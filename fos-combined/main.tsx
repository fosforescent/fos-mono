import React, { createContext, useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import TrellisMain from './components/trellis/main'


import { createBrowserRouter, RouterProvider } from "react-router-dom"
import TodoQueue from './todo/Queue'


const apiUrl = "http://localhost:4000"

interface LoaderData {
  shouldOpenMenu: boolean;
  apiUrl: string;
}

declare global {
  interface Window { Fos: any; }
}

window.Fos = window.Fos || {};



const router = createBrowserRouter([
  {
    path: "/",
    element: (<App />),

    loader: async ({ request }) => {
      // You can check the URL and return data
      const url = new URL(request.url);
      return { 
        shouldOpenMenu: url.pathname === "/", 
        apiUrl
      };
    },
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
        // element: <App />,
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
      }
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
