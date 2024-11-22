import { AppState, FosDataContent, FosReactOptions, FosPath } from "./types";
import { addChild } from "./mutations";
import { getNodeOperations } from "./nodeOperations";
import { getExpressionInfo } from "./dag-implementation/expression";



export const suggestTaskSteps = async (
  options: FosReactOptions,
  nodeRoute: FosPath,
  appState: AppState["data"]
) => {
  

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

  const systemPrompt = `You are part of a group of workers building a tree of subtasks to describe a project, which may be big or small.  As such, you do not provide information that is not directly related to the subtask at hand because it will probably be provided by another worker`

  const promptIntro = `PLEASE OUTPUT SINGLE VALID JSON ARRAY OF STRINGS < 50 CHARS PER ENTRY.  `

  const promptBody = `Please create 3-7 subtasks of the following task: ${mainTask}.  For context, this is a subtask of ${contextTasks.join(' subtask of the task ')}.  Please do not provide subtasks which are likely included in other branches.  If necessary, group information into a single subtask. ${ childRoutes.length > 0 ? `The following subtasks have already been created, so create new ones other than these: '${siblingDescriptions.join(', ')}'.` : ""} `

  const promptConclusion = `Please output only single json array containing only strings.`

  const userPrompt = `${promptIntro} ${promptBody} ${promptConclusion}`

  console.log("PROMPT", userPrompt, systemPrompt)

  
  const response: any = await options.promptGPT(systemPrompt, userPrompt).catch((error: Error) => {
    console.log('error', error)
    throw new Error('error getting suggestions')
  });

  // const newSubscriptionData = response.subscriptionData


  // const response = {
  //   "id": "chatcmpl-8u1eZoEtgdhgl5jP5ntJELW7dFukJ",
  //   "object": "chat.completion",
  //   "created": 1708363415,
  //   "model": "gpt-3.5-turbo-1106",
  //   "choices": [
  //       {
  //           "index": 0,
  //           "message": {
  //               "role": "assistant",
  //               "content": "```json\n[\"Create user interface\", \"Implement backend logic\", \"Test new option functionality\"]\n```"
  //           },
  //           "logprobs": null,
  //           "finish_reason": "stop"
  //       }
  //   ],
  //   "usage": {
  //       "prompt_tokens": 150,
  //       "completion_tokens": 20,
  //       "total_tokens": 170
  //   },
  //   "system_fingerprint": "fp_840d6af8ef"
  // }

  const messages = response.choices.map( (choice: {message: {content: string }}) => choice.message.content) 

  console.log('messages', messages)
  const taskSets = messages.map((message: string) => {
    const messageMatch = message.match(/.*(\[[^\][]*\]).*/m)
    if (!messageMatch || !messageMatch[1]) {
      throw new Error(`Could not parse response: ${message}`)
    }
    return JSON.parse(messageMatch[1])
  })

  if (taskSets.length === 0) {
    console.log('messages', messages)
    throw new Error(`No task sets found`)
  }
  
  if (taskSets.length > 1) {
    console.warn(`More than one task set found`, messages)
  }

  const newTasks = taskSets[0]

  const newNodeItems = newTasks.map((task: string) => {
    const newNodeData: Partial<FosDataContent> = {
      description: {
        content: task
      }
    }
    return newNodeData
  })



  const { newState: stateWithChildren, childRoutes: generatedChildRoutes }  = newNodeItems.reduce((acc: { newState: AppState["data"], childRoutes: FosPath[] }, newNodeItem: Partial<FosDataContent>, i: number) => {

    
    const newRow = { data: newNodeItem, children: []}

    const { newState: stateWithChild, childRoute }  = addChild(acc.newState, nodeRoute, "workflow", newRow , childRoutes.length + i)

    return { newState: stateWithChild, childRoutes: [...acc.childRoutes, childRoute] }

  }, { newState: appState, childRoutes: [] })



  return stateWithChildren
}