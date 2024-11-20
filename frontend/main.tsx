import React, { createContext, useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import WorkflowMain from './components/views/trellis/main'
import { FosSettingsPage }  from './components/settings'

import { createBrowserRouter, RouterProvider } from "react-router-dom"
import TodoQueue from './components/views/Queue'
import { TodoTree } from './components/inbox/Tree'

import { PinBoard } from './components/home/Pins'
import { InfoHome } from './components/info/Info'
import { MarketBrowse } from './components/market/MarketBrowse'
import QueueView from './components/views/Queue'


declare const __FOS_API_URL__: string;


const apiUrl = __FOS_API_URL__ || "http://localhost:4000"

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
        element: <PinBoard />,

      },
      {
        path: "tree",
        element: <WorkflowMain />
      },
      {
        path: "todo",
        children: [
          {
            index: true,
            element: <TodoQueue />,
 
          },
          {
            path: "tree",
            element: <TodoTree />
          },
        ]
       },
      {
        path: "market",
        children: [
          {
            index: true,
            element: <MarketBrowse />,
    
          },
        ]
      },
      {
        path: "queue",
        children: [
          {
            index: true,
            element: <QueueView />,
    
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
      {
        path: "info",
        children: [
          {
            index: true,
            element: <InfoHome />,
    
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
