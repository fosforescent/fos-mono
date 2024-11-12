import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { useAppState } from './components/app-state/app-state'


const Main = () => {

  const {
    loggedIn,
  } = useAppState()


  return (<App mode='custom' customApiUrl='https://localhost:3000'>
    <div>hello world</div>
  </App>)
}


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
)
