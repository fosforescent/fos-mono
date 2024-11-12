


export const publicRuntimeConfig = process.env?.['NODE_ENV'] === 'development' 
  ? {
      apiUrl: `http://localhost:3000`,
      baseUrl: `http://localhost:5173`
  }
  : {
    apiUrl: `http://localhost:3000`,
    baseUrl: `http://localhost:5173`
  }
    