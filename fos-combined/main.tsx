import React, { createContext, useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import WorkflowMain from './components/workflow/trellis/main'
import { FosSettingsPage }  from './components/settings'

import { createBrowserRouter, RouterProvider } from "react-router-dom"
import TodoQueue from './components/todo/Queue'
import { TodoTree } from './components/todo/Tree'
import { GroupForum } from './components/groups/Forum'
import { PinBoard } from './components/home/Pins'
import { InfoHome } from './components/info/Info'
import { MarketBrowse } from './components/market/MarketBrowse'


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
        element: <PinBoard />,

      },
      {
        path: "workflow",
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
        path: "group",
        children: [
          {
            index: true,
            element: <GroupForum />,
    
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
