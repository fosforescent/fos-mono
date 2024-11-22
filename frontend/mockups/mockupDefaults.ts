




import { Delta } from "@n1ru4l/json-patch-plus";


import { AppState, FosContextData, FosNodesData,  InfoState, TrellisSerializedData } from "../../shared/types";





const rootId = window.crypto.randomUUID()
const startTaskId = window.crypto.randomUUID()



export const defaultFocus = {
  route: [],
  char: 0
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
  "focusRoute": [['root', rootId]],
  "focusChar": null,
  "collapsedList": [],
  "rowDepth": 0,
  
  "dragInfo": {
    "dragging": null,
    "dragOverInfo": null
  }
}

export const getMockupState = (ctx: FosContextData): AppState =>  ({
  data: {
    fosData: ctx,
    trellisData: defaultTrellisData
  },
  auth: initialAuthState,
  info: {
    emailConfirmed: false,
    cookies: {
      acceptRequiredCookies: false,
      acceptSharingWithThirdParties: false
    }
  },
  theme: "system",
  loaded: true,
  apiUrl: "http://localhost:3000"
})





