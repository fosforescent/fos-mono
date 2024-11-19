
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

import { Premium } from "./Premium"

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
  ShieldQuestion,
  Coins
} from 'lucide-react'





import { api } from "../../api"
import { AppState, FosReactOptions } from "@/frontend/types"


export const Password = ({
  setMessage,
  setLoading,
  data,
  setData,
  options
} : {
  setMessage: (message: { messageType: string, message: string }) => void 
  setLoading: (loading: boolean) => void
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {



  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  



  const [confirm, setConfirm] = useState('')
  const [pwdsMatch, setPwdsMatch] = useState(true)
  const [pwdValid, setPwdValid] = useState(true)
  const canSubmit = pwdValid && pwdsMatch
  

  const appState = data

  const handleUpdateRequest = () => {
    if (!appState.auth.jwt) {
      throw new Error('no jwt, not logged in');
    }
    const jwt = appState.auth.jwt
    setLoading(true)

    api(appState, setData).authed().changePassword(currentPassword, newPassword).then(() => {
      setMessage({ messageType: "success", message: "Password updated successfully" })
      setLoading(false)
    }).catch((error: Error) => {
      setMessage({ messageType: "fail", message: error.message })
    })
  }

  const handleCurrentPwdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentPassword(e.target.value)
  }

  const handleNewPwdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value)
    // const pwdMatches = e.target.value.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/)
    const pwdMatches = e.target.value.match(/^.*$/)
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


    if (pwdMatches) {
      setPwdValid(true)
      setMessage({ messageType: "", message: "" })
    } else {
      setPwdValid(false)
    }
  }


  const checkSame = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('confirm', e.target.value,  newPassword)
    setConfirm(e.target.value)
    if (e.target.value === newPassword) {
      setPwdsMatch(true)
    } else {
      setPwdsMatch(false)
    }
  }





  return (<form onSubmit={(e) => e.preventDefault()}>
      <CardContent className="space-y-2 pt-3">
        <div className="space-y-1">
          <Label htmlFor="current">Current password</Label>
          <Input id="current" type="password" className="text-base" value={currentPassword} onChange={handleCurrentPwdChange} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-pass">New password</Label>
          <Input id="new-pass" type="password" value={newPassword} onChange={handleNewPwdChange} className="text-base" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="confirm-pass">Confirm new password</Label>
          <Input id="confirm-pass" type="password" value={confirm} onChange={checkSame} className="text-base" />
        </div>
      </CardContent>
      <CardFooter className="flex justify-around">
      <Button className="bg-emerald-900 text-white" onClick={handleUpdateRequest} title="Update Password"><SaveIcon /></Button>
      </CardFooter>
    </form>)
}
