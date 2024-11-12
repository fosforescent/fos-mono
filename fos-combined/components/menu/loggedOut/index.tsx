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

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import _ from 'lodash'

import { PwdResetComponent } from "./PwdResetComponent"
import { ForgotPwdComponent } from "./ForgotPwdComponent"
import { RegisterComponent } from "./RegisterComponent"
import { LoginComponent } from "./LoginComponent"
import { AppState, FosReactOptions } from "@/fos-combined/types"


export const LoginRegister = ({
  passwordResetToken,
  emailConfirmationToken,
  setLoading,
  setShowTerms,
  setShowPrivacy,
  data,
  setData,
  options
} : {
  passwordResetToken?: string,
  emailConfirmationToken?: string,
  setLoading?: (loading: boolean) => void
  setShowTerms: (showTerms: {open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void}) => void
  setShowPrivacy: (showPrivacy: {open: boolean, fromRegisterForm: boolean }) => void
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {


  const [message, setMessage] = useState<{ messageType: string, message: string }>({messageType: "none", message: ""})


  const [forgot, setForgot] = useState(false)


  const startTab = emailConfirmationToken ? "login" : passwordResetToken ? "forgot" : "login"

  const [tab, setTab] = useState(passwordResetToken ? "reset" : startTab);

  const onTabChange = (value: string) => {
    setMessage({messageType: "none", message: ""})
    setTab(value);
  }

  const handleForgot = () => {
    setForgot(true)
    setTab("forgot")
  }

  // console.log('pwd reset token', passwordResetToken)

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="w-full">
      <TabsList className="flex w-full justify-around">
        <TabsTrigger value="login"><DoorClosed /></TabsTrigger>
        <TabsTrigger value="register"><BookKey /></TabsTrigger>
        {forgot && <TabsTrigger value="forgot"><ShieldQuestion /></TabsTrigger>}
        {passwordResetToken && <TabsTrigger value="reset"><ShieldQuestion /></TabsTrigger>}
      </TabsList>
      <Card>
        {message.messageType === "fail" && <Alert variant="destructive">
          <AlertDescription>{message.message}</AlertDescription>          
        </Alert>}
        {message.messageType === "success" && <Alert className={`emerald-900`}>
          <AlertDescription>{message.message}</AlertDescription>          
        </Alert>}

      <TabsContent value="login">
        <LoginComponent setMessage={setMessage} setForgot={handleForgot} data={data} setData={setData} options={options} />
      </TabsContent>
      <TabsContent value="register">
        <RegisterComponent setMessage={setMessage} setShowTerms={setShowTerms} setShowPrivacy={setShowPrivacy} data={data} setData={setData} options={options} />
      </TabsContent>
      {forgot && <TabsContent value="forgot">
            <ForgotPwdComponent setMessage={setMessage} data={data} setData={setData} options={options} />
      </TabsContent>}
      {passwordResetToken && <TabsContent value="reset">
        <PwdResetComponent setMessage={setMessage} passwordResetToken={passwordResetToken} data={data} setData={setData} options={options} /> 
      </TabsContent>}
      </Card>
    </Tabs>
  )
}


