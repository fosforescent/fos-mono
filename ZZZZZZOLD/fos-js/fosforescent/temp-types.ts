
import { FosPeer, IFosPeer } from './fosPeer';
import { IFosNode } from './fosNodeBase';

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
}



export type FosNodeContent = {
  data: FosDataContent,
  content: [string, string][];
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

export type NodeAddress = string
export type ContentId = string
export type FosNodeId  = NodeAddress | ContentId

export type RouteElement = [FosNodeId, FosNodeId] 




export type FosTrail = [[string, string], ...[string, string][]]
export type FosPath = [string, string][]
export type FosRoute = [[string, string], ...[string, string][]]

export type FosNodesData = { [key: string]: FosNodeContent }

export type FosContextData = { 
  nodes: FosNodesData,
  trail: FosPath | null,
  focus: {
    route: FosPath,
    char: number
  } | null,
}

export type {
  IFosPeer,
  IFosNode
}

export {
  FosPeer,
}