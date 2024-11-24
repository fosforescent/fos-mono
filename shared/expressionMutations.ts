import exp from "constants";
import { FosExpression } from "./dag-implementation/expression";
import { FosNode } from "./dag-implementation/node";














const addSearchQuery = (expr: FosExpression, searchQuery: string) => {




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