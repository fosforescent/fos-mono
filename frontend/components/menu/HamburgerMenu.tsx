import React, { useState, useEffect } from 'react'

import { Button } from "@/components/ui/button"

import { logo } from "../../assets"

import { Input } from "@/components/ui/input"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet"


import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

import {
  CheckCircle2,
  CircleEllipsis,
  Undo2,
  Redo2,
  // MenuSquare,
  Menu,
  Send,
  LogOut,
  HardDrive,
  Cloud
} from 'lucide-react'




import { Account } from './Account'
import { Textarea } from '@/components/ui/textarea'

import { AppState, FosReactOptions } from '@fosforescent/shared/types'
import { getActions } from '@/lib/actions'
import { NavLink } from "react-router-dom";
import { cn } from '@/lib/utils'
import { LoginRegister } from './loggedOut'
import { TopButtons } from './TopButtons'



const HamburgerMenu = ({
  emailConfirmationToken,
  passwordResetToken,
  showTerms,
  showPrivacy,
  showCookieConsent,
  showClearData,
  showDeleteAccount,
  setShowTerms,
  setShowPrivacy,
  setShowCookieConsent,
  setShowClearData,
  setShowDeleteAccount,
  setShowEmailConfirm,
  data: appState,
  setData,
  options,
  menuOpen,
  setMenuOpen
}: {
  emailConfirmationToken?: string,
  passwordResetToken?: string,
  showTerms: { open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void },
  showPrivacy: { open: boolean, fromRegisterForm: boolean },
  showCookieConsent: boolean,
  showClearData: boolean,
  showDeleteAccount: boolean,
  setShowTerms: (showTerms: { open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void }) => void
  setShowPrivacy: (showPrivacy: { open: boolean, fromRegisterForm: boolean }) => void
  setShowCookieConsent: (showCookieConsent: boolean) => void
  setShowClearData: (showClearData: boolean) => void
  setShowDeleteAccount: (showDeleteAccount: boolean) => void
  setShowEmailConfirm: (showEmailConfirm: { open: boolean, email: string }) => void,
  data: AppState
  setData: (data: AppState) => void
  options: FosReactOptions
  menuOpen: boolean,
  setMenuOpen: (open: boolean) => void
}) => {


  const { sendMessage, logOut, loggedIn } = getActions(options, appState, setData)



  const [messageEmail, setMessageEmail] = useState(appState.auth.email || '')
  const [message, setMessage] = useState('')


  useEffect(() => {
    if (!messageEmail && appState.auth.email) {
      setMessageEmail(appState.auth.email)
    }
  }, [appState.auth.email])


  const handleMessageEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {

    // validate email
    const email = e.target.value


    setMessageEmail(e.target.value)
  }


  const handleSendMessage = () => {
    console.log('sending message', message)
    sendMessage(messageEmail, message).then(() => {
      setMessage('')
      setMessageEmail('')
    })
  }

  const [accordionValue, setAccordionValue] = useState(loggedIn() ? "nav" : "account")

  const navLinks = [
    { to: '/inbox', label: 'Inbox', testId: 'menu-inbox', show: loggedIn(), end: true },
    { to: '/groups', label: 'Groups', testId: 'menu-groups', show: loggedIn() },
    { to: '/settings', label: 'Settings', testId: 'menu-settings', show: loggedIn(), end: true }
  ]


  useEffect(() => {
    if (!loggedIn()) {
      setAccordionValue('account')
    }
  }, [appState])



  return (
    <div
      className={`flex space-between p-5 pb-2 w-full justify-between border-teal-100/30 overflow-x-hidden`}
      style={{
        boxSizing: 'border-box',
        // boxShadow: '0 0 10px 0 rgba(200,255,230,1)',
      }} >
      <div className={`flex pl-1`}>

        <div className={`px-3`}>
          <img src={logo.logo} alt="Fosforescent" className="h-7" /></div>
        Fosforescent
        {appState.loaded && <TopButtons
          data={appState}
          setData={setData}
          nodeRoute={appState.data.fosData.route}
          options={options}
        />}
      </div>
      <div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            data-testid="hamburger-menu"
            aria-label="Open navigation menu"
            className="hidden md:inline-flex"
          >
            <Menu />
          </SheetTrigger>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-10 w-10"
            data-testid="mobile-menu-toggle"
            aria-label="Open navigation menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu />
          </Button>
          <SheetContent
            className="md:min-w-[80%] sm:min-w-full flex flex-col justify-start gap-5 !border-none"
            side={'left'}
            aria-description='Fos Menu'
            data-testid="mobile-menu"
          >
            {/* <SheetHeader className="mb-10">
              Fos
            </SheetHeader> */}
            <SheetTitle className={`flex flex-row`}>
              <div className={`px-3`}><img src={logo.logo} alt="Fosforescent" className="h-7" /></div>
              Fosforescent
            </SheetTitle>
            <SheetDescription className="hidden">Menu</SheetDescription>

            {/* Offline Mode Indicator */}
            {appState.info?.offlineMode && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-md text-sm">
                <HardDrive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-amber-700 dark:text-amber-300">
                  Working offline
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800"
                  onClick={() => setAccordionValue('account')}
                >
                  <Cloud className="h-4 w-4 mr-1" />
                  Sign in to sync
                </Button>
              </div>
            )}

            {appState.loaded && (<><hr className={`my-5`} />
              <div className={`py-1`}>

                <Input type="search" placeholder="Search" className="w-full" />
              </div>

              <hr className={`my-5`} /></>)}



            <Accordion type="single" className="w-full" value={accordionValue} onValueChange={setAccordionValue} collapsible>


              {appState.loaded && <AccordionItem value="nav">
                <AccordionTrigger>Nav </AccordionTrigger>
                <AccordionContent>
                  {loggedIn() && (<div className="grow h-full">
                    <nav className="p-4 space-y-2 flex flex-col justify-center h-full">
                      {navLinks.filter((link) => link.show).map((link) => (
                        <Button
                          key={link.testId}
                          asChild
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => setMenuOpen(false)}
                        >
                          <NavLink
                            to={link.to}
                            data-testid={link.testId}
                            className={({ isActive }) =>
                              cn(
                                "w-full",
                                isActive && "bg-accent text-accent-foreground"
                              )
                            }
                            end={link.end}
                          >
                            {link.label}
                          </NavLink>
                        </Button>
                      ))}
                    </nav>

                  </div>)}
                </AccordionContent>
              </AccordionItem>}
              <AccordionItem value="account">
                <AccordionTrigger data-testid="menu-account">Account </AccordionTrigger>
                <AccordionContent>
                  {!loggedIn()
                    ? <LoginRegister
                      emailConfirmationToken={emailConfirmationToken}
                      passwordResetToken={passwordResetToken}
                      setShowTerms={setShowTerms}
                      setShowPrivacy={setShowPrivacy}
                      setAccordionValue={setAccordionValue}
                      data={appState}
                      setData={setData}
                      options={options}
                    />
                    : <div>
                      <Button variant="destructive" onClick={logOut}><LogOut /></Button><br />
                    </div>}
                </AccordionContent>
              </AccordionItem>
              {/* <AccordionItem value="settings">
                <AccordionTrigger>Settings</AccordionTrigger>
                <AccordionContent>
                  <Settings />
                </AccordionContent>
              </AccordionItem> */}
              <AccordionItem value="about">
                <AccordionTrigger>About / Privacy</AccordionTrigger>
                <AccordionContent>
                  <DescriptionComponent />

                  <div>
                    <Button variant="link" onClick={() => setShowPrivacy({ open: true, fromRegisterForm: false })}>Privacy Policy</Button><br />
                    <Button variant="link" onClick={() => setShowTerms({ open: true, fromRegisterForm: false, setAcceptTerms: (accept: boolean) => { console.log("accept terms: ", accept); } })}>Terms of Service</Button><br />
                    <Button variant="link" onClick={() => setShowCookieConsent(true)}>Cookie Policy</Button><br />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="help">
                <AccordionTrigger data-testid="menu-help">Contact</AccordionTrigger>
                <AccordionContent>
                  <div className='p-3'>
                    <Input type='email' placeholder='Your email' className='my-3' value={messageEmail} onChange={handleMessageEmailChange} />
                    <Textarea placeholder='Your message' className='my-3' value={message} onChange={(e) => setMessage(e.target.value)} />
                    <Button variant="secondary" onClick={handleSendMessage}><Send /></Button><br />
                  </div>
                </AccordionContent>

                {/* <AccordionContent>
                <div className='p-3'>
                  <a href='https://buy.stripe.com/8wMdSz0rT6AKejKcMM' target='_blank' className={`${buttonVariants({ variant: "ghost" })} bg-emerald-900 `}>Tip $1 or more</a>
                </div>
                <div className='p-3 h-32 w-32'>
                  <img src={images.btcCode} alt="btc-qrcode" className='object-stretch shrink-1' />
                </div>
                <div className='p-3 h-32 w-32'>
                  <img src={images.ethCode} alt="eth-qrcode" className='object-stretch shrink-1' />
                </div>
                </AccordionContent> */}
              </AccordionItem>
            </Accordion>
          </SheetContent>
        </Sheet>
      </div>

    </div>
  )
}

export default HamburgerMenu






const DescriptionComponent = () => {

  return (<>
    <a href='/' target='_blank' className='underline text-slate-400' >Fosforescent</a>&nbsp;
    is trying to become a visual programming language that intertwines human, computer,
    and AI instructions providing you with an interface to make your next steps clear, automate away your tedious tasks, and allow
    efficient decentralized planning and coordination
  </>)
}


