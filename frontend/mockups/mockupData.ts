import { FosContextData, FosNodesData, FosPathElem } from "../../shared/types";




export const addToMockContext = (rootEntry: FosPathElem, nodes: FosNodesData) => {


  const task1: FosNodesData = {
    task1: {
      data: {
        description: {
          content: "Task 1a"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ["WORKFLOW", "task1a_1"],
      ["WORKFLOW", "task1a_2"],
      ["WORKFLOW", "task1a_3"]
      ]
    },
    task1a_1: {
      data: {
        description: {
          content: "Task 1a.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
    task1a_2: {
      data: {
        description: {
          content: "Task 1a.2"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
    task1a_3: {
      data: {
        description: {
          content: "Task 1a.3"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
  }

  const task3: FosNodesData = {
    
    // Task 3

    task3: { 
      data: {
        description: {
          content: "Task 3a"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ["WORKFLOW", "task3a_1"],
      ["WORKFLOW", "task3a_2"],
      ["WORKFLOW", "task3a_3"]
      ]
    },
    task3a_1: {
      data: {
        description: {
          content: "Task 3a.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
    task3a_2: {
      data: {
        description: {
          content: "Task 3a.2"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
    task3a_3: {
      data: {
        description: {
          content: "Task 3a.3"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
  }


  const defaultNodesMinusTask2: FosNodesData = {

    
      
    
      ...task1,
      ...task3
    }


  const newContextMinusTask2: FosContextData = {
    nodes: {
      ...nodes,
      ...defaultNodesMinusTask2
    },
    route: [["root", "root"]],
    baseNodeContent: {
      data: {
        description: { 
          content: "My Goals",
        }
      },
      children: [
        ["WORKFLOW", "task1"],
        rootEntry,
        ["WORKFLOW", "task3"],
        // ["WORKFLOW", "task4"],
        // ["task5L", "task5R"]
      ]
    },
    baseNodeInstruction: {
      data: {},
      children: []
    }

  }


  return newContextMinusTask2
}
