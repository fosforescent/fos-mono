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



/** Client text capabilities selected by graph definitions, independent of domain types. */
export type TextPresentation = { mediaType: 'text/plain' | 'text/markdown'; interpolate?: boolean }

export type FosDataContent = {
  /** Graph constructor declarations. Products are rows; repetition expands a row template. */
  form?: {
    primitive?: 'text' | 'number' | 'peer' | 'time';
    repeat?: boolean;
    open?: boolean;
    title?: string[];
    /**
     * The row's own text is a one-line title (its description); what follows the first line is the field at this path
     * (a note's markdown body), an ordinary row of the node.
     */
    headline?: string[];
    text?: TextPresentation;
    attribution?: { id: string[]; name: string[] };
  };
  /** A constructor row's parameter, optionally bound from the caller's environment. */
  parameter?: { name: string; from?: string[] };
  scalar?: { type: 'text' | 'number' | 'peer' | 'time'; value: string | number };
  /** Presentation is a projection of fields, not a second copy of their values. */
  presentation?: { title?: string[]; headline?: string[]; attribution?: { id: string[]; name: string[] }; sequence?: boolean };
  created?: { time: number };
  position?: { value: number };
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
  /**
   * A link node: a node other peers attach to. It keeps PREV edges to its
   * previous states, MEMBER edges with capabilities, and PROPOSAL edges
   * (branches) that members can approve. See docs/sync.md.
   */
  link?: {
    createdAt: number
  }
  /** On a proposal node (a peer's branch at a link node). */
  /**
   * A requirement row under a task ("-" prefix): a capability / effect handler that must be supplied before the
   * task can be completed. The capability names the child row that fills it: `task` (a done task),
   * `allocation` (an allocation of `resource`), `search` (a run query), `confirmation`/`choice` (a supply by a
   * signed-in person), `market`/`mail` (a peer that registered that capability), `peer` (a named peer confirms).
   */
  requirement?: {
    capability: 'confirmation' | 'choice' | 'search' | 'allocation' | 'task' | 'market' | 'mail' | 'peer' | 'llm' | 'repo' | 'tool' | 'verify' | 'organize' | 'title'
    resource?: 'calendar' | 'account' | 'inventory' | 'person' | 'points' | 'location'
    amount?: number
    unit?: string
    start?: number
    end?: number
    options?: string[]
    /**
     * `peer` requirements: a peer id the task is assigned to (a shared host, a device). A user named with `-@name`
     * is not a string here: the row's `user` field binds their user object (sync/users.ts).
     */
    peer?: string
    /** `location` requirements ("-at Eiffel Tower 18:00..20:00"): the named place to be at, when the row names one. */
    place?: string
    /** `repo` requirements: the repository (owner/name) the issue goes to. */
    repo?: string
    /** `tool` requirements: the tool (of an MCP peer attached above) to run; the text is its input. */
    tool?: string
  },
  /** A supply row under a requirement: who/what satisfied it. `ref` names an allocation or query row by alias id. */
  supply?: {
    capability: 'confirmation' | 'choice' | 'search' | 'allocation' | 'task' | 'market' | 'mail' | 'peer' | 'llm' | 'repo' | 'tool' | 'verify' | 'organize' | 'title'
    by: string
    at: number
    ref?: string
    choice?: number
  },
  /** On a member reference: granted capabilities (CAPABILITY edges) the owner has switched off; the member still sees them, as offline. */
  disabledCapabilities?: {
    content: string[]
  },
  /** Retired row marker (older builds wrote it): never a row discriminator, and the library compiler refuses it. A row's type is its edge's left node. */
  instanceKind?: {
    kind: string
  },
  /** A named code behavior. `builtin:*` ones are retired (the library compiler refuses them): types are told apart by graph identity. */
  behavior?: {
    content: string
  },
  /** A pattern row (one of a type's rows, sync/patterns.ts): the wildcard, or the row type it names and the versions that match (none = any). */
  pattern?: {
    any?: boolean
    type?: string
    versions?: string[]
  },
  /** A type error node ([TYPE_ERROR, error]): the alias ids of the row's children its type does not accept. */
  typeError?: {
    rejected: string[]
  },
  /** On a reference-error template: the template a row is pinned to that this peer has not received yet. */
  missingTemplate?: {
    cid: string
  },
  /** A query row: its description is the search text; results appear as reference rows under it. */
  query?: {
    market?: boolean
    executedAt?: number
    count?: number
  },
  /** A resource bank row (calendar, account, inventory): allocations and sub-banks are its children. */
  resource?: {
    type: 'calendar' | 'account' | 'inventory' | 'person' | 'points' | 'location'
    unit: string
    capacity?: number
  },
  /** An allocation row: locks `amount` of a resource bank (alias id `resource`), optionally for a time window. */
  allocation?: {
    /** Handler demands use the same signed entry as resource allocations. */
    capability?: NonNullable<FosDataContent['requirement']>['capability']
    options?: string[]
    peer?: string
    repo?: string
    tool?: string
    at?: number
    ref?: string
    choice?: number
    resource: string
    type: 'calendar' | 'account' | 'inventory' | 'person' | 'points' | 'location'
    amount: number
    unit: string
    /** Window the allocation holds for: start = now when absent, end = forever when absent. Every resource has its own calendar. */
    start?: number
    end?: number
    by?: string
    /** Location allocations ("at Paris"): the place, by name and/or coordinates (a device's position). */
    location?: { name?: string; lat?: number; lng?: number }
  },
  /** A reference row: this node stands for the node whose alias id is `id` (shown by title; follows it on click). */
  ref?: {
    id: string
    /** Set on a market result: the account that owns the referenced node (the row lives in their store, not ours). */
    owner?: string
    /** Device holding this version; content is fetched separately from the reference. */
    peer?: string
    /** Scoped locator for an unloaded node supplied by this peer. */
    scope?: string[]; branches?: Array<{ scope: string[]; name: string }>
    /** An unloaded node its provider listed as held (`NodeChild.held`): a reference row, or a node a third peer holds. */
    held?: boolean
    version?: string
  },
  proposal?: {
    status: 'open' | 'rejected'
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
  // Peer reference fields (stored on peer reference nodes at root)
  /** Peer identifier (typically derived from public key) */
  peerId?: {
    content: string;
  };
  /** Peer's Ed25519 public key (base64) */
  publicKey?: {
    content: string;
  };
  /** Human-readable name for the peer */
  name?: {
    content: string;
  };
  // Peer connection persistence
  /** SDP offer for reconnecting to this peer */
  peerSdpOffer?: {
    content: string;
    timestamp: number;
    active: boolean;
  };
}



/**
 * Canonical node content in FosStore.table and on disk. Rows point to nodes by CID.
 */
export type FosNodeContent = {
  data: FosDataContent,
  children: FosPathElem[];  // Ordered today: row order still contributes to CID v4.
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




/** A row: [instruction node CID, target node CID], used in memory and in serialization. */
export type FosPathElem = [FosNodeId, FosNodeId]
export type FosPath = FosPathElem[]
export type FosRoute = [FosPathElem, ...FosPath]

/** Serialized form of the in-memory Map<CID, FosNodeContent>. */
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
