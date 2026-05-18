
import { AppState, FosContextData, FosNodesData, FosPath, InfoState, TrellisSerializedData } from "./types";


// import { v4 as uuidv4 } from 'uuid';




export const defaultTrail: FosPath = []

export const defaultFocus = {
  route: defaultTrail,
  char: 0
}



export const defaultTrellisData: TrellisSerializedData = {
  "focusRoute": [],
  "focusChar": null,
  "collapsedList": [],
  "rowDepth": 1,
  "activity": "todo",
  "mode": "execute",
  "view": "Queue",

  "dragInfo": {
    "dragging": null,
    "dragOverInfo": null
  }
}



