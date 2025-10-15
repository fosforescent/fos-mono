


// Detect if we're in production by checking the hostname
const isProduction = typeof window !== 'undefined' &&
  (window.location.hostname === 'fosforescent.com' ||
   window.location.hostname === 'www.fosforescent.com' ||
   window.location.hostname.includes('storage.googleapis.com'));

export const publicRuntimeConfig = {
  // Use localhost:4000 for browser access, backend:80 only works in Docker network
  // In production (when hosted on GCP), use the custom domain
  apiUrl: import.meta.env.VITE_FOS_API_URL ||
    (isProduction ? 'https://api.fosforescent.com' : 'http://localhost:4000'),
  baseUrl: import.meta.env.VITE_BASE_URL ||
    (isProduction ? `https://${typeof window !== 'undefined' ? window.location.hostname : 'fosforescent.com'}` : 'http://localhost:5173')
}
    

  