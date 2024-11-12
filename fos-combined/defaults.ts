




import { Delta } from "@n1ru4l/json-patch-plus";

import { useToast } from "@/components/ui/use-toast";
import { FosContextData, FosNodesData, FosTrail, TrellisSerializedData } from "./types";





const rootId = window.crypto.randomUUID()
const startTaskId = window.crypto.randomUUID()

export const defaultTrail: FosTrail = [["root", rootId] as [string, string]]

export const defaultFocus = {
  route: defaultTrail,
  char: 0
}


export const defaultNodes: FosNodesData = {
  [rootId]: {
    data: {
      description: { 
        content: "Fosforescent Root",
      }

    },
    content: [
      ["workflow", startTaskId]
    ]
  },
  [startTaskId]: {
    data: {
      description: { 
        content: "",
      }
    },
    content: [
    ]
  }
}


export const defaultNodesDemo: FosNodesData = {
  root: {
    data: {
      description: { 
        content: "Fosforescent Root",
      }
    },
    content: [
      ["workflow", "startTask"]
    ]
  },
  startTask: {
    data: {
      description: { 
        content: "Learn to use Fosforescent",
      }
    },
    content: [
    ]
  }

}

export const defaultNodesTest: FosNodesData = {
  root: {
    data: {
      description: { 
        content: "My Goals",
      }
    },
    content: [
      ["workflow", "task1"],
      ["workflow", "task2"],
      ["workflow", "task3"],
      // ["workflow", "task4"],
      // ["task5L", "task5R"]
    ]
  },


  task1: {
    data: {
      description: {
        content: "Task 1a"
      }
    },
    content: [
    ["workflow", "task1a_1"],
    ["workflow", "task1a_2"],
    ["workflow", "task1a_3"]
    ]
  },
  task1a_1: {
    data: {
      description: {
        content: "Task 1a.1"
      }
    },
    content: [
    ]
  },
  task1a_2: {
    data: {
      description: {
        content: "Task 1a.2"
      }
    },
    content: [
    ]
  },
  task1a_3: {
    data: {
      description: {
        content: "Task 1a.3"
      }
    },
    content: [
    ]
  },

  // Task 2
  task2: {
    data: {
      description: {
        content: "Task 2a"
      }
    },
    content: [
      ["workflow", "task2a_1"],
    ]
  },
  task2a_1: {
    data: {
      option: {
        selectedIndex: 0
      },
      description: {
        content: "Task 2a.1"
      }
    },
    content: [
      ["option", "task2a_1a_1"],
      ["option", "task2a_1a_2"],
      ["option", "task2a_1a_3"],
    ]
  },
  task2a_1a_1: {
    data: {
      description: {
        content: "Task 2a.1a.1"
      }
    },
    content: [
    ]
  },
  task2a_1b_1: {
    data: {
      description: {
        content: "Task 2a.1b.1"
      }
    },
    content: [
    ]
  },
  task2a_1c_1: {
    data: {
      description: {
        content: "Task 2a.1c.1"
      }
    },
    content: [
    ]
  },


  // Task 3

  task3: { 
    data: {
      description: {
        content: "Task 3a"
      }
    },
    content: [
    ["workflow", "task3a_1"],
    ["workflow", "task3a_2"],
    ["workflow", "task3a_3"]
    ]
  },
  task3a_1: {
    data: {
      description: {
        content: "Task 3a.1"
      }
    },
    content: [
    ]
  },
  task3a_2: {
    data: {
      description: {
        content: "Task 3a.2"
      }
    },
    content: [
    ]
  },
  task3a_3: {
    data: {
      description: {
        content: "Task 3a.3"
      }
    },
    content: [
    ]
  },
}

export const defaultContext: FosContextData = {
  nodes: defaultNodes,
  route: defaultTrail,
}


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





