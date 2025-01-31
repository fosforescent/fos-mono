import { INode } from '../dag-types'
import { IFosInterpreter } from "../dag-types"
import { Duration, DurationUnit, Cost, CostAllocation } from '../dag-implementation/node-data'
import { assert } from '../utils'

const exampleWorkflows = [
      // makeDinnerWorkflow(),
      // makeDinnerWithDrinkWorkflow(),
      // buildHouseWorkflow(),
      makeLasagnaWorkflow,
      // makeMedievalBanquetWorkflow(),
      // doFos(),
      // costLasagna(),
    ]
    

export function addExamples(interpreter: IFosInterpreter) {
  const newInterpreter = exampleWorkflows.reduce((acc: IFosInterpreter, wf: (x: IFosInterpreter) => IFosInterpreter ) =>{
    const result = wf(acc)
    console.log('result', result.getDisplayString(), result.getChildren().map( (x) => x.getDisplayString()))
    const root = result
    console.log('root', root.getChildren().map( (x) => x.getDisplayString()), root, root.getChildren().map(x => x))
    return root
  }, interpreter)
  return newInterpreter.getStack()
}



function makeLasagnaWorkflow(root: IFosInterpreter): IFosInterpreter {

  console.log('root', root.getName())

  const result = root.createTask('assemble-laysers', [])
  const [assembleLayers, rootWithAssembleLayers] = result
  console.log('here2',  result.map(x => x.getStubString()))
  console.log('assembleLayers', assembleLayers.getName())
  console.log('here1')
  assert(assembleLayers.getName() === 'assemble-laysers', 'assembleLayers.getName() === assemble-laysers')


  const result1 = assembleLayers.createTask('make-white-sauce')
  console.log('here3', result1.map(x => x.getDisplayString()))
  assert(result[1].getTasks().length === 1, 'tasks result is not empty')
  assert(result1[0].getName() === 'make-white-sauce', 'make White sauce created correctly')
  assert(result1[2]?.getTasks()[0]?.getTasks().length === 1, 'result1[2].getTasks()[0].getTasks().length === 1')
  const [redSauce, assembleLayersWithRedSauce, rootWithRedSauce] = result1[1].createTask('make-red-sauce')
  assert(assembleLayersWithRedSauce.getTasks().length === 2, 'assemble layers has had 2 tasks added')
  assert(redSauce.getName() === 'make-red-sauce', 'make Red sauce created correctly')
  assert(assembleLayersWithRedSauce.getName() === 'assemble-laysers', 'make Red sauce created correctly')
  assert(rootWithRedSauce?.getTasks()[0]?.getTasks().length === 2, 'rootWithRedSauce.getTasks()[0].getTasks().length === 2')
  const [pasta, assembleLayersWithPasta, rootWithPasta] = assembleLayersWithRedSauce.createTask('precook-pasta')
  assert(assembleLayersWithPasta.getTasks().length === 3, 'assemble layers has had 3 tasks added')

  assert(rootWithPasta?.getName() === 'root', 'rootWithPasta.getName() === root')
  const children0 = rootWithPasta?.getChildren().map( (x) => {
    console.log('root child', x.getDisplayString(), x.getChildren().map(y => y))
    return x
  })
  const children1 = assembleLayersWithPasta.getChildren().map( (x) => {
    console.log('assembleLayers child', x.getDisplayString())
    return x
  })

  assert(children0?.length === 2, 'children.length === 2')
  assert(children1.length === 4, 'children.length === 4')

  assert(rootWithPasta?.getTasks().length === 1, 'rootWithPasta.getTasks().length === 1')
  assert(rootWithPasta?.getTasks()[0]?.getTasks().length === 3, 'rootWithPasta.getTasks()[0].getTasks().length === 3')

  return rootWithPasta as IFosInterpreter
}



// function costLasagna(): INode {
//   const five : Cost = new Cost(5)
//   const two : Cost = new Cost(2)
//   const zero : Cost = new Cost(0)

//   const ten = new CostAllocation(10)

 
//   const makeWhiteSauceExpensive = new Task('make-white-sauce-expensive', [], { cost: five })
//   const makeWhiteSauceCheap = new Task('make-white-sauce-cheap', [], { cost: two })

//   const makeWhiteSauce = new OneOfNode('make-white-sauce', [makeWhiteSauceCheap, makeWhiteSauceExpensive], { cost: five })
//   const makeRedSauce = new Task('make-red-sauce', [], { cost: two })
//   const precookPasta = new Task('precookPasta', [], { cost: five })
//   const assembleLayers = new Task(
//     'cost-lasagna',
//     [makeWhiteSauce, makeRedSauce, precookPasta],
//     { cost: zero, costAllocation: ten },
//   )

//   return assembleLayers
// }




// GPT
// Here is a workflow definition for a recipe:
// <function makeLasagnaWorkflow()>
// Please create a workflow definition for an entire banquet. Output only a code example.
// Can you make it more medieval? There's no need for lasagna.

// function makeMedievalBanquetWorkflow(): INode {
//   const fiveMinutes: Duration = new Duration(5, DurationUnit.Minutes)
//   const fifteenMinutes: Duration = new Duration(15, DurationUnit.Minutes)
//   const halfHour: Duration = new Duration(30, DurationUnit.Minutes)
//   const oneHour: Duration = new Duration(60, DurationUnit.Minutes)
//   const twoHours: Duration = new Duration(120, DurationUnit.Minutes)

//   // Starters
//   const preparePottage = new Task('prepare-pottage', [], {duration: halfHour})
//   const bakeBread = new Task('bake-bread', [], {duration: oneHour})

//   // Main Course
//   const roastBoar = new Task('roast-boar', [], { duration: twoHours })
//   const roastVenison = new Task('roast-venison', [], { duration: twoHours })
//   const prepareVegetableStew = new Task('prepare-vegetable-stew', [], {duration: oneHour})

//   // Desserts
//   const makeFruitTarts = new Task('make-fruit-tarts', [], {duration: halfHour})
//   const prepareCheese = new Task('prepare-cheese', [], { duration: fiveMinutes })

//   // Assemble each course
//   const assembleStarters = new Task('assemble-starters', [preparePottage, bakeBread], { duration: fiveMinutes })
//   const assembleMainCourse = new Task(
//     'assemble-main-course',
//     [roastBoar, roastVenison, prepareVegetableStew],
//     { duration: fiveMinutes },
//   )
//   const assembleDesserts = new Task(
//     'assemble-desserts',
//     [makeFruitTarts, prepareCheese],
//     { duration: fiveMinutes },
//   )

//   // Assemble entire banquet
//   const assembleBanquet = new Task(
//     'assemble-banquet',
//     [assembleStarters, assembleMainCourse, assembleDesserts],
//     {duration: fifteenMinutes},
//   )

//   return assembleBanquet
// }

// function makeDinnerWorkflow(): INode {
//   const makeDinner = new OneOfNode('make-dinner', [
//     new Task('make-dried-carrot'),
//     new Task('make-grilled-carrot'),
//   ])
//   const cleanUp = new Task('clean-up', [makeDinner])
//   const root = new Task('carrot-dinner', [cleanUp])
//   return root
// }

// function makeDinnerWithDrinkWorkflow(): INode {
//   const makeFood = new OneOfNode('make-food', [
//     new Task('make-dried-carrot'),
//     new Task('make-grilled-carrot'),
//   ])
//   const makeDrink = new OneOfNode('make-drink', [new Task('make-wine'), new Task('make-water')])
//   const makeDinner = new Task('make-dinner', [makeFood, makeDrink])
//   const cleanUp = new Task('clean-up', [makeDinner])
//   const root = new Task('carrot-dinner-with-drink', [cleanUp])
//   return root
// }

// function doFos(): INode {
//   const makeBusiness = new OneOfNode('make-business')
//   const doSideProject = new Task('do-open-source-side-project')
//   const makeExecutionPlan = new OneOfNode('make-execution-plan', [makeBusiness, doSideProject])

//   const linkNode = new Task('link-node')
//   const copyNode = new Task('copy-node')

//   const addsToContext0 = new Task('get-dans-ideas')
//   const addsToContext1 = new Task('meta-added-via-wrapper-node')
//   const addsToContext2 = new Task('meta-required-name-in-context')
//   const chooseMetaDataImplementation = new OneOfNode('choose-meta-data-implementation', [
//     addsToContext0,
//     addsToContext1,
//     addsToContext2,
//   ])

//   const addCost = new Task('add-cost')
//   const addAccounts = new Task('add-cost-accounts', [addCost])

//   const linearizeWorkflow = new Task('linearize-workflow')


//   const newFeatures = new Task('new-features', [linkNode, copyNode, addAccounts, linearizeWorkflow])

//   const addNodeAbove = new Task('add-node-above')
//   const addChild = new Task('add-child')
//   const nodeAddition = new Task('node-addition', [addNodeAbove, addChild])
//   const sliceThisNodeOut = new Task('slice-this-node-out') // Keep children
//   const tuncateBranch = new Task('truncate-branch') // Remove children
//   const nodeRemoval = new Task('node-removal', [sliceThisNodeOut, tuncateBranch])
//   const createNewWorkflow = new Task('create-new-workflow')
//   const betterIndicatorThatNodeHasChildren = new Task('better-indicator-that-node-has-children')
   

//   const dragAndDrop = new Task('drag-and-drop')
//   const allowNodeCompletionInMiddleOfTree = new Task('add-node-completion-in-middle-of-tree')

//   const recreateDesktopView = new Task('recreate-desktop-view')
//   const collapseTreeInDesktopView = new Task('collapseTreeInDesktopView', [recreateDesktopView])

//   const basicFunctionalityForCurrentFeatures = new Task(
//     'basic-functionality-for-current-features',
//     [
//       nodeAddition,
//       nodeRemoval,
//       createNewWorkflow,
//       dragAndDrop,
//       betterIndicatorThatNodeHasChildren,
//       allowNodeCompletionInMiddleOfTree,
//       recreateDesktopView,
//       collapseTreeInDesktopView,
//     ],
//   )
//   const root = new Task('build-app', [
//     makeExecutionPlan,
//     basicFunctionalityForCurrentFeatures,
//     newFeatures,
//   ])
//   return root
// }

// function buildHouseWorkflow(): INode {
//   // GPT4
//   // Here's an example workflow: ...
//   // Now create another one, representing building a house.
//   // could you make it a bit more structured, i.e. with hierarchy?
//   // could you add some oneof nodes
//   const prepareGround = new Task('prepare-ground')

//   const buildConcreteFoundation = new Task('build-concrete-foundation')
//   const buildStoneFoundation = new Task('build-stone-foundation')
//   const buildFoundation = new OneOfNode('build-foundation', [
//     buildConcreteFoundation,
//     buildStoneFoundation,
//   ])

//   const buildFrame = new Task('build-frame')
//   const buildStructure = new Task('build-structure', [prepareGround, buildFoundation, buildFrame])

//   const buildWoodenRoof = new Task('build-wooden-roof')
//   const buildTileRoof = new Task('build-tile-roof')
//   const buildRoof = new OneOfNode('build-roof', [buildWoodenRoof, buildTileRoof])

//   const buildOuterWalls = new Task('build-outer-walls')
//   const buildInnerWalls = new Task('build-inner-walls')
//   const encloseHouse = new Task('enclose-house', [buildRoof, buildOuterWalls, buildInnerWalls])

//   const installPlumbing = new Task('install-plumbing')
//   const installElectric = new Task('install-electric')
//   const installUtilities = new Task('install-utilities', [installPlumbing, installElectric])

//   const installWoodenFinishings = new Task('install-wooden-finishings')
//   const installStoneFinishings = new Task('install-stone-finishings')
//   const installFinishings = new OneOfNode('install-finishings', [
//     installWoodenFinishings,
//     installStoneFinishings,
//   ])

//   const buildHouse = new Task('construct-house', [
//     buildStructure,
//     encloseHouse,
//     installUtilities,
//     installFinishings,
//   ])

//   const cleanUp = new Task('clean-up', [buildHouse])
//   const root = new Task('build-house', [cleanUp])

//   return root
// }