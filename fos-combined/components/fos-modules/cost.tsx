import { BrainCircuit, DollarSign } from "lucide-react"

import { Button } from "@/components/ui/button"
import CurrencyInput from "react-currency-input-field"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

import { AppState, FosDataContent, FosReactOptions, FosRoute, SelectionPath } from "@/fos-combined/types"
import { getNodeInfo } from "@/fos-combined/lib/utils"
import { getNodeOperations } from "@/fos-combined/lib/nodeOperations"






const ResourceComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosRoute
  setData: (state: AppState) => void
}) => {




  const { locked, 
    hasFocus, focusChar, isDragging, draggingOver, 
    nodeDescription: thisDescription, isRoot, childRoutes, isBase, nodeLabel, 
    nodeType, nodeId, disabled, depth, isCollapsed, 
    isTooDeep, isOption, hasChildren, 
  } = getNodeInfo(nodeRoute, data)
  
  const { 
    suggestOption, 
    setFocus, 
    setSelectedOption, 
    setFocusAndDescription, 
    deleteRow, 
    deleteOption,
    keyDownEvents,
    keyUpEvents,
    keyPressEvents,
    addOption,
    toggleOptionCollapse,
    suggestSteps,
    toggleCollapse,
    zoom,
    suggestRecursive,
   } = getNodeOperations(options, data, setData, nodeRoute)


 
  

  const systemPromptBase = `Take a deep breath.  Please respond only with a single valid JSON object with the key "cost" and a number value`
  const getUserPromptBase = (appData: AppState, nodeRoute: FosRoute, nodeDescription: string, parentDescriptions: string[]) => `How much does it cost to ${thisDescription} in the as a subtask of ${parentDescriptions.join(' subtask of the task ')}`
  const systemPromptRecursive = `Take a deep breath.  Please respond only with a single valid JSON object with the key "cost" and a number value`
  const getUserPromptRecursive = (appData: AppState, nodeRoute: FosRoute, nodeDescription: string, parentDescriptions: string[]) => {
    const resourceInfo = getCostInfo(data, nodeRoute)
    return `How much does it cost to ${thisDescription} in the as a subtask of ${parentDescriptions.join(' subtask of the task ')}, but factoring out the cost of its subtasks, which are estimated to cost somewhere between $${resourceInfo.min} and $${resourceInfo.max}, averaging $${resourceInfo.average}.  This will leave only the marginal cost, which is the information we want.`
  }
  const pattern = /.*(\{[^{}]*\}).*/m
  const parsePattern = (lAppData: AppState, lNodeRoute: FosRoute, response: string): CostData => {

    const result = JSON.parse(response)

    const resultParsed = result as { cost: string }

    const budgetInfo = getCostInfo(lAppData, lNodeRoute).budget
    
    return { marginal: parseFloat(resultParsed.cost), budget: budgetInfo } 
  } 



    
  const handleSuggestCost = async <CostData, CostInfo>() => {
    if (options?.canPromptGPT && options?.promptGPT){
      try {
        await suggestRecursive({
          systemPromptBase,
          getUserPromptBase,
          systemPromptRecursive,
          getUserPromptRecursive,
          pattern,
          parsePattern,
          getResourceInfo: getCostInfo,
          updateResourceInfo: setCostInfo,
          checkResourceInfo: checkCostInfo
        } )
  
      } catch (error) {
        console.error('error', error)
        options?.toast && options?.toast({
          title: 'Error',
          description: 'No suggestions could be generated: ' + error,
          duration: 5000,
        })
      }

    } else {
      console.error('No authedApi')
      const err =  new Error('No authedApi')
      err.cause = 'unauthorized'
      throw err
    }
  }

  const handleCostEdit = (value: number | undefined) => {
    if (!value) return
    const costInfo = getCostInfo(data, nodeRoute)
    setCostInfo(options, data, setData, nodeRoute, { marginal: value, budget: costInfo.budget })
  }
    


  
  const handleMinCostPath = async () => {
    // const newContext = node.setPath({ [node.getNodeData().selectedOption]: costInfo.minPaths })
  }
  
  const handleMaxCostPath = async () => {
    // const newContext = node.setPath({ [node.getNodeData().selectedOption]:  costInfo.maxPaths})
  }
  
  
  


  return (<div className="flex flex-row flex-wrap items-center justify-center">
  <div className='flex flex-row w-1/2 min-w-96 items-center justify-center flex-wrap'>
    <CostInput value={costInfo.marginal} onChange={(value) => handleCostEdit(value)} handleSuggestCost={handleSuggestCost} />
    <BudgetSlider value={costInfo.budget?.available} budgetInfo={costInfo.budget} step={1} bgValue={75} onChange={() => console.log("slider")}/>
  </div>
  <div className='flex flex-row justify-center items-center w-1/2 min-w-96'>
    <div className='overflow-hidden w-1/2 text-center text-sm'><div className='mx-auto'> Curr: {costDisplay(costInfo.current)} </div><div> Avg: {costDisplay(costInfo.average)} </div></div>
    <div className='overflow-hidden w-1/2 text-center'>
      <Button variant={"secondary"} className='bg-emerald-900 p-1 text-xs mx-auto' onClick={handleMinCostPath} title="Set min cost path"> <div>Min: {costDisplay(costInfo.min)}</div> </Button>
      <Button variant={"secondary"} className='bg-emerald-900 p-1 text-xs mx-auto' onClick={handleMaxCostPath} title="Set max cost path"> <div>Max: {costDisplay(costInfo.max)}</div> </Button>
    </div>
  </div>
  </div>)
}



export const setCostInfo = (appData: AppState, nodeRoute: FosRoute, options: FosReactOptions, setAppData: (appState: AppState) => void, { marginal, budget} : { marginal: number, budget?: { available: number } }) => {
  const { nodeData }  = getNodeInfo(nodeRoute, appData)
  const { setNodeData } = getNodeOperations(options, appData, setAppData, nodeRoute)
  const newCostData: FosDataContent["cost"] = {
    plannedMarginal: marginal,
    budget,
    entries: []
  }
  return setNodeData({
    cost: newCostData
  })
}

export const getCostInfo = (appData: AppState, nodeRoute: FosRoute): CostInfo => {
  throw new Error('Not implemented')
  // const indexToGet = thisNode.parseIndex(index)
  // get selected option

  // for each child
    // get min (+ marginal)
    // get max (+ marginal)
    // get avg (+ marginal)
    // get current (+ marginal)
    // get min paths
    // get max paths
  


    
  // const children = thisNode.getChildren(indexToGet)

  // const thisNodeOptionContent = thisNode.getOptionContent(indexToGet)

  // const thisNodeCost = thisNodeOptionContent.data?.cost?.marginal || 0




  // if (children.length === 0){
  //   return {
  //     min: thisNodeCost,
  //     max: thisNodeCost,
  //     average: thisNodeCost,
  //     current: thisNodeCost,
  //     minPaths: [],
  //     maxPaths: [],
  //     marginal: thisNodeCost
  //   }
  // } else {

  //   let min = 0
  //   let max = 0
  //   let average = 0
  //   let current = 0
  //   const minPaths: CostInfo["minPaths"] = []
  //   const maxPaths: CostInfo["maxPaths"] = []

  //   children.forEach((child, i) => {
  //     const childData = child.getNodeData()
  //     const childOptions = childData.options

  
  //     let minOptionCost = Number.MAX_SAFE_INTEGER;
  //     let maxOptionCost = Number.MIN_SAFE_INTEGER;
  //     const minOptionPaths: SelectionPath = {};
  //     const maxOptionPaths: SelectionPath = {};
  //     let avgOptionCost = 0;
  //     let currentOptionCost = 0;

  //     childOptions.forEach( (option, j) => {
  //       const childOptionCostInfo = getCostInfo(child, j)
  //       if (childOptionCostInfo.min < minOptionCost){
  //         minOptionCost = childOptionCostInfo.min
  //         minOptionPaths[j] = childOptionCostInfo.minPaths
  //       }
  //       if (childOptionCostInfo.max > maxOptionCost){
  //         maxOptionCost = childOptionCostInfo.max
  //         maxOptionPaths[j] = childOptionCostInfo.maxPaths
  //       }
  //       avgOptionCost = ((avgOptionCost * j) + childOptionCostInfo.average) / (j + 1)
  //       if (j === childData.selectedOption){
  //         currentOptionCost = childOptionCostInfo.current
  //       }
  //     })
  //     min += minOptionCost
  //     max += maxOptionCost
  //     average += avgOptionCost 
  //     current += currentOptionCost
  //   });

  //   return {
  //     min: min + thisNodeCost,
  //     max: max + thisNodeCost,
  //     average: average + thisNodeCost,
  //     current: current + thisNodeCost,
  //     minPaths: minPaths,
  //     maxPaths: maxPaths,
  //     marginal: thisNodeCost
  //   }

    
  // }


}

const checkCostInfo = (appData: AppState, nodeRoute: FosRoute): boolean => {
  const { nodeData } = getNodeInfo(nodeRoute, appData)

  return !!nodeData.cost
}


type CostInfo = {
  min: number,
  max: number,
  average: number,
  current: number,
  minPaths: SelectionPath,
  maxPaths: SelectionPath,
  marginal: number,
  budget?: {
    available: number,
  }
}

type CostData = {
  marginal: number,
  budget?: {
    available: number,
  }
}

const costDisplay = ( cost: number) => {

  const costString = cost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return `${costString}`
}


const CostInput = ({ 
  value, 
  onChange, 
  handleSuggestCost 
} : { 
  value: number, 
  onChange: (value: number | undefined) => void , 
  handleSuggestCost: () => Promise<void>
}) => {



  return (<div className='w-auto'>
    <div className='flex flex-row items-center justify-center'>
      <Button variant={"secondary"} className='bg-emerald-900 h-10 p-2 rounded-r-none rounded-l-' onClick={handleSuggestCost} title="Get estimated cost"><BrainCircuit /></Button>
      <CurrencyInput
        id="cost"
        className='h-10 w-20'
        name="cost"
        placeholder="enter cost"
        defaultValue={value}
        decimalsLimit={2}
        prefix='$'
        onValueChange={(val) => onChange(val !== undefined ? parseFloat(val) : val)}
      />
    </div>
  </div>);
}





const BudgetInput = ({ value, onChange }: { value: number | undefined, onChange: (value: number | undefined) => void }) => {



  return (<CurrencyInput
    id="cost"
    name="cost"
    placeholder="enter budget"
    className='w-24 m-w-20'
    defaultValue={value}
    decimalsLimit={2}
    prefix='$'
    onValueChange={(val) => onChange(val !== undefined ? parseFloat(val) : val)}
  />);
}


const BudgetSlider = (props: {
  value: number | undefined
  step: number
  onChange: (value: number | undefined) => void
  bgValue: number
  budgetInfo?: {
    available?: number,
  }, 
  costInfo?: {
    current: number,
    average: number,
    min: number,
    max: number,
  }
}) => {
  
  return (<div className="w-full align-middle py-5 flex-row flex flex-wrap justify-center item-center">
    {props.value !== undefined 
    && (<div className="min-w-20 grow-1 w-2/3"><SliderPrimitive.Root
        className={cn(
          "relative flex w-full touch-none select-none items-center",
        )}
        defaultValue={[props.value]}
        max={props.budgetInfo?.available}
        step={props.step}
        
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gradient-to-r from-emerald-900 to-destructive via-70% via-emerald-900">
          <SliderPrimitive.Range className="absolute h-full bg-black/30" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-transparent ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Root></div>)}
    <div className="grow-1 w-24 overflow-hidden">
      <BudgetInput value={props.value} onChange={props.onChange} />
    </div>
  </div>)
}


const CostRowComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosRoute
  setData: (state: AppState) => void
}) => {


  return (<div className="flex flex-initial grow">
    If you are seeing this, there is an error (cost)
  </div>)
}




const module = {
  icon: <DollarSign />,
  name: 'cost',
  HeadComponent: ResourceComponent,
  // RowComponent: CostRowComponent,
}

export default module