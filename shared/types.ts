import { Delta, DiffOptions } from "@n1ru4l/json-patch-plus"


export interface TrellisSerializedData {
  focusRoute: FosPath,
  focusChar: number | null,
  collapsedList: FosPath[],
  rowDepth: number,
  dragInfo: DragInfo,
  view: "Queue" | "Query" | "Tree" | "Focus" | "Settings" | "Browse",
  activity: string,
  mode: string,
}



export type FosDataContent = {
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
    scope?: "global" | "private";
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
  alias?: {
    id: string;
    previous?: string; // CID of previous node this alias pointed to
  }
  group?: {
    id: string;
    name: string;
    userProfiles: string[];
    visibility?: 'public' | 'private';
    createdBy?: string;
  }
  market?: {
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
  reactClient?: {
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
  // Linear resource types
  budget?: {
    total: number;
    consumed: number;
    currency: string;
    name?: string;
    parentBudgetId?: string;
  }
  calendar?: {
    name: string;
    slots?: {
      id: string;
      start: string;
      end: string;
      allocated: boolean;
      allocatedTo?: string;
    }[];
    parentCalendarId?: string;
  }
  spent?: {
    amount: number;
    description?: string;
    timestamp: number;
  }
  // Version control data
  commit?: {
    message: string;
    timestamp: number;
    branch: string;
  }
  merge?: {
    message: string;
    timestamp: number;
    hasConflicts: boolean;
  }
  branch?: {
    name: string;
  }
  tag?: {
    name: string;
    timestamp: number;
  }
  conflict?: {
    path: string;
  }
  // Datalog data
  variable?: {
    name: string;
  }
  predicate?: string;
  completed?: {
    taskId: string;
    time: number;
  }
  // Session type data
  session?: {
    type: 'send' | 'recv' | 'choice' | 'select' | 'end';
    payloadType?: string;
    options?: string[];
  }
  // Channel data
  channel?: {
    id: string;
    state: 'open' | 'closed';
    protocolNodeId?: string;
  }
  // Modal type data
  modal?: {
    type: 'box' | 'diamond';
    modality: string;  // 'local' | 'home' | 'online' | 'peer'
    valueNodeId: string;
  }
  // Actor data
  actor?: {
    id: string;
    name: string;
    endpoint: string | null;
    isLocal: boolean;
    capabilities: string[];
    providedModalities: string[];
  }
  // Recurring event data
  recurringDeposit?: {
    id: string;
    amount: number;
    currency: string;
    interval: 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
    startDate: string;
    endDate?: string;
    description?: string;
    dayOfWeek?: string;
    dayOfMonth?: number;
    active: boolean;
  }
  recurringExpense?: {
    id: string;
    amount: number;
    currency: string;
    interval: 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
    startDate: string;
    endDate?: string;
    description?: string;
    budgetId?: string;
    dayOfWeek?: string;
    dayOfMonth?: number;
    active: boolean;
  }
  recurringCalendarEvent?: {
    id: string;
    name: string;
    durationMinutes: number;
    interval: 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
    startDate: string;
    endDate?: string;
    timeOfDay: string;
    daysOfWeek?: string[];
    calendarId?: string;
    active: boolean;
  }
  // Peer consensus fields
  /** Members who can propose/approve changes to this node (peer IDs = Ed25519 public keys) */
  members?: {
    peerIds: string[];
  };
}



/**
 * Serialized node content (stored on disk, CID-based children)
 */
export type FosNodeContent = {
  data: FosDataContent,
  children: FosPathElem[];  // CID strings for persistence
}

/**
 * Forward declaration for FosNode (actual class in node.ts)
 * Used for runtime object references
 */
export interface IFosNode {
  getId(): string
  getEdges(): FosPathElem[]
  getData(): FosDataContent
}

/**
 * Runtime edge with direct object references (no CID lookup needed)
 */
export type FosEdge<T extends IFosNode = IFosNode> = [T, T]


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
export type FosNodeId = ContentId




/** CID-based path element for serialization */
export type FosPathElem = [FosNodeId, FosNodeId]
export type FosPath = FosPathElem[]
export type FosRoute = [FosPathElem, ...FosPath]

/** UUID-based path element for runtime (after refactor) */
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
  approved?: boolean
  role?: string
  /** True when using local-only mode (desktop app without login) */
  offlineMode?: boolean
}


export type AppStateInitial = {
  apiUrl: string
  info: InfoState
  theme: string
  auth: AuthState
  data: null
  loaded: false
  loggedIn: boolean
}

export type AppStateLoaded = {
  apiUrl: string
  info: InfoState
  theme: string
  auth: AuthState
  data: { fosData: FosContextData, trellisData: TrellisSerializedData }
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
  /** True when using local-only mode without server authentication */
  offlineMode?: boolean
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
  options: Partial<{
    canPromptGPT: boolean,
    promptGPT: (systemPrompt: string, userPrompt: string, options?: { temperature?: number }) => Promise<{
      choices: { message: { content: string, role: string }, finishReason: string }[]
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
  }>,
  nodeRoute: FosPath,
  dialogueProps: {
    loading: boolean,
    setLoading: (loading: boolean) => void,
    showCookies: boolean,
    setShowCookies: (showCookies: boolean) => void,
    showTerms: { open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void },
    setShowTerms: (showTerms: { open: boolean, fromRegisterForm: boolean, setAcceptTerms: (accept: boolean) => void }) => void,
    showPrivacy: { open: boolean, fromRegisterForm: boolean },
    setShowPrivacy: (showPrivacy: { open: boolean, fromRegisterForm: boolean }) => void,
    showClearData: boolean,
    setShowClearData: (showClearData: boolean) => void,
    showDeleteAccount: boolean,
    setShowDeleteAccount: (showDeleteAccount: boolean) => void,
    showEmailConfirm: { open: boolean, email: string },
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
