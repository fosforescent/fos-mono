
import { FosNode } from '../dag-implementation/node'
import { Store } from '../dag-implementation/store'
import { FosInterpreter, RootFosInterpreter } from "./interpreter"
import { IFosInterpreter } from "../dag-types" 

describe('interpreter basics', () => {

  test('spawn, getStack work properly', () => {

    const store = new Store()
    const descriptionStringAddress = store.create('test1').getAddress()

    const testInterpreter = new RootFosInterpreter(store)
    const checkStack1 = testInterpreter.getStack()
    expect(checkStack1.length).toBe(1)

    const newNode = store.create([
      [store.nameAddress, descriptionStringAddress]
    ])

    const [newTask, newTestInt] = testInterpreter.spawn(store.getNodeByAddress(store.allOfAddress), newNode)
    expect(newTask.getStack().length).toBe(2)
    expect(newTestInt.getStack().length).toBe(1)
    expect(newTask.getName()).toBe('test1')

    const description2StringAddress = store.create('test2').getAddress()
    const newNode2 = store.create([
      [store.nameAddress, description2StringAddress]
    ])
    const [newTask2, newTestInt2] = newTestInt.spawn(store.getNodeByAddress(store.allOfAddress), newNode2)
    expect(newTask2.getStack().length).toBe(2)
    expect(newTestInt2.getStack().length).toBe(1)

    const newTaskInterpreter2 = newTestInt2.getChildren().filter(child => child.getInstruction() === store.allOfAddress && child.getTarget() === newNode2.getAddress())[0] as IFosInterpreter

    expect(newTaskInterpreter2).toBeDefined()
    expect(newTaskInterpreter2.getName()).toBe('test2')

  })




  test('returns correctly and updates root when creating task', () => {
    const store = new Store()
    const interpreter = new RootFosInterpreter(store, store.getNodeByAddress(store.voidAddress), store.getNodeByAddress(store.unitAddress)) as IFosInterpreter
    const [name, updatedInterpreter] = interpreter.setName('root')
    const result = updatedInterpreter.createTask('B', [])
    expect(result.length).toBe(2)
    const [task, newInterpreter] = result
    expect(newInterpreter).not.toBe(updatedInterpreter)
    
    const result2 = task.createTask('C', [])
    const root = result2[2] as IFosInterpreter
    expect(root.getName()).toBe('root')
    expect(result2[1].getName()).toBe('B')
    expect(result2[0].getName()).toBe('C')
  })

  // test.skip('can run task', () => {
  //   const fos = Fos()
  //   const rootInterpreter = fos.getRoot()
  //   const [task, newInterpreter] = rootInterpreter.createTask('B', [])
  //   const [workflow, rootWithWorkflow] = newInterpreter.createWorkflow('workflow', task, )
  //   const [todo, rootWithTodo] = rootWithWorkflow.runWorkflow(workflow)
  //   const todos = rootWithTodo.getTodos()
  //   expect(todos.length).toBe(1)
  //   const [completedTodo, rootWithCompletedTodo] = rootWithTodo.setTaskInput(todo)
  //   const completedTodos = rootWithTodo.getCompletedTodos()
  //   expect(completedTodos.length).toBe(1)
  // })

  // test.skip('can run task and get result', () => {
  //   const store = new Store()
  //   const rootInterpreter = store.getInterpreter(store.voidAddress, store.unitAddress, null) as IFosInterpreter
  //   const [task, newInterpreter] = rootInterpreter.createTask('B', [])
  //   const [workflow, rootWithWorkflow] = newInterpreter.createWorkflow('workflow', [task])
  //   const [todo, rootWithTodo] = rootWithWorkflow.runTask(workflow)
  //   const todos = rootWithTodo.getTodos()
  //   expect(todos.length).toBe(1)
  //   const [completedTodo, rootWithCompletedTodo] = rootWithTodo.setTaskInput(todo)
  //   const completedTodos = rootWithTodo.getCompletedTodos()
  //   expect(completedTodos.length).toBe(1)
  // })


})