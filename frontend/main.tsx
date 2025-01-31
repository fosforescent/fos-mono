import React, { createContext, useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import { TreeView } from './components/views/tree/TreeLayout'
import { FosSettingsPage }  from './components/settings'

import { createBrowserRouter, RouterProvider } from "react-router-dom"
import TodoQueue from './components/views/QueueLayout'


import { PinBoard } from './components/home/Pins'
import { InfoHome } from './components/info/Info'
import { MarketBrowse } from './components/home/MarketBrowse'
import QueueView from './components/views/QueueLayout'
import { FieldTest } from '@/frontend/mockups/interactionMockups'

import './global.css'
import './App.css'
import { QueryView } from './components/views/QueryLayout'
import { BrowseView } from './components/views/BrowseLayout'

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
        // loader data
        element: <BrowseView />,
        loader: async () => {
          return {
            route: [],
          }
        }

      },
      {
        // Route should be [["root", "myRootId"]]
        // Should route to queue view.. 
        // how to route there?  Just set app state in app based on routes? 
        path: "inbox",
        element: <QueueView />,
        loader: async () => {
          return {
            route: [],
          }
        }
      },
      {
        path: "market",
        // Route should be [["root", "myRootId"], ["group", "everyoneRootid"], ["browse", "{filters? workflow}"]]
        // browsing services... anything workflows published to everyone
        // so this is filtering based on workflows 
        children: [
          {
            index: true,
            element: <BrowseView />,
            loader: async () => {
              return {
                route: [["group", "everyoneRootid"]],
              }
            },
    
          },
        ]
      },
      {
        path: "agora",
        // Route should be [["root", "myRootId"], ["group", "everyoneRootid"], ["queue", "{filters? comments}"]]
        // Route could also be [["root", "myRootId"], ["group", "everyoneRootid"], ["queue", "{filters? none}"]]
        children: [
          {
            index: true,
            element: <QueueView />,
            loader: async () => {
              return {
                route: [["group", "everyoneRootid"]],
              }
            },
    
          },
        ]
      },
      {
        path: "folders",
        // Route should be [["root", "myRootId"], ["group", "everyoneRootid"], ["queue", "{filters? comments}"]]
        // Route could also be [["root", "myRootId"], ["group", "everyoneRootid"], ["queue", "{filters? none}"]]
        children: [
          {
            index: true,
            element: <TreeView />,
            loader: async () => {
              return {
                route: [],
              }
            },
    
          },
        ]
      },
      // {
      //   path: "groups",
      //   // Route should be [["root", "myrootid"], ["browse", "{filters? group}"]]
      //   // browsing groups... upon clicking, 
      //   // route would go to [["root", "myrootid"], ["group", "groupRootId"], ["queue", "{filters? comments}"]]
      //   children: [
      //     {
      //       index: true,
      //       element: <GroupsBrowse />,
      //       loader: async () => {
      //         return {
      //           route: [["root", "myRootId"]],
      //         }
      //       },
    
      //     },
      //   ]
      // },
      // ,
      {
        path: "search",
        // Route should be [["root", "myrootid"]] // "browse", "{filters? none}"
        // browsing groups... upon clicking, 
        // route would go to [["root", "myrootid"], ["group", "groupRootId"]] /// "queue", "{filters? comments}"
        children: [
          {
            index: true,
            element: <QueryView />,
            loader: async () => {
              return {
                route: [],
              }
            },
    
          },
        ]
      },
      // {
      //   // Route should be [["root", "myrootid"]  // Routed to browse view
      //   path: "info",
      //   children: [
      //     {
      //       index: true,
      //       element: <BrowseView />,
      //       // loader: async () => {
      //       //   return {
      //       //     route: [["root", "myRootId"]],
      //       //   }
      //       // },
    
      //     },
      //   ]
      // },
      {
        // Route should be [["root", "myrootid"]  // Routed to browse view
        path: "info",
        children: [
          {
            index: true,
            element: <BrowseView />,
            // loader: async () => {
            //   return {
            //     route: [["root", "myRootId"]],
            //   }
            // },
    
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
