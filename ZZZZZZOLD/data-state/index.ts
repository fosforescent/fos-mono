

import { FosNodeContent,  FosTrail, FosContextData, FosNodesData, FosRoute } from "@/react-client"





import { Delta } from "@n1ru4l/json-patch-plus";

import { useToast } from "@/components/ui/use-toast";
import { defaultContext, defaultNodes } from "./initialNodes";
import { TrellisSerializedData } from "@/react-trellis/trellis/types";


export type InfoProfile = {
  // profileInfo: {
  //   [key: string]: any;
  // }
  profileInfo: {
    name: string,
  }
  emailConfirmed: boolean,
}

export type SubscriptionInfo = {
  subscriptionStatus: string,
  apiCallsAvailable: number,
  apiCallsUsed: number,
  apiCallsTotal: number,
}



export type InfoState = {
  profile?: InfoProfile
  subscription?: SubscriptionInfo
  cookies?: {
    acceptRequiredCookies: boolean
    acceptSharingWithThirdParties: boolean
  }
}



export type AppData = {
  fosData: FosContextData,
  trellisData: TrellisSerializedData
}




export type AuthState = {
  username: string,
  remember: boolean,
  jwt?: string,
  password?: string,
  email: string,
}




export type DataState = {
  synced: boolean,
  stored: boolean,
  appData: AppData,
  locked: boolean
  lastSyncTime: number
  lastStoreTime: number
  undoStack: Delta[],
  redoStack: Delta[],
  info: InfoState
  theme: string
  auth: AuthState
  
}







export const initialInfoState = {
  cookies: localStorage.getItem('cookiePrefs') ? JSON.parse(localStorage.getItem('cookiePrefs') || "") : undefined,
}




export const initialAuthState = {
  username: "",
  remember: false,
  jwt: JSON.parse(localStorage.getItem("auth") || "null") || null,
  email: "",
  password: "",
  loggedIn: false,
}

export const defaultTrellisData: TrellisSerializedData = {
  zoomRoute: [],
  focusRoute: [],
  focusChar: null,
  collapsedList: [],
  rowDepth: 0,
  draggingNode: null,
  draggingOverNode: null,
}

export const initialDataState: DataState =  JSON.parse(localStorage.getItem("data") || "null") || {
  synced: false,
  stored: false,
  appData: {
    fosData: defaultContext,
    trellisData: defaultTrellisData
  },
  auth: initialAuthState,
  info: initialInfoState,
  theme: JSON.parse(localStorage.getItem("theme") || "null") || "system",
  locked: false,
  lastSyncTime: 0,
  lastStoreTime: 0,
  undoStack: [],
  redoStack: []
}





