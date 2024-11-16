import React, { useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"



import { ProfilePasswordLogout } from "./loggedIn"
import { LoginRegister } from "./loggedOut"
import { AppState, FosReactOptions } from "@/fos-combined/types"
import { getActions } from "@/fos-combined/lib/actions"

export function Account({
  passwordResetToken,
  emailConfirmationToken,
  setShowTerms,
  setShowEmailConfirm,
  setShowClearData,
  setShowPrivacy,
  setShowCookies,
  data,
  setData,
  options,
  setAccordionValue
} : {
  passwordResetToken?: string,
  emailConfirmationToken?: string,
  setShowTerms: (showTerms: {open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void}) => void
  setShowEmailConfirm: (showEmailConfirm: { open: boolean, email: string }) => void
  setShowClearData: (showClearData: boolean) => void
  setShowPrivacy: (showPrivacy: {open: boolean, fromRegisterForm: boolean, }) => void
  setShowCookies: (showCookies: boolean) => void
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions,
  setAccordionValue: (value: "nav" | "account" | "about" | "help") => void
}) {


  const { loggedIn } = getActions(options, data, setData)


  const [loading, setLoading] = useState(false)


  

  return (<div>
    {loading 
      ? <div>
        <Skeleton className="h-300 w-full" />
      </div>
      : <div className="w-full">{loggedIn() 
        ? <ProfilePasswordLogout 
          emailConfirmationToken={emailConfirmationToken}
          setShowClearData={setShowClearData}
          setShowEmailConfirm={setShowEmailConfirm}
          setShowCookies={setShowCookies}
          setLoading={setLoading}
          data={data}
          setData={setData}
          options={options}
           />

        : <LoginRegister 
          passwordResetToken={passwordResetToken} 
          emailConfirmationToken={emailConfirmationToken} 
          setLoading={setLoading}
          setShowTerms={setShowTerms} 
          setShowPrivacy={setShowPrivacy}
          setAccordionValue={setAccordionValue}
          data={data}
          setData={setData}
          options={options}
          />}</div>
    }
    
  </div>)
}

