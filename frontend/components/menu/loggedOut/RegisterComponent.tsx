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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/frontend/components/ui/tabs"

import { Checkbox } from "@/frontend/components/ui/checkbox"

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

import { Alert, AlertDescription, AlertTitle } from "@/frontend/components/ui/alert"

import _, { set } from 'lodash'
import { AppState, FosReactOptions } from "@/shared/types"
import { getActions } from "@/frontend/lib/actions"



export const RegisterComponent = ({
  setMessage,
  setShowTerms,
  setShowPrivacy,
  data,
  setData,
  options
}: {
  setMessage: (message: { messageType: string, message: string }) => void
  setShowTerms: (showTerms: {open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void}) => void
  setShowPrivacy: (showPrivacy: {open: boolean, fromRegisterForm: boolean }) => void
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {

  const { registerUser  } = getActions(options, data, setData)


  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  

  const [confirm, setConfirm] = useState('')
  const [pwdsMatch, setPwdsMatch] = useState(true)
  const [pwdValid, setPwdValid] = useState(true)
  const [emailValid, setEmailValid] = useState(true)

  const [acceptTerms, setAcceptTerms] = useState(false)

  const canSubmit = pwdValid && pwdsMatch && acceptTerms 

  const handleRegister = () => {

    if (acceptTerms && pwdsMatch && pwdValid){
      registerUser(email, password, acceptTerms).then((res) => {
        console.log('registerUser', res)
        setMessage({ messageType: "success", message: "Account created successfully" })
      }).catch((error: Error) => {
        console.log('error', error)
        if (error.message === 'Failed to fetch') {
          setMessage({ messageType: "fail", message: "Could not connect to server" })
        } else {
          setMessage({ messageType: "fail", message: error.message })
        }
      })
    } else {
      return 
    }
  }

  const handlePwdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    // const pwdMatches = e.target.value.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/)
    // const pwdMatches = e.target.value.match(/^.*$/)

    if (!/[A-Z]/.test(e.target.value) || !/[0-9]/.test(e.target.value)) {
      setPwdValid(false)
      setMessage({ messageType: "fail", message: "Password must contain at least one uppercase letter and one number" })
      return      
    }
    if (e.target.value.length < 8) {
      setPwdValid(false)
      setMessage({ messageType: "fail", message: "Password must be at least 8 characters long" })
      return 
    }

    setMessage({ messageType: "none", message: "" })
    setPwdValid(true)
  }


  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // match with email regex else set error message
    const emailMatches = e.target.value.match(/^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/)
    if (!emailMatches) {
      setEmailValid(false)
      setMessage({ messageType: "fail", message: "Invalid email address" })
    } else {
      setEmailValid(true)
      setMessage({ messageType: "none", message: "" })
    }

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

  const handleTermsClick = () => {
    setShowTerms({open: true, fromRegisterForm: true, setAcceptTerms})
  }

  const handlePrivacyClick = () => {
    setShowPrivacy({open: true, fromRegisterForm: true})
  }

  const handleAcceptClick = () => {
    console.log('acceptTerms', acceptTerms)
    setAcceptTerms(!acceptTerms)
    if (confirm === password && emailValid && pwdValid){
      setPwdsMatch(true)
    }else{
      setPwdsMatch(false)
    }
  }

  return (<form onSubmit={(e) => e.preventDefault()}>
    <CardContent className="space-y-2 pt-3">
      <div className="space-y-1">
        {/* <Label htmlFor="current">Username</Label> */}
        <Input id="username" type="text" placeholder="Email" onChange={handleEmailChange} value={email} className={`${!emailValid && "border-destructive"} text-base`} />
      </div>
      <div className={`space-y-1`} >
        {/* <Label htmlFor="current">Current password</Label> */}
        <Input id="current" type="password" placeholder="Password" onChange={handlePwdChange} className={`${!pwdValid && "border-destructive"} text-base`} value={password} />
      </div>
      <div className="space-y-1">
        {/* <Label htmlFor="new">New password</Label> */}
        <Input id="new" type="password" placeholder="Confirm Password" onChange={checkSame} className={`${!pwdsMatch && "border-destructive"} text-base`} value={confirm} />
      </div>
      <div className="space-y-1 pt-5 px-9 text-slate-500 flex flex-row items-center">
        
      <Checkbox id="accept" name="accept" checked={acceptTerms} onClick={handleAcceptClick}/>
      <Label htmlFor="accept" className="ml-2 block">
        Accept <span onClick={handleTermsClick} className="link">Terms & Conditions</span> and <span onClick={handlePrivacyClick} className="link">Privacy Policy</span> 
      </Label>
      </div>
    </CardContent>
    <CardFooter className="flex justify-center">
    <Button className="bg-emerald-900 text-white" onClick={handleRegister} disabled={!canSubmit} title="Register"><User /></Button>
  </CardFooter>      
  </form>)
}
