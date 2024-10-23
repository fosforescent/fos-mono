import { FosPath, IFosNode, FosTrail, FosRoute,  FosNodeContent} from "@/fos-js"


export const suggestRecursive = async <T, S>(
    promptGPT: (systemPrompt: string, userPrompt: string, options?: { temperature?: number | undefined; }) => Promise<{
      choices: {message: {
        role: string, content: string
      }, finishReason: string}[]
    }>,
    node: IFosNode,
    {
      pattern, 
      parsePattern,
      systemPromptBase,
      getUserPromptBase,
      systemPromptRecursive,
      getUserPromptRecursive,
      getResourceInfo,
      setResourceInfo,
      checkResourceInfo
    } : {
      pattern: RegExp,
      parsePattern: (response: string, node: IFosNode) => S,
      systemPromptBase: string,
      getUserPromptBase: (nodeDescription: string, parentDescriptions: string[], node: IFosNode) => string,
      systemPromptRecursive: string,
      getUserPromptRecursive: (nodeDescription: string, parentDescriptions: string[], node: IFosNode) => string,
      getResourceInfo: (node: IFosNode) => T,
      setResourceInfo: (node: IFosNode, resourceInfo: S) => void,
      checkResourceInfo: (node: IFosNode) => boolean
    }
  ) => {
  const trail = node.getRoute()
  const [root, ...trailWithoutRoot] = trail

  console.log('starting to suggest', node.getRoute())

  const nodeType = node.getNodeType()

  if (nodeType !== 'task'){
    throw new Error('node must be a task')
  }

  
  const past = node.getAncestors().slice(1).reverse().map(([node, number], index) => {
    return node
  }).concat([node])

  const descriptions: string[] = past.map((node, index: number) => {
    const data = node.getData();
    const result: string = data.description?.content || ""
    return result
  })


  const getChildTimes = async (node: IFosNode, index: number, parentDescriptions: string[]): Promise<void> => {
    const nodeData = node.getData()


    const children = node.getChildren()

    console.log('getChildTimes', node.getRoute(), node.getData(), node)

    if (children.length === 0) {

      

      const resourceInfo = checkResourceInfo(node)
      console.log('resourceInfo', resourceInfo)

      if (!resourceInfo){


        const systemPrompt = systemPromptBase
        const userPrompt = getUserPromptBase(nodeData.description?.content || "", parentDescriptions, node)

        console.log('systemPrompt', systemPrompt, userPrompt)
        if (!systemPrompt || !userPrompt) throw new Error('missing prompt');

        const response: any = await promptGPT(systemPrompt, userPrompt).catch((error: Error) => {
          console.log('error', error)
          throw new Error('error getting suggestions')
        });

        const results = response.choices.map( (choice: {message: {content: string }}) => {
          
          const messageMatch = choice.message.content.match(pattern)
          if (!messageMatch || !messageMatch[1]) {
            throw new Error(`Could not parse response: ${choice.message.content}`)
          }
          return JSON.parse(messageMatch[1])
        }) 


        const resultParsed = results[0]

        setResourceInfo(node, parsePattern(resultParsed, node))

        return
      } else {
        return
      }

    } else {

  
        for (const child of children) {

          const itemNodeData = child.getData()
          
          const children = child.getChildren()

          let j = 0;
          for (const option of children) {
            const childDescription = option.getData().description?.content || ""

            await getChildTimes(node, j++, [...parentDescriptions, childDescription])
          }
        }


        const resourceInfo = checkResourceInfo(node)

        console.log('resourceInfo', resourceInfo)

        if (!resourceInfo){
          const description = node.getData().description?.content || ""

          const systemPrompt = systemPromptRecursive
          const userPrompt = getUserPromptRecursive(description, parentDescriptions, node)
  
          console.log('systemPrompt', systemPrompt, userPrompt)
          if (!systemPrompt || !userPrompt) throw new Error('missing prompt');
                
          const response: any = await promptGPT(systemPrompt, userPrompt).catch((error: Error) => {
            console.log('error', error)
            throw new Error('error getting suggestions')
          });

          const results = response.choices.map( (choice: {message: {content: string }}) => {
          
          const messageMatch = choice.message.content.match(pattern)
          if (!messageMatch || !messageMatch[1]) {
            throw new Error(`Could not parse response: ${choice.message.content}`)
          }
          return JSON.parse(messageMatch[1])
        }) 


        const resultParsed = results[0]
        
        setResourceInfo(node, parsePattern(resultParsed,node))
  
      } 
      
    }
  }

  const selectedOption = node.getData().option?.selectedIndex || 0

  const contextWithTimes = await getChildTimes(node, 0, descriptions)


  return

}

