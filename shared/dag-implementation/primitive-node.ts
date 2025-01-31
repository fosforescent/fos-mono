import { fi } from "date-fns/locale"
import { FosDataContent, FosNodeContent, FosPathElem } from "../types"
import { FosNode } from "./node"
import { FosStore } from "./store"

import { v4 as uuidv4 } from 'uuid';



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

export const getAllOfNode = (store: FosStore) => {
  const unitNode = getUnitNode(store)
  const allOfNode = store.create({
    data: {},
    children: [[unitNode.getId(), unitNode.getId()]]
  })
  return allOfNode
}


export const getStartRootAlias = (store: FosStore): FosNode => {
  const rootTarget = getTerminalNode(store)
  const rootInstruction = getRootInstructionNode(store)
  const targetConstructor = getTargetPointerConstructorNode(store)
  const instructionConstructor = getInstructionPointerConstructorNode(store)
  const prevConstructor = getPreviousVersionNode(store)
  const terminal = getTerminalNode(store)

  const newUuid = uuidv4()

  const aliasNode = store.create({
    data: {
      alias: {
        id: newUuid,
      }
    },
    children: [
      [targetConstructor.getId(), rootTarget.getId()],
      [instructionConstructor.getId(), rootInstruction.getId()],
      [prevConstructor.getId(), terminal.getId()]
    ]
  })
  // console.log('aliasNode', aliasNode.getId(), store.getNodeByAddress(aliasNode.getId()))
  return aliasNode
}


export const getPreviousVersionNode = (store: FosStore) => generateConstructor(store, "PREV", { description: { content : 'Previous Version Constructor' } }, [])
export const getFieldFieldNode = (store: FosStore) => generateConstructor(store, "FIELD", { description: { content : 'Field Field Constructor' } }, [])
export const getStringFieldNode = (store: FosStore) => generateConstructor(store, "STRING", { description: { content : 'String Field Constructor' } }, [])


export const getDescriptionFieldNode = (store: FosStore) => generateConstructor(store, "DESCRIPTION", { description: { content : 'String Field Constructor' } }, [
  [getFieldFieldNode, getStringFieldNode]
])

export const getNameFieldNode = (store: FosStore) => generateConstructor(store, "NAME", { description: { content : 'Name Field Constructor' } }, [
  [getFieldFieldNode, getStringFieldNode]
])


export const getWorkflowInstructionNode = (store: FosStore) => generateConstructor(store, "WORKFLOW", { description: { content : 'Option Not Selected Constructor' } }, [])
export const getRootInstructionNode = (store: FosStore) => generateConstructor(store, "ROOT", { description: { content : 'Root Instruction Constructor' } }, [])
export const getCommentInstructionNode = (store: FosStore) => generateConstructor(store, "COMMENT", { description: { content : 'Comment Constructor' } }, [])
export const getDocumentInstructionNode = (store: FosStore) => generateConstructor(store, "DOCUMENT", { description: { content : 'Document Constructor' } }, [])


export const getOptionSelectedConstructor =  (store: FosStore) => generateConstructor(store, "SELECTED", { description: { content : 'Option Selected Constructor' } }, [])
export const getOptionNotSelectedConstructor =  (store: FosStore) => generateConstructor(store, "NOTSELECTED", { description: { content : 'Option Not Selected Constructor' } }, [])
export const getChoiceTargetNode =  (store: FosStore) => generateConstructor(store, "CHOICE", { description: { content : 'Option Choice Target' } }, [
  // [store.optionSelectedConstructor.getId(), ],
  // [store.optionNotSelectedConstructor.getId(), ]
])

export const getTimeIntervalNode = (store: FosStore) => generateConstructor(store, "TIMEINTERVAL", { description: { content : 'Time Interval Constructor' } }, [])
export const getCompleteFieldNode = (store: FosStore) => generateConstructor(store, "COMPLETION", { description: { content : 'Complete Field Constructor' } }, [])

export const getLinkActionNode = (store: FosStore) => generateConstructor(store, "LINKACTION", { description: { content : 'Link Action Constructor' } }, [])
export const getCreateActionNode = (store: FosStore) => generateConstructor(store, "CREATE", { description: { content : 'Create Action Constructor' } }, [])
export const getDeleteActionNode = (store: FosStore) => generateConstructor(store, "DELETE", { description: { content : 'Delete Action Constructor' } }, [])

export const getCopyActionNode = (store: FosStore) => generateConstructor(store, "COPY", { description: { content : 'Copy Action Constructor' } }, [])
export const getMoveActionNode = (store: FosStore) => generateConstructor(store, "MOVE", { description: { content : 'Move Action Constructor' } }, [])
export const getRenameActionNode = (store: FosStore) => generateConstructor(store, "RENAME", { description: { content : 'Rename Action Constructor' } }, [])

export const getApprovalFieldNode = (store: FosStore) => generateConstructor(store, "APPROVAL", { description: { content : 'Approval Field Constructor' } }, [])
export const getVoteFieldNode = (store: FosStore) => generateConstructor(store, "VOTE", { description: { content : 'Vote Field Constructor' } }, [])
export const getContactFieldNode = (store: FosStore) => generateConstructor(store, "CONTACT", { description: { content : 'Contact Field Constructor' } }, [])
export const getRoleFieldNode = (store: FosStore) => generateConstructor(store, "ROLE", { description: { content : 'Role Field Constructor' } }, [])
export const getGroupFieldNode = (store: FosStore) => generateConstructor(store, "GROUP", { description: { content : 'Group Field Constructor' } }, [])
export const getPersonFieldNode = (store: FosStore) => generateConstructor(store, "PERSON", { description: { content : 'Person Field Constructor' } }, [])

export const getListFieldNode = (store: FosStore) => generateConstructor(store, "LIST", { description: { content : 'List Field Constructor' } }, [])
export const getPatternFieldNode = (store: FosStore) => generateConstructor(store, "PATTERN", { description: { content : 'Pattern Field Constructor' } }, [])
export const getNumberFieldNode = (store: FosStore) => generateConstructor(store, "NUMBER", { description: { content : 'Number Field Constructor' } }, [])
export const getBooleanFieldNode = (store: FosStore) => generateConstructor(store, "BOOLEAN", { description: { content : 'Boolean Field Constructor' } }, [])
export const getLinkFieldNode = (store: FosStore) => generateConstructor(store, "LINK", { description: { content : 'Link Field Constructor' } }, [])

export const getDurationFieldNode = (store: FosStore) => generateConstructor(store, "DURATION", { description: { content : 'Duration Field Constructor' } }, [])
export const getDateFieldNode = (store: FosStore) => generateConstructor(store, "DATE", { description: { content : 'Date Field Constructor' } }, [])
export const getTimeFieldNode = (store: FosStore) => generateConstructor(store, "TIME", { description: { content : 'Time Field Constructor' } }, [])

export const getEmailFieldNode = (store: FosStore) => generateConstructor(store, "EMAIL", { description: { content : 'Email Field Constructor' } }, [])
export const getPhoneFieldNode = (store: FosStore) => generateConstructor(store, "PHONE", { description: { content : 'Phone Field Constructor' } }, [])
export const getAddressFieldNode = (store: FosStore) => generateConstructor(store, "ADDRESS", { description: { content : 'Address Field Constructor' } }, [])

export const getPriceFieldNode = (store: FosStore) => generateConstructor(store, "PRICE", { description: { content : 'Price Field Constructor' } }, [])
export const getCurrencyFieldNode = (store: FosStore) => generateConstructor(store, "CURRENCY", { description: { content : 'Currency Field Constructor' } }, [])

export const getBusinessFieldNode = (store: FosStore) => generateConstructor(store, "BUSINESS", { description: { content : 'Business Field Constructor' } }, [])
export const getBusinessNameFieldNode = (store: FosStore) => generateConstructor(store, "BUSINESSNAME", { description: { content : 'Business Name Field Constructor' } }, [])

export const getPaymentFieldNode = (store: FosStore) => generateConstructor(store, "PAYMENT", { description: { content : 'Payment Field Constructor' } }, [])
export const getBidFieldNode = (store: FosStore) => generateConstructor(store, "BID", { description: { content : 'Bid Field Constructor' } }, [])
export const getMarketServiceListingNode = (store: FosStore) => generateConstructor(store, "MARKETSERVICE", { description: { content : 'Market Listing Constructor' } }, [])

export const getOfferFieldNode = (store: FosStore) => generateConstructor(store, "OFFER", { description: { content : 'Offer Field Constructor' } }, [])
export const getMarketRequestListingNode = (store: FosStore) => generateConstructor(store, "MARKETREQUEST", { description: { content : 'Market Request Listing Constructor' } }, [])

export const getInvoiceFieldNode = (store: FosStore) => generateConstructor(store, "INVOICE", { description: { content : 'Invoice Field Constructor' } }, [])
export const getInvoiceCommentFieldNode = (store: FosStore) => generateConstructor(store, "INVOICECOMMENT", { description: { content : 'Invoice Comment Field Constructor' } }, [])
export const getInvoiceItemFieldNode = (store: FosStore) => generateConstructor(store, "INVOICEITEM", { description: { content : 'Invoice Item Field Constructor' } }, [])

export const getReceiptFieldNode = (store: FosStore) => generateConstructor(store, "RECEIPT", { description: { content : 'Receipt Field Constructor' } }, [])
export const getQuoteFieldNode = (store: FosStore) => generateConstructor(store, "QUOTE", { description: { content : 'Quote Field Constructor' } }, [])
export const getOrderFieldNode = (store: FosStore) => generateConstructor(store, "ORDER", { description: { content : 'Order Field Constructor' } }, [])

export const getProjectFieldNode = (store: FosStore) => generateConstructor(store, "PROJECT", { description: { content : 'Project Field Constructor' } }, [])

export const getActionFieldNode = (store: FosStore) => generateConstructor(store, "ACTION", { description: { content : 'Action Field Constructor' } }, [])

export const getCompleteActionNode = (store: FosStore) => generateConstructor(store, "COMPLETE", { description: { content : 'Complete Action Constructor' } }, [])
export const getStartActionNode = (store: FosStore) => generateConstructor(store, "START", { description: { content : 'Start Action Constructor' } }, [])
export const getStopActionNode = (store: FosStore) => generateConstructor(store, "STOP", { description: { content : 'Stop Action Constructor' } }, [])
export const getPauseActionNode = (store: FosStore) => generateConstructor(store, "PAUSE", { description: { content : 'Pause Action Constructor' } }, [])
export const getCancelActionNode = (store: FosStore) => generateConstructor(store, "CANCEL", { description: { content : 'Cancel Action Constructor' } }, [])
export const getResumeActionNode = (store: FosStore) => generateConstructor(store, "RESUME", { description: { content : 'Resume Action Constructor' } }, [])

export const getInputActionNode = (store: FosStore) => generateConstructor(store, "INPUT", { description: { content : 'Input Action Constructor' } }, [])
export const getRefundRequestActionNode = (store: FosStore) => generateConstructor(store, "REFUNDREQUEST", { description: { content : 'Refund Request Action Constructor' } }, [])
export const getRefundActionNode = (store: FosStore) => generateConstructor(store, "REFUND", { description: { content : 'Refund Action Constructor' } }, [])
export const getRefundCompleteActionNode = (store: FosStore) => generateConstructor(store, "REFUNDCOMPLETE", { description: { content : 'Refund Complete Action Constructor' } }, [])

export const getReviewActionNode = (store: FosStore) => generateConstructor(store, "REVIEW", { description: { content : 'Review Action Constructor' } }, [])
export const getApproveActionNode = (store: FosStore) => generateConstructor(store, "APPROVE", { description: { content : 'Approve Action Constructor' } }, [])



export const getProposalFieldNode = (store: FosStore) => generateConstructor(store, "PROPOSAL", { description: { content : 'Proposal Field Constructor' } }, [])
export const getRevisionFieldNode = (store: FosStore) => generateConstructor(store, "REVISION", { description: { content : 'Revision Field Constructor' } }, [])

export const getTransactionFieldNode = (store: FosStore) => generateConstructor(store, "TRANSACTION", { description: { content : 'Transaction Field Constructor' } }, [])
export const getLabelFieldNode = (store: FosStore) => generateConstructor(store, "LABEL", { description: { content : 'Label Field Constructor' } }, [])
export const getComboFieldNode  = (store: FosStore) => generateConstructor(store, "COMBO", { description: { content : 'Combo Field Constructor' } }, [])
export const getTagFieldNode = (store: FosStore) => generateConstructor(store, "TAG", { description: { content : 'Tag Field Constructor' } }, [])

export const getInvoiceLineFieldNode = (store: FosStore) => generateConstructor(store, "INVOICECOMMENT", { description: { content : 'Invoice Comment Field Constructor' } }, [])

export const getInvoiceItemLineFieldNode = (store: FosStore) => generateConstructor(store, "INVOICEITEM", { description: { content : 'Invoice Item Field Constructor' } }, [])

export const getReceiptLineFieldNode = (store: FosStore) => generateConstructor(store, "RECEIPT", { description: { content : 'Receipt Field Constructor' } }, [])
export const getExpressionFieldNode = (store: FosStore) => generateConstructor(store, "EXPRESSION", { description: { content : 'Expression Field Constructor' } }, [])

export const getFirstNameFieldNode = (store: FosStore) => generateConstructor(store, "FIRSTNAME", { description: { content : 'First Name Field Constructor' } }, [])
export const getLastNameFieldNode = (store: FosStore) => generateConstructor(store, "LASTNAME", { description: { content : 'Last Name Field Constructor' } }, [])
export const getMiddleNameFieldNode = (store: FosStore) => generateConstructor(store, "MIDDLENAME", { description: { content : 'Middle Name Field Constructor' } }, [])

export const getOptionConstructor = (store: FosStore) => generateConstructor(store, "OPTION", { description: { content : 'Option Constructor' } }, [])


export const getSearchQueryNode = (store: FosStore) => generateConstructor(store, "SEARCHQUERY", { description: { content : 'Search Query Constructor' } }, [])
export const getSearchResultsNode = (store: FosStore) => generateConstructor(store, "SEARCHRESULT", { description: { content : 'Search Result Constructor' } }, [])

export const getErrorNode = (store: FosStore) => generateConstructor(store, "ERROR", { description: { content : 'Error Constructor' } }, [])
export const getPeerNode = (store: FosStore) => generateConstructor(store, "PEER", { description: { content : 'Peer Constructor' } }, [])
export const getRevertChangeNode = (store: FosStore) => generateConstructor(store, "REVERT", { description: { content : 'Revert Change Constructor' } }, [])

export const getPublishNode = (store: FosStore) => generateConstructor(store, "PUBLISH", { description: { content : 'Publish Constructor' } }, [])
export const getAppNode = (store: FosStore) => generateConstructor(store, "APP", { description: { content : 'App Constructor' } }, [])
export const getSubscriptionNode = (store: FosStore) => generateConstructor(store, "SUBSCRIPTION", { description: { content : 'Subscription Constructor' } }, [])
export const getOneTimeBuyNode = (store: FosStore) => generateConstructor(store, "ONETIMEBUY", { description: { content : 'One Time Buy Constructor' } }, [])
export const getRecurringBuyNode = (store: FosStore) => generateConstructor(store, "RECURRINGBUY", { description: { content : 'Recurring Buy Constructor' } }, [])
export const getErrorInstructionNode = (store: FosStore) => generateConstructor(store, "ERROR", { description: { content : 'Error Constructor' } }, [])
export const getErrorTargetNode = (store: FosStore) => generateConstructor(store, "ERROR", { description: { content : 'Error Constructor' } }, [])
export const getConflictNode = (store: FosStore) => generateConstructor(store, "CONFLICT", { description: { content : 'Conflict Constructor' } }, [])

export const getPeriodicTriggerNode = (store: FosStore) => generateConstructor(store, "PERIODIC", { description: { content : 'Periodic Trigger Constructor' } }, [])
export const getRequestTriggerNode = (store: FosStore) => generateConstructor(store, "REQUEST", { description: { content : 'Request Trigger Constructor' } }, [])
export const getManualTriggerNode = (store: FosStore) => generateConstructor(store, "MANUAL", { description: { content : 'Manual Trigger Constructor' } }, [])
export const getDailyTriggerNode = (store: FosStore) => generateConstructor(store, "DAILY", { description: { content : 'Daily Trigger Constructor' } }, [])
export const getWeeklyTriggerNode = (store: FosStore) => generateConstructor(store, "WEEKLY", { description: { content : 'Weekly Trigger Constructor' } }, [])
export const getMonthlyTriggerNode = (store: FosStore) => generateConstructor(store, "MONTHLY", { description: { content : 'Monthly Trigger Constructor' } }, [])
export const getYearlyTriggerNode = (store: FosStore) => generateConstructor(store, "YEARLY", { description: { content : 'Yearly Trigger Constructor' } }, [])

export const getDelayTriggerNode = (store: FosStore) => generateConstructor(store, "DELAY", { description: { content : 'Delay Trigger Constructor' } }, [])

export const getGroupShadowNode = (store: FosStore) => generateConstructor(store, "GROUPSHADOW", { description: { content : 'Group Shadow Constructor' } }, [])

export const getDereferenceAliasActionNode = (store: FosStore) => generateConstructor(store, "DEREFALIAS", { description: { content : 'Dereference Alias Node' } }, [])
export const getAliasConstructorNode =  (store: FosStore) => generateConstructor(store, "ALIAS", { description: { content : 'Alias Constructor Node' } }, [])
export const getTargetPointerConstructorNode =  (store: FosStore) => generateConstructor(store, "TARGETPOINTER", { description: { content : 'Target Constructor Node' } }, [])
export const getInstructionPointerConstructorNode = (store: FosStore) => generateConstructor(store, "INSTRUCTIONPOINTER", { description: { content : 'Alias Instruction Constructor Node' } }, [])

export const getBrachConstructorNode = (store: FosStore) => generateConstructor(store, "BRANCH", { description: { content : 'Branch Constructor Node' } }, [])

export const addChildAction = (store: FosStore) => generateConstructor(store, "ADDCHILD", { description: { content : 'Add Child Action Node' } }, [])
export const removeChildAction = (store: FosStore) => generateConstructor(store, "REMOVECHILD", { description: { content : 'Remove Child Action Node' } }, [])

export const addTodoAction = (store: FosStore) => generateConstructor(store, "ADDTODO", { description: { content : 'Add Todo Action Node' } }, [])
export const addCommentAction = (store: FosStore) => generateConstructor(store, "ADDCOMMENT", { description: { content : 'Add Comment Action Node' } }, [])
export const addDocumentAction = (store: FosStore) => generateConstructor(store, "ADDDOCUMENT", { description: { content : 'Add Document Action Node' } }, [])
export const addWorkflowAction = (store: FosStore) => generateConstructor(store, "ADDWORKFLOW", { description: { content : 'Add Workflow Action Node' } }, [])

export const addBranchAction = (store: FosStore) => generateConstructor(store, "ADDBRANCH", { description: { content : 'Add Branch Action Node' } }, [])
export const proposeChangeAction = (store: FosStore) => generateConstructor(store, "PROPOSECHANGE", { description: { content : 'Propose Change Action Node' } }, [])

export const registerMarketServiceAction = (store: FosStore) => generateConstructor(store, "REGISTERMARKETSERVICE", { description: { content : 'Register Market Service Action Node' } }, [])

export const typeNode = (store: FosStore) => generateConstructor(store, "TYPE", { description: { content : 'Type Node' } }, [])
export const pureActionNode = (store: FosStore) => generateConstructor(store, "PUREACTION", { description: { content : 'Pure Action Node' } }, [])
export const bindActionNode = (store: FosStore) => generateConstructor(store, "BINDACTION", { description: { content : 'Bind Action Node' } }, [])
export const addChildActionNode = (store: FosStore) => generateConstructor(store, "ADDCHILD", { description: { content : 'Add Child Action Node' } }, [])

export const getUpdateActionNode = (store: FosStore) => generateConstructor(store, "UPDATE", { description: { content : 'Update Action Node' } }, [])
export const evalAction = (store: FosStore) => generateConstructor(store, "EVAL", { description: { content : 'Eval Action Node' } }, [])
export const actionConstructor = (store: FosStore) => generateConstructor(store, "ACTION", { description: { content : 'Action Constructor Node' } }, [])
export const getGetInstructionNodeAction = (store: FosStore) => generateConstructor(store, "GETINSTRUCTION", { description: { content : 'Get Instruction Node Action' } }, [])
export const getGetTargetNodeAction = (store: FosStore) => generateConstructor(store, "GETTARGET", { description: { content : 'Get Target Node Action' } }, [])
export const getIsInstanceAction = (store: FosStore) => generateConstructor(store, "ISINSTANCE", { description: { content : 'Is Instance Action' } }, [])
export const createVariableAction = (store: FosStore) => generateConstructor(store, "CREATEVARIABLE", { description: { content : 'Create Variable Action' } }, [])



export const groupTypeNode = (store: FosStore) => generateConstructor(store, "GROUPTYPE", { description: { content : 'Group Type Node' } }, [])
export const todoTypeNode = (store: FosStore) => generateConstructor(store, "TODOTYPE", { description: { content : 'Todo Type Node' } }, [])
export const commentTypeNode = (store: FosStore) => generateConstructor(store, "COMMENTTYPE", { description: { content : 'Comment Type Node' } }, [])
export const documentTypeNode = (store: FosStore) => generateConstructor(store, "DOCUMENTTYPE", { description: { content : 'Document Type Node' } }, [])
export const workflowTypeNode = (store: FosStore) => generateConstructor(store, "WORKFLOWTYPE", { description: { content : 'Workflow Type Node' } }, [])
export const branchTypeNode = (store: FosStore) => generateConstructor(store, "BRANCHTYPE", { description: { content : 'Branch Type Node' } }, [])
export const marketServiceTypeNode = (store: FosStore) => generateConstructor(store, "MARKETSERVICETYPE", { description: { content : 'Market Service Type Node' } }, [])
export const marketRequestTypeNode = (store: FosStore) => generateConstructor(store, "MARKETREQUESTTYPE", { description: { content : 'Market Request Type Node' } }, [])
export const invoiceTypeNode = (store: FosStore) => generateConstructor(store, "INVOICETYPE", { description: { content : 'Invoice Type Node' } }, [])
export const receiptTypeNode = (store: FosStore) => generateConstructor(store, "RECEIPTTYPE", { description: { content : 'Receipt Type Node' } }, [])



export const booleanTypeNode = (store: FosStore) => generateConstructor(store, "BOOLEANTYPE", { description: { content : 'Boolean Type Node' } }, [])
export const falseConstructorNode = (store: FosStore) => generateConstructor(store, "FALSE", { description: { content : 'False Constructor Node' } }, [])
export const trueConstructorNode = (store: FosStore) => generateConstructor(store, "TRUE", { description: { content : 'True Constructor Node' } }, [])


export const updateInstructionNode = (store: FosStore) => generateConstructor(store, "UPDATEINSTRUCTION", { description: { content : 'Update Instruction Node' } }, [])




export const createAliasNode = () => {

  


}






export const generateConstructor = (
  store: FosStore, 
  alias: string, 
  data: FosDataContent, 
  children: [((store: FosStore) => FosNode),((store: FosStore) => FosNode)][]) => {

  const constructedChildren: FosPathElem[] = children.map(([left, right]) => [left(store).getId(), right(store).getId()] )

  const nodeContent: FosNodeContent = {
    data: data,
    children: constructedChildren
  }

  const newNode = store.create(nodeContent, alias)

  // if (alias === "TARGET") {
  //   console.log("TARGET address",  newNode.getId())
  // }
  // if (alias === "ALIASINSTRUCTION") {
  //   console.log("ALIASINSTRUCTION address",  newNode.getId())
  // }
  // if (alias === "PREV") {
  //   console.log("PREV address",  newNode.getId())
  // }



  if (!newNode) throw new Error('could not create node')
  return newNode
}




// == peano number stuff ==
// export const getNthDepNodeWithPattern = (store: FosStore, n: number, pattern: FosNode) => {
//   if (n < 0) throw new Error('cannot get negative dep')
// }

// export const getNthCommentInstructionNode = (store: FosStore) => {
// }



export const constructPrimitiveAliases = (store: FosStore) => {
  const voidNode = getTerminalNode(store)
  const terminal = getTerminalNode(store)
  const unit = getUnitNode(store)
  const previousVersion = getPreviousVersionNode(store)
  const fieldField = getFieldFieldNode(store)
  const stringField = getStringFieldNode(store)
  const descriptionField = getDescriptionFieldNode(store)
  const choiceTarget = getChoiceTargetNode(store)
  const linkField = getLinkFieldNode(store)
  const groupField = getGroupFieldNode(store)
  const roleField = getRoleFieldNode(store)
  const personField = getPersonFieldNode(store)
  const linkAction = getLinkActionNode(store)
  const copyAction = getCopyActionNode(store)
  const inputAction = getInputActionNode(store)
  const completeAction = getCompleteActionNode(store)
  const cancelAction = getCancelActionNode(store)
  const comboField = getComboFieldNode(store)
  const labelField = getLabelFieldNode(store)
  const numberField = getNumberFieldNode(store)
  const booleanField = getBooleanFieldNode(store)
  const listField = getListFieldNode(store)
  const completeField = getCompleteFieldNode(store)
  const approvalField = getApprovalFieldNode(store)
  const voteField = getVoteFieldNode(store)
  const workflowField = getWorkflowInstructionNode(store)
  const expressionField = getExpressionFieldNode(store)
  const contactField = getContactFieldNode(store)
  const emailField = getEmailFieldNode(store)
  const phoneField = getPhoneFieldNode(store)
  const addressField = getAddressFieldNode(store)
  const nameField = getNameFieldNode(store)
  const firstNameField = getFirstNameFieldNode(store)
  const lastNameField = getLastNameFieldNode(store)
  const middleNameField = getMiddleNameFieldNode(store)
  const businessField = getBusinessFieldNode(store)
  const businessNameField = getBusinessNameFieldNode(store)
  const dateField = getDateFieldNode(store)
  const timeField = getTimeFieldNode(store)
  const durationField = getDurationFieldNode(store)
  const invoiceLineField = getInvoiceLineFieldNode(store)
  const commentConstructor = getCommentInstructionNode(store)
  const timeIntervale = getTimeIntervalNode(store)
  const invoiceCommentsField = getInvoiceCommentFieldNode(store)
  const priceField = getPriceFieldNode(store)
  const currencyField = getCurrencyFieldNode(store)
  const invoiceNode = getInvoiceFieldNode(store)
  const documentField = getDocumentInstructionNode(store)
  const paymentNode = getPaymentFieldNode(store)
  const transactionNode = getTransactionFieldNode(store)
  const actionNode = getActionFieldNode(store)
  const optionSelectedConstructor = getOptionSelectedConstructor(store)
  const optionNotSelectedConstructor = getOptionNotSelectedConstructor(store)
  const tagField = getTagFieldNode(store)
  const optionConstructor = getOptionNotSelectedConstructor(store)
  const searchQueryNode = getSearchQueryNode(store)
  const searchResultsNode = getSearchResultsNode(store)
  const errorNode = getErrorNode(store)
  const peerNode = getPeerNode(store)
  const marketServiceNode = getMarketServiceListingNode(store)
  const marketRequestNode = getMarketRequestListingNode(store)

  const revertNode = getRevertChangeNode(store)
  const publishNode = getPublishNode(store)
  const appNode = getAppNode(store)
  const oneTimeBuyNode = getOneTimeBuyNode(store)
  const subscriptionNode = getSubscriptionNode(store)
  const recurringBuyNode = getRecurringBuyNode(store)
  const conflictNode = getConflictNode(store)
  const nameNode = getNameFieldNode(store)
  const allOfNode = getAllOfNode(store)  
  const invoiceItemLineField = getInvoiceItemLineFieldNode(store)
  const receiptLineField = getReceiptLineFieldNode(store)
  const proposalField = getProposalFieldNode(store)
  const revisionField = getRevisionFieldNode(store)
  const projectField = getProjectFieldNode(store)
  const periodicTrigger = getPeriodicTriggerNode(store)
  const requestTrigger = getRequestTriggerNode(store)
  const manualTrigger = getManualTriggerNode(store)
  const dailyTrigger = getDailyTriggerNode(store)
  const weeklyTrigger = getWeeklyTriggerNode(store)
  const monthlyTrigger = getMonthlyTriggerNode(store)
  const yearlyTrigger = getYearlyTriggerNode(store)
  const delayTrigger = getDelayTriggerNode(store)
  const startAction = getStartActionNode(store)
  const stopAction = getStopActionNode(store)
  const pauseAction = getPauseActionNode(store)
  const resumeAction = getResumeActionNode(store)

  const groupShadowNode = getGroupShadowNode(store)
  const aliasConstructor = getAliasConstructorNode(store)
  const targetPointerConstructor = getTargetPointerConstructorNode(store)
  const instructionPointerConstructor = getInstructionPointerConstructorNode(store)
  const dereferenceAlias = getDereferenceAliasActionNode(store)
  const startRootAlias = getStartRootAlias(store)
  const brachConstructorNode = getBrachConstructorNode(store)


  const updateAction = getUpdateActionNode(store)
 

  return {
    voidNode,
    terminal,
    unit,
    allOfNode,
    previousVersion,
    fieldField,
    stringField,
    descriptionField,
    choiceTarget,
    linkField,
    groupField,
    roleField,
    personField,
    linkAction,
    copyAction,
    inputAction,
    completeAction,
    cancelAction,
    comboField,
    labelField,
    numberField,
    booleanField,
    listField,
    completeField,
    approvalField,
    voteField,
    workflowField,
    expressionField,
    contactField,
    emailField,
    phoneField,
    addressField,
    nameField,
    firstNameField,
    lastNameField,
    middleNameField,
    businessField,
    businessNameField,
    dateField,
    timeField,
    durationField,
    invoiceLineField,
    commentConstructor,
    timeIntervale,
    invoiceCommentsField,
    priceField,
    currencyField,
    invoiceNode,
    documentField,
    paymentNode,
    transactionNode,
    actionNode,
    optionSelectedConstructor,
    optionNotSelectedConstructor,
    tagField,
    optionConstructor,
    searchQueryNode,
    searchResultsNode,
    errorNode,
    peerNode,
    marketServiceNode,
    marketRequestNode,
    revertNode,
    publishNode,
    appNode,
    oneTimeBuyNode,
    subscriptionNode,
    recurringBuyNode,
    conflictNode,
    nameNode,
    invoiceItemLineField,
    receiptLineField,
    proposalField,
    revisionField,
    projectField,
    periodicTrigger,
    requestTrigger,
    manualTrigger,
    dailyTrigger,
    weeklyTrigger,
    monthlyTrigger,
    yearlyTrigger,
    delayTrigger,
    startAction,
    stopAction,
    pauseAction,
    resumeAction,
    groupShadowNode,
    aliasConstructor,
    targetPointerConstructor,
    instructionPointerConstructor,
    dereferenceAlias,
    getStartRootAlias,
    startRootAlias,
    brachConstructorNode,
    // allOf: getAllOfNode(store),
    updateAction,
    
  }

}


export type PrimitiveAliases = {
  voidNode: FosNode,
  terminal: FosNode,
  unit: FosNode,
  allOfNode: FosNode,
  previousVersion: FosNode,
  fieldField: FosNode,
  stringField: FosNode,
  descriptionField: FosNode,
  choiceTarget: FosNode,
  linkField: FosNode,
  groupField: FosNode,
  roleField: FosNode,
  personField: FosNode,
  linkAction: FosNode,
  copyAction: FosNode,
  inputAction: FosNode,
  completeAction: FosNode,
  cancelAction: FosNode,
  comboField: FosNode,
  labelField: FosNode,
  numberField: FosNode,
  booleanField: FosNode,
  listField: FosNode,
  completeField: FosNode,
  approvalField: FosNode,
  voteField: FosNode,
  workflowField: FosNode,
  expressionField: FosNode,
  contactField: FosNode,
  emailField: FosNode,
  phoneField: FosNode,
  addressField: FosNode,
  nameField: FosNode,
  firstNameField: FosNode,
  lastNameField: FosNode,
  middleNameField: FosNode,
  businessField: FosNode,
  businessNameField: FosNode,
  dateField: FosNode,
  timeField: FosNode,
  durationField: FosNode,
  invoiceLineField: FosNode,
  commentConstructor: FosNode,
  timeIntervale: FosNode,
  invoiceCommentsField: FosNode,
  priceField: FosNode,
  currencyField: FosNode,
  invoiceNode: FosNode,
  documentField: FosNode,
  paymentNode: FosNode,
  transactionNode: FosNode,
  actionNode: FosNode,
  optionSelectedConstructor: FosNode,
  optionNotSelectedConstructor: FosNode,
  tagField: FosNode,
  optionConstructor: FosNode,
  searchQueryNode: FosNode,
  searchResultsNode: FosNode,
  errorNode: FosNode,
  peerNode: FosNode,
  marketServiceNode: FosNode,
  marketRequestNode: FosNode,
  revertNode: FosNode,
  publishNode: FosNode,
  appNode: FosNode,
  oneTimeBuyNode: FosNode,
  subscriptionNode: FosNode,
  recurringBuyNode: FosNode,
  conflictNode: FosNode,
  nameNode: FosNode,
  groupShadowNode: FosNode, 
  aliasConstructor: FosNode,
  targetConstructor: FosNode,
  aliasInstructionConstructor: FosNode,
  dereferenceAlias: FosNode,
  startRootAlias: FosNode,
  brachConstructorNode: FosNode,
  proposalField: FosNode,
  targetPointerConstructor: FosNode,
  instructionPointerConstructor: FosNode,
  revisionField: FosNode,
  projectField: FosNode,
  periodicTrigger: FosNode,
  requestTrigger: FosNode,
  manualTrigger: FosNode,
  dailyTrigger: FosNode,
  updateAction: FosNode, 
}
