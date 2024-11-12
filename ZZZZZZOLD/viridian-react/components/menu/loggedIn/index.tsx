
import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,

} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { useAppState } from "../../app-state/app-state"

import {
  User,
  KeyRound,
  DoorClosed,
  DoorOpen,
  Settings,
  ShieldQuestion,
  Coins
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"


import { SettingsComponent } from "./Settings"
import { Premium } from "./Premium"
import { Password } from "./Password"
import { api } from "../../../api"

export const ProfilePasswordLogout = ({
  emailConfirmationToken,
  setLoading,
  setShowClearData,
  setShowEmailConfirm,
  setShowCookies
} : {
  emailConfirmationToken?: string
  setLoading: (loading: boolean) => void
  setShowClearData: (showClearData: boolean) => void
  setShowEmailConfirm: (showEmailConfirm: { open: boolean, email: string }) => void
  setShowCookies: (showCookies: boolean) => void
}) => {

  
  const { appState } = useAppState()

  const [tab, setTab] = useState(emailConfirmationToken ? "settings": "settings");

  const onTabChange = (value: string) => {
    setTab(value);
  }

  const [message, setMessage] = useState<{ messageType: string, message: string }>({messageType: "none", message: ""})


  useEffect(() => {
    if (emailConfirmationToken) {
      if (!appState.auth.jwt) {
        throw new Error('no jwt, not logged in');
      }
      api(appState.apiUrl).authed(appState.auth.jwt).confirmEmail(emailConfirmationToken).then(() => {
        setTab("settings")
        setMessage({messageType: "success", message: "Email Successfully Confirmed!"})
        window.location.href = window.location.origin + window.location.pathname;
        setTimeout(() => {
          setMessage({messageType: "none", message: ""})
        }, 5000)
      })
    }
  }, [emailConfirmationToken]) 
  

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="w-full">
      <TabsList className="flex w-full justify-around">
        {/* <TabsTrigger value="account"><User /></TabsTrigger> */}
        <TabsTrigger value="settings"><Settings /></TabsTrigger>
        <TabsTrigger value="premium"><Coins /></TabsTrigger>
        <TabsTrigger value="password"><KeyRound /></TabsTrigger>
        </TabsList>
        <Card>
        {message.messageType === "fail" && <Alert variant="destructive">
          <AlertDescription>{message.message}</AlertDescription>          
        </Alert>}
        {message.messageType === "success" && <Alert className={`emerald-900`}>
          <AlertDescription>{message.message}</AlertDescription>          
        </Alert>}

        <TabsContent value="settings">
          <SettingsComponent setMessage={setMessage} setShowClearData={setShowClearData} setShowEmailConfirm={setShowEmailConfirm} />
        </TabsContent>
        <TabsContent value="premium">
          <Premium setShowCookies={setShowCookies} />
        </TabsContent>
        <TabsContent value="password">
          <Password setLoading={setLoading} setMessage={setMessage} />
        </TabsContent>
      </Card>
    </Tabs>
  )

}
