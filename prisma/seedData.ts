import { FosContextData, FosNodeContent, FosNodeId, FosNodesData } from "@/shared/types";

import { v4 as uuidv4 } from 'uuid';

export type GeneratedResult = { 
  nodesData: FosNodesData, 
  rootTargetNodeId: FosNodeId, 
  rootTargetNodeContent: FosNodeContent, 
  rootInstructionNodeId: FosNodeId, 
  rootInstructionNodeContent: FosNodeContent 
}

export const generateSeedContext = (): GeneratedResult  => {


    let ids: { [key: string] : string } = {

    }

    const genId = (name: string) => {
        if (ids[name] === undefined) {
            ids[name] = uuidv4()
        }
        return ids[name]
    }    

    const rootTargetNodeContent: FosNodeContent = {
        data: {
          description: { 
            content: "My Goals",
          }
        },
        children: [
          ["WORKFLOW",genId("task1")],
          ["WORKFLOW", genId("task2")],
          [genId("task3"), "COMPLETION"],
          // ["WORKFLOW", "task4"],
          // ["task5L", "task5R"]
        ]
    }

    const rootInstructionNodeContent: FosNodeContent = {
      data: {
        description: { 
          content: "Root Instruction",
        }
      },
      children: []
    }

    const nodesData: FosNodesData = {
        
        [genId("task1")]: {
          data: {
            description: {
              content: "Task 1a"
            }
          },
          children: [
          ["WORKFLOW", genId("task1a_1")],
          ["WORKFLOW", genId("task1a_2")],
          ["WORKFLOW", genId("task1a_3")]
          ]
        },
        [genId("task1a_1")]: {
          data: {
            description: {
              content: "Task 1a.1"
            }
          },
          children: [
          ]
        },
        [genId("task1a_2")]: {
          data: {
            description: {
              content: "Task 1a.2"
            }
          },
          children: [
          ]
        },
        [genId("task1a_3")]: {
          data: {
            description: {
              content: "Task 1a.3"
            }
          },
          children: [
          ]
        },
      
        // Task 2
        [genId("task2")]: {
          data: {
            description: {
              content: "Task 2a"
            }
          },
          children: [
            [genId("task2a_1"), "CHOICE"],
          ]
        },
        [genId("task2a_1")]: {
          data: {
            option: {
              selectedIndex: 0,
              defaultResolutionStrategy: "selected",
            },
            description: {
              content: "Task 2a.1"
            }
          },
          children: [
            [genId("task2a_1a_1"), "SELECTED" ],
            [genId("task2a_1a_2"), "NOTSELECTED" ],
            [genId("task2a_1a_3"), "NOTSELECTED" ],
          ]
        },
        [genId("task2a_1a_1")]: {
          data: {
            description: {
              content: "Task 2a.1a.1"
            }
          },
          children: [
          ]
        },
        [genId("task2a_1a_2")]: {
          data: {
            description: {
              content: "Task 2a.1b.1"
            }
          },
          children: [
          ]
        },
        [genId("task2a_1a_3")]: {
          data: {
            description: {
              content: "Task 2a.1c.1"
            }
          },
          children: [
          ]
        },
      
      
        // Task 3
      
        [genId("task3")]: { 
          data: {
            description: {
              content: "Todo 3a"
            }
          },
          children: [
          [genId("task3a_1"), "COMPLETION", ],
          [genId("task3a_2"), "COMPLETION"],
          [genId("task3a_3"), "COMPLETION"]
          ]
        },
        [genId("task3a_1")]: {
          data: {
            description: {
              content: "Todo 3a.1"
            }
          },
          children: [
          ]
        },
        [genId("task3a_2")]: {
          data: {
            description: {
              content: "Todo 3a.2"
            }
          },
          children: [
          ]
        },
        [genId("task3a_3")]: {
          data: {
            description: {
              content: "Todo 3a.3"
            }
          },
          children: [
          ]
        },

    }



    const context: GeneratedResult = {
        nodesData: nodesData,
        rootTargetNodeId: genId("root"),
        rootTargetNodeContent,
        rootInstructionNodeId: genId("rootInstruction"),
        rootInstructionNodeContent
    }

    return context


}