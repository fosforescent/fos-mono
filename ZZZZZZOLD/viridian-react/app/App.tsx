import './App.css'
import './global.css'
import React, { useEffect, useState } from 'react'

import HamburgerMenu from '../components/menu/HamburgerMenu'


import { AppStateProvider, useAppState } from '../components/app-state/app-state'
import { Toaster } from "@/components/ui/toaster"
import { useTraceUpdate } from '../components/trace-update'
import { CookieDialog } from '../components/dialog/CookieDialog'
import { PrivacyPolicyDialog } from '../components/dialog/PrivacyPolicyDialog'
import { TermsDialog } from '../components/dialog/TermsDialog'
import { set } from 'lodash'
import { ConfirmClearData } from '../components/dialog/ConfirmClearData'
import { ConfirmDeleteUser } from '../components/dialog/ConfirmDeleteUser'
import { ConfirmEmailChange } from '../components/dialog/ConfirmEmailChange'
import { ErrorBoundary } from '../components/error-boundary'
import { HelpDrawer } from '../components/dialog/HelpDrawer'
import { useToast } from '@/components/ui/use-toast';
import { jwtDecode } from 'jwt-decode';
import { Mode } from '../api'



declare const __DEV_SYC_API_URL__: string;
declare const __PROD_SYC_API_URL__: string;




const App = (props: { 
  children: React.ReactNode
  appDescriptionComponent?: React.ReactNode
  topBarComponent?: React.ReactNode
  footerComponent?: React.ReactNode
  customApiUrl?: string
  mode: Mode
}) => {

  
  const [logOut, setLogout] = useState<() => Promise<void>>(async () => { /* console.log('logout not set') */});

  const jwt = localStorage.getItem('auth')

  const {
    username,
    exp
  } = jwt ? jwtDecode(jwt) as { username: string, exp: number } : { username: "", exp: 0 }


  
  
  const apiUrl = (() => {
    switch (props.mode) {
      case "production":
        return __PROD_SYC_API_URL__
      case "development":
        return __DEV_SYC_API_URL__
      case "custom":
        if (props.customApiUrl){
          return props.customApiUrl
        } else {
          throw new Error("custom mode requires customApiUrl")
        }
      default:
        return "http://localhost:4000"
    }  
  })()
  
  useEffect(() => {
    // console.log('apiUrl', apiUrl, props.mode)
  }, [apiUrl])
  

  return (
    <div className="viridian-root">
      {/* <ErrorBoundary toast={toast} logOut={logOut} email={username} mode={props.mode} apiUrl={apiUrl}> */}
        <AppStateProvider mode={props.mode} customApiUrl={props.customApiUrl}>
          <AppInner 
            setLogout={setLogout} 
            appDescriptionComponent={props.appDescriptionComponent} 
            topBarComponent={props.topBarComponent}
            footerComponent={props.footerComponent}
            >
            {props.children}
          </AppInner>
        </AppStateProvider>
        <Toaster />
      {/* </ErrorBoundary> */}
  </div>)
}


function AppInner<T>({
  setLogout,
  children,
  appDescriptionComponent,
  topBarComponent,
  footerComponent
  } : {
  setLogout: React.Dispatch<React.SetStateAction<() => Promise<void>>>
  children: React.ReactNode,
  appDescriptionComponent?: React.ReactNode,
  topBarComponent?: React.ReactNode,
  footerComponent?: React.ReactNode
}) {


  const { appState, setAppState, toast, logOut, authedApi } = useAppState()

  const [showCookieConsent, setShowCookieConsent] = useState(false)

  const [showTerms, setShowTerms] = useState({open: false, fromRegisterForm: false, setAcceptTerms: (accept: boolean) => {}})
  const [showPrivacy, setShowPrivacy] = useState({open: false, fromRegisterForm: false})

  const [showClearData, setShowClearData] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [showEmailConfirm, setShowEmailConfirm] = useState<{ open: boolean, email: string}>({ open: false, email: ""})

 
  // useEffect(() => {
  //   const showCookieDialog = (e: FocusEvent) => {
  //     // console.log('showCookieDialog', appState.info.cookies)

  //     if (!appState.info.cookies){
  //       setShowCookieConsent(true)
  //     }
  //   }
  //   if(!appState.info.cookies){
  //     // console.log('add event listener')
  //     window.addEventListener('focus', showCookieDialog);
  //     document.addEventListener('click', showCookieDialog);
  //   }
  //   return () => {
  //     window.removeEventListener('focus', showCookieDialog)
  //     document.removeEventListener('click', showCookieDialog)
  //   }

  // }, [appState.info.cookies, showCookieConsent, appState.data])




  useEffect(() => {
    if (appState.auth.jwt){
      setLogout(logOut)
    }
  }, [])


  const emailConfirmationToken = new URLSearchParams(window.location.search).get('confirm-email-token') || undefined
  const passwordResetToken = new URLSearchParams(window.location.search).get('reset-password-token') || undefined


 

  

  return (<><div className="App h-full" style={{ height: '100%', width: '100%', position: 'relative', textAlign: 'center', margin: '0 auto', overflowX: 'hidden' }}>
      <div style={{textAlign: 'left', boxSizing: 'border-box'}} className='w-full'>
        <HamburgerMenu 
          emailConfirmationToken={emailConfirmationToken} 
          passwordResetToken={passwordResetToken}
          setShowCookieConsent={setShowCookieConsent}
          setShowTerms={setShowTerms}
          setShowPrivacy={setShowPrivacy}
          showCookieConsent={showCookieConsent}
          showTerms={showTerms}
          showPrivacy={showPrivacy}
          showClearData={showClearData}
          showDeleteAccount={showDeleteAccount}
          setShowClearData={setShowClearData}
          setShowDeleteAccount={setShowDeleteAccount}
          setShowEmailConfirm={setShowEmailConfirm}
          topBarComponent={topBarComponent}
          appDescriptionComponent={appDescriptionComponent}
           />
        <div className="flex items-center justify-center h-full w-full" style={{overflowX: 'hidden' }}>
          {children}
        </div>
      </div>
        <div>
        <CookieDialog open={showCookieConsent} setOpen={setShowCookieConsent} />
        <PrivacyPolicyDialog open={showPrivacy} setOpen={(isOpen: boolean) => setShowPrivacy({ open: isOpen, fromRegisterForm: false } )} />
        <TermsDialog open={showTerms.open} setOpen={(isOpen: boolean) => { setShowTerms({ ...showTerms, open: isOpen }) }} setAcceptTerms={showTerms.setAcceptTerms} />
        <ConfirmClearData open={showClearData} setOpen={setShowClearData} />
        <ConfirmDeleteUser open={showDeleteAccount} setOpen={setShowDeleteAccount} />
        <ConfirmEmailChange open={showEmailConfirm.open} setOpen={(status: boolean) => { setShowEmailConfirm({...showEmailConfirm, open: status}) }} email={showEmailConfirm.email} />
      </div>
    </div>
    <div className="w-full relative">
      {footerComponent}
    </div>
</>)
}

export default App


