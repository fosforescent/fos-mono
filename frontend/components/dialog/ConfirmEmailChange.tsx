import { Button } from "@/frontend/components/ui/button"
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
} from "@/frontend/components/ui/alert-dialog"
import { Input } from "@/frontend/components/ui/input"
import { Label } from "@/frontend/components/ui/label"

import { Switch } from "@/frontend/components/ui/switch"
import { useEffect, useState } from "react"

import { api } from "../../api"


import { jwtDecode } from "jwt-decode";
import { AppState, FosReactOptions } from "@/frontend/types"
import { getActions } from "@/frontend/lib/actions"

export const ConfirmEmailChange = ({
  open,
  setOpen,
  email,
  options, 
  data,
  setData,
}: {
  open: boolean,
  setOpen: (open: boolean) => void,
  email: string,
  options: FosReactOptions
  data: AppState
  setData: (state: AppState) => void
}) => {


  
  const { updateEmail } = getActions(options, data, setData)


  const handleUpdateEmail = () => {
    updateEmail(email).then(() => {
      setOpen(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle aria-description='Change Email'>Change Email</AlertDialogTitle>
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