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
import { AppState, FosReactOptions } from "@/frontend/types"
import { getActions } from "@/frontend/lib/actions"




export const ConfirmClearData = ({
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


  const { clearData } = getActions(options, data, setData)

  const handleDelete = () => {
    clearData()
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle aria-description='Clear Data'>Delete Data</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to reset your app data?
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOpen(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive" onClick={handleDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}