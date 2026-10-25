

export type FosDataContent = {
  /** A constructor row's parameter, optionally bound from the caller's environment. */
  scalar?: { type: 'text' | 'number' | 'peer' | 'time' | 'boolean' | 'null'; value: string | number | boolean | null };
  presentation?: { sequence?: boolean; icon?: string };
  created?: { time: number };
  position?: { value: number };
  error?: {
    target: string;
    instruction: string;
    targetIsError: boolean;
    instructionIsError: boolean;
    message: string;
  }
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
  /** On a proposal node (a peer's branch at a link node). */
  /** On a member reference: granted capabilities (CAPABILITY edges) the owner has switched off; the member still sees them, as offline. */
  disabledCapabilities?: {
    content: string[]
  },
  /** On a member reference: the constructors the owner switched off in that peer's menu here (menu ids). */
  disabledConstructors?: {
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
  /** A property path is code/data in the same ref shape as an explicitly bound input. */
  refExpression?: import('./sync/ref-paths').RefExpression,
  /** Only a local runtime meaning attached to this graph value can execute it. */
  primitive?: import('./sync/primitives').Primitive,
  /** Installation history only; availability is always determined by current ref rows. */
  primitiveDefaults?: { sources: string[] },
  /** Output refs may remain mutable or unfilled when the instruction starts. */
  refRole?: 'input' | 'output',
  /** A compiler-local binder. References to it use this node's CID, never an editing alias. */
  refHole?: { slot: number; role: 'input' | 'output' },
  refCompilation?: { cid: string },
  /** A signature over this value's unsigned node by the key named; made and checked through the sign and verify-signature capabilities. */
  signature?: { key: string; value: string },
  /** On a reference-error template: the template a row is pinned to that this peer has not received yet. */
  missingTemplate?: {
    cid: string
  },
  /** A query row: its title is the search text; results appear as reference rows under it. */
  query?: {
    market?: boolean
    executedAt?: number
    count?: number
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
  /** On a node link endpoint (a provideNode ref on the store root's alias): the local node it links (its id), and whether that node is the other peer's projection here. */
  nodeLink?: {
    node: string
    projection?: boolean
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
  updated?: {
    time: number;
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
}



/**
 * Canonical node content in FosStore.table and on disk. Rows point to nodes by CID.
 */
export type FosNodeContent = {
  data: FosDataContent,
  children: FosPathElem[];  // Ordered today: row order still contributes to CID v4.
}

/** A row: [left node cid, right node cid], used in memory and in serialization. */
export type FosPathElem = [string, string]

/** Serialized form of the in-memory Map<CID, FosNodeContent>. */
export type FosNodesData = { [cid: string]: FosNodeContent }

export type FosContextData = {
  nodes: FosNodesData,
  rootNodeId: string,
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


export type UserProfile = {
  displayName: string,

}


export type LoginResult = {
  access_token: string,
  type: string,
} & InfoState
