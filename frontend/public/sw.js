/// <reference lib="webworker" />

const CACHE_NAME = 'fos-offline-v1';
const STATIC_CACHE = 'fos-static-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle API requests
  if (url.pathname.startsWith('/user/data')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Handle static assets with stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

/**
 * Handle API requests with offline support
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);

  // For POST requests when offline, queue the mutation
  if (request.method === 'POST' && !navigator.onLine) {
    try {
      const body = await request.clone().json();
      await queueMutation(body);
      return new Response(JSON.stringify({ queued: true, offline: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[SW] Error queuing mutation:', error);
      return new Response(JSON.stringify({ error: 'Failed to queue mutation' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // For GET requests, try network first, then cache
  if (request.method === 'GET') {
    try {
      const networkResponse = await fetch(request);

      // Cache successful GET responses
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    } catch (error) {
      // Network failed, try cache
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('[SW] Returning cached API response for:', url.pathname);
        return cachedResponse;
      }

      // No cache, return offline error
      return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // For other requests, try network
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Network error', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Stale-while-revalidate strategy for static assets
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  // Start network fetch in background
  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // Wait for network if no cache
  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  // Return a basic offline page
  return new Response('<!DOCTYPE html><html><body><h1>Offline</h1></body></html>', {
    status: 503,
    headers: { 'Content-Type': 'text/html' }
  });
}

/**
 * Queue a mutation for later sync
 * This communicates with the main thread via postMessage
 */
async function queueMutation(data) {
  // Broadcast to all clients that a mutation needs to be queued
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'QUEUE_MUTATION',
      payload: data
    });
  });
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

// Handle sync events (Background Sync API)
self.addEventListener('sync', (event) => {
  if (event.tag === 'fos-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(notifyClientsToSync());
  }
});

/**
 * Notify clients to perform sync
 */
async function notifyClientsToSync() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_NOW'
    });
  });
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log('[SW] Push received:', data);

    // Could show notification about sync status, new data, etc.
    if (data.type === 'SYNC_AVAILABLE') {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_AVAILABLE', payload: data });
        });
      });
    }
  }
});

console.log('[SW] Service worker loaded');
