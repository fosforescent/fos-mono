import { FosContextData, FosNodeContent, FosNodeId, FosNodesData } from "@/fos-combined/types";

import { v4 as uuidv4 } from 'uuid';

export const generateSeedContext = (): { nodesData: FosNodesData, rootNodeId: FosNodeId, rootNodeContent: FosNodeContent } => {


    let ids: { [key: string] : string } = {

    }

    const genId = (name: string) => {
        if (ids[name] === undefined) {
            ids[name] = uuidv4()
        }
        return ids[name]
    }    

    const rootNodeContent: FosNodeContent = {
        data: {
          description: { 
            content: "My Goals",
          }
        },
        content: [
          ["workflow",genId("task1")],
          ["workflow", genId("task2")],
          ["todo", genId("task3")],
          // ["workflow", "task4"],
          // ["task5L", "task5R"]
        ]
    }

    const nodesData: FosNodesData = {
        
        [genId("task1")]: {
          data: {
            description: {
              content: "Task 1a"
            }
          },
          content: [
          ["workflow", genId("task1a_1")],
          ["workflow", genId("task1a_2")],
          ["workflow", genId("task1a_3")]
          ]
        },
        [genId("task1a_1")]: {
          data: {
            description: {
              content: "Task 1a.1"
            }
          },
          content: [
          ]
        },
        [genId("task1a_2")]: {
          data: {
            description: {
              content: "Task 1a.2"
            }
          },
          content: [
          ]
        },
        [genId("task1a_3")]: {
          data: {
            description: {
              content: "Task 1a.3"
            }
          },
          content: [
          ]
        },
      
        // Task 2
        [genId("task2")]: {
          data: {
            description: {
              content: "Task 2a"
            }
          },
          content: [
            ["option", genId("task2a_1")],
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
          content: [
            ["workflow", genId("task2a_1a_1")],
            ["workflow", genId("task2a_1a_2")],
            ["workflow", genId("task2a_1a_3")],
          ]
        },
        [genId("task2a_1a_1")]: {
          data: {
            description: {
              content: "Task 2a.1a.1"
            }
          },
          content: [
          ]
        },
        [genId("task2a_1a_2")]: {
          data: {
            description: {
              content: "Task 2a.1b.1"
            }
          },
          content: [
          ]
        },
        [genId("task2a_1a_3")]: {
          data: {
            description: {
              content: "Task 2a.1c.1"
            }
          },
          content: [
          ]
        },
      
      
        // Task 3
      
        [genId("task3")]: { 
          data: {
            description: {
              content: "Todo 3a"
            }
          },
          content: [
          ["todo", genId("task3a_1")],
          ["todo", genId("task3a_2")],
          ["todo", genId("task3a_3")]
          ]
        },
        [genId("task3a_1")]: {
          data: {
            description: {
              content: "Todo 3a.1"
            }
          },
          content: [
          ]
        },
        [genId("task3a_2")]: {
          data: {
            description: {
              content: "Todo 3a.2"
            }
          },
          content: [
          ]
        },
        [genId("task3a_3")]: {
          data: {
            description: {
              content: "Todo 3a.3"
            }
          },
          content: [
          ]
        },
    }



    const context: { nodesData: FosNodesData, rootNodeId: FosNodeId, rootNodeContent: FosNodeContent } = {
        nodesData: nodesData,
        rootNodeId: genId("root"),
        rootNodeContent
    }

    return context


}