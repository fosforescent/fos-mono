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
import { getActions } from "@/frontend/lib/actions"
import { AppState, FosReactOptions } from "@/shared/types"




export const ConfirmDeleteUser = ({
  open,
  setOpen,
  options,
  data,
  setData,
}: {
  open: boolean,
  setOpen: (open: boolean) => void
  options: FosReactOptions
  data: AppState
  setData: (state: AppState) => void
}) => {

  const { deleteAccount } = getActions(options, data, setData)

  
  const handleDelete = () => {
    deleteAccount()
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle aria-description='Delete'>Delete Account</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to delete your account? This action cannot be undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpen(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive" onClick={handleDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}