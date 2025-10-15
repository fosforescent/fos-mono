import { FosStore } from './store'
import { FosNode } from './node'
import { FosNodeContent, FosPath, FosPathElem, FosDataContent } from '../types'
import { aggMap } from '../utils'

export interface QueryResult {
  node: FosNode
  data: any
}

export interface SelectClause {
  [key: string]: 'string' | 'number' | 'boolean' | 'node' | 'any'
}

export interface WhereCondition {
  field: string
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'exists'
  value: any
}

export interface QueryOptions {
  select: SelectClause
  from?: FosNode | string
  where?: WhereCondition[]
  limit?: number
  maxDepth?: number
}

export function query(store: FosStore, queryNode: FosNode): FosNode[] {
  const queryCid = queryNode.getId()
  const result: FosNode[] = []
  const tableEntries = [...store.table.entries()]

  tableEntries.forEach(([entrykey, entryvalue]) => {
    if (entrykey === queryCid) return
    store.create(entryvalue)
    try {
      const thisNode = store.getNodeByAddress(entrykey)
      if (!thisNode) {
        throw new Error(`node ${entrykey} not found`)
      }
      const matches = matchPattern(store, queryNode, thisNode)
      result.push(thisNode)
    } catch (e: any) {
      if (!e.cause?.patternFailed) {
        throw e
      }
    }
  })
  return result
}

export function matchPattern(store: FosStore, pattern: FosNode, entry: FosNode): FosNode[] {
  const patternMap = aggMap(pattern.getEdges())
  const nodeMap = aggMap(entry.getEdges())

  const patternCid = pattern.getId()
  const entryCid = entry.getId()

  if (patternCid === store.primitive.voidNode.getId()) {
    return []
  }

  if (patternCid === entryCid) {
    return [entry]
  }
  if (patternCid === store.primitive.unit.getId()) {
    return [entry]
  }
  if (patternCid === store.primitive.voidNode.getId()) {
    throw new Error(`pattern expected void --- pattern ${pattern} does not match entry ${entry}`)
  }

  const patternResult: FosNode[] = []
  for (const [patternKey, patternValues] of patternMap.entries()) {
    if (!nodeMap.has(patternKey)) {
      throw new Error(`pattern ${patternKey} does not exist on node entry. Cannot resolve pattern`)
    } else {
      const entryTargetsForKey = nodeMap.get(patternKey) as string[]
      if (patternValues.length !== entryTargetsForKey.length) {
        throw new Error(`pattern ${patternKey} has ${patternValues.length} entries, but node ${patternKey} has ${nodeMap.get(patternKey)?.length} entries. Cannot resolve pattern`)
      } else {
        patternValues.forEach((patternValue, index) => {
          if (patternValue === store.primitive.unit.getId()) {
            const entryNode = store.getNodeByAddress(entryTargetsForKey[index] as string)
            if (!entryNode) {
              throw new Error(`node ${entryTargetsForKey[index]} not found`)
            }
            patternResult.push(entryNode)
          } else if (entryTargetsForKey[index] !== patternValue) {
            const patternNode = store.getNodeByAddress(patternValue)
            if (!patternNode) {
              throw new Error(`node ${patternValue} not found`)
            }
            const thisNode = store.getNodeByAddress(entryTargetsForKey[index] as string)
            if (!thisNode) {
              throw new Error(`node ${entryTargetsForKey[index]} not found`)
            }

            const subQueryResults = matchPattern(store, patternNode, thisNode)
            patternResult.push(...subQueryResults)
          }
        })
      }
    }
  }
  return patternResult
}

export function queryTriple(store: FosStore, subject: FosNode, predicate: FosNode, object: FosNode): [FosNode, FosNode, FosNode][] {
  const subjectMatches = query(store, subject)
  const tripleResults = subjectMatches.flatMap((subjectMatch) => {
    const edgeMatches = subjectMatch.getEdges().filter(([predicateKey, objectKey]) => {
      try {
        const thisNode = store.getNodeByAddress(predicateKey)
        if (!thisNode) {
          throw new Error(`node ${predicateKey} not found`)
        }
        matchPattern(store, predicate, thisNode)
        return true
      } catch (e: any) {
        if (!e.cause?.patternFailed) {
          throw e
        }
        return false
      }
    })
    const allMatches = edgeMatches.filter(([predicateKey, objectKey]) => {
      try {
        const thisNode = store.getNodeByAddress(objectKey)
        if (!thisNode) {
          throw new Error(`node ${objectKey} not found`)
        }
        matchPattern(store, object, thisNode)
        return true
      } catch (e: any) {
        if (!e.cause?.patternFailed) {
          throw e
        }
        return false
      }
    })
    return allMatches.map(([predicateKey, objectKey]) => [subjectMatch, store.getNodeByAddress(predicateKey), store.getNodeByAddress(objectKey)] as [FosNode, FosNode, FosNode])
  })
  return tripleResults
}

export function negativeQueryTriple(store: FosStore, subject: FosNode, predicate: FosNode, object: FosNode): [FosNode, FosNode, FosNode][] {
  const subjectCid = subject.getId()
  const predicateCid = predicate.getId()
  const objectCid = predicate.getId()

  if (subjectCid === store.primitive.voidNode.getId()) {
    const nodesToTest = query(store, object)
    const result = nodesToTest.filter((nodeToTest) => {
      const thisUnitNode = store.getNodeByAddress(store.primitive.unit.getId() as string)
      if (!thisUnitNode) {
        throw new Error(`node ${store.primitive.unit.getId()} not found`)
      }
      const test = queryTriple(store, thisUnitNode, predicate, nodeToTest)
      return test.length === 0
    })
    return result.map((node) => [subject, predicate, node] as [FosNode, FosNode, FosNode])
  } else if (predicateCid === store.primitive.voidNode.getId()) {
    throw new Error('not implemented')
  } else if (objectCid === store.primitive.voidNode.getId()) {
    throw new Error('not implemented')
  } else {
    throw new Error('not a negative query')
  }
}

export class LazyQuery implements AsyncIterable<QueryResult> {
  private store: FosStore
  private options: QueryOptions

  constructor(store: FosStore, options: QueryOptions) {
    this.store = store
    this.options = options
  }

  async *[Symbol.asyncIterator](): AsyncIterator<QueryResult> {
    const visitedNodes = new Set<string>()
    const state = { resultCount: 0 }

    if (this.options.from) {
      const rootNode = this.getRootNode(this.options.from)
      yield* this.traverseAndYield(rootNode, this.options, visitedNodes, 0, this.options.maxDepth || 10, state)
    } else {
      // Iterate over all nodes in the store when no 'from' is specified
      for (const [address, content] of this.store.table.entries()) {
        if (this.options.limit && state.resultCount >= this.options.limit) {
          return
        }

        if (!visitedNodes.has(address)) {
          const node = this.store.getNodeByAddress(address)
          if (node) {
            yield* this.traverseAndYield(node, this.options, visitedNodes, 0, this.options.maxDepth || 10, state)
          }
        }
      }
    }
  }

  private async *traverseAndYield(
    node: FosNode,
    options: QueryOptions,
    visitedNodes: Set<string>,
    depth: number,
    maxDepth: number,
    state: { resultCount: number }
  ): AsyncGenerator<QueryResult, void, unknown> {
    if (depth > maxDepth || visitedNodes.has(node.getId())) {
      return
    }

    if (options.limit && state.resultCount >= options.limit) {
      return
    }

    visitedNodes.add(node.getId())

    if (this.matchesConditions(node, options.where || [])) {
      const data = this.extractSelectData(node, options.select)
      yield { node, data }
      state.resultCount++

      if (options.limit && state.resultCount >= options.limit) {
        return
      }
    }

    for (const [instruction, target] of node.getEdges()) {
      if (options.limit && state.resultCount >= options.limit) {
        return
      }

      const targetNode = this.store.getNodeByAddress(target)
      if (targetNode) {
        yield* this.traverseAndYield(targetNode, options, visitedNodes, depth + 1, maxDepth, state)
      }
    }
  }

  private getRootNode(from?: FosNode | string): FosNode {
    if (!from) {
      return this.store.getRootNode()
    }

    if (typeof from === 'string') {
      const node = this.store.getNodeByAddress(from)
      if (!node) {
        throw new Error(`Node with address ${from} not found`)
      }
      return node
    }

    return from
  }

  private matchesConditions(node: FosNode, conditions: WhereCondition[]): boolean {
    return conditions.every(condition => this.evaluateCondition(node, condition))
  }

  private evaluateCondition(node: FosNode, condition: WhereCondition): boolean {
    const value = this.getFieldValue(node, condition.field)

    switch (condition.operator) {
      case '=':
        return value === condition.value
      case '!=':
        return value !== condition.value
      case '>':
        return value > condition.value
      case '<':
        return value < condition.value
      case '>=':
        return value >= condition.value
      case '<=':
        return value <= condition.value
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value)
      case 'exists':
        return value !== undefined && value !== null
      default:
        return false
    }
  }

  private getFieldValue(node: FosNode, fieldPath: string): any {
    if (fieldPath === 'id') {
      return node.getId()
    }

    if (fieldPath === 'edges') {
      return node.getEdges()
    }

    if (fieldPath === 'isLeaf') {
      return node.isLeaf()
    }

    const data = node.getData()
    const parts = fieldPath.split('.')
    let current: any = data

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        return undefined
      }
    }

    return current
  }

  private extractSelectData(node: FosNode, selectClause: SelectClause): any {
    const result: any = {}

    for (const [alias, type] of Object.entries(selectClause)) {
      let value: any

      // Handle special cases where the alias might not match the field path exactly
      if (alias === 'description') {
        // Try description.content first, then fall back to description
        value = this.getFieldValue(node, 'description.content') || this.getFieldValue(node, 'description')
      } else if (alias === 'cost') {
        // Try cost.plannedMarginal first, then fall back to cost
        value = this.getFieldValue(node, 'cost.plannedMarginal') || this.getFieldValue(node, 'cost')
      } else if (alias === 'priority') {
        // Try priority.level first, then fall back to priority
        value = this.getFieldValue(node, 'priority.level') || this.getFieldValue(node, 'priority')
      } else {
        value = this.getFieldValue(node, alias)
      }

      if (type === 'node') {
        result[alias] = node
      } else if (value !== undefined) {
        result[alias] = this.castValue(value, type)
      } else {
        result[alias] = null
      }
    }

    return result
  }

  private castValue(value: any, type: string): any {
    switch (type) {
      case 'string':
        return String(value)
      case 'number':
        return Number(value)
      case 'boolean':
        return Boolean(value)
      case 'any':
      default:
        return value
    }
  }

  private currentIterator?: AsyncIterator<QueryResult>

  async next(): Promise<QueryResult | null> {
    if (!this.currentIterator) {
      this.currentIterator = this[Symbol.asyncIterator]()
    }

    const result = await this.currentIterator.next()
    return result.done ? null : result.value
  }

  async toArray(): Promise<QueryResult[]> {
    const results: QueryResult[] = []
    for await (const result of this) {
      results.push(result)
    }
    return results
  }

  async take(count: number): Promise<QueryResult[]> {
    const results: QueryResult[] = []
    let taken = 0

    for await (const result of this) {
      results.push(result)
      taken++
      if (taken >= count) {
        break
      }
    }
    return results
  }

  async first(): Promise<QueryResult | null> {
    for await (const result of this) {
      return result
    }
    return null
  }

  async count(): Promise<number> {
    let count = 0
    for await (const _ of this) {
      count++
    }
    return count
  }
}

export class QueryBuilder {
  private store: FosStore
  private options: Partial<QueryOptions> = {}

  constructor(store: FosStore) {
    this.store = store
  }

  select(fields: SelectClause): QueryBuilder {
    this.options.select = fields
    return this
  }

  from(node: FosNode | string): QueryBuilder {
    this.options.from = node
    return this
  }

  where(field: string, operator: WhereCondition['operator'], value: any): QueryBuilder {
    if (!this.options.where) {
      this.options.where = []
    }
    this.options.where.push({ field, operator, value })
    return this
  }

  limit(count: number): QueryBuilder {
    this.options.limit = count
    return this
  }

  maxDepth(depth: number): QueryBuilder {
    this.options.maxDepth = depth
    return this
  }

  build(): LazyQuery {
    if (!this.options.select) {
      throw new Error('SELECT clause is required')
    }

    return new LazyQuery(this.store, this.options as QueryOptions)
  }
}


export function findNodesByDescription(store: FosStore, searchTerm: string): LazyQuery {
  return new LazyQuery(store, {
    select: { id: 'string', description: 'string', node: 'node' },
    where: [{
      field: 'description.content',
      operator: 'contains',
      value: searchTerm
    }]
  })
}