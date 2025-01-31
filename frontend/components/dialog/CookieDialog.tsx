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

import { ConfirmDeleteUser } from "./ConfirmDeleteUser"

import { Switch } from "@/frontend/components/ui/switch"
import { useEffect, useState } from "react"
import { AppState, FosReactOptions } from "@/shared/types"
import { getActions } from "@/frontend/lib/actions"

export function CookieDialog({
  open,
  setOpen,
  options,
  data,
  setData,
} : {
  open: boolean,
  setOpen: (open: boolean) => void
  options: FosReactOptions
  data: AppState
  setData: (state: AppState) => void

}) {


  const { setCookieConsent } = getActions(options, data, setData)

  const [reqForSubscription, setReqForSubscription] = useState(true)

  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSubmitPrefs = () => {
    console.log('handleSubmitPrefs', reqForSubscription)
    setCookieConsent({ acceptRequiredCookies: true, acceptSharingWithThirdParties: reqForSubscription })
    setOpen(false)
  }

  const handleSubmitAllPrefs = () => {
    console.log('handleSubmitPrefs', reqForSubscription)
    setCookieConsent({ acceptRequiredCookies: true, acceptSharingWithThirdParties: true })
    setOpen(false)
  }

  const handleSubmitNecessaryPrefs = () => {
    console.log('handleSubmitPrefs', reqForSubscription)
    setCookieConsent({ acceptRequiredCookies: true, acceptSharingWithThirdParties: false })
    setOpen(false)
  }


  const handleRejectAll = () => {
    setCookieConsent({
      acceptRequiredCookies: false,
      acceptSharingWithThirdParties: false
    })
    setOpen(false)
  }

  const handleDeleteClick = () => {
    setConfirmDelete(true)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="sm:max-w-[425px] z-50 text-center">
        <AlertDialogHeader>
          <AlertDialogTitle aria-description='Data Settings'>Edit data & cookie settings</AlertDialogTitle>
            <div className="text-left">
              Fosforescent stores your preferences and data in local storage as well as on the database.
              We do not use cookies. 
            </div>
            <div className="text-left">
              Currently we do not share this with 3rd parties except to generate suggestions via the openAI API or with Stripe for basic subscription management.
            </div>
            <div className="text-left">    
              We do not process it in any way or run analytics on it currently.  This is subject to change.
            </div>
            <div className="text-left">
              Subscriptions are managed through stripe and we do not store any payment information.
            </div>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
        <div className="flex items-center space-x-2">
          <Switch id="required" disabled={true} checked={true} />
          <Label htmlFor="required">Required For Basic Functionality</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="subscription" checked={reqForSubscription} onCheckedChange={setReqForSubscription} />
          <Label htmlFor="subscription">Required For Subscription</Label>
        </div>
        </div>
        <div className="flex justify-center space-x-2 sm:justify-start" onClick={handleDeleteClick}>
          <Button variant="destructive">Delete Account & All Data</Button>
        </div>

        <AlertDialogFooter className="flex wrap items-between  gap-y-1 w-60 sm:w-full mx-auto">
          {/* <AlertDialogCancel onClick={handleRejectAll}>Reject All</AlertDialogCancel> */}
          <AlertDialogAction className="bg-slate-400" onClick={handleSubmitNecessaryPrefs}>Required Only</AlertDialogAction>
          <AlertDialogAction className="bg-slate-400" onClick={handleSubmitAllPrefs}>Accept All</AlertDialogAction>
          <AlertDialogAction className="bg-emerald-400" onClick={handleSubmitPrefs}>Save Selection</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      <ConfirmDeleteUser open={confirmDelete}  setOpen={setConfirmDelete} data={data} setData={setData} options={options}/>
    </AlertDialog>
  )
}

