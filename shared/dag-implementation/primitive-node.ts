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


export const getStartRootAlias = (
  store: FosStore,
  primitives: {
    terminal: FosNode,
    previousVersion: FosNode,
    targetPointerConstructor: FosNode,
    instructionPointerConstructor: FosNode,
    rootInstructionNode: FosNode
  }
): FosNode => {
  const newUuid = uuidv4()

  const aliasNode = store.create({
    data: {
      alias: {
        id: newUuid,
      }
    },
    children: [
      [primitives.targetPointerConstructor.getId(), primitives.terminal.getId()],
      [primitives.instructionPointerConstructor.getId(), primitives.rootInstructionNode.getId()],
      [primitives.previousVersion.getId(), primitives.terminal.getId()]
    ]
  })
  // console.log('aliasNode', aliasNode.getId(), store.getNodeByAddress(aliasNode.getId()))
  return aliasNode
}


export const getPreviousVersionNode = (store: FosStore) => generateConstructor(store, "PREV", { description: { content: 'Previous Version Constructor' } }, [])
export const getFieldFieldNode = (store: FosStore) => generateConstructor(store, "FIELD", { description: { content: 'Field Field Constructor' } }, [])
export const getStringFieldNode = (store: FosStore) => generateConstructor(store, "STRING", { description: { content: 'String Field Constructor' } }, [])


export const getDescriptionFieldNode = (store: FosStore) => generateConstructor(store, "DESCRIPTION", { description: { content: 'String Field Constructor' } }, [
  [getFieldFieldNode, getStringFieldNode]
])

export const getNameFieldNode = (store: FosStore) => generateConstructor(store, "NAME", { description: { content: 'Name Field Constructor' } }, [
  [getFieldFieldNode, getStringFieldNode]
])


export const getWorkflowInstructionNode = (store: FosStore) => generateConstructor(store, "WORKFLOW", { description: { content: 'Option Not Selected Constructor' } }, [])
export const getRootInstructionNode = (store: FosStore) => generateConstructor(store, "ROOT", { description: { content: 'Root Instruction Constructor' } }, [])
export const getCommentInstructionNode = (store: FosStore) => generateConstructor(store, "COMMENT", { description: { content: 'Comment Constructor' } }, [])
export const getDocumentInstructionNode = (store: FosStore) => generateConstructor(store, "DOCUMENT", { description: { content: 'Document Constructor' } }, [])


export const getOptionSelectedConstructor = (store: FosStore) => generateConstructor(store, "SELECTED", { description: { content: 'Option Selected Constructor' } }, [])
export const getOptionNotSelectedConstructor = (store: FosStore) => generateConstructor(store, "NOTSELECTED", { description: { content: 'Option Not Selected Constructor' } }, [])
export const getChoiceTargetNode = (store: FosStore) => generateConstructor(store, "CHOICE", { description: { content: 'Option Choice Target' } }, [
  // [store.optionSelectedConstructor.getId(), ],
  // [store.optionNotSelectedConstructor.getId(), ]
])

export const getTimeIntervalNode = (store: FosStore) => generateConstructor(store, "TIMEINTERVAL", { description: { content: 'Time Interval Constructor' } }, [])
export const getCompleteFieldNode = (store: FosStore) => generateConstructor(store, "COMPLETION", { description: { content: 'Complete Field Constructor' } }, [])

export const getLinkActionNode = (store: FosStore) => generateConstructor(store, "LINKACTION", { description: { content: 'Link Action Constructor' } }, [])
export const getCreateActionNode = (store: FosStore) => generateConstructor(store, "CREATE", { description: { content: 'Create Action Constructor' } }, [])
export const getDeleteActionNode = (store: FosStore) => generateConstructor(store, "DELETE", { description: { content: 'Delete Action Constructor' } }, [])

export const getCopyActionNode = (store: FosStore) => generateConstructor(store, "COPY", { description: { content: 'Copy Action Constructor' } }, [])
export const getMoveActionNode = (store: FosStore) => generateConstructor(store, "MOVE", { description: { content: 'Move Action Constructor' } }, [])
export const getRenameActionNode = (store: FosStore) => generateConstructor(store, "RENAME", { description: { content: 'Rename Action Constructor' } }, [])

export const getApprovalFieldNode = (store: FosStore) => generateConstructor(store, "APPROVAL", { description: { content: 'Approval Field Constructor' } }, [])
export const getVoteFieldNode = (store: FosStore) => generateConstructor(store, "VOTE", { description: { content: 'Vote Field Constructor' } }, [])
export const getContactFieldNode = (store: FosStore) => generateConstructor(store, "CONTACT", { description: { content: 'Contact Field Constructor' } }, [])
export const getRoleFieldNode = (store: FosStore) => generateConstructor(store, "ROLE", { description: { content: 'Role Field Constructor' } }, [])
export const getGroupFieldNode = (store: FosStore) => generateConstructor(store, "GROUP", { description: { content: 'Group Field Constructor' } }, [])
export const getPersonFieldNode = (store: FosStore) => generateConstructor(store, "PERSON", { description: { content: 'Person Field Constructor' } }, [])

export const getListFieldNode = (store: FosStore) => generateConstructor(store, "LIST", { description: { content: 'List Field Constructor' } }, [])
export const getPatternFieldNode = (store: FosStore) => generateConstructor(store, "PATTERN", { description: { content: 'Pattern Field Constructor' } }, [])
export const getNumberFieldNode = (store: FosStore) => generateConstructor(store, "NUMBER", { description: { content: 'Number Field Constructor' } }, [])
export const getBooleanFieldNode = (store: FosStore) => generateConstructor(store, "BOOLEAN", { description: { content: 'Boolean Field Constructor' } }, [])
export const getLinkFieldNode = (store: FosStore) => generateConstructor(store, "LINK", { description: { content: 'Link Field Constructor' } }, [])

export const getDurationFieldNode = (store: FosStore) => generateConstructor(store, "DURATION", { description: { content: 'Duration Field Constructor' } }, [])
export const getDateFieldNode = (store: FosStore) => generateConstructor(store, "DATE", { description: { content: 'Date Field Constructor' } }, [])
export const getTimeFieldNode = (store: FosStore) => generateConstructor(store, "TIME", { description: { content: 'Time Field Constructor' } }, [])

export const getEmailFieldNode = (store: FosStore) => generateConstructor(store, "EMAIL", { description: { content: 'Email Field Constructor' } }, [])
export const getPhoneFieldNode = (store: FosStore) => generateConstructor(store, "PHONE", { description: { content: 'Phone Field Constructor' } }, [])
export const getAddressFieldNode = (store: FosStore) => generateConstructor(store, "ADDRESS", { description: { content: 'Address Field Constructor' } }, [])

export const getPriceFieldNode = (store: FosStore) => generateConstructor(store, "PRICE", { description: { content: 'Price Field Constructor' } }, [])
export const getCurrencyFieldNode = (store: FosStore) => generateConstructor(store, "CURRENCY", { description: { content: 'Currency Field Constructor' } }, [])

export const getBusinessFieldNode = (store: FosStore) => generateConstructor(store, "BUSINESS", { description: { content: 'Business Field Constructor' } }, [])
export const getBusinessNameFieldNode = (store: FosStore) => generateConstructor(store, "BUSINESSNAME", { description: { content: 'Business Name Field Constructor' } }, [])

export const getPaymentFieldNode = (store: FosStore) => generateConstructor(store, "PAYMENT", { description: { content: 'Payment Field Constructor' } }, [])
export const getBidFieldNode = (store: FosStore) => generateConstructor(store, "BID", { description: { content: 'Bid Field Constructor' } }, [])
export const getMarketServiceListingNode = (store: FosStore) => generateConstructor(store, "MARKETSERVICE", { description: { content: 'Market Listing Constructor' } }, [])

export const getOfferFieldNode = (store: FosStore) => generateConstructor(store, "OFFER", { description: { content: 'Offer Field Constructor' } }, [])
export const getMarketRequestListingNode = (store: FosStore) => generateConstructor(store, "MARKETREQUEST", { description: { content: 'Market Request Listing Constructor' } }, [])

export const getInvoiceFieldNode = (store: FosStore) => generateConstructor(store, "INVOICE", { description: { content: 'Invoice Field Constructor' } }, [])
export const getInvoiceCommentFieldNode = (store: FosStore) => generateConstructor(store, "INVOICECOMMENT", { description: { content: 'Invoice Comment Field Constructor' } }, [])
export const getInvoiceItemFieldNode = (store: FosStore) => generateConstructor(store, "INVOICEITEM", { description: { content: 'Invoice Item Field Constructor' } }, [])

export const getReceiptFieldNode = (store: FosStore) => generateConstructor(store, "RECEIPT", { description: { content: 'Receipt Field Constructor' } }, [])
export const getQuoteFieldNode = (store: FosStore) => generateConstructor(store, "QUOTE", { description: { content: 'Quote Field Constructor' } }, [])
export const getOrderFieldNode = (store: FosStore) => generateConstructor(store, "ORDER", { description: { content: 'Order Field Constructor' } }, [])

export const getProjectFieldNode = (store: FosStore) => generateConstructor(store, "PROJECT", { description: { content: 'Project Field Constructor' } }, [])

export const getActionFieldNode = (store: FosStore) => generateConstructor(store, "ACTION", { description: { content: 'Action Field Constructor' } }, [])

export const getCompleteActionNode = (store: FosStore) => generateConstructor(store, "COMPLETE", { description: { content: 'Complete Action Constructor' } }, [])
export const getStartActionNode = (store: FosStore) => generateConstructor(store, "START", { description: { content: 'Start Action Constructor' } }, [])
export const getStopActionNode = (store: FosStore) => generateConstructor(store, "STOP", { description: { content: 'Stop Action Constructor' } }, [])
export const getPauseActionNode = (store: FosStore) => generateConstructor(store, "PAUSE", { description: { content: 'Pause Action Constructor' } }, [])
export const getCancelActionNode = (store: FosStore) => generateConstructor(store, "CANCEL", { description: { content: 'Cancel Action Constructor' } }, [])
export const getResumeActionNode = (store: FosStore) => generateConstructor(store, "RESUME", { description: { content: 'Resume Action Constructor' } }, [])

export const getInputActionNode = (store: FosStore) => generateConstructor(store, "INPUT", { description: { content: 'Input Action Constructor' } }, [])
export const getRefundRequestActionNode = (store: FosStore) => generateConstructor(store, "REFUNDREQUEST", { description: { content: 'Refund Request Action Constructor' } }, [])
export const getRefundActionNode = (store: FosStore) => generateConstructor(store, "REFUND", { description: { content: 'Refund Action Constructor' } }, [])
export const getRefundCompleteActionNode = (store: FosStore) => generateConstructor(store, "REFUNDCOMPLETE", { description: { content: 'Refund Complete Action Constructor' } }, [])

export const getReviewActionNode = (store: FosStore) => generateConstructor(store, "REVIEW", { description: { content: 'Review Action Constructor' } }, [])
export const getApproveActionNode = (store: FosStore) => generateConstructor(store, "APPROVE", { description: { content: 'Approve Action Constructor' } }, [])



export const getProposalFieldNode = (store: FosStore) => generateConstructor(store, "PROPOSAL", { description: { content: 'Proposal Field Constructor' } }, [])
export const getRevisionFieldNode = (store: FosStore) => generateConstructor(store, "REVISION", { description: { content: 'Revision Field Constructor' } }, [])

// Peer-related constructors for membership-based sync
export const getPeerFieldNode = (store: FosStore) => generateConstructor(store, "PEER", { description: { content: 'Peer Reference Constructor' } }, [])
export const getMemberFieldNode = (store: FosStore) => generateConstructor(store, "MEMBER", { description: { content: 'Member Edge Constructor - points to peer reference' } }, [])
export const getPeerIdFieldNode = (store: FosStore) => generateConstructor(store, "PEERID", { description: { content: 'Peer ID Field' } }, [])
export const getPeerPublicKeyFieldNode = (store: FosStore) => generateConstructor(store, "PEERPUBKEY", { description: { content: 'Peer Public Key Field' } }, [])

// Proposal-related constructors for peer consensus (branching model)
export const getProposedContentNode = (store: FosStore) => generateConstructor(store, "PROPOSEDCONTENT", { description: { content: 'Proposed Content Constructor' } }, [])
export const getProposalNameNode = (store: FosStore) => generateConstructor(store, "PROPOSALNAME", { description: { content: 'Proposal/Branch Name Constructor' } }, [])
export const getParentBranchNode = (store: FosStore) => generateConstructor(store, "PARENTBRANCH", { description: { content: 'Parent Branch Constructor' } }, [])
export const getSenderNode = (store: FosStore) => generateConstructor(store, "SENDER", { description: { content: 'Sender Constructor (peer ID)' } }, [])
export const getTimestampNode = (store: FosStore) => generateConstructor(store, "TIMESTAMP", { description: { content: 'Timestamp Constructor' } }, [])
export const getSignatureNode = (store: FosStore) => generateConstructor(store, "SIGNATURE", { description: { content: 'Signature Constructor (Ed25519)' } }, [])

export const getTransactionFieldNode = (store: FosStore) => generateConstructor(store, "TRANSACTION", { description: { content: 'Transaction Field Constructor' } }, [])
export const getLabelFieldNode = (store: FosStore) => generateConstructor(store, "LABEL", { description: { content: 'Label Field Constructor' } }, [])
export const getComboFieldNode = (store: FosStore) => generateConstructor(store, "COMBO", { description: { content: 'Combo Field Constructor' } }, [])
export const getTagFieldNode = (store: FosStore) => generateConstructor(store, "TAG", { description: { content: 'Tag Field Constructor' } }, [])

export const getInvoiceLineFieldNode = (store: FosStore) => generateConstructor(store, "INVOICECOMMENT", { description: { content: 'Invoice Comment Field Constructor' } }, [])

export const getInvoiceItemLineFieldNode = (store: FosStore) => generateConstructor(store, "INVOICEITEM", { description: { content: 'Invoice Item Field Constructor' } }, [])

export const getReceiptLineFieldNode = (store: FosStore) => generateConstructor(store, "RECEIPT", { description: { content: 'Receipt Field Constructor' } }, [])
export const getExpressionFieldNode = (store: FosStore) => generateConstructor(store, "EXPRESSION", { description: { content: 'Expression Field Constructor' } }, [])

export const getFirstNameFieldNode = (store: FosStore) => generateConstructor(store, "FIRSTNAME", { description: { content: 'First Name Field Constructor' } }, [])
export const getLastNameFieldNode = (store: FosStore) => generateConstructor(store, "LASTNAME", { description: { content: 'Last Name Field Constructor' } }, [])
export const getMiddleNameFieldNode = (store: FosStore) => generateConstructor(store, "MIDDLENAME", { description: { content: 'Middle Name Field Constructor' } }, [])

export const getOptionConstructor = (store: FosStore) => generateConstructor(store, "OPTION", { description: { content: 'Option Constructor' } }, [])


export const getSearchQueryNode = (store: FosStore) => generateConstructor(store, "SEARCHQUERY", { description: { content: 'Search Query Constructor' } }, [])
export const getSearchResultsNode = (store: FosStore) => generateConstructor(store, "SEARCHRESULT", { description: { content: 'Search Result Constructor' } }, [])

export const getErrorNode = (store: FosStore) => generateConstructor(store, "ERROR", { description: { content: 'Error Constructor' } }, [])
export const getPeerNode = (store: FosStore) => generateConstructor(store, "PEER", { description: { content: 'Peer Constructor' } }, [])
export const getRevertChangeNode = (store: FosStore) => generateConstructor(store, "REVERT", { description: { content: 'Revert Change Constructor' } }, [])

export const getPublishNode = (store: FosStore) => generateConstructor(store, "PUBLISH", { description: { content: 'Publish Constructor' } }, [])
export const getAppNode = (store: FosStore) => generateConstructor(store, "APP", { description: { content: 'App Constructor' } }, [])
export const getSubscriptionNode = (store: FosStore) => generateConstructor(store, "SUBSCRIPTION", { description: { content: 'Subscription Constructor' } }, [])
export const getOneTimeBuyNode = (store: FosStore) => generateConstructor(store, "ONETIMEBUY", { description: { content: 'One Time Buy Constructor' } }, [])
export const getRecurringBuyNode = (store: FosStore) => generateConstructor(store, "RECURRINGBUY", { description: { content: 'Recurring Buy Constructor' } }, [])
export const getErrorInstructionNode = (store: FosStore) => generateConstructor(store, "ERROR", { description: { content: 'Error Constructor' } }, [])
export const getErrorTargetNode = (store: FosStore) => generateConstructor(store, "ERROR", { description: { content: 'Error Constructor' } }, [])
export const getConflictNode = (store: FosStore) => generateConstructor(store, "CONFLICT", { description: { content: 'Conflict Constructor' } }, [])

export const getPeriodicTriggerNode = (store: FosStore) => generateConstructor(store, "PERIODIC", { description: { content: 'Periodic Trigger Constructor' } }, [])
export const getRequestTriggerNode = (store: FosStore) => generateConstructor(store, "REQUEST", { description: { content: 'Request Trigger Constructor' } }, [])
export const getManualTriggerNode = (store: FosStore) => generateConstructor(store, "MANUAL", { description: { content: 'Manual Trigger Constructor' } }, [])
export const getDailyTriggerNode = (store: FosStore) => generateConstructor(store, "DAILY", { description: { content: 'Daily Trigger Constructor' } }, [])
export const getWeeklyTriggerNode = (store: FosStore) => generateConstructor(store, "WEEKLY", { description: { content: 'Weekly Trigger Constructor' } }, [])
export const getMonthlyTriggerNode = (store: FosStore) => generateConstructor(store, "MONTHLY", { description: { content: 'Monthly Trigger Constructor' } }, [])
export const getYearlyTriggerNode = (store: FosStore) => generateConstructor(store, "YEARLY", { description: { content: 'Yearly Trigger Constructor' } }, [])

export const getDelayTriggerNode = (store: FosStore) => generateConstructor(store, "DELAY", { description: { content: 'Delay Trigger Constructor' } }, [])

export const getGroupShadowNode = (store: FosStore) => generateConstructor(store, "GROUPSHADOW", { description: { content: 'Group Shadow Constructor' } }, [])

export const getDereferenceAliasActionNode = (store: FosStore) => generateConstructor(store, "DEREFALIAS", { description: { content: 'Dereference Alias Node' } }, [])
export const getAliasConstructorNode = (store: FosStore) => generateConstructor(store, "ALIAS", { description: { content: 'Alias Constructor Node' } }, [])
export const getTargetPointerConstructorNode = (store: FosStore) => generateConstructor(store, "TARGETPOINTER", { description: { content: 'Target Constructor Node' } }, [])
export const getInstructionPointerConstructorNode = (store: FosStore) => generateConstructor(store, "INSTRUCTIONPOINTER", { description: { content: 'Alias Instruction Constructor Node' } }, [])

export const getBrachConstructorNode = (store: FosStore) => generateConstructor(store, "BRANCH", { description: { content: 'Branch Constructor Node' } }, [])

export const addChildAction = (store: FosStore) => generateConstructor(store, "ADDCHILD", { description: { content: 'Add Child Action Node' } }, [])
export const removeChildAction = (store: FosStore) => generateConstructor(store, "REMOVECHILD", { description: { content: 'Remove Child Action Node' } }, [])

export const addTodoAction = (store: FosStore) => generateConstructor(store, "ADDTODO", { description: { content: 'Add Todo Action Node' } }, [])
export const addCommentAction = (store: FosStore) => generateConstructor(store, "ADDCOMMENT", { description: { content: 'Add Comment Action Node' } }, [])
export const addDocumentAction = (store: FosStore) => generateConstructor(store, "ADDDOCUMENT", { description: { content: 'Add Document Action Node' } }, [])
export const addWorkflowAction = (store: FosStore) => generateConstructor(store, "ADDWORKFLOW", { description: { content: 'Add Workflow Action Node' } }, [])

export const addBranchAction = (store: FosStore) => generateConstructor(store, "ADDBRANCH", { description: { content: 'Add Branch Action Node' } }, [])
export const proposeChangeAction = (store: FosStore) => generateConstructor(store, "PROPOSECHANGE", { description: { content: 'Propose Change Action Node' } }, [])

export const registerMarketServiceAction = (store: FosStore) => generateConstructor(store, "REGISTERMARKETSERVICE", { description: { content: 'Register Market Service Action Node' } }, [])

// Group actions
export const createGroupAction = (store: FosStore) => generateConstructor(store, "CREATEGROUP", { description: { content: 'Create Group Action Node' } }, [])
export const addMemberToGroupAction = (store: FosStore) => generateConstructor(store, "ADDMEMBERTOGROUP", { description: { content: 'Add Member To Group Action Node' } }, [])
export const removeMemberFromGroupAction = (store: FosStore) => generateConstructor(store, "REMOVEMEMBERFROMGROUP", { description: { content: 'Remove Member From Group Action Node' } }, [])
export const createDMAction = (store: FosStore) => generateConstructor(store, "CREATEDM", { description: { content: 'Create DM Action Node' } }, [])
export const sendGroupMessageAction = (store: FosStore) => generateConstructor(store, "SENDGROUPMESSAGE", { description: { content: 'Send Group Message Action Node' } }, [])

export const typeNode = (store: FosStore) => generateConstructor(store, "TYPE", { description: { content: 'Type Node' } }, [])
export const pureActionNode = (store: FosStore) => generateConstructor(store, "PUREACTION", { description: { content: 'Pure Action Node' } }, [])
export const bindActionNode = (store: FosStore) => generateConstructor(store, "BINDACTION", { description: { content: 'Bind Action Node' } }, [])
export const addChildActionNode = (store: FosStore) => generateConstructor(store, "ADDCHILD", { description: { content: 'Add Child Action Node' } }, [])

export const getUpdateActionNode = (store: FosStore) => generateConstructor(store, "UPDATE", { description: { content: 'Update Action Node' } }, [])
export const evalAction = (store: FosStore) => generateConstructor(store, "EVAL", { description: { content: 'Eval Action Node' } }, [])
export const actionConstructor = (store: FosStore) => generateConstructor(store, "ACTION", { description: { content: 'Action Constructor Node' } }, [])
export const getGetInstructionNodeAction = (store: FosStore) => generateConstructor(store, "GETINSTRUCTION", { description: { content: 'Get Instruction Node Action' } }, [])
export const getGetTargetNodeAction = (store: FosStore) => generateConstructor(store, "GETTARGET", { description: { content: 'Get Target Node Action' } }, [])
export const getIsInstanceAction = (store: FosStore) => generateConstructor(store, "ISINSTANCE", { description: { content: 'Is Instance Action' } }, [])
export const createVariableAction = (store: FosStore) => generateConstructor(store, "CREATEVARIABLE", { description: { content: 'Create Variable Action' } }, [])



export const groupTypeNode = (store: FosStore) => generateConstructor(store, "GROUPTYPE", { description: { content: 'Group Type Node' } }, [])
export const todoTypeNode = (store: FosStore) => generateConstructor(store, "TODOTYPE", { description: { content: 'Todo Type Node' } }, [])
export const commentTypeNode = (store: FosStore) => generateConstructor(store, "COMMENTTYPE", { description: { content: 'Comment Type Node' } }, [])
export const documentTypeNode = (store: FosStore) => generateConstructor(store, "DOCUMENTTYPE", { description: { content: 'Document Type Node' } }, [])
export const workflowTypeNode = (store: FosStore) => generateConstructor(store, "WORKFLOWTYPE", { description: { content: 'Workflow Type Node' } }, [])
export const branchTypeNode = (store: FosStore) => generateConstructor(store, "BRANCHTYPE", { description: { content: 'Branch Type Node' } }, [])
export const marketServiceTypeNode = (store: FosStore) => generateConstructor(store, "MARKETSERVICETYPE", { description: { content: 'Market Service Type Node' } }, [])
export const marketRequestTypeNode = (store: FosStore) => generateConstructor(store, "MARKETREQUESTTYPE", { description: { content: 'Market Request Type Node' } }, [])
export const invoiceTypeNode = (store: FosStore) => generateConstructor(store, "INVOICETYPE", { description: { content: 'Invoice Type Node' } }, [])
export const receiptTypeNode = (store: FosStore) => generateConstructor(store, "RECEIPTTYPE", { description: { content: 'Receipt Type Node' } }, [])



export const booleanTypeNode = (store: FosStore) => generateConstructor(store, "BOOLEANTYPE", { description: { content: 'Boolean Type Node' } }, [])
export const falseConstructorNode = (store: FosStore) => generateConstructor(store, "FALSE", { description: { content: 'False Constructor Node' } }, [])
export const trueConstructorNode = (store: FosStore) => generateConstructor(store, "TRUE", { description: { content: 'True Constructor Node' } }, [])


export const updateInstructionNode = (store: FosStore) => generateConstructor(store, "UPDATEINSTRUCTION", { description: { content: 'Update Instruction Node' } }, [])

export const getPrevInstructionPointerConstructor = (store: FosStore) => generateConstructor(store, "PREVINSTPTR", { description: { content: 'Previous Instruction Pointer Constructor' } }, [])
export const getPrevTargetPointerConstructor = (store: FosStore) => generateConstructor(store, "PREVTRGTPTR", { description: { content: 'Previous Target Pointer Constructor' } }, [])

// === Datalog Primitives ===
// These primitives support Datalog-style scopes with facts, rules, and queries

// FACT: Ground truth assertion in a scope
export const getFactNode = (store: FosStore) => generateConstructor(store, "FACT", { description: { content: 'Fact - Ground truth in scope' } }, [])

// RULE: Derivation rule (head :- body)
export const getRuleNode = (store: FosStore) => generateConstructor(store, "RULE", { description: { content: 'Rule - Derivation rule' } }, [])

// RULE_HEAD: The pattern that this rule derives
export const getRuleHeadNode = (store: FosStore) => generateConstructor(store, "RULEHEAD", { description: { content: 'Rule Head - What this rule derives' } }, [])

// RULE_BODY: The conditions that must match for this rule
export const getRuleBodyNode = (store: FosStore) => generateConstructor(store, "RULEBODY", { description: { content: 'Rule Body - Conditions to match' } }, [])

// VARIABLE: Unbound query variable that unifies during matching
export const getVariableNode = (store: FosStore) => generateConstructor(store, "VARIABLE", { description: { content: 'Variable - Unbound query variable' } }, [])

// QUERY: Query expression against a scope
export const getQueryNode = (store: FosStore) => generateConstructor(store, "QUERY", { description: { content: 'Query - Query against scope' } }, [])

// BINDING: Variable binding result from unification
export const getBindingNode = (store: FosStore) => generateConstructor(store, "BINDING", { description: { content: 'Binding - Variable binding result' } }, [])

// SCOPE: Container for facts, rules, and bindings
export const getScopeNode = (store: FosStore) => generateConstructor(store, "SCOPE", { description: { content: 'Scope - Datalog database container' } }, [])

// PARENT_SCOPE: Link to parent scope for lexical scoping
export const getParentScopeNode = (store: FosStore) => generateConstructor(store, "PARENTSCOPE", { description: { content: 'Parent Scope - Lexical parent' } }, [])

// ASSERT: Action to add a fact to scope
export const getAssertNode = (store: FosStore) => generateConstructor(store, "ASSERT", { description: { content: 'Assert - Add fact to scope' } }, [])

// RETRACT: Action to remove a fact from scope
export const getRetractNode = (store: FosStore) => generateConstructor(store, "RETRACT", { description: { content: 'Retract - Remove fact from scope' } }, [])

// TASK_EFFECT: Effects to execute when task completes
export const getTaskEffectNode = (store: FosStore) => generateConstructor(store, "TASKEFFECT", { description: { content: 'Task Effect - On-complete effects' } }, [])

// COMPLETED: Marker for completed task
export const getCompletedNode = (store: FosStore) => generateConstructor(store, "COMPLETED", { description: { content: 'Completed - Task completion marker' } }, [])

// === Version Control Primitives ===
// These primitives support git-style version control for scopes

// COMMIT: A versioned snapshot with message and timestamp
export const getCommitNode = (store: FosStore) => generateConstructor(store, "COMMIT", { description: { content: 'Commit - Versioned snapshot' } }, [])

// HEAD: Pointer to current branch head
export const getHeadNode = (store: FosStore) => generateConstructor(store, "HEAD", { description: { content: 'Head - Current branch pointer' } }, [])

// MERGE: Merge operation combining two branches
export const getMergeNode = (store: FosStore) => generateConstructor(store, "MERGE", { description: { content: 'Merge - Branch merge operation' } }, [])

// MERGE_SOURCE: The source branch being merged in
export const getMergeSourceNode = (store: FosStore) => generateConstructor(store, "MERGESOURCE", { description: { content: 'Merge Source - Branch being merged' } }, [])

// ANCESTOR: Common ancestor marker for merges
export const getAncestorNode = (store: FosStore) => generateConstructor(store, "ANCESTOR", { description: { content: 'Ancestor - Common ancestor' } }, [])

// HISTORY: Container for version history
export const getHistoryNode = (store: FosStore) => generateConstructor(store, "HISTORY", { description: { content: 'History - Version history container' } }, [])

// BRANCH_NAME: Branch name identifier
export const getBranchNameNode = (store: FosStore) => generateConstructor(store, "BRANCHNAME", { description: { content: 'Branch Name - Branch identifier' } }, [])

// TAG: Named reference to a specific commit
export const getTagNode = (store: FosStore) => generateConstructor(store, "TAG", { description: { content: 'Tag - Named commit reference' } }, [])

// CONFLICT_OURS: Our version in a conflict
export const getConflictOursNode = (store: FosStore) => generateConstructor(store, "CONFLICTOURS", { description: { content: 'Conflict Ours - Local version' } }, [])

// CONFLICT_THEIRS: Their version in a conflict
export const getConflictTheirsNode = (store: FosStore) => generateConstructor(store, "CONFLICTTHEIRS", { description: { content: 'Conflict Theirs - Remote version' } }, [])

// CONFLICT_BASE: Base version in a conflict (common ancestor)
export const getConflictBaseNode = (store: FosStore) => generateConstructor(store, "CONFLICTBASE", { description: { content: 'Conflict Base - Common ancestor version' } }, [])

// === Linear Type Primitives ===
// These primitives support Par-style linear types for resources like budgets and calendars

// LINEAR: Marker indicating a value must be consumed exactly once
export const getLinearNode = (store: FosStore) => generateConstructor(store, "LINEAR", { description: { content: 'Linear - Must be consumed exactly once' } }, [])

// CONSUME: Operation to consume a linear value
export const getConsumeNode = (store: FosStore) => generateConstructor(store, "CONSUME", { description: { content: 'Consume - Use linear value' } }, [])

// SPLIT: Operation to split a linear value into parts
export const getSplitNode = (store: FosStore) => generateConstructor(store, "SPLIT", { description: { content: 'Split - Divide linear value' } }, [])

// === Par-style Session Type Primitives ===

// SEND: Protocol action to send a value
export const getSendNode = (store: FosStore) => generateConstructor(store, "SEND", { description: { content: 'Send - Send value in protocol' } }, [])

// RECV: Protocol action to receive a value
export const getRecvNode = (store: FosStore) => generateConstructor(store, "RECV", { description: { content: 'Recv - Receive value in protocol' } }, [])

// CHOICE: Protocol offering a choice to the other party
export const getChoiceNode = (store: FosStore) => generateConstructor(store, "CHOICE", { description: { content: 'Choice - Offer selection' } }, [])

// SELECT: Protocol making a selection from offered choices
export const getSelectNode = (store: FosStore) => generateConstructor(store, "SELECT", { description: { content: 'Select - Make selection' } }, [])

// END: Protocol session termination
export const getEndNode = (store: FosStore) => generateConstructor(store, "END", { description: { content: 'End - Session complete' } }, [])

// DUAL: Type operator computing the dual of a session type
export const getDualNode = (store: FosStore) => generateConstructor(store, "DUAL", { description: { content: 'Dual - Opposite session type' } }, [])

// === Resource Primitives ===

// BUDGET: Linear monetary resource
export const getBudgetNode = (store: FosStore) => generateConstructor(store, "BUDGET", { description: { content: 'Budget - Linear monetary resource' } }, [])

// CALENDAR: Linear time-slot resource
export const getCalendarNode = (store: FosStore) => generateConstructor(store, "CALENDAR", { description: { content: 'Calendar - Linear time resource' } }, [])

// ALLOCATION: Sub-allocation of a linear resource
export const getAllocationNode = (store: FosStore) => generateConstructor(store, "ALLOCATION", { description: { content: 'Allocation - Resource sub-division' } }, [])

// BALANCE: Current balance of a budget
export const getBalanceNode = (store: FosStore) => generateConstructor(store, "BALANCE", { description: { content: 'Balance - Current budget amount' } }, [])

// SPENT: Amount spent from a budget
export const getSpentNode = (store: FosStore) => generateConstructor(store, "SPENT", { description: { content: 'Spent - Consumed budget amount' } }, [])

// TIMESLOT: A specific time period in a calendar
export const getTimeslotNode = (store: FosStore) => generateConstructor(store, "TIMESLOT", { description: { content: 'Timeslot - Calendar time period' } }, [])

// AVAILABLE: Available resource amount
export const getAvailableNode = (store: FosStore) => generateConstructor(store, "AVAILABLE", { description: { content: 'Available - Remaining resource' } }, [])

// === Modal Type Primitives ===
// These primitives support modal types for storage routing

// BOX: □_m A - value available in modality m
export const getBoxNode = (store: FosStore) => generateConstructor(store, "BOX", { description: { content: 'Box - Modal necessity' } }, [])

// DIAMOND: ◇_m A - value possible in modality m
export const getDiamondNode = (store: FosStore) => generateConstructor(store, "DIAMOND", { description: { content: 'Diamond - Modal possibility' } }, [])

// MODALITY: Modality identifier
export const getModalityNode = (store: FosStore) => generateConstructor(store, "MODALITY", { description: { content: 'Modality - Storage context' } }, [])

// LOCAL_MOD: Local .fos storage modality
export const getLocalModNode = (store: FosStore) => generateConstructor(store, "LOCALMOD", { description: { content: 'Local Modality - Local .fos storage' } }, [])

// HOME_MOD: Home ~/.fos storage modality
export const getHomeModNode = (store: FosStore) => generateConstructor(store, "HOMEMOD", { description: { content: 'Home Modality - ~/.fos storage' } }, [])

// ONLINE_MOD: Online server storage modality
export const getOnlineModNode = (store: FosStore) => generateConstructor(store, "ONLINEMOD", { description: { content: 'Online Modality - Server storage' } }, [])

// PEER_MOD: Peer storage modality
export const getPeerModNode = (store: FosStore) => generateConstructor(store, "PEERMOD", { description: { content: 'Peer Modality - Peer storage' } }, [])

// UNBOX: Operation to extract value from box (requires modality)
export const getUnboxNode = (store: FosStore) => generateConstructor(store, "UNBOX", { description: { content: 'Unbox - Extract modal value' } }, [])

// === Actor Primitives ===
// These primitives support virtual actors and capability-based dispatch

// ACTOR: Actor identifier/reference
export const getActorNode = (store: FosStore) => generateConstructor(store, "ACTOR", { description: { content: 'Actor - Protocol participant' } }, [])

// CAPABILITY: Capability that an actor provides
export const getCapabilityNode = (store: FosStore) => generateConstructor(store, "CAPABILITY", { description: { content: 'Capability - Actor capability' } }, [])

// EFFECT: Side effect to be handled by an actor
export const getEffectNode = (store: FosStore) => generateConstructor(store, "EFFECT", { description: { content: 'Effect - Side effect' } }, [])

// HANDLER: Effect handler implementation
export const getHandlerNode = (store: FosStore) => generateConstructor(store, "HANDLER", { description: { content: 'Handler - Effect handler' } }, [])



export const createAliasNode = () => {




}






export const generateConstructor = (
  store: FosStore,
  alias: string,
  data: FosDataContent,
  children: [((store: FosStore) => FosNode), ((store: FosStore) => FosNode)][]) => {

  const constructedChildren: FosPathElem[] = children.map(([left, right]) => [left(store).getId(), right(store).getId()])

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
  // Proposal-related constructors
  const proposedContentField = getProposedContentNode(store)
  const proposalNameField = getProposalNameNode(store)
  const parentBranchField = getParentBranchNode(store)
  const senderField = getSenderNode(store)
  const timestampField = getTimestampNode(store)
  const signatureField = getSignatureNode(store)
  // Peer/membership-related constructors
  const peerField = getPeerFieldNode(store)
  const memberField = getMemberFieldNode(store)
  const peerIdField = getPeerIdFieldNode(store)
  const peerPublicKeyField = getPeerPublicKeyFieldNode(store)
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
  const rootInstructionNode = getRootInstructionNode(store)
  const startRootAlias = getStartRootAlias(store, {
    terminal,
    previousVersion,
    targetPointerConstructor,
    instructionPointerConstructor,
    rootInstructionNode
  })
  const brachConstructorNode = getBrachConstructorNode(store)


  const updateAction = getUpdateActionNode(store)
  const prevInstructionPointerConstructor = getPrevInstructionPointerConstructor(store)
  const prevTargetPointerConstructor = getPrevTargetPointerConstructor(store)

  // Group actions
  const createGroupActionNode = createGroupAction(store)
  const addMemberToGroupActionNode = addMemberToGroupAction(store)
  const removeMemberFromGroupActionNode = removeMemberFromGroupAction(store)
  const createDMActionNode = createDMAction(store)
  const sendGroupMessageActionNode = sendGroupMessageAction(store)

  // Datalog primitives
  const factNode = getFactNode(store)
  const ruleNode = getRuleNode(store)
  const ruleHeadNode = getRuleHeadNode(store)
  const ruleBodyNode = getRuleBodyNode(store)
  const variableNode = getVariableNode(store)
  const queryNode = getQueryNode(store)
  const bindingNode = getBindingNode(store)
  const scopeNode = getScopeNode(store)
  const parentScopeNode = getParentScopeNode(store)
  const assertNode = getAssertNode(store)
  const retractNode = getRetractNode(store)
  const taskEffectNode = getTaskEffectNode(store)
  const completedNode = getCompletedNode(store)

  // Version control primitives
  const commitNode = getCommitNode(store)
  const headNode = getHeadNode(store)
  const mergeNode = getMergeNode(store)
  const mergeSourceNode = getMergeSourceNode(store)
  const ancestorNode = getAncestorNode(store)
  const historyNode = getHistoryNode(store)
  const branchNameNode = getBranchNameNode(store)
  const tagNode = getTagNode(store)
  const conflictOursNode = getConflictOursNode(store)
  const conflictTheirsNode = getConflictTheirsNode(store)
  const conflictBaseNode = getConflictBaseNode(store)

  // Linear type primitives
  const linearNode = getLinearNode(store)
  const consumeNode = getConsumeNode(store)
  const splitNode = getSplitNode(store)

  // Session type primitives
  const sendNode = getSendNode(store)
  const recvNode = getRecvNode(store)
  const choiceNode = getChoiceNode(store)
  const selectNode = getSelectNode(store)
  const endNode = getEndNode(store)
  const dualNode = getDualNode(store)

  // Resource primitives
  const budgetNode = getBudgetNode(store)
  const calendarNode = getCalendarNode(store)
  const allocationNode = getAllocationNode(store)
  const balanceNode = getBalanceNode(store)
  const spentNode = getSpentNode(store)
  const timeslotNode = getTimeslotNode(store)
  const availableNode = getAvailableNode(store)

  // Modal type primitives
  const boxNode = getBoxNode(store)
  const diamondNode = getDiamondNode(store)
  const modalityNode = getModalityNode(store)
  const localModNode = getLocalModNode(store)
  const homeModNode = getHomeModNode(store)
  const onlineModNode = getOnlineModNode(store)
  const peerModNode = getPeerModNode(store)
  const unboxNode = getUnboxNode(store)

  // Actor primitives
  const actorNode = getActorNode(store)
  const capabilityNode = getCapabilityNode(store)
  const effectNode = getEffectNode(store)
  const handlerNode = getHandlerNode(store)

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
    proposedContentField,
    proposalNameField,
    parentBranchField,
    senderField,
    timestampField,
    signatureField,
    peerField,
    memberField,
    peerIdField,
    peerPublicKeyField,
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
    prevInstructionPointerConstructor,
    prevTargetPointerConstructor,
    rootInstructionNode,
    // Group actions
    createGroupActionNode,
    addMemberToGroupActionNode,
    removeMemberFromGroupActionNode,
    createDMActionNode,
    sendGroupMessageActionNode,
    // Datalog primitives
    factNode,
    ruleNode,
    ruleHeadNode,
    ruleBodyNode,
    variableNode,
    queryNode,
    bindingNode,
    scopeNode,
    parentScopeNode,
    assertNode,
    retractNode,
    taskEffectNode,
    completedNode,
    // Version control primitives
    commitNode,
    headNode,
    mergeNode,
    mergeSourceNode,
    ancestorNode,
    historyNode,
    branchNameNode,
    tagNode,
    conflictOursNode,
    conflictTheirsNode,
    conflictBaseNode,
    // Linear type primitives
    linearNode,
    consumeNode,
    splitNode,
    // Session type primitives
    sendNode,
    recvNode,
    choiceNode,
    selectNode,
    endNode,
    dualNode,
    // Resource primitives
    budgetNode,
    calendarNode,
    allocationNode,
    balanceNode,
    spentNode,
    timeslotNode,
    availableNode,
    // Modal type primitives
    boxNode,
    diamondNode,
    modalityNode,
    localModNode,
    homeModNode,
    onlineModNode,
    peerModNode,
    unboxNode,
    // Actor primitives
    actorNode,
    capabilityNode,
    effectNode,
    handlerNode,

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
  dereferenceAlias: FosNode,
  startRootAlias: FosNode,
  brachConstructorNode: FosNode,
  proposalField: FosNode,
  proposedContentField: FosNode,
  proposalNameField: FosNode,
  parentBranchField: FosNode,
  senderField: FosNode,
  timestampField: FosNode,
  signatureField: FosNode,
  peerField: FosNode,
  memberField: FosNode,
  peerIdField: FosNode,
  peerPublicKeyField: FosNode,
  targetPointerConstructor: FosNode,
  instructionPointerConstructor: FosNode,
  revisionField: FosNode,
  projectField: FosNode,
  periodicTrigger: FosNode,
  requestTrigger: FosNode,
  manualTrigger: FosNode,
  dailyTrigger: FosNode,
  updateAction: FosNode,
  prevInstructionPointerConstructor: FosNode,
  prevTargetPointerConstructor: FosNode,
  rootInstructionNode: FosNode,
  // Group actions
  createGroupActionNode: FosNode,
  addMemberToGroupActionNode: FosNode,
  removeMemberFromGroupActionNode: FosNode,
  createDMActionNode: FosNode,
  sendGroupMessageActionNode: FosNode,
  // Datalog primitives
  factNode: FosNode,
  ruleNode: FosNode,
  ruleHeadNode: FosNode,
  ruleBodyNode: FosNode,
  variableNode: FosNode,
  queryNode: FosNode,
  bindingNode: FosNode,
  scopeNode: FosNode,
  parentScopeNode: FosNode,
  assertNode: FosNode,
  retractNode: FosNode,
  taskEffectNode: FosNode,
  completedNode: FosNode,
  // Version control primitives
  commitNode: FosNode,
  headNode: FosNode,
  mergeNode: FosNode,
  mergeSourceNode: FosNode,
  ancestorNode: FosNode,
  historyNode: FosNode,
  branchNameNode: FosNode,
  tagNode: FosNode,
  conflictOursNode: FosNode,
  conflictTheirsNode: FosNode,
  conflictBaseNode: FosNode,
  // Linear type primitives
  linearNode: FosNode,
  consumeNode: FosNode,
  splitNode: FosNode,
  // Session type primitives
  sendNode: FosNode,
  recvNode: FosNode,
  choiceNode: FosNode,
  selectNode: FosNode,
  endNode: FosNode,
  dualNode: FosNode,
  // Resource primitives
  budgetNode: FosNode,
  calendarNode: FosNode,
  allocationNode: FosNode,
  balanceNode: FosNode,
  spentNode: FosNode,
  timeslotNode: FosNode,
  availableNode: FosNode,
  // Modal type primitives
  boxNode: FosNode,
  diamondNode: FosNode,
  modalityNode: FosNode,
  localModNode: FosNode,
  homeModNode: FosNode,
  onlineModNode: FosNode,
  peerModNode: FosNode,
  unboxNode: FosNode,
  // Actor primitives
  actorNode: FosNode,
  capabilityNode: FosNode,
  effectNode: FosNode,
  handlerNode: FosNode,
}
