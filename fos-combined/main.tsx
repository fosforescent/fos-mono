import React, { createContext, useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import TrellisMain from './components/trellis/main'


import { createBrowserRouter, RouterProvider } from "react-router-dom"

const apiUrl = "http://localhost:4000"

interface LoaderData {
  shouldOpenMenu: boolean;
  apiUrl: string;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
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
        element: <TrellisMain />
      }
    ]
  }
])


interface WebSocketContextType {
  send: (message: any) => void;
  messages: any[];
  connected: boolean;

}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider = ({ url, children }: { url: string; children: React.ReactNode }) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(url);
    socket.onopen = () => setConnected(true);
    socket.onmessage = (e) => setMessages(prev => [...prev, JSON.parse(e.data)]);
    setWs(socket);
    return () => socket.close();
  }, [url]);

  const send = (message: any) => ws?.send(JSON.stringify(message));

  return (
    <WebSocketContext.Provider value={{ send, messages, connected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
  return context;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebSocketProvider url="ws://localhost:4000">
      <RouterProvider router={router} />
    </WebSocketProvider>
  </React.StrictMode>,
)
