import React, { useState, useEffect } from 'react'

import { buttonVariants, Button } from "@/components/ui/button"


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
  Send
} from 'lucide-react'




import { Account } from './Account'
import { Textarea } from '@/components/ui/textarea'
import { App } from '@prisma/client'
import { AppState, FosReactOptions } from '@/fos-combined/types'
import { getActions } from '@/fos-combined/lib/actions'



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
  options
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
}) => {


  const { sendMessage } = getActions(options, appState, setData)

  const [menuOpen, setMenuOpen] = useState<boolean>(emailConfirmationToken || passwordResetToken ? true : false)



  
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

  const [accordionValue, setAccordionValue] = useState('account')


  return (
    <div 
      className={`flex space-between p-5 pb-2 w-full justify-between border-teal-100/30 overflow-x-hidden`}
      style={{
        boxSizing: 'border-box',
        // boxShadow: '0 0 10px 0 rgba(200,255,230,1)',
      }} >
      <div className={`flex pl-1`}>
        {/* {<TopButtons />}  */}
      </div>
      <div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger><Menu /></SheetTrigger>
          <SheetContent>
            <SheetHeader>
              Fos
            </SheetHeader>
            <SheetTitle>
              Settings
            </SheetTitle>

            <Accordion type="single" className="w-full" value={accordionValue} onValueChange={setAccordionValue}>
              <AccordionItem value="account">
                <AccordionTrigger>Account </AccordionTrigger>
                <AccordionContent>
                  <Account 
                    emailConfirmationToken={emailConfirmationToken} 
                    passwordResetToken={passwordResetToken}
                    setShowTerms={setShowTerms}
                    setShowClearData={setShowClearData}
                    setShowEmailConfirm={setShowEmailConfirm}
                    setShowPrivacy={setShowPrivacy}
                    setShowCookies={setShowCookieConsent}
                    data={appState}
                    setData={setData}
                    options={options}
                    />  
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


