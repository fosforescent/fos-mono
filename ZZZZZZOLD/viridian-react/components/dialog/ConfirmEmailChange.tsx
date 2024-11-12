import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useAppState } from "../../components/app-state/app-state"
import { Switch } from "@/components/ui/switch"
import { useEffect, useState } from "react"

import { api } from "../../api"


import { jwtDecode } from "jwt-decode";

export const ConfirmEmailChange = ({
  open,
  setOpen,
  email,
}: {
  open: boolean,
  setOpen: (open: boolean) => void,
  email: string,
}) => {

  const { setAppState, appState } = useAppState()

  const updateEmail = async (email: string) => {
    if (!appState.auth.jwt) throw new Error('no jwt, not logged in', {cause: 'unauthorized'});
    api(appState.apiUrl).authed(appState.auth.jwt).updateEmail(email).then((result) => {
      if (!appState.info){
        throw new Error('user info not found -- shouldn\'t have gotten here')
      }
      if (!appState.info.profile){
        throw new Error('user info profile not found -- shouldn\'t have gotten here')
      }

      const jwtProps = jwtDecode<{ username: string, exp: number}>(result)

      if (jwtProps.username !== email){
        throw new Error('jwt username does not match email, update failed')
      }

      setAppState({ 
        ...appState, 
        info: { 
          ...appState.info, 
          profile: { 
            ...appState.info.profile
          }, 
          emailConfirmed: false  
        },
        auth: {
          ...appState.auth,
          email: email,
          jwt: result
        } 
      })
    });
  }

  const handleUpdateEmail = () => {
    updateEmail(email).then(() => {
      setOpen(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change Email</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to change your email to: {email}?
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpen(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive" onClick={handleUpdateEmail}>Update Email</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}