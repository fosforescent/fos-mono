import { Delta, DiffOptions } from "@n1ru4l/json-patch-plus"
import { getGlobal } from "../frontend/App"


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
  
  theme: "light" | "dark" | "system",
  locked: boolean
}>


export interface TrellisSerializedData {
  focusRoute: FosPath,
  focusChar: number | null,
  collapsedList: FosPath[],
  rowDepth: number,
  dragInfo: DragInfo,
  view: "Queue" | "Query" | "Tree" | "Focus" | "Settings",
  activity: string,
  mode: string,
}



export type FosDataContent = {
  alias?: {
    id: string;
  }
  versionControl?: {
    delta: Delta,
    branches: string[],
    tags: string[],
  }
  reversion?: {
    reversionedToAddress: string,
    nStepsBack: number,
  }
  error?: {
    target: string;
    instruction: string;
    targetIsError: boolean;
    instructionIsError: boolean;
    message: string;
  }
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

  }
  description?: {
    content: string;
  }

  comment?: {
    content: string;
    authorID: string;
    authorName: string;
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
        nodeId: string;
      } | {
        type: "serverWs";
        address: string;
        nodeId: string;
      } | {
        type: "webRtc";
        offerSdpJson: string;
        nodeId: string;
      } | {
        type: "group";
        id: string;
      },

    }
  }
  group?: {
    id: string;
    name: string;
    userProfiles: string[];

  }
  market?:{
    sellerProfile: string;
    buyerProfile: string;
    price: number;
    approveBid: boolean;
    approveFulfillment: boolean;
    approvePayment: boolean;
  }
  todo?: {
    completed: boolean;
    time: number;
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
  children: FosPathElem[];
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




export type FosPathElem = [FosNodeId, FosNodeId]
export type FosPath = FosPathElem[]
export type FosRoute = [FosPathElem, ...FosPath]

export type FosNodesData = { [key: FosNodeId]: FosNodeContent }

export type FosContextData = { 
  nodes: FosNodesData,
  route: FosPath,
  rootNodeId: FosNodeId,

}


export type FosPeer = {
  type: "server",
  id: string,
} | {
  type: "webRtc",
  id: string,
}



export type SubscriptionInfo = {
  subscriptionStatus: string,
  apiCallsAvailable: number,
  apiCallsUsed: number,
  apiCallsTotal: number,
  connectedAccountCreated: boolean,
  connectedAccountLinked: boolean,
  connectedAccountEnabled: boolean,
  // subscription_session?: string,
}



export type InfoState = {
  profile?: UserProfile
  subscription?: SubscriptionInfo
  emailConfirmed: boolean,
  cookies: {
    acceptRequiredCookies: boolean
    acceptSharingWithThirdParties: boolean
  }
}


export type AppStateInitial = {
  apiUrl: string
  info: InfoState
  theme: string
  auth: AuthState
  data:  null
  loaded: false
  loggedIn: boolean
}

export type AppStateLoaded = {
  apiUrl: string
  info: InfoState
  theme: string
  auth: AuthState
  data:  { fosData: FosContextData, trellisData: TrellisSerializedData }
  loaded: true
  loggedIn: boolean
}

export type AppState = AppStateInitial | AppStateLoaded


export type AuthState = {
  username: string,
  remember: boolean,
  jwt?: string,
  jwtDecoded?: {
    exp: number,
    username: string
  }
  password?: string,
  email: string,
}


export type DragInfo = {
  dragging: {
    id: string
    nodeRoute: FosPath
    breadcrumb: boolean
  } | null
  dragOverInfo: {
    id: string
    nodeRoute: FosPath
    position: 'above' | 'below' | 'on' | 'breadcrumb'
  } | null
}

export type UserProfile = {
  displayName: string,

}

            
export type LoginResult = { 
  access_token: string, 
  type: string,
} & InfoState
 


export type ContextType = { 
  data: AppStateLoaded, 
  setData: (data: AppStateLoaded) => void, 
  options: FosReactOptions,
  nodeRoute: FosPath,
  dialogueProps: {
    loading: boolean,
    setLoading: (loading: boolean) => void,
    showCookies: boolean,
    setShowCookies: (showCookies: boolean) => void,
    showTerms: {open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void},
    setShowTerms: (showTerms: {open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void}) => void,
    showPrivacy: {open: boolean, fromRegisterForm: boolean},
    setShowPrivacy: (showPrivacy: {open: boolean, fromRegisterForm: boolean}) => void,
    showClearData: boolean,
    setShowClearData: (showClearData: boolean) => void,
    showDeleteAccount: boolean,
    setShowDeleteAccount: (showDeleteAccount: boolean) => void,
    showEmailConfirm: { open: boolean, email: string},
    setShowEmailConfirm: (showEmailConfirm: { open: boolean, email: string }) => void,
  },
  tokens: {
    emailConfirmationToken?: string,
    passwordResetToken?: string
  }
};

export type MockEvent = {
  type: string;
  payload: {
    fosData: Partial<FosContextData>;
    trellisData: Partial<TrellisSerializedData>;
  };
};
