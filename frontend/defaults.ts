




import { Delta } from "@n1ru4l/json-patch-plus";

import { useToast } from "@/frontend/components/ui/use-toast";
import { AppState, FosContextData, FosNodesData, FosPath, InfoState, TrellisSerializedData } from "../shared/types";



export const getMaxDepth = () => {
  return ( (window.innerWidth - 500) / 100)
}


const rootId = window.crypto.randomUUID()
const startTaskId = window.crypto.randomUUID()

export const defaultTrail: FosPath = []

export const defaultFocus = {
  route: defaultTrail,
  char: 0
}


export const defaultNodes: FosNodesData = {
  [startTaskId]: {
    data: {
      description: { 
        content: "",
      }
    },
    children: [
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
    children: [
      ["workflow", "startTask"]
    ]
  },
  startTask: {
    data: {
      description: { 
        content: "Learn to use Fosforescent",
      }
    },
    children: [
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
    children: [
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
    children: [
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
    children: [
    ]
  },
  task1a_2: {
    data: {
      description: {
        content: "Task 1a.2"
      }
    },
    children: [
    ]
  },
  task1a_3: {
    data: {
      description: {
        content: "Task 1a.3"
      }
    },
    children: [
    ]
  },

  // Task 2
  task2: {
    data: {
      description: {
        content: "Task 2a"
      }
    },
    children: [
      ["task2a_1", "option_for_task2"],
    ]
  },
  option_for_task2: {
    data: {
      option: {
        selectedIndex: 0,
        defaultResolutionStrategy: "selected",
      },
    }, 
    children: []
  },
  task2a_1: {
    data: {

      description: {
        content: "Task 2a.1"
      }
    },
    children: [
      ["task2a_1a_1", "unit"],
      ["task2a_1a_2", "unit"],
      ["task2a_1a_3", "unit"],
    ]
  },
  task2a_1a_1: {
    data: {
      description: {
        content: "Task 2a.1a.1"
      }
    },
    children: [
    ]
  },
  task2a_1b_1: {
    data: {
      description: {
        content: "Task 2a.1b.1"
      }
    },
    children: [
    ]
  },
  task2a_1c_1: {
    data: {
      description: {
        content: "Task 2a.1c.1"
      }
    },
    children: [
    ]
  },


  // Task 3

  task3: { 
    data: {
      description: {
        content: "Task 3a"
      }
    },
    children: [
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
    children: [
    ]
  },
  task3a_2: {
    data: {
      description: {
        content: "Task 3a.2"
      }
    },
    children: [
    ]
  },
  task3a_3: {
    data: {
      description: {
        content: "Task 3a.3"
      }
    },
    children: [
    ]
  },
}

export const defaultContext: FosContextData = {
  nodes: defaultNodes,
  route: defaultTrail,
  baseNodeContent: {
    data: {
      description: { 
        content: "Fosforescent Root",
      }

    },
    children: [
      [startTaskId, "COMPLETION"]
    ]
  },
  baseNodeInstruction: {
    data: {
      description: { 
        content: "Learn to use Fosforescent",
      }
    },
    children: [
    ]
  }
}






export const initialInfoState: InfoState = {
  cookies: localStorage.getItem('cookiePrefs') ? JSON.parse(localStorage.getItem('cookiePrefs') || "") : undefined,
  emailConfirmed: false,
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
  "rowDepth": getMaxDepth(),
  "activity": "todo",
  "mode": "execute",
  "view": "Queue",
  "dragInfo": {
    "dragging": null,
    "dragOverInfo": null
  }
}


declare const __FOS_API_URL__: string;


export const initialDataState: AppState =  {

  data: {
    fosData: defaultContext,
    trellisData: defaultTrellisData
  },
  auth: initialAuthState,
  info: initialInfoState,
  theme: JSON.parse(localStorage.getItem("theme") || "null") || "system",
  apiUrl: __FOS_API_URL__,
  loaded: false
}

