import exp from "constants";
import { FosExpression } from "./dag-implementation/expression";
import { FosNode } from "./dag-implementation/node";
import { AppState, FosReactOptions } from "./types";
import { FosStore } from "./dag-implementation/store";





/**
 * 
 *       zoom,
        snip,
        moveBelowRoute,
        moveAboveRoute,
        moveToTopChildOfRoute,
        runTask,
        toggleCollapse,
        toggleOptionChildCollapse,
        moveLeft,
        moveRight,
        moveUp,
        moveDown,
        addDownSibling,
        setFocus,
        setDescription,
        setFocusAndDescription,
        setSelectedOption,
        addRowAsChild,
        deleteRow,
        addOption,
        deleteOption,
        suggestOption,
        suggestMagic,
        suggestSteps,
        suggestRecursive,
        moveFocusDown,
        moveFocusUp,
        moveFocusToEnd,
        moveFocusToStart,
        keyUpEvents,
        keyDownEvents,
        keyPressEvents,
        setNodeData,
        setSelectedIndex,

 */



export const getExpressionActions = (expr: FosExpression, setAppData: (data: AppState["data"]) => void) => {

  const addSearchQuery = (searchQuery: string) => {

    addSearchQueryAction(expr, searchQuery)
    const updatedContext: AppState["data"] = expr.store.exportContext([])
    setAppData(updatedContext)
  }

  const completeTask = () => {
    const currentTargetVal = expr.targetNode.value
    expr.updateTargetContent({ 
      data: {
        ...currentTargetVal.data,
        todo: {
          completed: true,
          time: Date.now()
        },
      },
      children: expr.targetNode.value.children
    })
    
    const updatedContext: AppState["data"] = expr.store.exportContext([])
    setAppData(updatedContext)
  }

  const addTask = (description: string) => {
    const newTaskNode = expr.store.create({
      data: {
        description: {
          content: description
        },
        updated: {
          time: Date.now()
        },
      },
      children: []
    })

    const newEdge = expr.targetNode.addEdge(newTaskNode.getId(), expr.store.primitive.completeField.getId())

  }

  const addComment = (comment: string, ) => {

    
  }



  return {
    completeTask
  }

}


const addSearchQueryAction = (expr: FosExpression, searchQuery: string) => {




}

const replaceInstruction = (expr: FosExpression, instruction: FosNode) => {



}

const replaceTarget = (expr: FosExpression, target: FosNode) => {

}



const completeTask = (expr: FosExpression) => {

}


const addTimeInterval = (expr: FosExpression, startTime: number | undefined, stopTime: number | undefined) => {


}

const startTimeInterval = (expr: FosExpression) => {


}

const stopTimeInterval = (expr: FosExpression) => {

}

const addGroup = (expr: FosExpression, groupDescription: string) => {

}

const inviteToGroup = (expr: FosExpression, groupTarget: FosNode) => {


}

const addComment = (expr: FosExpression, comment: string) => {

}

const addLink = (expr: FosExpression, nodeToLink: FosNode) => {

}

const deleteLink = (expr: FosExpression, linkNode: FosNode) => {

}

const deleteGroup = (expr: FosExpression, group: FosNode) => {

}

const deleteComment = (expr: FosExpression, comment: FosNode) => {

}

const editComment = (expr: FosExpression, comment: FosNode, newComment: string) => {

}


const makeChoice = (expr: FosExpression, option: FosNode) => {


}

const makeProposal = (expr: FosExpression) => {

}

const makeBranch = (expr: FosExpression, branch: string) => { 

}

const resolveConflict = (expr: FosExpression, conflict: string) => {

}

const revertToPrevious = (expr: FosExpression, previous: FosNode) => {

}


const createBid = (expr: FosExpression, bid: string) => {

}


const createOffer = (expr: FosExpression, offer: string) => {


}

const upvote = (expr: FosExpression, node: FosNode) => {

}

const downvote = (expr: FosExpression, node: FosNode) => {


}

const approve = (expr: FosExpression, node: FosNode) => {

}

const createCommit = (expr: FosExpression) => {

}

const sendInvoice = (expr: FosExpression, invoice: FosNode) => {

}

const addEntryToInvoice = (expr: FosExpression, invoice: FosNode, entry: FosNode) => {

}

const addCommentToInvoice = (expr: FosExpression, invoice: FosNode, comment: FosNode) => {

}

const updateEntryInInvoice = (expr: FosExpression, invoice: FosNode, entry: FosNode, newEntry: string) => {

}

const addPaymentToInvoice = (expr: FosExpression, invoice: FosNode, payment: FosNode) => {
  
}


const toggleMarketService = (expr: FosExpression) => {

}


const toggleServiceForGroup = (expr: FosExpression, group: FosNode) => {

}


const toggleMarketRequest = (expr: FosExpression) => {

}

export const attachUserToGroup = async (groupStore: FosStore, userStore: FosStore) => {
  
  const groupExpr = new FosExpression(groupStore, [])

  const userExpr = new FosExpression(userStore, [])
  

  groupExpr.addPeer



  const userGroup = await prisma.fosGroup.findFirst({

  const storedCtx = loadCtxFromDb(prisma, user.)


    const userFosGroup = await prisma.fosGroup.findFirst({
        where: { id: user.fosGroupId },
        include: { rootTargetNode: true, rootInstructionNode: true }
    })
    if (!userFosGroup) {
        throw new Error('User fos group not found')
    }

    const userRootNode = await prisma.fosNode.findFirst({
        where: { id: userFosGroup?.rootTargetNode.id },
    })
    
    if(!userRootNode) {
        throw new Error('User root node not found')
    }




    const groupUserNodeAccessLink = await prisma.fosNodeGroupAccessLink.create({
        data: {
            fosNodeId: group.rootTargetNodeId,
            fosGroupId: userFosGroup.id,
        }
    })

    if (userRootNode?.data) {
        const nodeContent = userRootNode.data as FosNodeContent
        if (!nodeContent.children) {
          console.log('nodeContent', nodeContent)
          throw new Error('User root node has no children')
        }       
        const newNodeData = {
            data: nodeContent.data,
            children: [...nodeContent.children, ["GROUP", group.rootTargetNodeId]]
        }

        await prisma.fosNode.update({
            where: { id: userRootNode?.id },
            data: {
                data: newNodeData
            }
        })
    }

    const groupRootInstructionNode = await prisma.fosNode.findFirst({
        where: { id: group.rootInstructionNodeId },
    })

    if (groupRootInstructionNode?.data) {
        const nodeContent = groupRootInstructionNode.data as FosNodeContent
        if (!nodeContent.children) {
          console.log('nodeContent', nodeContent)
          throw new Error('User root node has no children')
        }       
        const newNodeData = {
            data: nodeContent.data,
            children: [...nodeContent.children, ["PEER", userFosGroup.rootTargetNodeId]]
        }

        await prisma.fosNode.update({
            where: { id: groupRootInstructionNode?.id },
            data: {
                data: newNodeData
            }
        })
    }

}