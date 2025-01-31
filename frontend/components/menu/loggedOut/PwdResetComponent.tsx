
import React, { useEffect, useState } from "react"
import { Button } from "@/frontend/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/frontend/components/ui/card"
import { Input } from "@/frontend/components/ui/input"
import { Label } from "@/frontend/components/ui/label"



import {
  SaveIcon,
  RotateCcw,
} from 'lucide-react'
import { AppState, FosReactOptions } from "@/shared/types"
import { getActions } from "@/frontend/lib/actions"


export const PwdResetComponent = ({
  setMessage,
  passwordResetToken,
  data,
  setData,
  options

}: {
  setMessage: (message: { messageType: string, message: string }) => void
  passwordResetToken: string
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  

  const [confirm, setConfirm] = useState('')
  const [pwdsMatch, setPwdsMatch] = useState(true)
  const [pwdValid, setPwdValid] = useState(true)
  const canSubmit = pwdValid && pwdsMatch
  

  const {  resetPassword,  } = getActions(options, data, setData)

  // console.log('passwordResetToken', passwordResetToken)

  const handleResetRequest = () => {
    resetPassword(email, password, passwordResetToken).then(() => {
      setMessage({ messageType: "success", message: "Password reset successfully" }) 
      window.history.replaceState({}, document.title, window.location.pathname);
    }).catch((error: Error) => {
      setMessage({ messageType: "fail", message: error.message })
      window.history.replaceState({}, document.title, window.location.pathname);
    })
  }

  const handlePwdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    // const pwdMatches = e.target.value.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/)
    const pwdMatches = e.target.value.match(/^.*$/)
    if (pwdMatches) {
      setPwdValid(true)
    } else {
      setPwdValid(false)
    }
  }


  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }


  const checkSame = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirm(e.target.value)
    if (e.target.value === password) {
      setPwdsMatch(true)
    } else {
      setPwdsMatch(false)
    }
  }


  return (
    <>
      <form onSubmit={(e) => e.preventDefault()}>
    <CardContent className="space-y-2 pt-3">
      <div className="space-y-1">
        {/* <Label htmlFor="current">Email</Label> */}
        <Input id="current" type="text" value={email} onChange={handleEmailChange} placeholder="Email" className="text-base"/>
      </div>
      <div className="space-y-1">
        {/* <Label htmlFor="new-pass">New password</Label> */}
        <Input id="new-pass" type="password" value={password} onChange={handlePwdChange} placeholder="New Password" className="text-base" />
      </div>
      <div className="space-y-1">
        {/* <Label htmlFor="confirm-pass">Confirm new password</Label> */}
        <Input id="confirm-pass" type="password" value={confirm} onChange={checkSame} placeholder="Confirm New Password" className="text-base" />
      </div>
    </CardContent>
    <CardFooter className="flex justify-around">
    <Button className="bg-emerald-900 text-white" onClick={handleResetRequest} disabled={!canSubmit} title="Reset Password"><SaveIcon /></Button>
    </CardFooter>
    </form>
  </>
  )
}
