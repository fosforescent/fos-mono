import { Store } from './store'
import { FosNode } from './node'

describe('node basics', () => {

  test('can create node and get address name', () => {
    const store = new Store()
    const node = new FosNode([], store)
    const storeAddress = store.create([]).getAddress()
    const nodeAddress = node.getAddress()
    expect(storeAddress).toBe(nodeAddress)
  })

  test('can create and add name', () => {
    const store = new Store()
    const node = new FosNode([], store)
    const storeAddress = store.create([]).getAddress()
    const nodeAddress = node.getAddress()
    expect(storeAddress).toBe(nodeAddress)
  })

  test('can create and update name', () => {
    const store = new Store()
    const node = new FosNode([], store)
    const storeAddress = store.create([]).getAddress()
    const nodeAddress = node.getAddress()
    expect(storeAddress).toBe(nodeAddress)
  })




})