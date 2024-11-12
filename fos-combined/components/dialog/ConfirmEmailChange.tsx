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

import { Switch } from "@/components/ui/switch"
import { useEffect, useState } from "react"

import { api } from "../../api"


import { jwtDecode } from "jwt-decode";
import { AppState, FosReactOptions } from "@/fos-combined/types"
import { getActions } from "@/fos-combined/lib/actions"

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