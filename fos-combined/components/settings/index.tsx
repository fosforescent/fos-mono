
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

import { getActions } from "@/fos-combined/lib/actions"

export const ProfilePasswordLogout = ({
  emailConfirmationToken,
  setLoading,
  setShowClearData,
  setShowEmailConfirm,
  setShowCookies,
  data,
  setData,
  options
} : {
  emailConfirmationToken?: string
  setLoading: (loading: boolean) => void
  setShowClearData: (showClearData: boolean) => void
  setShowEmailConfirm: (showEmailConfirm: { open: boolean, email: string }) => void
  setShowCookies: (showCookies: boolean) => void
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {

  
  const { confirmEmail } = getActions(options, data, setData)
  

  const [tab, setTab] = useState(emailConfirmationToken ? "settings": "settings");

  const onTabChange = (value: string) => {
    setTab(value);
  }

  const [message, setMessage] = useState<{ messageType: string, message: string }>({messageType: "none", message: ""})


  useEffect(() => {
    if (emailConfirmationToken) {
      if (!data.auth.jwt) {
        throw new Error('no jwt, not logged in');
      }
      confirmEmail(emailConfirmationToken).then(() => {
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
          <SettingsComponent setMessage={setMessage} setShowClearData={setShowClearData} setShowEmailConfirm={setShowEmailConfirm} data={data} setData={setData} options={options} />
        </TabsContent>
        <TabsContent value="premium">
          <Premium setShowCookies={setShowCookies} data={data} setData={setData} options={options} />
        </TabsContent>
        <TabsContent value="password">
          <Password setLoading={setLoading} setMessage={setMessage} data={data} setData={setData} options={options} />
        </TabsContent>
      </Card>
    </Tabs>
  )

}




import { AppState, ContextType, FosReactOptions, FosRoute } from "@/fos-combined/types"
import { useProps } from "@/fos-combined/App"


export const FosSettingsPage = () => {
  
  const {  
    data,
    setData,
    options,
    dialogueProps,
    tokens
  } : ContextType = useProps()


  return (<div className='flex w-full px-2 items-center overflow-x-scroll no-scrollbar'>
    <ProfilePasswordLogout 
      emailConfirmationToken={tokens.emailConfirmationToken}
      setShowClearData={dialogueProps.setShowClearData}
      setShowEmailConfirm={dialogueProps.setShowEmailConfirm}
      setShowCookies={dialogueProps.setShowCookies}
      setLoading={dialogueProps.setLoading}
      data={data}
      setData={setData}
      options={options}
        />
</div>)

}


