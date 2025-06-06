import { FosExpression } from './expression'
import { FosStore } from './store'
import { FosNode } from './node'

describe('Todo Creation', () => {
  let store: FosStore
  let rootNode: FosNode
  let expression: FosExpression

  beforeEach(async () => {
    // Create a new store for each test
    store = new FosStore()
    
    // Create a root node with basic structure
    rootNode = await FosNode.createNode(store, {
      data: {
        description: { content: "Root node" }
      },
      children: []
    })

    // Create an expression pointing to the root
    expression = await FosExpression.getInstance(store, [], rootNode.getCid())
  })

  it('should create a todo and add it to the node', async () => {
    const todoDescription = "Test todo item"
    
    // Add a todo
    const updatedExpression = await expression.addTodo(todoDescription)
    
    // Verify the todo was created
    expect(updatedExpression).toBeDefined()
    
    // Check that the target node now has children (the todo)
    const targetNode = updatedExpression.targetNode
    const children = targetNode.getChildren()
    
    expect(children.length).toBeGreaterThan(0)
    
    // Find the todo child
    const todoChild = children.find(([fieldName]) => fieldName === 'todo')
    expect(todoChild).toBeDefined()
    
    if (todoChild) {
      const [, todoNodeCid] = todoChild
      const todoNode = await store.retrieveNode(todoNodeCid)
      
      // Verify the todo has the correct description
      const todoData = todoNode?.getDataField('description')
      expect(todoData?.content).toBe(todoDescription)
      
      // Verify the todo has completion status
      const todoCompletion = todoNode?.getDataField('todo')
      expect(todoCompletion?.completed).toBe(false)
      expect(todoCompletion?.time).toBeDefined()
    }
  })

  it('should filter todos correctly', async () => {
    // Add a couple of todos
    await expression.addTodo("First todo")
    await expression.addTodo("Second todo")
    
    // Add a comment for comparison
    await expression.addComment("A comment")
    
    // Get all descendents for todo activity
    const todoRoutes = expression.getAllDescendentsForActivity('todo')
    
    // Should have 2 todo routes
    expect(todoRoutes.length).toBe(2)
    
    // Verify they're actually todos
    for (const route of todoRoutes) {
      const routeExpression = await FosExpression.getInstance(store, route, rootNode.getCid())
      const targetNode = routeExpression.targetNode
      const todoData = targetNode.getDataField('todo')
      expect(todoData).toBeDefined()
      expect(todoData?.completed).toBe(false)
    }
  })

  it('should maintain todo order', async () => {
    const todos = ["First todo", "Second todo", "Third todo"]
    
    // Add todos in order
    for (const todoText of todos) {
      await expression.addTodo(todoText)
    }
    
    // Get todo routes and verify order
    const todoRoutes = expression.getAllDescendentsForActivity('todo')
    expect(todoRoutes.length).toBe(3)
    
    // Check that descriptions match expected order
    const descriptions = []
    for (const route of todoRoutes) {
      const routeExpression = await FosExpression.getInstance(store, route, rootNode.getCid())
      const targetNode = routeExpression.targetNode
      const description = targetNode.getDataField('description')
      if (description) {
        descriptions.push(description.content)
      }
    }
    
    expect(descriptions).toEqual(todos)
  })

  it('should create todos with unique timestamps', async () => {
    // Add todos with a small delay to ensure different timestamps
    const expression1 = await expression.addTodo("First todo")
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1))
    
    const expression2 = await expression1.addTodo("Second todo")
    
    const todoRoutes = expression2.getAllDescendentsForActivity('todo')
    expect(todoRoutes.length).toBe(2)
    
    const timestamps = []
    for (const route of todoRoutes) {
      const routeExpression = await FosExpression.getInstance(store, route, rootNode.getCid())
      const targetNode = routeExpression.targetNode
      const todoData = targetNode.getDataField('todo')
      if (todoData) {
        timestamps.push(todoData.time)
      }
    }
    
    // Timestamps should be different
    expect(timestamps[0]).not.toBe(timestamps[1])
    expect(timestamps[0]).toBeLessThan(timestamps[1])
  })
})