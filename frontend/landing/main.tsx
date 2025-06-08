import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Home from '@/components/pages/Home.tsx'
import './App.css'
import './globals.css'

import {
  createHashRouter,
  RouterProvider,
} from "react-router-dom";

import { ThemeProvider } from '@/components/theme-provider'

import ErrorPage from "@/components/pages/Error";

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <App><ErrorPage /></App>,
    children: [
      {
        path: "/",
        element: <Home position="" />,
      },
      {
        path: "/contact",
        element: <Home position="contact" />,
      },
      {
        path: "/uses",
        element: <Home position="uses" />,
      },
      {
        path: "/register",
        element: <Home position="register" />,
      },
      {
        path: "/about",
        element: <Home position="about" />,
      },
    ]
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
)
