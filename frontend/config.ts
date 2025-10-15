


export const publicRuntimeConfig = {
  // Use localhost:4000 for browser access, backend:80 only works in Docker network
  apiUrl: import.meta.env.VITE_FOS_API_URL || `http://localhost:4000`,
  baseUrl: import.meta.env.VITE_BASE_URL || `http://localhost:5173`
}
    

  