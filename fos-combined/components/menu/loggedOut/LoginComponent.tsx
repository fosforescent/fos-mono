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
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { Checkbox } from "@/components/ui/checkbox"

import {
  User,
  KeyRound,
  DoorClosed,
  DoorOpen,
  BookKey,
  LogIn,
  LogOut,
  SaveAllIcon,
  SaveIcon,
  RotateCcw,
  Settings,
  ShieldQuestion
} from 'lucide-react'


import _ from 'lodash'
import { Form } from "@/components/ui/form"
import { getActions } from "@/fos-combined/lib/actions"
import { AppState, FosReactOptions } from "@/fos-combined/types"



export const LoginComponent = ({
  setMessage,
  setForgot,
  data,
  setData,
  options
}: {
  setMessage: (message: { messageType: string, message: string }) => void
  setForgot: (forgot: boolean) => void
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {

  const {  logIn,  } = getActions(options, data, setData)


  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  

  const [emailValid, setEmailValid] = useState(true)

  const [remember, setRemember] = useState(false)

  const canSubmit = emailValid 


  const handleLogin = () => {
    console.log('login, email', email, password);
    
    logIn(email, password, remember).then(() => {
      // window.Fos.ws.
      setMessage({ messageType: "success", message: "Logged In Successfully" })
    }).catch((error: Error) => {
      console.log('login error', error)
      if (error.message === 'Failed to fetch') {
        setMessage({ messageType: "fail", message: "Could not connect to server" })
      } else {
        setMessage({ messageType: "fail", message: error.message })
      }

    })
  }

  const handlePwdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    // console.log('password', password)
  }


  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const emailMatches = e.target.value.match(/^.*$/)
    if (emailMatches) {
      setEmailValid(true)
    } else {
      setEmailValid(false)
    }
    setEmail(e.target.value)
  }


  const handleForgotPassword = () => {
    setForgot(true)
    console.log('forgot password')
  }




  return (<>
  <form onSubmit={(e) => e.preventDefault()}>
    <CardContent className="space-y-2 pt-3">
      <div className="space-y-1">
        {/* <Label htmlFor="name">Name</Label> */}
        <Input id="username" placeholder="Email" onChange={handleEmailChange} className="text-base"/>
      </div>
      <div className="space-y-1">
        {/* <Label htmlFor="username">Username</Label> */}
        <Input id="password" placeholder="Password" onChange={handlePwdChange} type="password" className="text-base" />
      </div>
      <div>
        <Button variant={"ghost"} onClick={handleForgotPassword}>Forgot Password?</Button>
      </div>
      <div className="pt-5 text-slate-500">
          <Checkbox id="remember" name="remember" checked={remember} onClick={() => setRemember(!remember)}/>
          <Label htmlFor="remember" className="ml-2">
            Remember Username
          </Label>
      </div>
    </CardContent>
    <CardFooter className="flex justify-around">
      <Button className="bg-emerald-900 text-white" onClick={handleLogin} disabled={!canSubmit} title="Login"><LogIn /></Button>
      {/* <Button className="bg-emerald-900 bg-orange-900" ><ShieldQuestion /></Button> */}
    </CardFooter>
  </form></>)
}
