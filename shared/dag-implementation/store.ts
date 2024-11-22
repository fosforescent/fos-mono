import { assert, aggMap, traverseNodes } from '../utils'
import { FosNode,} from './node'


import { 
  getNameFieldNode, 
  getPreviousVersionNode, 
  getStringFieldNode, 
  getTerminalNode, 
  getUnitNode, 
  getDescriptionFieldNode, 
  getFieldFieldNode,
  getChoiceTargetNode,
  getLinkFieldNode,
  getLinkActionNode,
  getCopyActionNode,
  getInputActionNode,
  getCompleteActionNode,
  getCancelActionNode,
  getOptionNotSelectedConstructor,
  getOptionSelectedConstructor,
  getWorkflowInstructionNode,
  getRootInstructionNode,
  getCommentInstructionNode,
  getDocumentInstructionNode,
  getRoleFieldNode,
  getNumberFieldNode,
  getTimeFieldNode,
  getDateFieldNode,
  getDurationFieldNode,
  getInvoiceLineFieldNode,
  getInvoiceCommentFieldNode,
  getInvoiceFieldNode,
  getPaymentFieldNode,
  getTransactionFieldNode,
  getActionFieldNode,
  getApprovalFieldNode,
  getVoteFieldNode,
  // getExpressionFieldNode,
  getContactFieldNode,
  getEmailFieldNode,
  getPhoneFieldNode,
  getAddressFieldNode,
  // getFirstNameFieldNode,
  // getLastNameFieldNode,
  // getMiddleNameFieldNode,
  getBusinessFieldNode,
  getBusinessNameFieldNode,
  // getInvoiceNode,
  // getDocumentFieldNode,
  // getPaymentNode,
  // getNo,
  getPersonFieldNode,
  getGroupFieldNode,
  getCurrencyFieldNode,
  getPriceFieldNode,
  getListFieldNode,
  getBooleanFieldNode,
  getTagFieldNode,
  getLabelFieldNode,
  getComboFieldNode,
  getExpressionFieldNode,
  getFirstNameFieldNode,
  getLastNameFieldNode,
  getMiddleNameFieldNode,
  getSearchQueryNode,
  getSearchResultsNode,



} from './primitive-node'

import { AppState, FosContextData, FosNodeContent, FosPath, FosPathElem, FosRoute, TrellisSerializedData } from '../types'

import { sha3_256 } from 'js-sha3'
import { th } from 'date-fns/locale'
import { FosExpression } from './expression'


export class FosStore {
  table: Map<string, FosNodeContent> = new Map()


  voidNode: FosNode
  unitNode: FosNode
  // nameNode: FosNode
  previousVersionNode: FosNode
  // allOfNode: FosNode
  fieldFieldNode: FosNode
  stringFieldNode: FosNode
  descriptionFieldNode: FosNode
  choiceTargetNode: FosNode
  linkFieldNode: FosNode
  groupFieldNode: FosNode
  // inputFieldNode: FosNode
  roleFieldNode: FosNode
  personFieldNode: FosNode
  linkActionNode: FosNode
  copyActionNode: FosNode
  inputActionNode: FosNode
  completeActionNode: FosNode
  cancelActionNode: FosNode
  // choiceFieldNode: FosNode
  // taskFieldNode: FosNode
  comboFieldNode: FosNode
  labelFieldNode: FosNode
  numberFieldNode: FosNode
  booleanFieldNode: FosNode
  listFieldNode: FosNode
  // optionFieldNode: FosNode
  approvalFieldNode: FosNode
  voteFieldNode: FosNode
  workflowFieldNode: FosNode 
  expressionFieldNode: FosNode
  contactFieldNode: FosNode
  emailFieldNode: FosNode
  phoneFieldNode: FosNode
  addressFieldNode: FosNode
  nameFieldNode: FosNode
  firstNameFieldNode: FosNode
  lastNameFieldNode: FosNode
  middleNameFieldNode: FosNode
  businessFieldNode: FosNode
  businessNameFieldNode: FosNode
  dateFieldNode: FosNode
  timeFieldNode: FosNode
  durationFieldNode: FosNode
  invoiceLineFieldNode: FosNode
  
  invoiceCommentsFieldNode: FosNode
  priceFieldNode: FosNode
  currencyFieldNode: FosNode
  invoiceNode: FosNode
  documentFieldNode: FosNode
  paymentNode: FosNode
  transactionNode: FosNode
  actionNode: FosNode
  optionSelectedConstructor: FosNode
  optionNotSelectedConstructor: FosNode
  tagFieldNode: FosNode
  optionConstructor: FosNode
  searchQueryNode: FosNode
  searchResultsNode: FosNode
  

  rootsHistory: string[] = [];


  trellisData: TrellisSerializedData = {
    focusChar: null,
    focusRoute: [],
    collapsedList: [],
    rowDepth: 0,
    dragInfo: {
      dragging: null,
      dragOverInfo: null,
    }
  }
  
  rootInstruction: FosNode
  rootTarget: FosNode

  fosRoute: FosPath = []

  cache = new Map<string, FosNode>()

  aliasMap = new Map<string, string>()

  version = 0

  constructor(fosCtxData?: AppState["data"]) {
    const voidNode = getTerminalNode(this)
    this.voidNode = voidNode

    this.unitNode = getUnitNode(this)
    // this.nameNode = getNameNode(this)
    // this.allOfNode = getAllOfNode(this)
    this.previousVersionNode = getPreviousVersionNode(this)
    this.fieldFieldNode = getFieldFieldNode(this)
    this.stringFieldNode = getStringFieldNode(this)
    this.descriptionFieldNode = getDescriptionFieldNode(this)
    this.choiceTargetNode = getChoiceTargetNode(this)
    this.linkFieldNode = getLinkFieldNode(this)
    this.linkActionNode = getLinkActionNode(this)
    this.copyActionNode = getCopyActionNode(this)
    this.inputActionNode = getInputActionNode(this)
    this.completeActionNode = getCompleteActionNode(this)
    this.cancelActionNode = getCancelActionNode(this)
    this.roleFieldNode = getRoleFieldNode(this)
    this.numberFieldNode = getNumberFieldNode(this)
    this.timeFieldNode = getTimeFieldNode(this)
    this.dateFieldNode = getDateFieldNode(this)
    this.durationFieldNode = getDurationFieldNode(this)
    this.invoiceLineFieldNode = getInvoiceLineFieldNode(this)
    
    this.invoiceCommentsFieldNode = getInvoiceCommentFieldNode(this)
    this.invoiceNode = getInvoiceFieldNode(this)
    this.paymentNode = getPaymentFieldNode(this)
    this.transactionNode = getTransactionFieldNode(this)
    this.actionNode = getActionFieldNode(this)
    this.approvalFieldNode = getApprovalFieldNode(this)
    this.voteFieldNode = getVoteFieldNode(this)
    this.expressionFieldNode = getExpressionFieldNode(this)
    this.contactFieldNode = getContactFieldNode(this)
    this.emailFieldNode = getEmailFieldNode(this)
    this.phoneFieldNode = getPhoneFieldNode(this)
    this.addressFieldNode = getAddressFieldNode(this)
    this.firstNameFieldNode = getFirstNameFieldNode(this)
    this.lastNameFieldNode = getLastNameFieldNode(this)
    this.middleNameFieldNode = getMiddleNameFieldNode(this)
    this.businessFieldNode = getBusinessFieldNode(this)
    this.businessNameFieldNode = getBusinessNameFieldNode(this)
    this.workflowFieldNode = getWorkflowInstructionNode(this)
    this.comboFieldNode = getComboFieldNode(this)
    this.labelFieldNode = getLabelFieldNode(this)
    this.numberFieldNode = getNumberFieldNode(this)
    this.booleanFieldNode = getBooleanFieldNode(this)
    this.listFieldNode = getListFieldNode(this)
    // this.optionFieldNode = getOptionFieldNode(this)
    this.priceFieldNode = getPriceFieldNode(this)
    this.currencyFieldNode = getCurrencyFieldNode(this)
    this.groupFieldNode = getGroupFieldNode(this)
    
    this.personFieldNode = getPersonFieldNode(this)
    this.nameFieldNode = getNameFieldNode(this)
    this.documentFieldNode = getDocumentInstructionNode(this)
    this.optionSelectedConstructor = getOptionSelectedConstructor(this)
    this.optionNotSelectedConstructor = getOptionNotSelectedConstructor(this)
    this.optionConstructor = getOptionNotSelectedConstructor(this)
    this.tagFieldNode = getTagFieldNode(this)

    this.searchQueryNode = getSearchQueryNode(this)
    this.searchResultsNode = getSearchResultsNode(this)

    


    if (fosCtxData){

      this.fosRoute = fosCtxData.fosData.route
      traverseNodes(fosCtxData.fosData, (nodeContent, address) => {
        console.log('traverseNodes', nodeContent, address)
        this.insert(nodeContent, address)
      })
      // Object.keys(fosCtxData.fosData.nodes).forEach((alias) => {
      //   const content = fosCtxData.fosData.nodes[alias]!
      //   this.insert(content, alias)
      // })
      const thisRootInstructionNode = this.create(fosCtxData.fosData.baseNodeInstruction, "rootInstruction")
      const thisRootTargetNode = this.create(fosCtxData.fosData.baseNodeContent, "rootTarget")
      this.rootInstruction = thisRootInstructionNode
      this.rootTarget = thisRootTargetNode

    } else {
      this.rootInstruction = getTerminalNode(this)
      this.rootTarget = getTerminalNode(this)
    }
    
  }



  applyMutation (mutation: FosNodeContent): void {
    // apply mutation, 


  }




  hash (nodeContent: FosNodeContent): string {
    const hash = hashContent(nodeContent)
    return hash
  }

  checkAddress (address: string): string | null {
    // console.log('checkAddress', address, [...this.table.keys()], [...this.externalData.keys()], this.table.get(address) !== undefined, this.externalData.get(address) !== undefined)
    const isNode = this.table.get(address) !== undefined
    if (isNode){
      return address
    } else {
      const aliasAddress = this.aliasMap.get(address)
      if (!aliasAddress){
        console.log('address not found', address, this.aliasMap)
        throw new Error(`address ${address} not found`)
      }else{
        const aliasResult = this.table.get(aliasAddress as string) !== undefined
        if (aliasResult){
          return address
        }else{
          return null
        }
      }
    }

  }



  create(value: FosNodeContent, alias?: string): FosNode {
    value.children.forEach((item, index) => {
      if (Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string') {
        if (!this.checkAddress(item[0])){
          throw new Error(`node ${item[0]} not found at index ${index}.  Probably inserting an edge that doesn't exist`)
        }
        if (!this.checkAddress(item[1])){
          throw new Error(`node ${item[1]} not found at index ${index}.  Probably inserting a node with an edge to a node that doesn't exist`)
        }
      } else {
        throw new Error(`inserting array that has malformed edges`)
      }
    })
    return new FosNode(value, this, alias)
  }

  insert (nodeContent: FosNodeContent, alias?: string): string {
    console.log('insert regular starting', nodeContent)
    nodeContent.children.map((edge, index) => {      
      // console.log('edge', edge)
      assert(!!this.checkAddress(edge[0]), `node ${edge[0]} not found at index ${index}`)
      assert(!!this.checkAddress(edge[1]) , `node ${edge[1]} not found at index ${index}`)
      return [this.checkAddress(edge[0]), this.checkAddress(edge[1])]
    })
    const address = this.hash(nodeContent)
    this.table.set(address, nodeContent)

    if (alias){
      this.aliasMap.set(alias, address)
    }

    console.log('insert regular', address, nodeContent, this.table, this.aliasMap)
    return address
  }

  getAliases(node: FosNode): string[] {
    const cid = node.getId()
    return [...this.aliasMap.entries().filter(([alias, entry]) => {
      if (entry === cid) return true

    }).map(([alias, entry]) => alias), cid]
  }


  remove (node: FosNode): void {
    const cid = node.getId()
    assert(!!this.checkAddress(cid), `address ${cid} not found`)
    this.table.has(cid) && this.table.delete(cid)
    this.cache.has(cid) && this.cache.delete(cid)


    this.aliasMap.forEach((alias, address) => {
      if (cid === address){
        this.aliasMap.delete(alias)
      }
    })
    
    /**
     * TODO: delete all edges that point to this address, 
     * notify interpreter? 
    */
    
  }


  exportContext(route: FosPath): AppState["data"] {
    const nodes: AppState["data"]["fosData"]["nodes"] = {}
    this.table.forEach((content, address) => {
      const aliases = this.getAliases(this.getNodeByAddress(address))
      aliases.forEach((alias) => {
        nodes[alias] = content
      })
    })
    return {
      fosData: {
        nodes,
        route: route,
        baseNodeContent: this.rootTarget.getContent(),
        baseNodeInstruction: this.rootInstruction.getContent(),
      },
      trellisData: this.trellisData
    }
  }

  getNodeByAddress (address: string): FosNode {
    // console.log('getNodeByAddress', address, this.checkAddress(address, true))
    if (!this.checkAddress(address)) {
      console.log('address was not found', address)
      throw new Error(`address ${address} not found`)
    }
    if (this.cache.has(address)) return this.cache.get(address) as FosNode
    if (this.aliasMap.has(address)){
      console.log('alias found', address, this.aliasMap.get(address))      
      return this.getNodeByAlias(address)
    }
    // console.log('queryNodeByAddress', address, this.cache.entries())
    // console.log('test1', this.cache.has(address))
    const nodeContent = this.table.get(address) as FosNodeContent
    // console.log('edges', edges)

    const result = this.create(nodeContent)

    if (!result) throw new Error(`Unable to construct node for address ${address}`)
    return result
  }

  getNodeByAlias (alias: string): FosNode {
    const address = this.aliasMap.get(alias)
    if (!address){
      throw new Error(`alias ${alias} not found`)
    }
    const node = this.getNodeByAddress(address)
    return node
  }

  
  getContent(node: FosNode): FosNodeContent {
    const maybeContent = this.table.get(node.getId())
    if (!maybeContent){
      throw new Error(`node ${node.getId()} not found`)
    }
    return maybeContent
  }



  query(query: FosNode): FosNode[] {
    /**
     * TODO: change this to return nodes that are part of the subgraph starting from the current root (or another root if specified)
     * 
     * query should return any nodes that have at least the same edges as the query, where the unit node is a wildcard. 
     * So this means that if the query has an edge to a different target, we need to go into that target and compare it to the 
     * entry. We can only stop comparing the trees once with hit a leaf node... unit, void, or external unless the entry 
     * doesn't have an edge of the type, or it has a different number of edges from the query
     */
    // console.log('query starting', query)

    const queryCid = query.getId()

    const result: FosNode[] = []
    const tableEntries = [...this.table.entries()]
    tableEntries.forEach(([entrykey, entryvalue]) => {
      if (entrykey === queryCid) return
      this.create(entryvalue)
      try {
        const matches = this.matchPattern(query, this.getNodeByAddress(entrykey))
        result.push(this.getNodeByAddress(entrykey))
      }catch (e: any) {
        if (!e.cause?.patternFailed){
          throw e
        }
        // console.log('query failed', e)
      }
    })
    return result
  }

  matchPattern (pattern: FosNode, entry: FosNode): FosNode[] {
    const patternMap = aggMap(pattern.getEdges())
    const nodeMap = aggMap(entry.getEdges())

    const patternCid = pattern.getId()
    const entryCid = entry.getId()

    if(patternCid === entryCid){
      return []
    }
    if(patternCid === this.unitNode.getId()){
      return [entry]
    }
    if(patternCid === this.voidNode.getId()){
      throw new Error(`pattern expecte void --- pattern ${pattern} does not match entry ${entry}`, { cause: { patternFailed: true } })
    }

    const patternResult: FosNode[] = []
    for (const [patternKey, patternValues] of patternMap.entries()) {
      if (!nodeMap.has(patternKey)) {
        throw new Error(`pattern ${patternKey} does not exist on node entry.  Cannot resolve pattern`, { cause: { patternFailed: true } })
      }else {
        const entryTargetsForKey = nodeMap.get(patternKey) as string[]
        if( patternValues.length !== entryTargetsForKey.length){
          throw new Error(`pattern ${patternKey} has ${patternValues.length} entries, but node ${patternKey} has ${nodeMap.get(patternKey)?.length} entries.  Cannot resolve pattern`, { cause: { patternFailed: true } })
        }else{
          patternValues.forEach((patternValue, index) => {
            if (patternValue === this.unitNode.getId()){
              patternResult.push(this.getNodeByAddress(entryTargetsForKey[index] as string))
            } else if (entryTargetsForKey[index] !== patternValue){
              // TODO: figure out what do here
              const subQueryResults = this.matchPattern(this.getNodeByAddress(patternValue), this.getNodeByAddress(entryTargetsForKey[index] as string))
              patternResult.push(...subQueryResults)
            }
          })
        }
      }
    }
    return patternResult
  }

  queryTriple(subject: FosNode, predicate: FosNode, object: FosNode): [FosNode, FosNode, FosNode][] {
    const subjectMatches = this.query(subject)
    const result: FosNode[] = []
    const tripleResults = subjectMatches.flatMap((subjectMatch) => {
      const edgeMatches = subjectMatch.getEdges().filter(([predicateKey, objectKey]) => {
        try {
          this.matchPattern(predicate, this.getNodeByAddress(predicateKey))
          return true
        } catch (e: any) {
          if (!e.cause?.patternFailed){
            throw e
          }
          return false
        }
      })
      const allMatches = edgeMatches.filter(([predicateKey, objectKey]) => {
        try {
          this.matchPattern(object, this.getNodeByAddress(objectKey))
          return true
        } catch (e : any) {
          if (!e.cause?.patternFailed){
            throw e
          }
          return false
        }

      })
      return allMatches.map(([predicateKey, objectKey]) => [subjectMatch, this.getNodeByAddress(predicateKey), this.getNodeByAddress(objectKey)] as [FosNode, FosNode, FosNode])
    })
    return tripleResults
  }

  negativeQueryTriple(subject: FosNode, predicate: FosNode, object: FosNode): [FosNode, FosNode, FosNode][] {

    const subjectCid = subject.getId()
    const predicateCid = predicate.getId()
    const objectCid = predicate.getId()

    if (subjectCid === this.voidNode.getId()) {
      const nodesToTest = this.query(object)
      const result = nodesToTest.filter((nodeToTest) => {
        const test = this.queryTriple(this.getNodeByAddress(this.unitNode.getId() as string), predicate, nodeToTest)
        return test.length === 0
      })
      return result.map((node) => [subject, predicate, node] as [FosNode, FosNode, FosNode])
    } else if (predicateCid === this.voidNode.getId()) {
      throw new Error('not implemented')
    } else if (objectCid === this.voidNode.getId()) {
      throw new Error('not implemented')
    } else {
      throw new Error('not a negative query')
    }
  }

 
  
}  



function sortObject(obj: any): any {
  if (Array.isArray(obj)) {
    return [...obj].sort().map(sortObject)
  }
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((result: any, key) => {
      result[key] = sortObject(obj[key])
      return result
    }, {})
  }
  return obj
}

function sortEdges(edges: FosPathElem[]): FosPathElem[] {
  return edges.map(edge => [...edge].sort() as FosPathElem)
    .sort((a, b) => 
      a[0] < b[0] ? -1 : 
      a[0] > b[0] ? 1 : 
      a[1] < b[1] ? -1 : 
      a[1] > b[1] ? 1 : 0
    )
}

export function hashContent(content: FosNodeContent): string {
  const normalized = {
    data: sortObject(content.data),
    children: sortEdges(content.children)
  }
  return sha3_256(JSON.stringify(normalized))
}

const aggMapContent = (content: FosNodeContent): Map<string, string[]> => {
  return aggMap(content.children)
}
