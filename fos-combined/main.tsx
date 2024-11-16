import React, { createContext, useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import TrellisMain from './components/workflow/trellis/main'
import { FosSettingsPage }  from './components/settings'

import { createBrowserRouter, RouterProvider } from "react-router-dom"
import TodoQueue from './components/todo/Queue'


const apiUrl = "http://localhost:4000"

interface LoaderData {
  shouldOpenMenu: boolean;
  apiUrl: string;
}

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
        element: <div>Please Log In or Register to continue</div>,

      },
      {
        path: "workflows",
        element: <TrellisMain />
      },
      {
        path: "todos",
        children: [
          {
            index: true,
            element: <TodoQueue />,
    
          },
          {
            path: "workflows",
            element: <TrellisMain />
          },
        ]
      },
      {
        path: "settings",
        children: [
          {
            index: true,
            element: <FosSettingsPage />,
    
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






ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <RouterProvider router={router} future={{
        v7_startTransition: true,
      }} />
  </React.StrictMode>,
)
