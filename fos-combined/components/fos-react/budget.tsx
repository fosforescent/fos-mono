import { BrainCircuit, Landmark } from "lucide-react"
// import { Bank } from '@radix-ui/react-icons'

import { Button } from "@/components/ui/button"
import CurrencyInput from "react-currency-input-field"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"



import { AppState, FosDataContent, FosNodesData, FosReactOptions, FosRoute, SelectionPath } from "@/fos-combined/types"
import { getNodeOperations } from "@/fos-combined/lib/nodeOperations"
import { getNodeInfo } from "@/fos-combined/lib/utils"




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


  const {  locked, 
    hasFocus, focusChar, isDragging, draggingOver, 
    nodeDescription, isRoot, childRoutes, isBase, nodeLabel, 
    nodeType, nodeId, disabled, depth, isCollapsed, 
    isTooDeep, isOption, hasChildren, nodeData
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
    setNodeData,
   } = getNodeOperations(options, data, setData, nodeRoute)

   const costInfo = getBudgetInfo(nodeData)


  return (<div className="flex flex-row flex-wrap items-center justify-center">
  <div className='flex flex-row w-1/2 min-w-96 items-center justify-center flex-wrap'>
    <CostInput value={costInfo.marginal} onChange={(value) => handleBudgetEdit(value)} handleSuggestCost={handleSuggestCost} />
  </div>

  </div>)
}


export const getCostInfo = (appData: AppState, nodeRoute: FosRoute): CostInfo => {
  throw new Error('Not implemented')
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
    If you are seeing this, there is an error. 
    {/* <BudgetSlider value={costInfo.budget?.available} budgetInfo={costInfo.budget} step={1} bgValue={75} onChange={() => console.log("slider")}/> */}
  </div>)
}




const module = {
  icon: <Landmark />,
  name: 'budget',
  HeadComponent: ResourceComponent,
  // RowComponent: CostRowComponent,
}

export default module