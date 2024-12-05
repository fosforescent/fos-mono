
import { AppState, FosDataContent, FosPathElem, FosReactOptions, FosPath } from "./types";
import { addChild, changeInstruction, updateNodeContent } from "./mutations";

import { FosExpression } from "./dag-implementation/expression";


export const suggestTaskOptions = async (
  expression: FosExpression,
  options: FosReactOptions,
): Promise<AppState["data"]> => {


  if (!options.canPromptGPT || !options.promptGPT) {
    throw new Error('GPT not available')
  }

  const pastRoutes: FosPath[] = nodeRoute.slice(2, -1).map((_, i) => nodeRoute.slice(0, i + 1)) as FosPath[]

  const { getParentInfo, childRoutes, nodeType, nodeContent } = getExpressionInfo(nodeRoute, appState)

  const siblingDescriptions = childRoutes.map((childRoute) => {
    const { nodeDescription } = getExpressionInfo(childRoute, appState)
    return nodeDescription
  })
  

  const optionDescriptions = pastRoutes.map((nodeRoute, index: number) => {
    const { nodeDescription } = getExpressionInfo(nodeRoute, appState)
    return nodeDescription
  })

  const [mainTask, ...contextTasks] = optionDescriptions.slice().reverse()


  const systemPrompt = `You are part of a group of workers building a tree of subtasks to describe a project, which may be big or small.  As such, you do not provide information that is not directly related to the subtask at hand because it will probably be provided by another worker`

  const promptIntro = `PLEASE OUTPUT A SINGLE VALID JSON OBJECT INCLUDING: (1) THE key "description" WITH A DESCRIPTION OF THE NEW ALTERNATIVE TASK  (2) THE KEY "steps" WITH AN ARRAY OF STRINGS < 50 CHARS PER ENTRY REPRESENTING THE NEW TASK'S SUBTASKS.`

  const promptBody = `Please create an 1-3 alternative tasks to the following tasks which serves the same purpose within its larger context: ${JSON.stringify(optionDescriptions)}.  For context, these are options of a subtask of ${contextTasks.join(' subtask of the task ')}.  ${ childRoutes.length > 0 ? `The following alternatives have already been created, so please create new ones other than these: '${siblingDescriptions.join(', ')}'.` : ""}  Please be specific, representing a true alternative, not just an abstraction or restatement of the task.  Stop and consider "why would someone be doing this?" and then come up with another way to achieve that goal.  If there are already multiple existing alternatives, feel free to get creative and think outside the box.  `

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
  const alternativeList = messages.map((message: string) => {
    const messageMatch = message.match(/.*(\{[^{}]*\}).*/m)
    if (!messageMatch || !messageMatch[1]) {
      throw new Error(`Could not parse response: ${message}`)
    }
    return JSON.parse(messageMatch[1])
  })

  const alternatives: {
    description: string,
    steps: string[]
  }[] = alternativeList[0]

  console.log('alternative', alternatives, alternativeList)

  if( alternativeList.length > 1) {
    console.warn(`More than one alternative found`, alternativeList)
  }

  if (!alternatives[0]?.description) {
    console.log('messages', messages)
    throw new Error(`No description found for alternative`)
  }

  if (!alternatives[0]?.steps || alternatives[0]?.steps.length === 0) {
    console.warn(`No alte found for task`, messages)
    throw new Error(`No alternatives found for task`)
  }






  // Move node to task under option

  
  if (nodeType === "option"){

    const {
      newState: stateWithAlternatives,
      childRoutes: generatedChildRoutes
    } = alternatives.reduce((
      acc: { newState: AppState["data"], childRoutes: FosPath[] }, 
      alternative: {
        description: string,
        steps: string[]
      }, i: number) => {
        

      const newRow = { data: {
        description: {
          content: alternative.description
        },
      }, children: []}

      const { newState: stateWithChild, childRoute }  = addChild(acc.newState, nodeRoute, "option", newRow , i)

      const childInfo = getExpressionInfo(childRoute, stateWithChild)

      const optionRoute: FosPath = [...nodeRoute, ["option", childInfo.nodeId]]

      const {
        newState: stateWithAltSubsteps,
        childRoutes: generatedStepRoutes
      } = alternative.steps.reduce((
        acc: { newState: AppState["data"], childRoutes: FosPath[] },
        astep: string,
        i: number
      ) => {
        const newNodeData: Partial<FosDataContent> = {
          description: {
            content: astep
          }
        }

        const newRow = { data: newNodeData, children: []}
        
        const { newState: stateWithSubstep, childRoute } = addChild(acc.newState, optionRoute, "workflow", newRow , i)

        return {
          newState: stateWithSubstep, 
          childRoutes: [...acc.childRoutes, childRoute]
        }
      }, {
        newState: stateWithChild, childRoutes: []
      })

      return {
        newState: stateWithAltSubsteps, childRoutes: [...acc.childRoutes, childRoute]
      }
    }, { newState: appState, childRoutes: [] })


    return stateWithAlternatives

  } else if (nodeType === "workflow") {
    // turn workflow node into option node
    // add alternatives as children
    // including original task as first child
    const { newState: stateWithChangedInstruction, newRoute } = changeInstruction(appState, nodeRoute, "option" )
    const { newState: stateWithSelf, childRoute } = addChild(stateWithChangedInstruction, newRoute, "workflow", nodeContent, 0)
    const childElem: FosPathElem = childRoute[childRoute.length - 1]!
    if(!childElem){
      throw new Error('childElem is undefined')
    }
    const stateWithBlankOption = updateNodeContent(stateWithSelf, { data: { description: { content: "" } }, children: [childElem] }, newRoute)
   
    const {
      newState: stateWithAlternatives,
      childRoutes: generatedChildRoutes
    } = alternatives.reduce((
      acc: { newState: AppState["data"], childRoutes: FosPath[] }, 
      alternative: {
        description: string,
        steps: string[]
      }, i: number) => {
        

      const newRow = { data: {
        description: {
          content: alternative.description
        },
      }, children: []}

      const { newState: stateWithChild, childRoute }  = addChild(acc.newState, nodeRoute, "option", newRow , i)

      const childInfo = getExpressionInfo(childRoute, stateWithChild)

      const optionRoute: FosPath = [...nodeRoute, ["option", childInfo.nodeId]]

      const {
        newState: stateWithAltSubsteps,
        childRoutes: generatedStepRoutes
      } = alternative.steps.reduce((
        acc: { newState: AppState["data"], childRoutes: FosPath[] },
        astep: string,
        i: number
      ) => {
        const newNodeData: Partial<FosDataContent> = {
          description: {
            content: astep
          }
        }

        const newRow = { data: newNodeData, children: []}
        
        const { newState: stateWithSubstep, childRoute } = addChild(acc.newState, newRoute, "workflow", newRow , i)

        return {
          newState: stateWithSubstep, 
          childRoutes: [...acc.childRoutes, childRoute]
        }
      }, {
        newState: stateWithChild, childRoutes: []
      })

      return {
        newState: stateWithAltSubsteps, childRoutes: [...acc.childRoutes, childRoute]
      }
    }, { newState: stateWithBlankOption, childRoutes: [] })
    

    return stateWithAlternatives

  } else {
    throw new Error(`Method not implemented for type ${nodeType}.`);
  }


}