import { FosContextData, FosNodesData } from "../../shared/types";
import { addToMockContext } from "./mockupData";




export const optionMockupContextStart: FosContextData = addToMockContext(["WORKFLOW", "task2"], 
  {
    // Task 2
    task2: {
      data: {
        description: {
          content: "Task 2a"
        },
        todo: {
          completed: false,
        }
      },
      children: [
        ["task2a_1", "CHOICE"], // holds context until triggered
        // ["task2a_1", "optionNode"]
      ]
    },
    // optionNode: {
    //   data: {
    //     description: {
    //       content: "Option Node"
    //     },
    //     option: {
    //       selectedIndex: 0,
    //       defaultResolutionStrategy: "selected",
    //     }
    //   },
    //   children: [
    //     ["SELECTION", "GET_SELECTION_FROM_CONTEXT"]
    //   ]
    // },

    task2a_1: {
      data: {
        description: {
          content: "Task 2a.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
        ["task2a_1a_1", "SELECTED"], // will pass context through here
        ["task2a_1b_1", "NOTSELECTED"],
        ["task2a_1c_1", "NOTSELECTED"],
      ]
    },
    task2a_1a_1: {
      data: {
        description: {
          content: "Task 2a.1a.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
    task2a_1b_1: {
      data: {
        description: {
          content: "Task 2a.1b.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
    task2a_1c_1: {
      data: {
        description: {
          content: "Task 2a.1c.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
  
  
  
  })



  export const optionMockupContextEnd: FosContextData = addToMockContext(["WORKFLOW", "task2"], 
    {
      
     // Task 2
     task2: {
      data: {
        description: {
          content: "Task 2a"
        },
        todo: {
          completed: false,
        }
      },
      children: [
        ["task2a_1a_1", "OPTION"], // holds context until triggered
      ]
    },

    task2a_1a_1: {
      data: {
        description: {
          content: "Task 2a.1a.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
    task2a_1b_1: {
      data: {
        description: {
          content: "Task 2a.1b.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
    task2a_1c_1: {
      data: {
        description: {
          content: "Task 2a.1c.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
  
  
    
    })
  
  