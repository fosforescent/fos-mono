import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import { FosSettingsPage }  from './components/settings'

import { createBrowserRouter, RouterProvider } from "react-router-dom"
import InboxView from './components/messaging/InboxView'
import GroupDirectory from './components/messaging/GroupDirectory'

import './global.css'
import './App.css'

declare const __FOS_API_URL__: string;


const apiUrl = __FOS_API_URL__ || "http://localhost:4000"

declare global {
  interface Window { 
    Fos: {
      ws: WebSocket;
      apiUrl: string;
    }; 
  }
}

window.Fos = window.Fos || {  
  apiUrl
};


const router = createBrowserRouter([
  {
    path: "/",
    element: (<App />),

    children: [
      {
        index: true,
        element: <InboxView />
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
