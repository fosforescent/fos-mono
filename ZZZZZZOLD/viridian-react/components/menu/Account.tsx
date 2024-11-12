import React, { useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"


import { useAppState } from "../app-state/app-state"

import { ProfilePasswordLogout } from "./loggedIn"
import { LoginRegister } from "./loggedOut"

export function Account({
  passwordResetToken,
  emailConfirmationToken,
  setShowTerms,
  setShowEmailConfirm,
  setShowClearData,
  setShowPrivacy,
  setShowCookies
} : {
  passwordResetToken?: string,
  emailConfirmationToken?: string,
  setShowTerms: (showTerms: {open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void}) => void
  setShowEmailConfirm: (showEmailConfirm: { open: boolean, email: string }) => void
  setShowClearData: (showClearData: boolean) => void
  setShowPrivacy: (showPrivacy: {open: boolean, fromRegisterForm: boolean, }) => void
  setShowCookies: (showCookies: boolean) => void
}) {


  const { loggedIn } = useAppState()


  const [loading, setLoading] = useState(false)


  

  return (<div>
    {loading 
      ? <div>
        <Skeleton className="h-300 w-full" />
      </div>
      : <div className="w-full">{loggedIn 
        ? <ProfilePasswordLogout 
          emailConfirmationToken={emailConfirmationToken}
          setShowClearData={setShowClearData}
          setShowEmailConfirm={setShowEmailConfirm}
          setShowCookies={setShowCookies}
          setLoading={setLoading} />

        : <LoginRegister 
          passwordResetToken={passwordResetToken} 
          emailConfirmationToken={emailConfirmationToken} 
          setLoading={setLoading}
          setShowTerms={setShowTerms} 
          setShowPrivacy={setShowPrivacy}
          />}</div>
    }
    
  </div>)
}

