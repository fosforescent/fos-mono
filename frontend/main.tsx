import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import { FosSettingsPage }  from './components/settings'

import { createBrowserRouter, RouterProvider } from "react-router-dom"
import InboxView from './components/messaging/InboxView'
import GroupDirectory from './components/messaging/GroupDirectory'
import WorkspaceView from './components/views/WorkspaceView'

import './global.css'
import './App.css'
import { publicRuntimeConfig } from './config'
import { queueMutation } from './lib/offline/sync-queue'
import { syncManager } from './lib/offline/sync-manager'

const apiUrl = publicRuntimeConfig.apiUrl

declare global {
  interface Window {
    Fos: {
      ws: WebSocket;
      apiUrl: string;
      swRegistration?: ServiceWorkerRegistration;
    } | {
      apiUrl: string;
      swRegistration?: ServiceWorkerRegistration;
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
              // New version available
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
        // Service worker asked us to queue a mutation
        if (payload && payload.cid && payload.content) {
          await queueMutation({
            operation: 'update',
            cid: payload.cid,
            content: payload.content
          });
        }
        break;

      case 'SYNC_NOW':
        // Service worker triggered a sync (e.g., from Background Sync)
        syncManager.syncNow();
        break;

      case 'SYNC_AVAILABLE':
        // Server has new data available
        syncManager.syncNow();
        break;

      default:
        console.log('[Main] Unknown message from service worker:', type);
    }
  });
}


const router = createBrowserRouter([
  {
    path: "/",
    element: (<App />),

    children: [
      {
        index: true,
        element: <WorkspaceView />
      },
      {
        path: "workspace",
        element: <WorkspaceView />
      },
      {
        path: "inbox",
        element: <InboxView />
      },
      {
        path: "groups",
        children: [
          {
            index: true,
            element: <GroupDirectory />
          },
        ]
      },
      {
        // Route should be [["root", "myrootid"]  // Routed to browse view
        path: "settings",
        children: [
          {
            index: true,
            element: <FosSettingsPage />,
            // loader: async () => {
            //   return {
            //     route: [["root", "myRootId"]],
            //   }
            // },

          },
        ]
      },

    ]
  }
], {
  future: {
    v7_fetcherPersist: true,
    v7_relativeSplatPath: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
})



// ReactDOM.createRoot(document.getElementById('root')!).render(
//   <React.StrictMode>
//       <FieldTest />
//   </React.StrictMode>,
// )


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <RouterProvider router={router} future={{
        v7_startTransition: true,
      }} />
  </React.StrictMode>,
)
