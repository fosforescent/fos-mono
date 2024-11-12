
import { FosContextData, FosNodesData, FosTrail } from "@/fos-js";



export const defaultTrail: FosTrail = [["root", "root"] as [string, string]]

export const defaultFocus = {
  route: defaultTrail,
  char: 0
}

export const defaultNodes: FosNodesData = {
  root: {
    data: {
      description: { 
        content: "Fosforescent Root",
      }

    },
    content: [
      ["todo", "startTask"]
    ]
  },
  startTask: {
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
      // ["workflow" "task4"],
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
  trail: defaultTrail,
  focus: defaultFocus,
}