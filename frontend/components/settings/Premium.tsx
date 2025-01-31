

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



import { api } from "../../api"

import { Progress } from "@/frontend/components/ui/progress"
import { AppState, FosReactOptions } from "@/shared/types"
import { getActions } from "@/frontend/lib/actions"

export const Premium = ( {
  setShowCookies,
  data,
  setData,
  options
} : {
  setShowCookies: (showCookies: boolean) => void
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {

  const appState = data
  
  if (!appState.info){
    throw new Error('user info not found -- shouldn\'t have gotten here')
  }
  if(!appState.info.subscription){
    console.log('appstate,', appState)
    throw new Error('user info not found -- shouldn\'t have gotten here')
  }

  return (<div>

      <CardContent className="space-y-2 pt-3">



        <div className="p-3">
          Usage:
        <Progress value={appState.info.subscription.apiCallsUsed} max={appState.info.subscription.apiCallsAvailable} />
          {appState.info.subscription.apiCallsUsed} / {appState.info.subscription.apiCallsAvailable} (All time: {appState.info.subscription.apiCallsTotal})
        </div>
        <div>
          {appState.info.subscription.subscriptionStatus === 'on' ? "Thank you for your subscription!" : "You are not currently subscribed"}

        </div>
        <div>
        {<GoToConnectPortal data={data} setData={setData} options={options} />}
        </div>

      </CardContent>

      </div>
  )
}





const GoToConnectPortal = ( {
  data,
  setData,
  options
} : {
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {

  const appState  = data;

  const handlePortalClick = async (event: any) => {
    if (!appState.auth.jwt) return console.error('no jwt, not logged in');
    const { url } = await api(appState, setData).authed().getConnectSession();
    window.open(url, '_blank');
  }

  if (!appState.info){
    throw new Error('user info not found -- shouldn\'t have gotten here')
  }
  if(!appState.info.subscription){
    throw new Error('user info not found -- shouldn\'t have gotten here')
  }

  return (
  <section className="text-center">
    {/* <Card className="m-5">
      <div className="product">
        <div className="description">
          <h3>Top up: 2500 suggestions /mo</h3>
          <h5>$15.00</h5>
        </div>
      </div>
      <form action="/create-checkout-session" method="POST">
        <input type="hidden" name="lookup_key" value="{{PRICE_LOOKUP_KEY}}" />
        <Button id="checkout-and-portal-button" type="submit" className="bg-emerald-900" variant="ghost">
          Checkout
        </Button>
      </form>
    </Card> */}
    <Card className="m-5">
      <div className="product p-3">
        {/* <Logo /> */}
        <div>
          {appState.info.subscription.apiCallsUsed} / {appState.info.subscription.apiCallsAvailable} API calls used (all time: {appState.info.subscription.apiCallsTotal})
          <Progress value={appState.info.subscription.apiCallsUsed} max={appState.info.subscription.apiCallsAvailable} />
        </div>
      { appState.info.subscription.subscriptionStatus === 'active' ? `You are subscribed.  Thank you for your subscription!` : `You are not currently subscribed`}
      </div>
      <Button id="checkout-and-portal-button" type="submit" className="bg-emerald-900" variant="ghost" onClick={handlePortalClick}>
      { appState.info.subscription.subscriptionStatus === 'active' ? `Go To Portal` : `Set up payment methods`}
      </Button>

    </Card>

  </section>
)};







const ProductDisplay = ( {
  setShowCookies,
  data,
  setData,
  options
} : {
  setShowCookies: (showCookies: boolean) => void
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {

  const actions = getActions(options, data, setData)
  const appState = data

  const handleSubscriptionClick = async (event: any) => {
    if(!appState.auth.jwt) return console.error('no jwt, not logged in');
    if (!appState.info.cookies?.acceptSharingWithThirdParties) {
      setShowCookies(true);
    } else {
      const { url } = await api(appState, setData).authed().getCheckoutSession();
      window.open(url, '_blank');  
    }
  }
  if (!appState.info){
    throw new Error('user info not found -- shouldn\'t have gotten here')
  }
  if(!appState.info.subscription){
    throw new Error('user info not found -- shouldn\'t have gotten here')
  }

  return (
    <section className="text-center">
      {/* <Card className="m-5">
        <div className="product">
          <div className="description">
            <h3>Top up: 2500 suggestions /mo</h3>
            <h5>$15.00</h5>
          </div>
        </div>
        <form action="/create-checkout-session" method="POST">
          <input type="hidden" name="lookup_key" value="{{PRICE_LOOKUP_KEY}}" />
          <Button id="checkout-and-portal-button" type="submit" className="bg-emerald-900" variant="ghost">
            Checkout
          </Button>
        </form>
      </Card> */}
      <Card className="p-3">


        <div className="product">
          {/* <Logo /> */}

          <div className="description">
            <p>3000 suggestions /mo</p>
            <h5>$9.00 / month</h5>
          </div>
        </div>
        <div className="p-3">
          <Button id="checkout-and-portal-button" type="submit" className="bg-emerald-900" variant="ghost" onClick={handleSubscriptionClick}>
            Subscribe
          </Button>
        </div>
      </Card>

    </section>
  );
}

const GoToPortal = ( {
  data,
  setData,
  options
} : {
  data: AppState,
  setData: (data: AppState) => void,
  options: FosReactOptions
}) => {

  const appState  = data;

  const handlePortalClick = async (event: any) => {
    if (!appState.auth.jwt) return console.error('no jwt, not logged in');
    const { url } = await api(appState, setData).authed().getCheckoutSession();
    window.open(url, '_blank');
  }

  if (!appState.info){
    throw new Error('user info not found -- shouldn\'t have gotten here')
  }
  if(!appState.info.subscription){
    throw new Error('user info not found -- shouldn\'t have gotten here')
  }

  return (
  <section className="text-center">
    {/* <Card className="m-5">
      <div className="product">
        <div className="description">
          <h3>Top up: 2500 suggestions /mo</h3>
          <h5>$15.00</h5>
        </div>
      </div>
      <form action="/create-checkout-session" method="POST">
        <input type="hidden" name="lookup_key" value="{{PRICE_LOOKUP_KEY}}" />
        <Button id="checkout-and-portal-button" type="submit" className="bg-emerald-900" variant="ghost">
          Checkout
        </Button>
      </form>
    </Card> */}
    <Card className="m-5">
      <div className="product p-3">
        {/* <Logo /> */}
        {/* <div>
          {appState.info.subscription.apiCallsUsed} / {appState.info.subscription.apiCallsAvailable} API calls used (all time: {appState.info.subscription.apiCallsTotal})
          <Progress value={appState.info.subscription.apiCallsUsed} max={appState.info.subscription.apiCallsAvailable} />
        </div> */}
        You are subscribed.  Thank you for your subscription!
      </div>
      <Button id="checkout-and-portal-button" type="submit" className="bg-emerald-900" variant="ghost" onClick={handlePortalClick}>
        Go to Portal
      </Button>

    </Card>

  </section>
)};

