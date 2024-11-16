
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
  ShieldQuestion,
  Edit3Icon,
  Edit2
} from 'lucide-react'

import _ from 'lodash'

import { AppState, FosReactOptions } from "@/fos-combined/types"
import { getActions } from "@/fos-combined/lib/actions"




export const SettingsComponent = ({ 
  setMessage,
  setShowClearData,
  setShowEmailConfirm,
  data,
  setData,
  options
 } : { 
  setMessage: (message: { messageType: string, message: string }) => void
  setShowClearData: (showClearData: boolean) => void
  setShowEmailConfirm: (showEmailConfirm: { open: boolean, email: string }) => void
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {


  const appState = data
  const setAppState = setData

  const {   clearData, confirmEmailInit, confirmEmail, logOut} = getActions(options, data, setData)

  const [isEditing, setIsEditing] = useState(false)
  const [advancedSettings, setAdvancedSettings] = useState(false)
  const [email, setEmail] = useState(appState.auth.email || '')
  const [isValid, setIsValid] = useState(true)

  


  useEffect(() => {
    console.log('user info profile', appState.info.profile)

  }, [])


  const emailConfirmed = appState.info.emailConfirmed
  

  const handleResetData = () => {
    setShowClearData(true)
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
    const valid = emailRegex.test(email)
    setIsValid(valid)
    if(!valid) {
      setMessage({ messageType: "fail", message: "Invalid email" })
    } else {
      setMessage({ messageType: "none", message: "" })
    }

  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    validateEmail(e.target.value)

    console.log('email change', e.target.value)
  }


  const handleEditButtonClick = () => {
    setIsEditing(true)
  }

  const handleEmailConfirmClick = () => {
    if (!appState.auth.jwt) return console.error('no jwt, not logged in');
    confirmEmailInit().then(() => {
      setMessage({ messageType: "success", message: "Email confirmation sent" })
    })
    console.log('confirm email')
  }

  const handleSaveButtonClick = () => {
    if (!appState.auth.jwt) return console.error('no jwt, not logged in');

    if (email !== appState.auth.email) {
      setShowEmailConfirm({
        open: true,
        email: email,
      })

      setMessage({ messageType: "success", message: "Email updated.  Confirmation email sent" })
    } 
    setIsEditing(false)
  }



  return (appState.info?.profile ?
    <><CardContent className="space-y-2 pt-3">
      <div className="space-y-1">
        <Label htmlFor="email">Email {!emailConfirmed && "(not confirmed)"}</Label>
        <Input 
          name="email" 
          id="email" 
          value={email}
          className={`${!emailConfirmed && "border-destructive"} text-base`}
          disabled={!isEditing}
          onChange={handleEmailChange} />
      </div>
      {!emailConfirmed && (<Button 
          className="bg-orange-900 text-white" 
          onClick={handleEmailConfirmClick}>
            Resend Email Confirmation
        </Button>)}
    </CardContent>
    <CardFooter>
      <div className="flex justify-around w-full basis-full">
        <div className="basis-1/3">
          {isEditing 
            ? (<Button className="bg-emerald-900 text-white" onClick={handleSaveButtonClick} title="Save Email" ><SaveIcon /></Button>)
            : (<Button className="bg-blue-900 text-white" onClick={handleEditButtonClick} title="Edit Email" ><Edit2 /></Button>
            )}
        </div>
        
        <div className="basis-1/3">
          <Button onClick={() => setAdvancedSettings(!advancedSettings)} title="Advanced Settings"><ShieldQuestion /></Button>
        
        </div>
      </div>
    </CardFooter>
    {advancedSettings && <CardFooter>
      <div className="flex justify-around w-full basis-full">
        <div>
          <Button variant="destructive" name="reset_data" onClick={handleResetData} title="Reset Data"><RotateCcw /></Button>
          <br /><Label htmlFor="reset_data">Reset Data</Label>
        </div>
      </div>
    </CardFooter>}
    </>
  : <CardContent className="space-y-2 pt-3">
    <div className="space-y-1">
      Loading...
      </div>
  </CardContent>)

}