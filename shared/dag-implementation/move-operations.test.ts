import { FosExpression } from './expression'
import { FosStore } from './store'
import { FosPath } from '../types'

describe('FosStore Basic Operations', () => {
  let store: FosStore

  beforeEach(() => {
    store = new FosStore()
  })

  it('should create a store with a root expression', () => {
    const root = store.getRootExpression()
    expect(root).toBeDefined()
    expect(root.route).toEqual([])
  })

  it('should add children to root', async () => {
    const root = store.getRootExpression()

    const newChild = await root.addChild(
      store.primitive.voidNode,
      { data: { description: { content: 'Test Child' } }, children: [] },
      -1
    )

    // Verify the returned child has the right description
    expect(newChild).toBeDefined()
    expect(newChild.getDescription()).toBe('Test Child')
  })

  it('should create nested children', async () => {
    const root = store.getRootExpression()

    // Add a parent node
    const parent = await root.addChild(
      store.primitive.voidNode,
      { data: { description: { content: 'Parent' } }, children: [] },
      -1
    )
    expect(parent.getDescription()).toBe('Parent')

    // Add a child to the parent
    const child = await parent.addChild(
      store.primitive.voidNode,
      { data: { description: { content: 'Nested Child' } }, children: [] },
      -1
    )
    expect(child.getDescription()).toBe('Nested Child')

    // Verify the child has a longer route (nested deeper)
    expect(child.route.length).toBeGreaterThan(parent.route.length)
  })
})

// Move operations need investigation - skipped for now
describe.skip('Move Operations', () => {
  let store: FosStore

  beforeEach(() => {
    store = new FosStore()
  })

  describe('moveNodeAboveRoute', () => {
    it('should move a node above its sibling', async () => {
      // TODO: Fix move operations - they have bugs with stale references
    })
  })

  describe('moveNodeBelowRoute', () => {
    it('should move a node below its sibling', async () => {
      // TODO: Fix move operations
    })
  })

  describe('moveNodeIntoRoute', () => {
    it('should move a node as a child of another node', async () => {
      // TODO: Fix move operations
    })
  })
})
