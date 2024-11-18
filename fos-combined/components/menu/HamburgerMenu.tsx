import React, { useState, useEffect } from 'react'

import { buttonVariants, Button } from "@/components/ui/button"

import LogoUrl from "../../assets/logo3-bare.png"

import { Input } from "@/components/ui/input"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
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
  LogOut
} from 'lucide-react'




import { Account } from './Account'
import { Textarea } from '@/components/ui/textarea'

import { AppState, FosReactOptions } from '@/fos-combined/types'
import { getActions } from '@/fos-combined/lib/actions'
import { NavLink } from "react-router-dom";
import { cn } from '@/lib/utils'
import { LoginRegister } from './loggedOut'


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
  showTerms: {open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void},
  showPrivacy: {open: boolean, fromRegisterForm: boolean},
  showCookieConsent: boolean,
  showClearData: boolean,
  showDeleteAccount: boolean,
  setShowTerms: (showTerms:{open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void}) => void
  setShowPrivacy: (showPrivacy: {open: boolean, fromRegisterForm: boolean }) => void
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
    if(!messageEmail && appState.auth.email){
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

  const [accordionValue, setAccordionValue] = useState(loggedIn() ? "": "account")


  useEffect(() => {
    if(!loggedIn()){
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
        <img src={LogoUrl} alt="Fosforescent" className="h-7" /></div>
              Fosforescent
        {/* {<TopButtons />}  */}
      </div>
      <div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger><Menu /></SheetTrigger>
          <SheetContent className="md:min-w-[80%] sm:min-w-full flex flex-col justify-around" side={'left'} aria-description='Fos Menu'>
            {/* <SheetHeader className="mb-10">
              Fos
            </SheetHeader> */}
            <SheetTitle className={`flex flex-row`}>
              <div className={`px-3`}><img src={LogoUrl} alt="Fosforescent" className="h-7" /></div>
              Fosforescent
            </SheetTitle>
            <SheetDescription className="hidden">Menu</SheetDescription>

            <hr  className={`my-5`} />

      
            {loggedIn() && (<div className="grow h-full">
              <nav className="p-4 space-y-2 flex flex-col justify-center h-full">
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setMenuOpen(false)}
                >
                  <NavLink
                    to="/todo"
                    className={({ isActive }) =>
                      cn(
                        "w-full",
                        isActive && "bg-accent text-accent-foreground"
                      )
                    }
                    end
                  >
                    Todos
                  </NavLink>
                </Button>     
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setMenuOpen(false)}
                >
                  <NavLink
                    to="/workflow"
                    className={({ isActive }) =>
                      cn(
                        "w-full",
                        isActive && "bg-accent text-accent-foreground"
                      )
                    }
                    end
                  >
                    Workflows
                  </NavLink>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setMenuOpen(false)}
                >
                  <NavLink
                    to="/market"
                    className={({ isActive }) =>
                      cn(
                        "w-full",
                        isActive && "bg-accent text-accent-foreground"
                      )
                    }
                    end
                  >
                    Market
                  </NavLink>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setMenuOpen(false)}
                >
                  <NavLink
                    to="/group"
                    className={({ isActive }) =>
                      cn(
                        "w-full",
                        isActive && "bg-accent text-accent-foreground"
                      )
                    }
                    end
                  >
                    Groups
                  </NavLink>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setMenuOpen(false)}
                  >
                  <NavLink
                    to="/info"
                    className={({ isActive }) =>
                      cn(
                        "w-full",
                        isActive && "bg-accent text-accent-foreground"
                      )
                    }
                    end
                  >
                    Info
                  </NavLink>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  onClick={() => setMenuOpen(false)}
                  className="w-full justify-start"
                >
                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      cn(
                        "w-full",
                        isActive && "bg-accent text-accent-foreground"
                      )
                    }
                    end
                  >
                    Settings
                  </NavLink>
                </Button>      
              </nav>

            </div>)}
            
            <Accordion type="single" className="w-full" value={accordionValue} onValueChange={setAccordionValue} collapsible>


              <AccordionItem value="account">
                <AccordionTrigger>Account </AccordionTrigger>
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
                  <Button variant="destructive" onClick={logOut}><LogOut /></Button><br/>
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
                    <Button variant="link" onClick={() => setShowPrivacy({ open: true, fromRegisterForm: false })}>Privacy Policy</Button><br/>
                    <Button variant="link" onClick={() => setShowTerms({ open: true, fromRegisterForm: false, setAcceptTerms: (accept: boolean) => { console.log("accept terms: ", accept); }})}>Terms of Service</Button><br/>
                    <Button variant="link" onClick={() => setShowCookieConsent(true)}>Cookie Policy</Button><br/>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="help">
                <AccordionTrigger>Contact</AccordionTrigger>
                <AccordionContent>
                  <div className='p-3'>
                    <Input type='email' placeholder='Your email' className='my-3' value={messageEmail} onChange={handleMessageEmailChange}/>
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


