import { BrainCircuit, Download, FileText } from "lucide-react"
import { FosDataModule, FosModuleProps } from "./fosModules"
import { SelectionPath, IFosNode } from "@/fos-js"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { suggestRecursive } from "../../../lib/suggestRecursive"
import { FosReactOptions } from ".."
import { FosWrapper } from "../fosWrapper"







const ResourceComponent = ({ node, options }: FosModuleProps) => {


  const documentInfo = getDocumentInfo(node.fosNode())

 
  
   const handleDocumentEdit = (value: string) => {
    setDocumentInfo(node.fosNode(), { content: value })
  }

  const handleDownloadDocument = async () => {
        // Create the text content
        const textContent = documentInfo.aggregated || '';

        // Create a Blob from the text content
        const blob = new Blob([textContent], { type: 'text/plain' });

        // Create a URL for the Blob
        const url = URL.createObjectURL(blob);

        // Open the Blob content in a new window
        window.open(url, '_blank');

        // Clean up the URL object after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 100);

  }



  const systemPromptBase = `Take a deep breath.  Please respond only with a single valid JSON object with the key "document" and a string value`
  const getUserPromptBase = (thisDescription: string, parentDescriptions: string[], node: IFosNode) => `Please provide text which is the fulfillment of these instructions: ${thisDescription} in the context of the task ${parentDescriptions.join(' subtask of the task ')}`
  const systemPromptRecursive = `Take a deep breath.  Please respond only with a single valid JSON object with the key "document" and a string value`
  const getUserPromptRecursive = (thisDescription: string, parentDescriptions: string[], node: IFosNode) => {
    const resourceInfo = getDocumentInfo(node)
    return `Please provide text which is the fulfillment of these instructions:${thisDescription} in the context of the task ` 
      + `${parentDescriptions.join(' subtask of the task ')}, but the following pieces are already written as part of child tasks. ` 
      + ` Please insert them with the template format eg {{ 0 }} for child #0.  Do not be redundant with that information: \n` 
      + `${node.getChildren().map((child, index) => `{{${index}}} : ${getDocumentInfo(child).aggregated}` ).join("\n")}`
  }
  const pattern = /.*(\{[^{}]*\}).*/m
  const parsePattern = (result: any, node: IFosNode): DocumentData => {


    const resultParsed = result as { document: string }
    
    return { content: resultParsed.document } 
  } 

  

    
  const handleSuggestDocument = async () => {
    console.log('suggesting document')
    if (options?.canPromptGPT && options?.promptGPT){

      try {
        await suggestRecursive(options.promptGPT, node.fosNode(), {
          systemPromptBase,
          getUserPromptBase,
          systemPromptRecursive,
          getUserPromptRecursive,
          pattern,
          parsePattern,
          getResourceInfo: getDocumentInfo,
          setResourceInfo: setDocumentInfo,
          checkResourceInfo: checkDocumentInfo,
        } )
  
      } catch (error) {
        console.error('error suggesting document', error)
        options?.toast && options.toast({
          title: 'Error',
          description: 'Error suggesting document: ' + error,
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


  return (<div className='w-full text-center overflow-hidden flex flex-row'>
    <div className='p-0'>
      <Button variant={"secondary"} className='bg-emerald-900 inline-block p-2' onClick={handleSuggestDocument} title="Execute prompt" disabled={checkDocumentInfo(node.fosNode())}><BrainCircuit /></Button>
      <Button variant={"secondary"} className='bg-emerald-900 inline-block p-2' onClick={handleDownloadDocument} title="Execute prompt"><Download /></Button>
    
    </div>
    <div className="w-full">
    {/* <MDEditor
      value={documentInfo.content}
      onChange={(value) => value && handleDocumentEdit(value)}
    />
    <MDEditor.Markdown source={documentInfo.content} style={{ whiteSpace: 'pre-wrap' }} /> */}
    <Textarea value={documentInfo?.content} onChange={(e) => handleDocumentEdit(e.target.value)} />
    </div>
  </div>)


}



const DocumentRowComponent = ({ node }: { node: FosWrapper }) => {

  const codeId = 0

  return (<div>
    <Button variant={"secondary"} className='bg-emerald-900 p-1' title="Insert Child Document" onClick={() => {
      // setShowDocument(true)
    }}><FileText size={'1rem'} /></Button>
  </div>)

}
type DocumentInfo = {
  content: string
  aggregated: string
}

type DocumentData = {
  content: string
}


const getDocumentInfo = (node: IFosNode): {
  content: string,
  aggregated?: string
} => {
  const nodeData = node.getData()


  const children = node.getChildren()

  if (!children.length){
    return {
      content: nodeData.document?.content || '',
      aggregated: nodeData.document?.content || ''
    }
  } else {

    const aggregated = children.reduce((acc, child, index) => {
      const childDocumentInfo = getDocumentInfo(child)
      return acc.replace(`{{${index + 1}}}`, childDocumentInfo.aggregated || '')
    }, nodeData.document?.content || '')
  
    return {
      content: nodeData.document?.content || '',
      aggregated
    }
  }

}

const setDocumentInfo = (node: IFosNode, documentInfo: {
  content: string
}) => {
  const nodeData = node.getData()
  return node.setData({
    ...nodeData,
    document: documentInfo
  })
}

const checkDocumentInfo = (node: IFosNode): boolean => {
  const nodeData = node.getData()
  return !!nodeData.document && !!nodeData.document.content
}



const module: FosDataModule = {
  icon: <FileText />,
  name: 'document',
  HeadComponent: ResourceComponent,
  // RowComponent: DocumentRowComponent
}

export default module