import { FosContextData, FosNodesData } from "../../shared/types";
import { addToMockContext, } from "./mockupData";




export const marketMockupContextStart: FosContextData = addToMockContext(["workflow", "task2"], 
  {


    // possibly link todo as subtask
    // task1a_2: {
    //   data: {
    //     description: {
    //       children: "Task 1a.2"
    //     },
    //     todo: {
    //       completed: false,
    //     }
    //   },
    //   children: [
    //   ]
    // },
  

    // Task 2
    task2: {
      data: {

      },
      children: [
        ["market_task_id", "context_buyer_wants_to_provide_cloned"],
      ]
    },
    marketTask_id: {

      data: {
        peers: ["seller", "buyer"],
      }, 
      children: [
        ["SELLER_BID_APPROVAL", "get_seller_bid_approval"],
        ["BUYER_BID_APPROVAL", "get_buyer_bid_approval"],
        ["BID", "make_estimate"], // 
        ["FULFILLMENT", "seller_workflow_task_on_estimate_approval"],
        ["SELLER_FULFILLMENT_APPROVAL", "get_seller_fulfillment_approval"],
        ["BUYER_FULFILLMENT_APPROVAL", "get_buyer_fulfillment_approval"],
        ["PAYMENT", "buyer_make_payment_task_on_fulfillment_approval"],
        ["CANCELLATION", "make_cancellation"],
        ["REFUND", "make_refund_task"],
        ["REFUND_APPROVAL", "get_refund_approval"],
        ["REVERSED_PAYMENT", "reverse_payment_task"],
      ]
    },
    make_refund_task: {
      data: {},
      children: [
        ["makeRefundWorkflow_id", "BUYER_REFUND_REQUEST"],
        ["makeRefundWorkflow_id", "SELLER_REFUND_REQUEST"]
      ]

    },
    make_cancellation: {
      data: {},
      children: [
        ["makeCancellationWorkflow_id", "BUYER_CANCELLATION_REQUEST"],
        ["makeCancellationWorkflow_id", "SELLER_CANCELLATION_REQUEST"]
      ]
    },
    makeRefundWorkflow_id: {
      data: {},
      children: [
        ["PAYMENT", "{actual_payment_node_id}"],
        ["REVERSED_PAYMENT", "reverse_payment_task"]
      ]
    },
    reverse_payment_task: {
      data: {},
      children: [
        ["reversePaymentWorkflow_id", "{actual_payment_node_id}"]
      ]
    },
    make_estimate: {
      data: {},
      children: [
        ["sellerMakeEstimate_workflow_id", "SELLER_BID_APPROVAL"] // should also be in seller's context as todo with link to market task
      ]

    },
    seller_workflow_task: {
      data: {},
      children: [
        ["startSellerWorkflow_id", "BUYER_BID_APPROVAL"], // should also be in seller's context as todo with link to market task
      ]
      
    },
    buyer_make_payment_task_on_fulfillment_approval: {
      data: {},
      children: [
        ["startPaymentWorkflow_id", "BUYER_FULFILLMENT_APPROVAL"], // should also be in seller's context as todo with link to market task
      ]
      

    },
    context_buyer_wants_to_provide_cloned: {
      data: {
        description: {
          children: "Returns"
        },
        todo: {
          completed: false,
        },
      }, 
      children: [
        ["DOCUMENT", "blahblah_cloned"],
        // ["Clone context buyer wants to provide", "BUYER_CONTEXT"]
        ["ETC", "other_context_cloned"]
      ]

    },

    startSellerFulfillmentWorkflow_id: {
      data: {
        description: {
          children: "Start Seller Workflow"
        },
        todo: {
          completed: false,
        },
      }, 
      children: [
        ["fulfillment_approval", "void"],
        ["sellerWorkflow_id", "SELLER_CONTEXT_PLUS_original_task_workflow_args_cloned"]
      ]
    },
    "SELLER_CONTEXT_PLUS_original_task_workflow_args_cloned": {
      // good candidate for server native instruction
      data: {
        description: {
          children: "Clone Tasks and Add"
        },
        todo: {
          completed: false,
        },
      },
      children: [
        ["CLONECONTEXT", "(whole context)"]
      
      ]
    },



  
  
  })


export const marketMockupContextWithTaskCreated: FosContextData = addToMockContext(["workflow", "task2"], 
  {
   
        // Task 2
    task2: {
      data: {
        description: {
          children: "Task 2a"
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
          children: "Task 2a.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
        ["task2a_1a_1", "ctx"],
      ]
    },
    task2a_1a_1: {
      data: {
        description: {
          children: "Task 2a.1a.1"
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
          children: "Task 2a.1b.1"
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
          children: "Task 2a.1c.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
  
  
  })
export const marketMockupContext: FosContextData = addToMockContext(["workflow", "task2"], 
  {
    
  
  
    task2a_1: {
      data: {
        description: {
          children: "Task 2a.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
        ["task2a_1a_1", "ctx"],
      ]
    },
    task2a_1a_1: {
      data: {
        description: {
          children: "Task 2a.1a.1"
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
          children: "Task 2a.1b.1"
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
          children: "Task 2a.1c.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
  
  
  })
export const marketMockupStartContext: FosContextData = addToMockContext(["workflow", "task2"], 
  {
  
    task2a_1: {
      data: {
        description: {
          children: "Task 2a.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
        ["task2a_1a_1", "ctx"],
      ]
    },
    task2a_1a_1: {
      data: {
        description: {
          children: "Task 2a.1a.1"
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
          children: "Task 2a.1b.1"
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
          children: "Task 2a.1c.1"
        },
        todo: {
          completed: false,
        }
      },
      children: [
      ]
    },
  
  
  })


