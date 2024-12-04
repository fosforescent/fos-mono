import { assert, aggMap, traverseNodes } from '../utils'
import { FosNode,} from './node'


import { 
  constructPrimitiveAliases,
  PrimitiveAliases

} from './primitive-node'

import { AppState, FosContextData, FosNodeContent, FosNodeId, FosPath, FosPathElem, FosRoute, TrellisSerializedData } from '../types'

import { sha3_256 } from 'js-sha3'

import { FosExpression } from './expression'
import { Delta, diff, patch } from '@n1ru4l/json-patch-plus'




export class FosStore {
  table: Map<string, FosNodeContent> = new Map()


  

  rootsHistory: FosPathElem[] = [];


  trellisData: TrellisSerializedData = {
    focusChar: null,
    focusRoute: [],
    collapsedList: [],
    rowDepth: 0,
    view: "Queue",
    activity: "todo",
    mode: "execute",
    dragInfo: {
      dragging: null,
      dragOverInfo: null,
    }
  }

  updatedTime = 0
  
  rootInstruction: FosNode
  rootTarget: FosNode

  fosRoute: FosPath = []

  cache = new Map<string, FosNode>()

  aliasMap = new Map<string, string>()
  uuidMap = new Map<string, string>()
  cidToUuidMap = new Map<string, string>()

  version = 0

  primitive: PrimitiveAliases
  private hashCache = new WeakMap<FosNodeContent, string>();

  updateCtxCallback: ((data: AppState["data"]) => void) | null;

 
  constructor({ fosCtxData, mutationCallback }: { fosCtxData?: AppState["data"], mutationCallback?: (data: AppState["data"]) => void } = {}) {
    this.primitive = constructPrimitiveAliases(this)
    this.updateCtxCallback = mutationCallback || null

    if (fosCtxData){

      this.fosRoute = fosCtxData.fosData.route
      const existingCids = [...this.table.keys()]
      const existingAliases = [...this.aliasMap.keys()]
      const newKeys = Object.keys(fosCtxData.fosData.nodes)

      const allValidKeys = new Set([...existingCids, ...existingAliases, ...newKeys])
      // check all children first
      Object.keys(fosCtxData.fosData.nodes).forEach((key) => {
        const nodeContent = fosCtxData.fosData.nodes[key]!
        nodeContent.children.forEach((edge, index) => {
          if (!allValidKeys.has(edge[0])){
            throw new Error(`edge ${edge} has non-existent instruction node`)
          }
          if(!allValidKeys.has(edge[1])){
            throw new Error(`edge ${edge} has non-existent target nodes`)
          }
        })
      })

  
      Object.keys(fosCtxData.fosData.nodes).forEach((key) => {
        const nodeContent = fosCtxData.fosData.nodes[key]!
        const cid = this.hash(nodeContent)
        this.table.set(cid, nodeContent)
        if (key !== cid) this.aliasMap.set(key, cid)

      })

      const thisRootInstructionNode = this.create(fosCtxData.fosData.baseNodeInstruction, "rootInstruction")
      const thisRootTargetNode = this.create(fosCtxData.fosData.baseNodeContent, "rootTarget")
      this.rootInstruction = thisRootInstructionNode
      this.rootTarget = thisRootTargetNode

    } else {
      this.rootInstruction = this.primitive.voidNode
      this.rootTarget = this.primitive.voidNode
    }
    
  }

  


  getRootExpression(): FosExpression {
    return new FosExpression(this, [])
  }

  hash (nodeContent: FosNodeContent): string {
    if (this.hashCache.has(nodeContent)){
      return this.hashCache.get(nodeContent) as string
    }else {
      const hash = hashContent(nodeContent)
      return hash
  
    }
  }

  checkAddress (address: string): string | null {
    // console.log('checkAddress', address, [...this.table.keys()], [...this.externalData.keys()], this.table.get(address) !== undefined, this.externalData.get(address) !== undefined)
    const isNode = this.table.get(address) !== undefined
    if (isNode){
      return address
    } else {
      const aliasAddress = this.aliasMap.get(address)
      if (!aliasAddress){
        return null
        // console.log('address not found', address, this.aliasMap)
        // throw new Error(`address ${address} not found`)
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
    
    const updatedChildren = value.children.map((item, index) => {
      if (Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string') {

  

        if (!this.checkAddress(item[0]) && !this.checkAddress(item[1])){

          const newErrorTargetContent: FosNodeContent = {
            data: {
              error: {
                instructionIsError: true,
                instruction: item[0],
                targetIsError: true,
                target: item[1],
                message: `Error: edge referencing non-existent nodes - \n ${item[0]} , ${item[1]} \n Please report if this issue persists or caused data loss`
              }
            },
            children: []
          }
          const newErrorTargetAddress = this.insert(newErrorTargetContent)
          const newElem: FosPathElem = [this.primitive.errorNode.getId(), newErrorTargetAddress]
          return newElem


        } else if (!this.checkAddress(item[0])) {

          const newErrorTargetContent: FosNodeContent = {
            data: {
              error: {
                instructionIsError: true,
                instruction: item[0],
                targetIsError: false,
                target: item[1],
                message: `Error: edge referencing non-existent nodes - \n ${item[0]} \n Please report if this issue persists or caused data loss`
              }
            },
            children: []
          }
          const newErrorTargetAddress = this.insert(newErrorTargetContent)
          const newElem: FosPathElem = [this.primitive.errorNode.getId(), newErrorTargetAddress]
          return newElem

        } else if (!this.checkAddress(item[1])) {
          const newErrorTargetContent: FosNodeContent = {
            data: {
              error: {
                instructionIsError: false,
                instruction: item[0],
                targetIsError: true,
                target: item[1],
                message: `Error: edge referencing non-existent nodes - \n ${item[1]} \n Please report if this issue persists or caused data loss`
              }
            },
            children: []
          }
          const newErrorTargetAddress = this.insert(newErrorTargetContent)
          const newElem: FosPathElem = [this.primitive.errorNode.getId(), newErrorTargetAddress]
          return newElem
        }


        return item

      } else {

        const newErrorTargetContent: FosNodeContent = {
          data: {
            error: {
              instructionIsError: true,
              instruction: "",
              targetIsError: true,
              target: "",
              message: `malformed edge - \n ${JSON.stringify(item)} \n Please report if this issue persists or caused data loss`
            }
          },
          children: []
        }
        const newErrorTargetAddress = this.insert(newErrorTargetContent)
        const newElem: FosPathElem = [this.primitive.errorNode.getId(), newErrorTargetAddress]
        return newElem
      // throw new Error(`inserting array that has malformed edges`)
      }
    })
    const updatedValue: FosNodeContent = {
      ...value,
      children: updatedChildren
    }


    const hasDiff = diff({ left: value, right: updatedValue })
    if (hasDiff){
      console.log('diff found', hasDiff)
      this.mutateAlias(alias as string, updatedValue, this.hash(updatedValue))
      // throw new Error(`diff found between original and updated content`)
    }

    return new FosNode(updatedValue, this, alias)
  }

  insert (nodeContent: FosNodeContent, alias?: string): string {
    // console.log('insert regular starting', nodeContent)
    nodeContent.children.map((edge, index) => {      
      // console.log('edge', edge)
      assert(!!this.checkAddress(edge[0]), `node ${edge[0]} not found at index ${index}`)
      assert(!!this.checkAddress(edge[1]) , `node ${edge[1]} not found at index ${index}`)
      return [this.checkAddress(edge[0]), this.checkAddress(edge[1])]
    })

    let newCid = this.hash(nodeContent)
    this.table.set(newCid, nodeContent)
    if (alias){
      // console.log('alias found', this.aliasMap, alias, newCid, this.table.get(this.aliasMap.get(alias) as string))
      if (this.aliasMap.has(alias)){
        nodeContent = this.mutateAlias(alias, nodeContent, newCid)
        newCid = this.hash(nodeContent)      
      }
      this.aliasMap.set(alias, newCid)
    }

    this.table.set(newCid, nodeContent)

    // console.log('insert regular', newCid, nodeContent, this.table, this.aliasMap)
    return newCid
  }

  mutateAlias (alias: string, nodeContent: FosNodeContent, tentativeCid: string): FosNodeContent {

    // console.log('alias found', this.aliasMap, alias, nodeContent, this.aliasMap.get(alias) as string, tentativeCid)
    const prevCid = this.aliasMap.get(alias)
    if (!prevCid){
      this.aliasMap.set(alias, tentativeCid)
      return nodeContent
      // throw new Error(`alias ${alias} not found`)
    }


    const thisStoreInstance = this.table.get(this.aliasMap.get(alias) as string)
    if(!thisStoreInstance){
      throw new Error(`alias ${alias} not found`)
    }


    const storeNodeContent = this.table.get(prevCid)
    if (!storeNodeContent){
      throw new Error(`node ${prevCid} not found`)
    }


    const nodeContentDiff = diff({ left: thisStoreInstance, right: nodeContent })

    if (!nodeContentDiff){
      return nodeContent
    } 
    // determine if prev Cid exists in current node content prevList
    // if it does, then we need to just need to insert the new content and update the alias
    
    const currPrevItem = nodeContent.children.find((item) => item[0] === this.primitive.previousVersion.getId())
    if (!currPrevItem){
      console.trace('currPrevItem not found', nodeContent, tentativeCid, storeNodeContent, prevCid)
      console.log('currPrevItem not found', nodeContent, tentativeCid, storeNodeContent, prevCid)
      //resolve with conflict
      return this.getConflictNodeContent(nodeContent, tentativeCid, storeNodeContent, prevCid, alias)
    }

    const storePrevItem = storeNodeContent.children.find((item) => item[0] === this.primitive.previousVersion.getId())
    if (!storePrevItem){
      //resolve with conflict
      return this.getConflictNodeContent(nodeContent, tentativeCid, storeNodeContent, prevCid, alias)
    }

    const currPrevList = this.getPrevList(currPrevItem[1])
    if (currPrevList.includes(prevCid)){
      this.aliasMap.set(alias,tentativeCid)
      return nodeContent
    }

    
    const storePrevList = this.getPrevList(storePrevItem[1])

    if (storePrevList.includes(tentativeCid)){
      // keep alias same, but pass old content
      return storeNodeContent
    }

  

    const removeSharedSuffix = <T>(arr1: T[], arr2: T[]): [T[], T[], T[]] => {
      let suffixLen = 0;
      while (
        suffixLen < arr1.length && 
        suffixLen < arr2.length && 
        arr1[arr1.length - 1 - suffixLen] === arr2[arr2.length - 1 - suffixLen]
      ) {
        suffixLen++;
      }
      return [
        arr1.slice(0, arr1.length - suffixLen),
        arr2.slice(0, arr2.length - suffixLen),
        arr1.slice(arr1.length - suffixLen)
      ];
    }
    
    const [storePrevListNoSuffix, currPrevListNoSuffix, suffix] = removeSharedSuffix<string>(storePrevList, currPrevList)

  
    const storeStateInfo: {
      nodeContent: FosNodeContent,
      backwardDeltas: Delta[],
      forwardDeltas: Delta[],
    } = storePrevListNoSuffix.reduce((acc: {
      nodeContent: FosNodeContent,
      backwardDeltas: Delta[],
      forwardDeltas: Delta[],
    }, cid: string)=>{
      const thisContent = this.table.get(cid) as FosNodeContent
      const thisContentReverseDiff = thisContent.data.versionControl?.delta
      if (!thisContentReverseDiff){
        throw new Error(`no diffs found for ${cid}`)
      }
      const reversedState = patch({ left: acc.nodeContent, delta: thisContentReverseDiff })
      const forwardDelta = diff({ left: reversedState, right: acc.nodeContent })
      return {
        nodeContent: reversedState,
        backwardDeltas: [...acc.backwardDeltas, thisContentReverseDiff],
        forwardDeltas: [...acc.forwardDeltas, forwardDelta]
      }
    }, { 
      backwardDeltas: [],
      forwardDeltas: [],
      nodeContent: storeNodeContent
    })


    const incomingStateInfo: {
      nodeContent: FosNodeContent,
      backwardDeltas: Delta[],
      forwardDeltas: Delta[],
    } = currPrevListNoSuffix.reduce((acc: {
      nodeContent: FosNodeContent,
      backwardDeltas: Delta[],
      forwardDeltas: Delta[],
    }, cid: string)=>{
      const thisContent = this.table.get(cid) as FosNodeContent
      const thisContentReverseDiff = thisContent.data.versionControl?.delta
      if (!thisContentReverseDiff){
        throw new Error(`no diffs found for ${cid}`)
      }
      const reversedState = patch({ left: acc.nodeContent, delta: thisContentReverseDiff })
      const forwardDelta = diff({ left: reversedState, right: acc.nodeContent })
      return {
        nodeContent: reversedState,
        backwardDeltas: [...acc.backwardDeltas, thisContentReverseDiff],
        forwardDeltas: [...acc.forwardDeltas, forwardDelta]
      }
    }, { 
      backwardDeltas: [],
      forwardDeltas: [],
      nodeContent: nodeContent
    })


    const baseStateDiff = diff({ left: storeStateInfo.nodeContent, right: incomingStateInfo.nodeContent })

    if (baseStateDiff){
      throw new Error(`doing something wrong... rewinding didn't get back to the same state`)
    }


    const finalState1: FosNodeContent = [...storeStateInfo.forwardDeltas, ...incomingStateInfo.forwardDeltas].reduce((acc: FosNodeContent, delta) => {
      return patch<FosNodeContent>({ left: acc, delta })
    }, storeStateInfo.nodeContent)
    const finalState2: FosNodeContent = [...incomingStateInfo.forwardDeltas, ...storeStateInfo.forwardDeltas].reduce((acc: FosNodeContent, delta) => {
      return patch({ left: acc, delta })
    }, incomingStateInfo.nodeContent)
 
    const hasFinalDiff = diff({ left: finalState1, right: finalState2 })

    if (hasFinalDiff){
      return this.getConflictNodeContent(nodeContent, tentativeCid, storeNodeContent, prevCid, alias)
    } else {
      const newNodeContent = this.addPrevNodeToContent(finalState1, prevCid)
      this.hash(newNodeContent)
      return newNodeContent
    }



    
  }



  // getConflictNodeContent (content: FosNodeContent, currId: string, existingContent: FosNodeContent, existingId: string, alias: string ): FosNodeContent {
  //   this.table.set(currId, content)

  //   const newElemForCurrent: FosPathElem = [this.primitive.conflictNode.getId(), currId]
  //   const newElemForExisting: FosPathElem = [this.primitive.conflictNode.getId(), existingId]


  //   const conflictNodeConent: FosNodeContent = {
  //     data: {

  //     },
  //     children: [newElemForCurrent, newElemForExisting],
  //   }

  //   return conflictNodeConent
  // }

  addPrevNodeToContent (content: FosNodeContent, oldNodeCid: string): FosNodeContent {
    const oldNodeContent = this.table.get(oldNodeCid)
    

    /**
     * reversed diff should allow us to apply diff to newest content and move backwards
     */
    const diffToPrev = diff({ left: content, right: oldNodeContent })
    if (!diffToPrev){
      throw new Error(`no diff found between ${oldNodeCid} and ${content}`)
    }

    
    const newElem: FosPathElem = [this.primitive.previousVersion.getId(), oldNodeCid]
    const newContent: FosNodeContent = {
      data: {
        ...content.data,
        versionControl: {
          delta: diffToPrev,
          branches: [],
          tags: [],
        }
      },
      children: [newElem, ...content.children.filter((item) => item[0] !== this.primitive.previousVersion.getId())]
    }
    return newContent
  }


  // addRowToContent (content: FosNodeContent, instruction: string, target: string): FosNodeContent {


  // }

  addErrorNodeToContent (content: FosNodeContent, item: any, instruction: string, target: string, instructionIsError: boolean, targetIsError: boolean, message: string): FosNodeContent {
    const newErrorTargetContent: FosNodeContent = {
      data: {
        error: {
          instructionIsError: instructionIsError,
          instruction: instruction,
          targetIsError: targetIsError,
          target: target,
          message: `malformed edge - \n ${JSON.stringify(item)} \n Please report if this issue persists or caused data loss`
        }
      },
      children: []
    }
    const newErrorTargetAddress = this.insert(newErrorTargetContent)
    const newElem: FosPathElem = [this.primitive.errorNode.getId(), newErrorTargetAddress]
    const newContent = {
      ...content,
      children: [newElem, ...content.children]
    }
    return newContent

  }

  getPrevList (cid: FosNodeId): FosNodeId[] {

    const helper = (cid: FosNodeId): FosNodeId[] => {
      const currentContent = this.table.get(cid)
      if (!currentContent){
        throw new Error(`node ${cid} not found`)
      }
      const prevItem = currentContent.children.find((item) => item[0] === this.primitive.previousVersion.getId())
      if (!prevItem){
        return []
      }else{
        return [...helper(prevItem[1]), prevItem[1]] as FosNodeId[]
      }
    }
    const thisStorePrevList = helper(cid)

    return thisStorePrevList
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
      const nodeFromAddress = this.getNodeByAddress(address)
      if (!nodeFromAddress){
        throw new Error(`node ${address} not found`)
      }

      const aliases = this.getAliases(nodeFromAddress)
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

  getNodeByAddress (address: string): FosNode | null{
    // console.log('getNodeByAddress', address, this.checkAddress(address))
    if (this.cache.has(address)) return this.cache.get(address) as FosNode
    if (this.aliasMap.has(address)){
      console.log('alias found', address, this.aliasMap.get(address))    
      const aliasAddress = this.aliasMap.get(address)
      if (!aliasAddress){
        return null
      }
      if (aliasAddress === address){
        this.aliasMap.delete(address)
        throw new Error(`alias ${aliasAddress} is pointing to itself`)
      }
      const nodeContent = this.table.get(aliasAddress)
      if (!nodeContent){
        throw new Error(`node ${aliasAddress} not found`)
      }
      const node = this.create(nodeContent)
      if (!node){
        throw new Error(`node ${address} not found`)
      }
  
      return node  
    }
    if (!this.checkAddress(address)) {
      // return null
      console.log('address was not found', address, this.aliasMap, this.table, this.aliasMap.get(address))
      throw new Error(`address ${address} not found`)
    }
    // console.log('queryNodeByAddress', address, this.cache.entries())
    // console.log('test1', this.cache.has(address))
    const nodeContent = this.table.get(address) as FosNodeContent
    // console.log('edges', edges)

    const result = this.create(nodeContent)

    if (!result) throw new Error(`Unable to construct node for address ${address}`)
    return result
  }



  
  getContent(node: FosNode): FosNodeContent {
    const maybeContent = this.table.get(node.getId())
    if (!maybeContent){
      throw new Error(`node ${node.getId()} not found`)
    }
    return maybeContent
  }


  insertRoute(route: FosPath): void {
    throw new Error("Method not implemented.")
  }

  deleteRoute(route: FosPath): void {
    throw new Error("Method not implemented.")
  }

  checkRoute(route: FosPath): boolean {

    throw new Error("Method not implemented.")
  }

  pickRoute(route: FosPath): boolean {

    throw new Error("Method not implemented.")
  }



  query(query: FosNode): FosNode[] {
    /**
     * TODO: change this to return nodes that are part of the subgraph starting from the current root (or another root if specified)
     * TODO: change this to watch for cycles
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
        const thisNode = this.getNodeByAddress(entrykey)
        if (!thisNode){
          throw new Error(`node ${entrykey} not found`)
        }
        const matches = this.matchPattern(query, thisNode)
        result.push(thisNode)
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

    // console.log("match check", patternCid, entryCid)

    if(patternCid === this.primitive.voidNode.getId()){
      return []
    }

    if(patternCid === entryCid){
      return [entry]
    }
    if(patternCid === this.primitive.unit.getId()){
      return [entry]
    }
    if(patternCid === this.primitive.voidNode.getId()){
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
            if (patternValue === this.primitive.unit.getId()){
              const entryNode = this.getNodeByAddress(entryTargetsForKey[index] as string)
              if (!entryNode){
                throw new Error(`node ${entryTargetsForKey[index]} not found`)
              }
              patternResult.push(entryNode)
            } else if (entryTargetsForKey[index] !== patternValue){
              // TODO: figure out what do here
              const patternNode = this.getNodeByAddress(patternValue)
              if (!patternNode){
                throw new Error(`node ${patternValue} not found`)
              }
              const thisNode = this.getNodeByAddress(entryTargetsForKey[index] as string)
              if (!thisNode){
                throw new Error(`node ${entryTargetsForKey[index]} not found`)
              }

              const subQueryResults = this.matchPattern(patternNode, thisNode)
              patternResult.push(...subQueryResults)
            }
          })
        }
      }
    }
    // console.log('matchPattern', pattern, entry, patternResult)
    // console.trace()
    return patternResult
  }

  queryTriple(subject: FosNode, predicate: FosNode, object: FosNode): [FosNode, FosNode, FosNode][] {
    const subjectMatches = this.query(subject)
    const result: FosNode[] = []
    const tripleResults = subjectMatches.flatMap((subjectMatch) => {
      const edgeMatches = subjectMatch.getEdges().filter(([predicateKey, objectKey]) => {
        try {
          const thisNode = this.getNodeByAddress(predicateKey)
          if (!thisNode){
            throw new Error(`node ${predicateKey} not found`)
          }
          this.matchPattern(predicate, thisNode)
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
          const thisNode = this.getNodeByAddress(objectKey)
          if (!thisNode){
            throw new Error(`node ${objectKey} not found`)
          }
          this.matchPattern(object, thisNode)
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

    if (subjectCid === this.primitive.voidNode.getId()) {
      const nodesToTest = this.query(object)
      const result = nodesToTest.filter((nodeToTest) => {
        const thisUnitNode = this.getNodeByAddress(this.primitive.unit.getId() as string)
        if (!thisUnitNode){
          throw new Error(`node ${this.primitive.unit.getId()} not found`)
        }
        const test = this.queryTriple(thisUnitNode, predicate, nodeToTest)
        return test.length === 0
      })
      return result.map((node) => [subject, predicate, node] as [FosNode, FosNode, FosNode])
    } else if (predicateCid === this.primitive.voidNode.getId()) {
      throw new Error('not implemented')
    } else if (objectCid === this.primitive.voidNode.getId()) {
      throw new Error('not implemented')
    } else {
      throw new Error('not a negative query')
    }
  }


  updateWithContext(context: AppState["data"]) {

    const otherStore = new FosStore({ fosCtxData: context})
    this.updateFromStore(otherStore)
    const newContext = this.exportContext(otherStore.fosRoute)
    // if (this.updateCtxCallback){
    //   this.updateCtxCallback(newContext)
    // }
    return newContext
  }

  updateFromStore(otherStore: FosStore) {
    // ** insert other store nodes into this store
    // check aliases.. if one is different, create mutation
    const existingCids = [...this.table.keys()]
    const existingAliases = [...this.aliasMap.keys()]
    const otherCids = [...otherStore.table.keys()]
    const otherAliases = [...otherStore.aliasMap.keys()]


    const allValidKeys = new Set([...existingCids, ...existingAliases, ...otherCids, ...otherAliases])
    // check all children first
    otherStore.aliasMap.keys().forEach((key) => {
      const keyCid = otherStore.aliasMap.get(key)
      if (!keyCid){
        throw new Error(`alias ${key} not found for incoming store alias map`)
      }
      const nodeContent = otherStore.table.get(keyCid) as FosNodeContent
      if(!nodeContent){
        console.log('nodeContent not found', key, this.aliasMap.get(key), this.table)
        throw new Error("oh dang this table is all messed up")
      }

      nodeContent.children.forEach((edge, index) => {
        if (!allValidKeys.has(edge[0])){
          throw new Error(`edge ${edge} has non-existent instruction node`)
        }
        if(!allValidKeys.has(edge[1])){
          throw new Error(`edge ${edge} has non-existent target nodes`)
        }
      })
    })

    otherStore.table.keys().forEach((key) => {
      const nodeContent = otherStore.table.get(key) as FosNodeContent
      const cid = this.hash(nodeContent)
      nodeContent.children.forEach((edge, index) => {
        if (!allValidKeys.has(edge[0])){
          throw new Error(`edge ${edge} has non-existent instruction node`)
        }
        if(!allValidKeys.has(edge[1])){
          throw new Error(`edge ${edge} has non-existent target nodes`)
        }
      })

    })

    this.table = new Map([...otherStore.table, ...this.table])
    


    otherStore.aliasMap.forEach((otherAddress, otherAlias) => {
      const thisAliasAddress = this.aliasMap.get(otherAlias)

      if (!otherAddress){
        throw new Error(`address ${otherAddress} not found`)
      }

      if (thisAliasAddress){

        if (thisAliasAddress === otherAddress){
          return 
        }

        const thisNode = this.table.get(thisAliasAddress)
        
        const otherNodeContent = otherStore.table.get(otherAddress)
        if (!otherNodeContent){
          throw new Error(`node ${otherAddress} not found`)
        }

        const thisNodeHash = hashContent(thisNode as FosNodeContent)
        const otherNodeHash = hashContent(otherNodeContent)

        if (otherNodeHash !== otherAddress){
          throw new Error(`store is not compatible`)
        }
        // console.log('otherAlias', otherNodeContent, )
        if (thisNodeHash !== otherNodeHash){
          this.mutateAlias(otherAlias, otherNodeContent, otherAddress)
        }


      }


      const otherStoreContent = otherStore.table.get(otherAddress)

      if (!otherStoreContent){
        // console.log('otherStoreContent not found', otherAddress, otherAlias)
        // console.log('thisstore alias info', this.aliasMap.get(otherAlias), this.table.get(this.aliasMap.get(otherAlias) as string), this.aliasMap, this.table, otherStore.aliasMap, otherStore.table)
        throw new Error(`node ${otherAddress} not found`)
      }


      // valid alias that doesn't exist in ours
      this.aliasMap.set(otherAlias, otherAddress)

    })

    otherStore.table.entries().filter(([x, _]) => this.table.has(x)).forEach(([otherAddress, otherContent],i) => {
      if (this.insert(otherContent) !== otherAddress){
        throw new Error(`stores mismatched`)
      }
    })

    this.trellisData = otherStore.trellisData


  }
    

  
  
  
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
    data: JSON.stringify(content.data),
    children: sortEdges(content.children)
  }
  return sha3_256(JSON.stringify(normalized))
}

const aggMapContent = (content: FosNodeContent): Map<string, string[]> => {
  return aggMap(content.children)
}
