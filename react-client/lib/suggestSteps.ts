import { FosPath, IFosNode, FosTrail, FosRoute, FosDataContent } from "@/fos-js"

export const suggestSteps = async (
  promptGPT: (systemPrompt: string, userPrompt: string, options?: { temperature?: number | undefined; }) => Promise<{
    choices: {message: {
      role: string, content: string
    }, finishReason: string}[]
  }>,
  node: IFosNode,
  ) => {
  const trail = node.getRoute()
  const [root, ...trailWithoutRoot] = trail
  const token = localStorage.getItem('token')

 
  const description = node.getData().description?.content || ""


  const past = node.getAncestors().slice(1).reverse().map(([node, number], index) => {
    return node
  }).concat([node])

  

  const descriptions = past.map((node, index: number) => {
    const data = node.getData();
    return data.description?.content
  })

  const [mainTask, ...contextTasks] = descriptions.slice().reverse()

  const systemPrompt = `You are part of a group of workers building a tree of subtasks to describe a project, which may be big or small.  As such, you do not provide information that is not directly related to the subtask at hand because it will probably be provided by another worker`

  const promptIntro = `PLEASE OUTPUT SINGLE VALID JSON ARRAY OF STRINGS < 50 CHARS PER ENTRY.  `

  const promptBody = `Please create 3-7 subtasks of the following task: ${mainTask}.  For context, this is a subtask of ${contextTasks.join(' subtask of the task ')}.  Please do not provide subtasks which are likely included in other branches.  If necessary, group information into a single subtask`

  const promptConclusion = `Please output only single json array containing only strings.`

  const userPrompt = `${promptIntro} ${promptBody} ${promptConclusion}`

  console.log("PROMPT", userPrompt, systemPrompt)

  
  const response: any = await promptGPT(systemPrompt, userPrompt).catch((error: Error) => {
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
    const newNodeData: FosDataContent = {
      description: {
        content: task
      }
    }
    return newNodeData
  })

 
  console.log('suggestion1')
  const nodeData = node.getData()



  if (node.getChildren().length > 0){
    // add new tasks to new option
    console.log('suggestion1')

    // if is option add child

    // else create new option node on parent and move this under

    

  }


  for (const newNodeItem of newNodeItems){

    const newNode = node.newChild("workflow")
    const newNodeData = newNode.getData()
    newNode.setData({
      ...newNodeData,
      ...newNodeItem
    })
  }



  return
}