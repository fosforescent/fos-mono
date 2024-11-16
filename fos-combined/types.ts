import { getGlobal } from "./App"
import { FosModule } from "./components/fos-react/fosModules"

export type FosReactGlobal = ReturnType<typeof getGlobal>

export type FosReactOptions = Partial<{
  canPromptGPT: boolean,
  promptGPT: (systemPrompt: string, userPrompt: string, options?: { temperature?: number }) => Promise<{
    choices: {message: { content: string, role: string}, finishReason: string}[]
  }>,
  toast: (toastOpts: {
    title: string, 
    description: string,
    duration: number
  }) => void,
  canUndo: boolean,
  undo: () => void,
  canRedo: boolean,
  redo: () => void,
  activeModule: FosModule,
  setActiveModule: (module: FosModule | undefined) => void,
  activeModuleRows: FosModule,
  setActiveModuleRows: (module: FosModule | undefined) => void,
  modules: FosModule[],
  theme: "light" | "dark" | "system",
  locked: boolean
}>


export interface TrellisSerializedData {
  focusRoute: FosRoute,
  focusChar: number | null,
  collapsedList: FosRoute[],
  rowDepth: number,
  draggingNode: FosRoute | null,
  draggingOverNode: FosRoute | null,
  dragInfo: DragInfo,
}



export type FosDataContent = {
  duration?: {
    plannedMarginal: number;
    entries: {
      start: number;
      stop: number;
      notes: string;
    }[]
  };
  cost?: {
    budget?: {
      available: number;
    }
    plannedMarginal: number;
    entries: {
      time: number;
      amount: number;
    }[]
  };
  probability?: {
    marginSuccess: number;
    marginFailure: number;
  };
  document?: {
    content: string;
  };
  resources?: {
    required: string[];
    available: string[];
    produced: string[];
  }
  option?: {
    selectedIndex: number;
    defaultResolutionStrategy: "choice" | "selected" | "race";
    chosenOptions: FosPathElem[]
  }
  description?: {
    content: string;
  }

  comment?: {
    content: string;
    author: string;
    time: number;
    votes: {
      [key: string]: string;
    }
  }
  peers?: {
    [key: string]: {
      connectionInfo: {
        type: "serverHttp";
        address: string;
      } | {
        type: "serverWs";
        address: string;
      } | {
        type: "webRtc";
        offerSdpJson: string;
      },

    }
  }
  todo?: {
    completed: boolean;
    notes: string;
  }
  reactClient?:{
    collapsed: boolean;
  }
  updated?: {
    time: number;
  }
  webView?: {
    focus: boolean;
    focusChar: number | null;
    zoomed: boolean;
    selectedModule: string;
    collapsed: boolean;
  }
}



export type FosNodeContent = {
  data: FosDataContent,
  content: FosPathElem[];
}

export type FosNodeNewContent = {
  data: Partial<FosDataContent>,
  content: FosPathElem[];
}

// export type FosNodeData = {
//   selectedOption: number;
//   description: string;
//   collapsed: boolean;
//   mergeNode?: string;
//   options: [FosNodeContent, ...FosNodeContent[]]
// }


export type SelectionPath = {
  [key: string]: SelectionPath
}

export type NodeAddress = `${string}-${string}-${string}-${string}-${string}`
export type ContentId = string
export type FosNodeId  = NodeAddress | ContentId

export type RouteElement = FosPathElem 



export type FosPathElem = [FosNodeId, FosNodeId]
export type FosTrail = [FosPathElem, ...FosPathElem[]]
export type FosPath = FosPathElem[]
export type FosRoute = [FosPathElem, ...FosPathElem[]]

export type FosNodesData = { [key: FosNodeId]: FosNodeContent }

export type FosContextData = { 
  nodes: FosNodesData,
  route: FosRoute,
}




export type InfoProfile = {
  // profileInfo: {
  //   [key: string]: any;
  // }
  name: string,
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
  emailConfirmed: boolean,
  subscriptionSession: boolean,
  cookies?: {
    acceptRequiredCookies: boolean
    acceptSharingWithThirdParties: boolean
  }
}


export type AppState = {
  apiUrl: string
  info: InfoState
  theme: string
  auth: AuthState
  data:  { fosData: FosContextData, trellisData: TrellisSerializedData }
}



export type AuthState = {
  username: string,
  remember: boolean,
  jwt?: string,
  password?: string,
  email: string,
}


type DragInfo = {
  dragging: {
    id: string
    nodeRoute: FosRoute
    breadcrumb: boolean
  } | null
  dragOverInfo: {
    id: string
    nodeRoute: FosRoute
    position: 'above' | 'below' | 'on' | 'breadcrumb'
  } | null
}