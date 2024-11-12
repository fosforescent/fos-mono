import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import {

  ShieldQuestion

} from 'lucide-react'


import _ from 'lodash'

import { api } from "../../../api"
import { AppState, FosReactOptions } from "@/fos-combined/types"

export const ForgotPwdComponent = ({
  setMessage,
  data,
  setData,
  options
}: {
  setMessage: (message: { messageType: string, message: string }) => void
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {



  const appState = data;

  const [email, setEmail] = useState(appState.auth.email || '')
  const [validEmail, setValidEmail] = useState(true)

  const canSubmit = validEmail

  const handleEmailChange =(e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    const emailMatches = e.target.value.match(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/)
    if (emailMatches) {
      setValidEmail(true)
    } else {
      setValidEmail(false)
    }
  }


  const handleResetRequest = () => {
    console.log('reset request', email)
    const response = api(appState.apiUrl).public.resetPasswordRequest(email).then((response) => {  
      setMessage({ messageType: "success", message: "Password reset request sent" })
    }).catch((error) => {
      setMessage({ messageType: "error", message: "Password reset request failed" })
      throw error
    })
  }

  return (<>
    <CardContent className="space-y-2">
      <form>
        <div className="space-y-1">
          {/* <Label htmlFor="name">Name</Label> */}
          <Input id="username" placeholder="Username / Email" onChange={handleEmailChange} />
        </div>
      </form>
    </CardContent>
    <CardFooter className="flex justify-around">
      <Button className="bg-emerald-900 text-white" onClick={handleResetRequest} disabled={!canSubmit}><ShieldQuestion /></Button>
      {/* <Button className="bg-emerald-900 bg-orange-900" ><ShieldQuestion /></Button> */}
  </CardFooter></>)


}