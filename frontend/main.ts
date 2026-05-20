/**
 * Fosforescent - Vanilla TypeScript Entry Point
 *
 * Replaces React with direct DOM manipulation for simpler, faster UI.
 */

import { FosApp, createFosApp } from './vanilla';
import { publicRuntimeConfig } from './config';
import { queueMutation } from './lib/offline/sync-queue';
import { syncManager } from './lib/offline/sync-manager';

import './vanilla/styles.css';

// ============================================================================
// Console capture for Tauri - logs to both console and Tauri's log system
// ============================================================================
const setupConsoleCapture = () => {
  const isTauri = '__TAURI__' in window;
  if (!isTauri) return;

  const logs: string[] = [];
  const maxLogs = 1000;

  const formatArgs = (args: any[]): string => {
    return args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  };

  const captureLog = (level: string, originalFn: (...args: any[]) => void) => {
    return (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const message = `[${timestamp}] [${level}] ${formatArgs(args)}`;
      logs.push(message);
      if (logs.length > maxLogs) logs.shift();

      // Call original
      originalFn.apply(console, args);

      // Try to send to Tauri
      try {
        const tauri = (window as any).__TAURI__;
        if (tauri?.core?.invoke) {
          tauri.core.invoke('log_frontend', { level, message: formatArgs(args) }).catch(() => {});
        }
      } catch {}
    };
  };

  console.log = captureLog('LOG', console.log.bind(console));
  console.warn = captureLog('WARN', console.warn.bind(console));
  console.error = captureLog('ERROR', console.error.bind(console));

  // Expose logs for debugging
  (window as any).fosLogs = () => logs.join('\n');
  (window as any).fosClearLogs = () => { logs.length = 0; };
};

setupConsoleCapture();

// Verify console capture is working
console.log('[Main] Console capture initialized - this message should appear in Tauri logs');

const apiUrl = publicRuntimeConfig.apiUrl;

declare global {
  interface Window {
    Fos: {
      ws?: WebSocket;
      apiUrl: string;
      swRegistration?: ServiceWorkerRegistration;
      app?: FosApp;
    };
  }
}

window.Fos = window.Fos || {
  apiUrl
};

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      window.Fos.swRegistration = registration;
      console.log('[Main] Service worker registered:', registration.scope);

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[Main] New service worker available');
            }
          });
        }
      });
    } catch (error) {
      console.error('[Main] Service worker registration failed:', error);
    }
  });

  // Handle messages from service worker
  navigator.serviceWorker.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    switch (type) {
      case 'QUEUE_MUTATION':
        if (payload && payload.cid && payload.content) {
          await queueMutation({
            operation: 'update',
            cid: payload.cid,
            content: payload.content
          });
        }
        break;

      case 'SYNC_NOW':
      case 'SYNC_AVAILABLE':
        syncManager.syncNow();
        break;

      default:
        console.log('[Main] Unknown message from service worker:', type);
    }
  });
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Main] DOMContentLoaded - starting vanilla app initialization');

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.error('[Main] Root element not found');
    return;
  }

  console.log('[Main] Root element found, creating FosApp');

  // Create the vanilla app
  const app = createFosApp(rootEl, { autoLoad: true });

  // Expose app globally for debugging and Tauri integration
  window.Fos.app = app;

  console.log('[Main] Fosforescent vanilla app initialized successfully');
  console.log('[Main] Version: vanilla-2024-05-18-v2'); // Version marker to verify code is updated
});
