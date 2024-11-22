import { BrainCircuit, Dices } from "lucide-react"

import { Button } from "@/frontend/components/ui/button"
import { suggestRecursive } from "../../lib/suggestRecursive"
import { AppState, FosReactOptions, FosPath } from "@/shared/types"





const ResourceComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {




  const handleProbabilityEdit = (value: {
    marginSuccess: number,
    marginFailure: number,
  }) => {
    setProbabilityInfo(node.fosNode(), value)
  }
  

  const probabilityInfo = getProbabilityInfo(node.fosNode())




  const handleMinProbabilitySuccessPath = async () => {
    // const newContext = node.setPath(probabilityInfo.minProbabilitySuccessPath)
  }
  
  const handleMaxProbabilitySuccessPath = async () => {
    // const newContext = node.setPath(probabilityInfo.maxProbabilitySuccessPath)
  }
  
  const handleMinProbabilityFailurePath = async () => {
    // const newContext = node.setPath(probabilityInfo.minProbabilityFailurePath)
  }
  
  const handleMaxProbabilityFailurePath = async () => {
    // const newContext = node.setPath(probabilityInfo.maxProbabilityFailurePath)
  }
  
  
    



  const systemPromptBase = `Take a deep breath.  Please respond only with a single valid JSON object with the keys "probabilitySuccess" and "probabilityFailure" and a number value between 1-100 representing the percentage of success and failure respectively`
  const getUserPromptBase = (thisDescription: string, parentDescriptions: string[], node: IFosNode) =>  `How likely is it that the following will lead to success or failure respectively ${thisDescription} in the context of the task ${parentDescriptions.join(' subtask of the task ')} please express as a percentage (0-100)`
  const systemPromptRecursive = `Take a deep breath.  Please respond only with a single valid JSON object with the keys "probabilitySuccess" and "probabilityFailure" and a number value between 1-100 representing the percentage of success and failure respectively`
  const getUserPromptRecursive = (thisDescription: string, parentDescriptions: string[], node: IFosNode) => {
    const resourceInfo = getProbabilityInfo(node)
    return `How likely is it that the following will lead to success or failure respectively ${thisDescription} in the context of the task ${parentDescriptions.join(' subtask of the task ')} please express as a percentage (0-100), but factoring out the probability of its subtasks, which are estimated to be likely somewhere between ${resourceInfo.minSuccess * 100} and ${resourceInfo.maxSuccess * 100}, averaging ${resourceInfo.averageSuccess * 100} to succeed and somewhere between ${resourceInfo.minFailure * 100} and ${resourceInfo.maxFailure * 100}, averaging ${resourceInfo.averageFailure * 100} to fail. This should leave only the marginal probability, which is the information we want.`
  }
  const pattern = /.*(\{[^{}]*\}).*/m
  const parsePattern = (result: any, node: IFosNode): ProbabilityData => {

    const resultParsed = result as { probabilitySuccess: number, probabilityFailure: number }

  
    const probabilitySuccess = resultParsed.probabilitySuccess
    const probabilityFailure = resultParsed.probabilityFailure

    const resultProcessed: ProbabilityData = {
      marginSuccess: probabilitySuccess / 100,
      marginFailure: probabilityFailure / 100,
    }

    return resultProcessed
  } 



  const handleSuggestProbability = async () => {
    if (options?.canPromptGPT && options?.promptGPT){

      try {
        await suggestRecursive(options.promptGPT, node.fosNode(), {
          systemPromptBase,
          getUserPromptBase,
          systemPromptRecursive,
          getUserPromptRecursive,
          pattern,
          parsePattern,
          getResourceInfo: getProbabilityInfo,
          setResourceInfo: setProbabilityInfo,
          checkResourceInfo: checkProbabilityInfo
        } )
  
      } catch (error) {
        console.error('error', error)
        options?.toast && options.toast({
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



  return (<div className='w-full text-center overflow-hidden'>
  <div className='mx-auto items-center justify-center gap-1.5 flex items-center'>
    <Button variant={"secondary"} className='bg-emerald-900 inline-block w-14' onClick={handleSuggestProbability} title="Get estimated probabilities"><BrainCircuit /></Button>
    <ProbablityInput value={probabilityInfo} onUpdate={(value) => handleProbabilityEdit(value)}/>
  </div>
  <div className='flex flex-row justify-stretch items-center mx-auto' style={{ maxWidth: '600px' }}>
    <div className='px-3 overflow-hidden w-1/2'>
      <div title="Probability of success of Currently Selected Path"> Curr: {probabilityDisplay(probabilityInfo.currentSuccess)} </div>
      <div title="Probability of success of Average Path"> Avg: {probabilityDisplay(probabilityInfo.averageSuccess)} </div>
    </div>
    <div className='px-3 overflow-hidden w-1/2'>
      <Button variant={"secondary"} className='bg-emerald-900 p-1' onClick={handleMinProbabilitySuccessPath} title="Set min probability success path"> <div className='w-full'>Min: {probabilityDisplay(probabilityInfo.minSuccess)} </div></Button>
      <Button variant={"secondary"} className='bg-emerald-900 p-1' onClick={handleMaxProbabilitySuccessPath} title="Set max probability success path"> <div className='w-full'>Max: {probabilityDisplay(probabilityInfo.maxSuccess)} </div></Button>
    </div>
  </div>
  <div className='flex flex-row justify-stretch items-center mx-auto' style={{ maxWidth: '600px' }}>
    <div className='px-3 overflow-hidden w-1/2'>
      <div title="Time of Currently Selected Path"> Curr: {probabilityDisplay(probabilityInfo.currentFailure)} </div>
      <div title="Time of Average Path"> Avg: {probabilityDisplay(probabilityInfo.averageFailure)} </div>
    </div>
    <div className='px-3 overflow-hidden w-1/2'>
      <Button variant={"secondary"} className='bg-emerald-900 p-1' onClick={handleMinProbabilityFailurePath} title="Set min probability failure path"> <div className='w-full'>Min: {probabilityDisplay(probabilityInfo.minFailure)} </div></Button>
      <Button variant={"secondary"} className='bg-emerald-900 p-1' onClick={handleMaxProbabilityFailurePath} title="Set max probability failure path"> <div className='w-full'>Max: {probabilityDisplay(probabilityInfo.maxFailure)} </div></Button>
    </div>
  </div>
  </div>)

}

type ProbabilityData = {
  marginSuccess: number,
  marginFailure: number,
}

type ProbabilityInfo = ProbabilitySuccessInfo & ProbabilityFailureInfo

type ProbabilitySuccessInfo = {
  marginSuccess: number,
  minSuccess: number,
  maxSuccess: number,
  currentSuccess: number,
  averageSuccess: number,
  maxProbabilitySuccessPath: SelectionPath,
  minProbabilitySuccessPath: SelectionPath,
}


type ProbabilityFailureInfo = {
  marginFailure: number,
  minFailure: number,
  maxFailure: number,
  currentFailure: number,
  averageFailure: number,
  maxProbabilityFailurePath: SelectionPath,
  minProbabilityFailurePath: SelectionPath,
}





const setProbabilityInfo = (node: IFosNode, value: {
  marginSuccess: number,
  marginFailure: number,
}) => {
  const nodeData = node.getData()

  return node.setData({
    ...nodeData,
    probability: value
  })

}

const getProbabilityInfo = (node: IFosNode): ProbabilityInfo  => {
  const nodeData = node.getData()
  // console.log('nodeData', nodeData)

  const probabilitySuccessInfo = getProbabilitySuccessInfo(node)
  const probabilityFailureInfo = getProbabilityFailureInfo(node)

  const probabilityInfo = {
    ...probabilitySuccessInfo,
    ...probabilityFailureInfo
  }
  return probabilityInfo
}



const probabilityDisplay = ( probability: number) => {
  const probabilityString = probability.toLocaleString('en-US', { style: 'percent', minimumFractionDigits: 2 })
  return `${probabilityString}`
} 


const ProbablityInput = ({
  value,
  onUpdate,
}: {
  value: ProbabilityInfo,
  onUpdate: (value: ProbabilityData) => void
}) => {
  return (<div className='w-auto'>
    <div className='flex flex-row items-center justify-center'>
  
    </div>
  </div>);
}




const getProbabilityFailureInfo = (thisNode: IFosNode, index?: number): ProbabilityFailureInfo => {


  // for each child
    // get min (+ marginal)
    // get max (+ marginal)
    // get avg (+ marginal)
    // get current (+ marginal)
    // get min paths
    // get max paths
  


    
  // const children = thisNode.getChildren()

  // const thisNodeOptionContent = thisNode.getOptionContent(indexToGet)

  const thisNodeFailure = thisNode.getData().probability?.marginFailure || 0




  // if (children.length === 0){
    return {
      minFailure: thisNodeFailure,
      maxFailure: thisNodeFailure,
      averageFailure: thisNodeFailure,
      currentFailure: thisNodeFailure,
      minProbabilityFailurePath: {},
      maxProbabilityFailurePath: {},
      marginFailure: thisNodeFailure
    }
  // } else {

  //   let min = 0
  //   let max = 0
  //   let average = 0
  //   let current = 0
  //   const minPaths: SelectionPath = []
  //   const maxPaths: SelectionPath = []

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
  //       const childOptionCostInfo = getProbabilityInfo(child, j)
  //       if (childOptionCostInfo.minFailure < minOptionCost){
  //         minOptionCost = childOptionCostInfo.minFailure
  //         minOptionPaths[j] = [childOptionCostInfo.minProbabilityFailurePath]
  //       }
  //       if (childOptionCostInfo.maxFailure > maxOptionCost){
  //         maxOptionCost = childOptionCostInfo.maxFailure
  //         maxOptionPaths[j] = [childOptionCostInfo.maxProbabilityFailurePath]
  //       }
  //       avgOptionCost = ((avgOptionCost * j) + childOptionCostInfo.averageFailure) / (j + 1)
  //       if (j === childData.selectedOption){
  //         currentOptionCost = childOptionCostInfo.currentFailure
  //       }
  //     })
  //     min += minOptionCost
  //     max += maxOptionCost
  //     average += avgOptionCost 
  //     current += currentOptionCost
  //   });

  //   return {
  //     minFailure: min + thisNodeFailure,
  //     maxFailure: max + thisNodeFailure,
  //     averageFailure: average + thisNodeFailure,
  //     currentFailure: current + thisNodeFailure,
  //     minProbabilityFailurePath: minPaths,
  //     maxProbabilityFailurePath: maxPaths,
  //     marginFailure: thisNodeFailure
  //   }

    
  // }


}



const getProbabilitySuccessInfo = (thisNode: IFosNode, index?: number): ProbabilitySuccessInfo => {
 // get selected option

  // for each child
    // get min (+ marginal)
    // get max (+ marginal)
    // get avg (+ marginal)
    // get current (+ marginal)
    // get min paths
    // get max paths
  


    
  const children = thisNode.getChildren()

  // const thisNodeOptionContent = thisNode.getOptionContent(indexToGet)

  const thisNodeSuccess = thisNode.getData().probability?.marginSuccess || 0




  // if (children.length === 0){
    return {
      minSuccess: thisNodeSuccess,
      maxSuccess: thisNodeSuccess,
      averageSuccess: thisNodeSuccess,
      currentSuccess: thisNodeSuccess,
      minProbabilitySuccessPath: {},
      maxProbabilitySuccessPath: {},
      marginSuccess: thisNodeSuccess
    }
  // } else {

  //   let min = 0
  //   let max = 0
  //   let average = 0
  //   let current = 0
  //   const minPaths: SelectionPath = []
  //   const maxPaths: SelectionPath = []

    // children.forEach((child, i) => {
    //   const childData = child.getNodeData()
    //   const childOptions = childData.options

  
    //   let minOptionCost = Number.MAX_SAFE_INTEGER;
    //   let maxOptionCost = Number.MIN_SAFE_INTEGER;
    //   const minOptionPaths: SelectionPath = {};
    //   const maxOptionPaths: SelectionPath = {};
    //   let avgOptionCost = 0;
    //   let currentOptionCost = 0;

    //   childOptions.forEach( (option, j) => {
    //     const childOptionCostInfo = getProbabilityInfo(child, j)
    //     if (childOptionCostInfo.minSuccess < minOptionCost){
    //       minOptionCost = childOptionCostInfo.minSuccess
    //       minOptionPaths[j] = [childOptionCostInfo.minProbabilitySuccessPath]
    //     }
    //     if (childOptionCostInfo.maxSuccess > maxOptionCost){
    //       maxOptionCost = childOptionCostInfo.maxSuccess
    //       maxOptionPaths[j] = [childOptionCostInfo.maxProbabilitySuccessPath]
    //     }
    //     avgOptionCost = ((avgOptionCost * j) + childOptionCostInfo.averageSuccess) / (j + 1)
    //     if (j === childData.selectedOption){
    //       currentOptionCost = childOptionCostInfo.currentSuccess
    //     }
    //   })
    //   min += minOptionCost
    //   max += maxOptionCost
    //   average += avgOptionCost 
    //   current += currentOptionCost
    // });

    // return {
    //   minSuccess: min + thisNodeSuccess,
    //   maxSuccess: max + thisNodeSuccess,
    //   averageSuccess: average + thisNodeSuccess,
    //   currentSuccess: current + thisNodeSuccess,
    //   minProbabilitySuccessPath: minPaths,
    //   maxProbabilitySuccessPath: maxPaths,
    //   marginSuccess: thisNodeSuccess
    // }

    
  // }


}


const checkProbabilityInfo = (node: IFosNode): boolean => {
  const nodeData = node.getData()
  return !!nodeData.probability
}

const ProbabilityRowComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosPath
  setData: (state: AppState) => void
}) => {


  return (<div className="flex flex-initial grow">
    If you are seeing this, there is an error. 
  </div>)
}



const module = {
  icon: <Dices />,
  name: 'probability',
  HeadComponent: ResourceComponent,
  // RowComponent: ProbabilityRowComponent,
}

export default module