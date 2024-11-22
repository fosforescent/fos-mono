import { AppState, FosReactOptions, FosPath } from "./types"
import { getExpressionInfo } from "./dag-implementation/expression"


export const suggestStepsRecursive = async <T, S>(
    options: FosReactOptions,
    nodeRoute: FosPath,
    appState: AppState["data"],
    {
      pattern, 
      parsePattern,
      systemPromptBase,
      getUserPromptBase,
      systemPromptRecursive,
      getUserPromptRecursive,
      getResourceInfo,
      updateResourceInfo,
      checkResourceInfo
    } : {
      pattern: RegExp,
      parsePattern: (appData: AppState["data"], nodeRoute: FosPath, response: string) => S,
      systemPromptBase: string,
      getUserPromptBase: (appData: AppState["data"], nodeRoute: FosPath, nodeDescription: string, parentDescriptions: string[]) => string,
      systemPromptRecursive: string,
      getUserPromptRecursive: (appData: AppState["data"], nodeRoute: FosPath, nodeDescription: string, parentDescriptions: string[]) => string,
      getResourceInfo: (appData: AppState["data"], nodeRoute: FosPath) => T,
      updateResourceInfo: (appData: AppState["data"], nodeRoute: FosPath,  resourceInfo: S) => AppState["data"],
      checkResourceInfo: (appData: AppState["data"], nodeRoute: FosPath) => boolean
    }
  ): Promise<AppState["data"]> => {

    if (!options.canPromptGPT || !options.promptGPT) {
      throw new Error('GPT not available')
    }
  
    const pastRoutes: FosPath[] = nodeRoute.slice(2, -1).map((_, i) => nodeRoute.slice(0, i + 1)) as FosPath[]
  
    const { getParentInfo, childRoutes } = getExpressionInfo(nodeRoute, appState)
  
    const siblingDescriptions = childRoutes.map((childRoute) => {
      const { nodeDescription } = getExpressionInfo(childRoute, appState)
      return nodeDescription
    })
    
  
    const descriptions = pastRoutes.map((nodeRoute, index: number) => {
      const { nodeDescription } = getExpressionInfo(nodeRoute, appState)
      return nodeDescription
    })
  
    const [mainTask, ...contextTasks] = descriptions.slice().reverse()


  const getChildTimes = async (localAppData: AppState["data"], localNodeRoute:FosPath,  index: number, parentDescriptions: string[]): Promise<AppState["data"]> => {

    
    const { childRoutes, nodeDescription } = getExpressionInfo(localNodeRoute, localAppData)
    

    if (!options.canPromptGPT || !options.promptGPT) {
      throw new Error('GPT not available')
    }

    if (childRoutes.length === 0) {

      

      const resourceInfo = checkResourceInfo(localAppData, localNodeRoute)
      console.log('resourceInfo', resourceInfo)

      if (!resourceInfo){


        const systemPrompt = systemPromptBase
        const userPrompt = getUserPromptBase(localAppData, localNodeRoute, nodeDescription, parentDescriptions, )

        console.log('systemPrompt', systemPrompt, userPrompt)
        if (!systemPrompt || !userPrompt) throw new Error('missing prompt');

        const response: any = await options.promptGPT(systemPrompt, userPrompt).catch((error: Error) => {
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

        const newAppState = updateResourceInfo(localAppData, localNodeRoute,  parsePattern(localAppData, nodeRoute, resultParsed))

        return newAppState
      } else {
        return appState
      }

    } else {

  
      let updatedState = localAppData

      for (const childRoute of childRoutes) {

        const childInfo = getExpressionInfo(childRoute, updatedState)
        const itemNodeData = childInfo.nodeData
        
        // const children = child.getChildren()

        let j = 0;
        for (const childRoute of childRoutes) {
          const { nodeDescription: childDescription } = getExpressionInfo(childRoute, updatedState)

          updatedState = await getChildTimes(updatedState, localNodeRoute, j++, [...parentDescriptions, childDescription])
        }
      }


        const resourceInfo = checkResourceInfo(updatedState, localNodeRoute, )

        console.log('resourceInfo', resourceInfo)

        if (!resourceInfo){
          const { nodeDescription: description }  = getExpressionInfo(localNodeRoute, updatedState)

          const systemPrompt = systemPromptRecursive
          const userPrompt = getUserPromptRecursive(updatedState, localNodeRoute, description, parentDescriptions)
  
          console.log('systemPrompt', systemPrompt, userPrompt)
          if (!systemPrompt || !userPrompt) throw new Error('missing prompt');
                
          const response: any = await options.promptGPT(systemPrompt, userPrompt).catch((error: Error) => {
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
        
        const newState = updateResourceInfo(updatedState, nodeRoute, parsePattern(localAppData, nodeRoute, resultParsed))
        
        return newState
      } else {
        return updatedState
      }
      
    }
  }
  

  const contextWithTimes = await getChildTimes(appState, nodeRoute, 0, descriptions)


  return contextWithTimes

}

