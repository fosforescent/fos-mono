import { Store } from './store'
import { NoContextNode, FosNode} from './node'


describe('store basics', () => {
  test('will not insert edges that reference nonexistent nodes', () => {
    const store = new Store()
    expect(() => store.insert([['B', 'C']])).toThrow()
    expect(() => store.insert([])).not.toThrow()
    })

  test('can insert and retrieve null INode', () => {

    const store = new Store()
    const addressFor3 = store.create(3).getAddress()
    // console.log('addressFor3.0', addressFor3)
    const resultFor3 = store.getNodeByAddress(addressFor3) as NoContextNode<number>
    // console.log('addressFor3', addressFor3, resultFor3.getAddress())
    expect(resultFor3.getValue()).toEqual(3)
  })

  test('can insert and retrieve INode with edges', () => {

    const store = new Store()
    const addressForNode = store.insert([])
    const insertedNode = new FosNode([], store)
    const addressForInsertedNode = store.create([]).getAddress()
    expect(addressForNode).toEqual(addressForInsertedNode)

    const insertedNode2 = new FosNode([[addressForInsertedNode, addressForInsertedNode]], store)

    const addressForNode2 = store.insert([[addressForNode, addressForNode]])
    const addressForInsertedNode2 = insertedNode2.getAddress()

    expect(addressForNode2).toEqual(addressForInsertedNode2)

  })

  test('should maintain same address for name edge no matter how it is retrived', () => {
    const store = new Store()
    const insertedAsEdges = store.insert([])
    const insertedAsNode = (new FosNode([], store)).getAddress()
    expect(insertedAsEdges).toEqual(insertedAsNode)

    // console.log('store', store)
    const queriedAddress = store.getNodeByAddress(store.nameAddress).getAddress()
    // console.log('store2', store.nameAddress, queriedAddress)
    expect(store.nameAddress).toEqual(queriedAddress)
  })

  test('query should work', () => {
    const store = new Store()
    const voidNode = store.create([])
    const unitNode = voidNode.addEdge(voidNode.getAddress(), voidNode.getAddress())
    const newNode = unitNode.addEdge(unitNode.getAddress(), unitNode.getAddress())
    const newNode2 = newNode.addEdge(newNode.getAddress(), newNode.getAddress())
    const newNode3 = newNode2.addEdge(newNode2.getAddress(), newNode2.getAddress())

    const queryNode = store.create([[newNode2.getAddress(), unitNode.getAddress()]])

    const result = store.query(queryNode).filter((elem) => elem.getAddress() === newNode3.getAddress())

    expect(result).toBeDefined()
    expect(result.length).toEqual(1)
    expect(result[0]!.getAddress()).toEqual(newNode3.getAddress())
  })


  test('nested query should work', () => {
    const store = new Store()
    const voidNode = store.create([])
    const unitNode = voidNode.addEdge(voidNode.getAddress(), voidNode.getAddress())
    const newNode = unitNode.addEdge(unitNode.getAddress(), unitNode.getAddress())
    const newNode2 = newNode.addEdge(newNode.getAddress(), newNode.getAddress())
    const newNode3 = newNode2.addEdge(newNode2.getAddress(), newNode2.getAddress())


    const nameNode = store.create('myNodeName')
    const newNode4 = newNode3.addEdge(store.nameAddress, nameNode.getAddress()) // this is a new node with the name 'myNodeName'
    const newNode5 = newNode3.addEdge(newNode3.getAddress(), newNode4.getAddress()) // this is a new node with an edge of type 'newNode3' to the node with the name 'myNodeName'

    const nameQueryNode = store.create([[store.nameAddress, nameNode.getAddress()]]) // this requires an edge to the name 'myNodeName'
    const nodeWithNameQueryNode = store.create([[newNode3.getAddress(), nameQueryNode.getAddress()]]) // this requires an edge of type 'newNode3' to an edge with name 'myNodeName'

    const queryNameResult = store.query(nodeWithNameQueryNode) // We are searching for a node with an edge of type 'newNode3' to an edge with name 'myNodeName'
    
    // console.log('result', queryNameResult.map(x => x[0].getEdges()), 'newnewNode', newNode.getAddress(), 'newNode5', newNode5.getAddress(), 'newNode3', newNode3.getAddress(),)
    // console.log('newNode4', newNode4.getAddress(), 'nameNode', nameNode.getAddress(), 'nameQueryNode', nameQueryNode.getAddress(), 'nodeWithNameQueryNode', nodeWithNameQueryNode.getAddress())

    expect(queryNameResult).toBeDefined()
    expect(queryNameResult.length).toEqual(1)
    expect(queryNameResult[0]!.getAddress()).toBe(newNode5.getAddress())
  })



  test('nested query with pattern should work', () => {
    const store = new Store()
    const voidNode = store.create([])
    const unitNode = voidNode.addEdge(voidNode.getAddress(), voidNode.getAddress())
    const newNode = unitNode.addEdge(unitNode.getAddress(), unitNode.getAddress())
    const newNode2 = newNode.addEdge(newNode.getAddress(), newNode.getAddress())
    const newNode3 = newNode2.addEdge(newNode2.getAddress(), newNode2.getAddress())


    const nameNode = store.create('myNodeName')
    const newNode4 = newNode3.addEdge(store.nameAddress, nameNode.getAddress())
    const newNode5 = newNode3.addEdge(newNode3.getAddress(), newNode4.getAddress())

    const nameQueryNode = store.create([[store.nameAddress, nameNode.getAddress()]])
    const nodeWithNameQueryNode = store.create([[newNode3.getAddress(), nameQueryNode.getAddress()]])


    const queryNameResult = store.query(nodeWithNameQueryNode)

    const getNameNode = store.create([[store.nameAddress, store.unitAddress]])
    const patternNode = store.create([[newNode3.getAddress(), getNameNode.getAddress()]])


    const matches = queryNameResult.map((elem) => store.matchPattern(patternNode, elem))


    // console.log('matches', matches[0]!.map(x => x.getEdges()), 'newnewNode', newNode.getAddress(), 'newNode5', newNode5.getAddress(), 'newNode3', newNode3.getAddress(),)
    // console.log('newNode4', newNode4.getAddress(), 'nameNode', nameNode.getAddress(), 'nameQueryNode', nameQueryNode.getAddress(), 'nodeWithNameQueryNode', nodeWithNameQueryNode.getAddress())


    expect(matches[0]).toBeDefined()
    expect(matches.length).toEqual(1)
    expect(matches[0]![0]!.getAddress()).toBe(nameNode.getAddress())
  })

  test('query triple should work ', () => {
    const store = new Store()
    const voidNode = store.create([])
    const unitNode = voidNode.addEdge(voidNode.getAddress(), voidNode.getAddress())
    const newNode = unitNode.addEdge(unitNode.getAddress(), unitNode.getAddress())
    const newNode2 = newNode.addEdge(newNode.getAddress(), newNode.getAddress())
    const newNode3 = newNode2.addEdge(newNode2.getAddress(), newNode2.getAddress())

    const newNode4 = newNode3.addEdge(newNode2.getAddress(), newNode3.getAddress())
    const newNode5 = newNode4.addEdge(newNode2.getAddress(), newNode4.getAddress())
    const newNode6 = newNode3.addEdge(newNode3.getAddress(), newNode3.getAddress())
    const newNode7 = newNode4.addEdge(newNode3.getAddress(), newNode4.getAddress())


    const patternNode = store.create([[newNode2.getAddress(), store.unitAddress]])

    const matches = store.queryTriple(store.getNodeByAddress(store.unitAddress), patternNode, newNode4)

    // console.log('matches', matches[0], 'newnewNode', newNode.getAddress(), 'newNode5', newNode5.getAddress(), 'newNode3', newNode3.getAddress())
    expect(matches[0]).toBeDefined()
    expect(matches.length).toEqual(1)
    expect(matches[0]![0]!.getAddress()).toBe(newNode7.getAddress())
  })

  test('query with void relationship to test negative result shoudl work',() => {
    const store = new Store()
    const voidNode = store.create([])
    const unitNode = voidNode.addEdge(voidNode.getAddress(), voidNode.getAddress())
    const newNode = unitNode.addEdge(unitNode.getAddress(), unitNode.getAddress())
    const newNode2 = newNode.addEdge(newNode.getAddress(), newNode.getAddress())
    const newNode3 = newNode2.addEdge(newNode2.getAddress(), newNode2.getAddress())

    const newNode4 = newNode3.addEdge(newNode2.getAddress(), newNode3.getAddress())
    const newNode5 = newNode4.addEdge(newNode2.getAddress(), newNode4.getAddress())
    const newNode6 = newNode3.addEdge(newNode3.getAddress(), newNode3.getAddress())
    const newNode7 = newNode4.addEdge(newNode3.getAddress(), newNode4.getAddress())


    const patternNode = store.create([[newNode2.getAddress(), newNode2.getAddress()]])

    const matches = store.negativeQueryTriple(store.getNodeByAddress(store.voidAddress), newNode2, patternNode)

    // console.log('matches', matches[0]![2]!.getAddress(), 'newNode2', newNode2.getAddress(), 'newNode4', newNode4.getAddress(), 'newNode6', newNode6.getAddress())
    // console.log('matches', matches[0]![2]!.getAddress(), 'newNode7', newNode7.getAddress(), 'newNode', newNode.getAddress(), 'newNode5', newNode5.getAddress())
    expect(matches[0]).toBeDefined()
    expect(matches.length).toEqual(1)
    expect(matches[0]![2]!.getAddress()).toBe(newNode6.getAddress())
    expect(matches[0]![0]!.getAddress()).toBe(store.voidAddress)
 
    
  })

})