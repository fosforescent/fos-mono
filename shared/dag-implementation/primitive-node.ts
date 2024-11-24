import { fi } from "date-fns/locale"
import { FosNodeContent } from "../types"
import { FosNode } from "./node"
import { FosStore } from "./store"



export const getTerminalNode = (store: FosStore) => {
  const terminalNode = store.create({
    data: {},
    children: []
  }, "TERMINAL")
  // console.log('terminalNode', terminalNode)
  return terminalNode
}

export const getUnitNode = (store: FosStore) => {
  const terminalNode = getTerminalNode(store)
  const unitNode = store.create({
    data: {},
    children: [[terminalNode.getId(), terminalNode.getId()]]
}, "UNIT")
  // console.log('unitNode', unitNode)
  return unitNode
}

// export const getAllOfNode = (store: FosStore) => {
//   const unitNode = getUnitNode(store)
//   const allOfNode = store.create({
//     data: {},
//     children: [[unitNode.getId(), unitNode.getId()]]
//   })
//   return allOfNode
// }

export const getPreviousVersionNode = (store: FosStore) => generateConstructor(store, "PREV", 'Previous Version Constructor', [])
export const getFieldFieldNode = (store: FosStore) => generateConstructor(store, "FIELD", 'Field Field Constructor', [])
export const getStringFieldNode = (store: FosStore) => generateConstructor(store, "STRING", 'String Field Constructor', [])


export const getDescriptionFieldNode = (store: FosStore) => generateConstructor(store, "DESCRIPTION", 'String Field Constructor', [
  [store.fieldFieldNode.getId(), store.stringFieldNode.getId()]
])
export const getNameFieldNode = (store: FosStore) => generateConstructor(store, "NAME", 'Name Field Constructor', [
  [store.fieldFieldNode.getId(), store.stringFieldNode.getId()]
])


export const getWorkflowInstructionNode = (store: FosStore) => generateConstructor(store, "WORKFLOW", 'Option Not Selected Constructor', [])
export const getRootInstructionNode = (store: FosStore) => generateConstructor(store, "ROOT", 'Option Not Selected Constructor', [])
export const getCommentInstructionNode = (store: FosStore) => generateConstructor(store, "COMMENT", 'Comment Constructor', [])
export const getDocumentInstructionNode = (store: FosStore) => generateConstructor(store, "DOCUMENT", 'Document Constructor', [])


export const getOptionSelectedConstructor =  (store: FosStore) => generateConstructor(store, "SELECTED", 'Option Selected Constructor', [])
export const getOptionNotSelectedConstructor =  (store: FosStore) => generateConstructor(store, "NOTSELECTED", 'Option Not Selected Constructor', [])
export const getChoiceTargetNode =  (store: FosStore) => generateConstructor(store, "CHOICE", 'Option Choice Target', [
  // [store.optionSelectedConstructor.getId(), ],
  // [store.optionNotSelectedConstructor.getId(), ]
])

export const getTimeIntervalNode = (store: FosStore) => generateConstructor(store, "TIMEINTERVAL", 'Time Interval Constructor', [])
export const getCompleteFieldNode = (store: FosStore) => generateConstructor(store, "COMPLETION", 'Complete Field Constructor', [])

export const getLinkActionNode = (store: FosStore) => generateConstructor(store, "LINKACTION", 'Link Action Constructor', [])
export const getCreateActionNode = (store: FosStore) => generateConstructor(store, "CREATE", 'Create Action Constructor', [])
export const getDeleteActionNode = (store: FosStore) => generateConstructor(store, "DELETE", 'Delete Action Constructor', [])

export const getCopyActionNode = (store: FosStore) => generateConstructor(store, "COPY", 'Copy Action Constructor', [])
export const getMoveActionNode = (store: FosStore) => generateConstructor(store, "MOVE", 'Move Action Constructor', [])
export const getRenameActionNode = (store: FosStore) => generateConstructor(store, "RENAME", 'Rename Action Constructor', [])

export const getApprovalFieldNode = (store: FosStore) => generateConstructor(store, "APPROVAL", 'Approval Field Constructor', [])
export const getVoteFieldNode = (store: FosStore) => generateConstructor(store, "VOTE", 'Vote Field Constructor', [])
export const getContactFieldNode = (store: FosStore) => generateConstructor(store, "CONTACT", 'Contact Field Constructor', [])
export const getRoleFieldNode = (store: FosStore) => generateConstructor(store, "ROLE", 'Role Field Constructor', [])
export const getGroupFieldNode = (store: FosStore) => generateConstructor(store, "GROUP", 'Group Field Constructor', [])
export const getPersonFieldNode = (store: FosStore) => generateConstructor(store, "PERSON", 'Person Field Constructor', [])

export const getListFieldNode = (store: FosStore) => generateConstructor(store, "LIST", 'List Field Constructor', [])
export const getPatternFieldNode = (store: FosStore) => generateConstructor(store, "PATTERN", 'Pattern Field Constructor', [])
export const getNumberFieldNode = (store: FosStore) => generateConstructor(store, "NUMBER", 'Number Field Constructor', [])
export const getBooleanFieldNode = (store: FosStore) => generateConstructor(store, "BOOLEAN", 'Boolean Field Constructor', [])
export const getLinkFieldNode = (store: FosStore) => generateConstructor(store, "LINK", 'Link Field Constructor', [])

export const getDurationFieldNode = (store: FosStore) => generateConstructor(store, "DURATION", 'Duration Field Constructor', [])
export const getDateFieldNode = (store: FosStore) => generateConstructor(store, "DATE", 'Date Field Constructor', [])
export const getTimeFieldNode = (store: FosStore) => generateConstructor(store, "TIME", 'Time Field Constructor', [])

export const getEmailFieldNode = (store: FosStore) => generateConstructor(store, "EMAIL", 'Email Field Constructor', [])
export const getPhoneFieldNode = (store: FosStore) => generateConstructor(store, "PHONE", 'Phone Field Constructor', [])
export const getAddressFieldNode = (store: FosStore) => generateConstructor(store, "ADDRESS", 'Address Field Constructor', [])

export const getPriceFieldNode = (store: FosStore) => generateConstructor(store, "PRICE", 'Price Field Constructor', [])
export const getCurrencyFieldNode = (store: FosStore) => generateConstructor(store, "CURRENCY", 'Currency Field Constructor', [])

export const getBusinessFieldNode = (store: FosStore) => generateConstructor(store, "BUSINESS", 'Business Field Constructor', [])
export const getBusinessNameFieldNode = (store: FosStore) => generateConstructor(store, "BUSINESSNAME", 'Business Name Field Constructor', [])

export const getPaymentFieldNode = (store: FosStore) => generateConstructor(store, "PAYMENT", 'Payment Field Constructor', [])
export const getBidFieldNode = (store: FosStore) => generateConstructor(store, "BID", 'Bid Field Constructor', [])
export const getMarketServiceListingNode = (store: FosStore) => generateConstructor(store, "MARKETSERVICE", 'Market Listing Constructor', [])

export const getOfferFieldNode = (store: FosStore) => generateConstructor(store, "OFFER", 'Offer Field Constructor', [])
export const getMarketRequestListingNode = (store: FosStore) => generateConstructor(store, "MARKETREQUEST", 'Market Request Listing Constructor', [])

export const getInvoiceFieldNode = (store: FosStore) => generateConstructor(store, "INVOICE", 'Invoice Field Constructor', [])
export const getInvoiceCommentFieldNode = (store: FosStore) => generateConstructor(store, "INVOICECOMMENT", 'Invoice Comment Field Constructor', [])
export const getInvoiceItemFieldNode = (store: FosStore) => generateConstructor(store, "INVOICEITEM", 'Invoice Item Field Constructor', [])

export const getReceiptFieldNode = (store: FosStore) => generateConstructor(store, "RECEIPT", 'Receipt Field Constructor', [])
export const getQuoteFieldNode = (store: FosStore) => generateConstructor(store, "QUOTE", 'Quote Field Constructor', [])
export const getOrderFieldNode = (store: FosStore) => generateConstructor(store, "ORDER", 'Order Field Constructor', [])

export const getProjectFieldNode = (store: FosStore) => generateConstructor(store, "PROJECT", 'Project Field Constructor', [])

export const getActionFieldNode = (store: FosStore) => generateConstructor(store, "ACTION", 'Action Field Constructor', [])

export const getCompleteActionNode = (store: FosStore) => generateConstructor(store, "COMPLETE", 'Complete Action Constructor', [])
export const getStartActionNode = (store: FosStore) => generateConstructor(store, "START", 'Start Action Constructor', [])
export const getStopActionNode = (store: FosStore) => generateConstructor(store, "STOP", 'Stop Action Constructor', [])
export const getPauseActionNode = (store: FosStore) => generateConstructor(store, "PAUSE", 'Pause Action Constructor', [])
export const getCancelActionNode = (store: FosStore) => generateConstructor(store, "CANCEL", 'Cancel Action Constructor', [])
export const getResumeActionNode = (store: FosStore) => generateConstructor(store, "RESUME", 'Resume Action Constructor', [])

export const getInputActionNode = (store: FosStore) => generateConstructor(store, "INPUT", 'Input Action Constructor', [])
export const getRefundRequestActionNode = (store: FosStore) => generateConstructor(store, "REFUNDREQUEST", 'Refund Request Action Constructor', [])
export const getRefundActionNode = (store: FosStore) => generateConstructor(store, "REFUND", 'Refund Action Constructor', [])
export const getRefundCompleteActionNode = (store: FosStore) => generateConstructor(store, "REFUNDCOMPLETE", 'Refund Complete Action Constructor', [])

export const getReviewActionNode = (store: FosStore) => generateConstructor(store, "REVIEW", 'Review Action Constructor', [])
export const getApproveActionNode = (store: FosStore) => generateConstructor(store, "APPROVE", 'Approve Action Constructor', [])



export const getProposalFieldNode = (store: FosStore) => generateConstructor(store, "PROPOSAL", 'Proposal Field Constructor', [])
export const getRevisionFieldNode = (store: FosStore) => generateConstructor(store, "REVISION", 'Revision Field Constructor', [])

export const getTransactionFieldNode = (store: FosStore) => generateConstructor(store, "TRANSACTION", 'Transaction Field Constructor', [])
export const getLabelFieldNode = (store: FosStore) => generateConstructor(store, "LABEL", 'Label Field Constructor', [])
export const getComboFieldNode  = (store: FosStore) => generateConstructor(store, "COMBO", 'Combo Field Constructor', [])
export const getTagFieldNode = (store: FosStore) => generateConstructor(store, "TAG", 'Tag Field Constructor', [])

export const getInvoiceLineFieldNode = (store: FosStore) => generateConstructor(store, "INVOICECOMMENT", 'Invoice Comment Field Constructor', [])

export const getInvoiceItemLineFieldNode = (store: FosStore) => generateConstructor(store, "INVOICEITEM", 'Invoice Item Field Constructor', [])

export const getReceiptLineFieldNode = (store: FosStore) => generateConstructor(store, "RECEIPT", 'Receipt Field Constructor', [])
export const getExpressionFieldNode = (store: FosStore) => generateConstructor(store, "EXPRESSION", 'Expression Field Constructor', [])

export const getFirstNameFieldNode = (store: FosStore) => generateConstructor(store, "FIRSTNAME", 'First Name Field Constructor', [])
export const getLastNameFieldNode = (store: FosStore) => generateConstructor(store, "LASTNAME", 'Last Name Field Constructor', [])
export const getMiddleNameFieldNode = (store: FosStore) => generateConstructor(store, "MIDDLENAME", 'Middle Name Field Constructor', [])

export const getOptionConstructor = (store: FosStore) => generateConstructor(store, "OPTION", 'Option Constructor', [])


export const getSearchQueryNode = (store: FosStore) => generateConstructor(store, "SEARCHQUERY", 'Search Query Constructor', [])
export const getSearchResultsNode = (store: FosStore) => generateConstructor(store, "SEARCHRESULT", 'Search Result Constructor', [])

export const getErrorNode = (store: FosStore) => generateConstructor(store, "ERROR", 'Error Constructor', [])
export const getPeerNode = (store: FosStore) => generateConstructor(store, "PEER", 'Peer Constructor', [])
export const getRevertChangeNode = (store: FosStore) => generateConstructor(store, "REVERT", 'Revert Change Constructor', [])

export const getPublishNode = (store: FosStore) => generateConstructor(store, "PUBLISH", 'Publish Constructor', [])
export const getAppNode = (store: FosStore) => generateConstructor(store, "APP", 'App Constructor', [])
export const getSubscriptionNode = (store: FosStore) => generateConstructor(store, "SUBSCRIPTION", 'Subscription Constructor', [])
export const getOneTimeBuyNode = (store: FosStore) => generateConstructor(store, "ONETIMEBUY", 'One Time Buy Constructor', [])
export const getRecurringBuyNode = (store: FosStore) => generateConstructor(store, "RECURRINGBUY", 'Recurring Buy Constructor', [])
export const getErrorInstructionNode = (store: FosStore) => generateConstructor(store, "ERROR", 'Error Constructor', [])
export const getErrorTargetNode = (store: FosStore) => generateConstructor(store, "ERROR", 'Error Constructor', [])
export const getConflictNode = (store: FosStore) => generateConstructor(store, "CONFLICT", 'Conflict Constructor', [])



export const generateConstructor = (store: FosStore, alias: string, description: string, children: FosNodeContent["children"]) => {

  const nodeContent: FosNodeContent = {
    data: {
      description: {
        content: description
      }
    },
    children: children
  }

  const newNode = store.create(nodeContent, alias)
  if (!newNode) throw new Error('could not create node')
  return newNode
}






export const getNthDepNodeWithPattern = (store: FosStore, n: number, pattern: FosNode) => {
  if (n < 0) throw new Error('cannot get negative dep')

}



export const getNthCommentInstructionNode = (store: FosStore) => {


}



export const constructPrimitiveAliases = (store: FosStore) => {

  return {
    terminal: getTerminalNode(store),
    unit: getUnitNode(store),
    // allOf: getAllOfNode(store),
  }

}