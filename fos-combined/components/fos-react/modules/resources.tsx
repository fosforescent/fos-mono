import { Boxes, BrainCircuit, PlusCircle } from 'lucide-react'
import { FosDataModule, FosModuleProps } from './fosModules'
import { suggestRecursive } from '../../../lib/suggestRecursive'
import { SelectionPath, IFosNode } from "@/fos-js"
import { Button } from '/components/ui/button'
import { Input } from '@/components/ui/input'
import { FosReactOptions } from '..'
import { FosWrapper } from '../fosWrapper'




const ResourceComponent = ({
  node,
  options
}: {
  node: FosWrapper,
  options: FosReactOptions
}) => {


  const resourceInfo = getResourceInfo(node.fosNode())




    
  const handleResourceEdit = (index: number, value: ResourceData) => {


    setResourceInfo(node.fosNode(), value)
  }



  const systemPromptBase = `Take a deep breath.  Please respond only with a single valid JSON object with the key "resources" and an array of strings`
  const getUserPromptBase = (thisDescription: string, parentDescriptions: string[], node: IFosNode) => `Please provide a list of required resources in order ` 
      + `to complete this task: ${thisDescription} in the context of the task ${parentDescriptions.join(' subtask of the task ')}.  A resource ` 
      + `is anything that is needed to complete the task, such as a tool, a person, a piece of information, or a physical object.  Please be thorough and specific. ` 
      + `and focus on this particular task because other workers will be providing information about other tasks.`
  const systemPromptRecursive = `Take a deep breath.  Please respond only with a single valid JSON object with the key "document" and an array of strings`
  const getUserPromptRecursive = (thisDescription: string, parentDescriptions: string[], node: IFosNode) => {
    const resourceInfo = getResourceInfo(node)
    return `Please provide a list of required resources in order to complete this task: ${thisDescription} in the context of the task ` 
      + `${parentDescriptions.join(' subtask of the task ')}, but the following resource are already accounted for, so please don't include them.`
      + `A resource is anything that is needed to complete the task, such as a tool, a person, a piece of information, or a physical object.  Please be thorough and specific. ` 
      + `and focus on this particular task because other workers will be providing information about other tasks.`
  }
  const pattern = /.*(\{[^{}]*\}).*/m
  const parsePattern = (result: any, node: IFosNode): ResourceData => {


    const resultParsed = result as { resources: string[] }
    
    return { required: resultParsed.resources, available: [], produced: []} 
  } 

  

    
  const handleSuggestResources = async () => {
    if (options?.canPromptGPT && options?.promptGPT){
      try {
        await suggestRecursive(options?.promptGPT, node.fosNode(), {
        systemPromptBase,
        getUserPromptBase,
        systemPromptRecursive,
        getUserPromptRecursive,
        pattern,
        parsePattern,
        getResourceInfo: getResourceInfo,
        setResourceInfo: setResourceInfo,
        checkResourceInfo: checkResourceInfo,
      } )
    } catch (error){
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




  

  const onChangeInput = (index: number, value: string) => () => {
    const newResourceInfo = {
      ...resourceInfo,
      requiredForThis: resourceInfo.requiredForThis.map((resource, i) => {
        if (i === index){
          return value
        }
        return resource
      })
    }

    const newMarginalInfo = {
      required: newResourceInfo.requiredForThis,
      available: newResourceInfo.available,
      produced: []
    }

    handleResourceEdit(index, newMarginalInfo)
  }

  const onCheckAvailable = (index: number) => () => {

    const resourceAtIndex = resourceInfo.requiredForThis[index]
    if (!resourceAtIndex){
      return
    }

    const newResourceInfo = {
      ...resourceInfo,
      available: [...resourceInfo.available, resourceAtIndex]
    }

    const newMarginalInfo = {
      required: newResourceInfo.requiredForThis.filter((resource, i) => i !== index),
      available: newResourceInfo.available,
      produced: []
    }

    handleResourceEdit(index, newMarginalInfo)
  }

  return (<div className='w-full text-center overflow-hidden flex flex-row'>
  <div>
    <Button variant={"secondary"} className='bg-emerald-900 inline-block w-14' onClick={handleSuggestResources} title="Suggest required resources"><BrainCircuit /></Button>
  </div>
  <div className="flex flex-row flex-wrap justify-center">
    {resourceInfo.requiredForCurrent.map((resource, index) => {
      return <div key={index} className='flex flex-row items-center justify-center flex-wrap w-48'>
        {resourceInfo.requiredForThis.includes(resource) ? (<Input value={resource} onChange={(e) => onChangeInput(index, e.target.value)} className='inline-block' />) : (<div>{resource}</div>)}
      </div>
    
    })}
    <Button variant={"secondary"} className='bg-emerald-900 inline-block w-14' onClick={handleSuggestResources} title="Add required resources"><PlusCircle /></Button>
  </div>

</div>)


}


const getResourceInfo = (node: IFosNode): ResourceInfo => {
  
  const nodeData = node.getData()
  return {
    requiredForThis: ['resource1', 'resource2'],
    available: ['resource1', 'resource3'],
    requiredForCurrent: ['resource1', 'resource2'],
    minRequired: ['resource1'],
    allPossibleRequired: ['resource1', 'resource2', 'resource3']
  }
}


type ResourceInfo = {
  requiredForThis: string[],
  available: string[],
  requiredForCurrent: string[],
  minRequired: string[],
  allPossibleRequired: string[]

}

type ResourceData = {
  required: string[],
  available: string[],
  produced: string[]
}


const setResourceInfo = (node: IFosNode, resourceInfo: ResourceData) => {
  const nodeData = node.getData()

  return node.setData({
    ...nodeData,
    resources: resourceInfo
  })

}

const checkResourceInfo = (node: IFosNode) => {
  const nodeData = node.getData()
  return !!nodeData.resources
}

const ResourceRowComponent = ({ node, options: fosOptions, meta, state, updateState }: FosModuleProps) => {


  return (<div className="flex flex-initial grow">
    If you are seeing this, there is an error. 
  </div>)
}



const module: FosDataModule = {
  icon: <Boxes />,
  name: 'resources',
  HeadComponent: ResourceComponent,
  // RowComponent: ResourceRowComponent,
}

export default module