

import { suggestOption } from "./suggestOption"
import { suggestSteps } from "./suggestSteps"

import { setCostInfo, getCostInfo } from "../components/fos-react/modules/cost" 
import { setDurationInfo, getDurationInfo } from "../components/fos-react/modules/duration"



export const suggestMagic = async (
  promptGPT: (systemPrompt: string, userPrompt: string, options?: { temperature?: number | undefined; }) => Promise<{
    choices: {message: {
      role: string, content: string
    }, finishReason: string}[]
  }>,
  node: IFosNode,
  ) => {

  console.log('suggestMagic', node)

  const past = node.getAncestors().slice(1).reverse().map(([node, number], index) => {
    return node
  }).concat([node])

  

  const descriptions = past.map((node, index: number) => {
    const data = node.getData();
    return data.description?.content
  })


  const getChildTimes = async (node: IFosNode, index: number, parentDescriptions: string[], options?: { temperature?: number | undefined; }): Promise<void> => {

    const nodeData = node.getData()
    const children = node.getChildren()

    if (children.length === 0) {
          let systemPrompt: string;
          let userPrompt: string;
          const keys: (keyof FosNodeContent['data'])[] = ["duration"]
          keys.forEach(async (resourceName: keyof FosNodeContent['data']) => {
              
          if (!nodeData?.[resourceName]){
      
              switch(resourceName) {
              case 'cost':
                systemPrompt = `Take a deep breath.  Please respond only with a single valid JSON object with the key "cost" and a number value`
                userPrompt = `How much does it cost to ${nodeData.description?.content || ""} in the as a subtask of ${parentDescriptions.join(' subtask of the task ')}`
                break;
              case 'duration': 
                systemPrompt = `Take a deep breath.  Please respond only with a single valid JSON object with the optional keys "milliseconds", "seconds", "minutes", "hours", "days", "weeks", "months", or "years" and a number value`
                userPrompt = `How long does it take to ${nodeData.description?.content || ""} in the as a subtask of ${parentDescriptions.join(' subtask of the task ')} please express in terms of milliseconds, seconds, minutes, hours, days, weeks, months, or years.`
                break;

            }

            const response: any = await promptGPT(systemPrompt, userPrompt).catch((error: Error) => {
              console.log('error', error)
              throw new Error('error getting suggestions')
            });

            const results = response.choices.map( (choice: {message: {content: string }}) => {
              
              const messageMatch = choice.message.content.match(/.*(\{[^{}]*\}).*/m)
              if (!messageMatch || !messageMatch[1]) {
                throw new Error(`Could not parse response: ${choice.message.content}`)
              }
              return JSON.parse(messageMatch[1])
            }) 


            const resultParsed = results[0]

            switch (resourceName) {
              case 'duration':
                setDurationInfo(node, { plannedMarginal: parseTime(resultParsed), entries: [] })
                break;

            }
          }

        });

        return
 
    } else {


        const keys: (keyof FosNodeContent['data'])[] = ["duration"]
        keys.forEach(async (resourceName: keyof FosNodeContent['data']) => {

          for (const child of children) {

            const itemNodeData = child.getData()

            for ( const [j, option] of child.getChildren().entries()){

              const description = option.getData().description?.content || ""
              await getChildTimes(child, j, [...parentDescriptions, description])

            }
          }


          if (!nodeData?.[resourceName]){

            const durationInfo = getDurationInfo(node)

            let systemPrompt: string;
            let userPrompt: string;

            switch(resourceName) {
              case 'duration': 
                systemPrompt = `Take a deep breath.  Please respond only with a single valid JSON object with the optional keys "milliseconds", "seconds", "minutes", "hours", "days", "weeks", "months", or "years" and a number value`
                userPrompt = `How long does it take to ${nodeData.description?.content || ""} in the as a subtask of ${parentDescriptions.join(' subtask of the task ')} please express in terms of milliseconds, seconds, minutes, hours, days, weeks, months, or years., but factoring out the time of its subtasks, which are estimated to take somewhere between ${durationInfo.min} and ${durationInfo.max}, averaging ${durationInfo.average}. This will leave only the marginal time, which is the information we want.`
                break;
              default:
                throw new Error(`Resource ${resourceName} not recognized`)
            }

                  
            const response: any = await promptGPT(systemPrompt, userPrompt).catch((error: Error) => {
              console.log('error', error)
              throw new Error('error getting suggestions')
            });

            const results = response.choices.map( (choice: {message: {content: string }}) => {
              
              const messageMatch = choice.message.content.match(/.*(\{[^{}]*\}).*/m)
              if (!messageMatch || !messageMatch[1]) {
                throw new Error(`Could not parse response: ${choice.message.content}`)
              }
              return JSON.parse(messageMatch[1])
            }) 


            const resultParsed = results[0]

            switch (resourceName) {

              case 'duration':
                setDurationInfo(node, { plannedMarginal: parseTime(resultParsed), entries: []})
                break;

            }
    

        } 
      });


      if (getDurationInfo(node).average > (30 * 60 * 1000)) {

        // suggest steps

        await suggestSteps(promptGPT, node)


        
        const numOptions = node.getChildren().length


        for (const i of Array(numOptions).keys()) {
          
          
          await suggestOption(promptGPT, node)

        }

        await getChildTimes(node, index, parentDescriptions)

        // if length of option is less than 3, suggest options until there are 3


      }

      return 
      
    }
  }

  return

}

const parseTime = (time: {milliseconds?: number, seconds?: number, minutes?: number, hours?: number, days?: number, weeks?: number, months?: number, years?: number}) => {
  // turn object into int number of milliseconds
  const milliseconds = time.milliseconds || 0
  const seconds = (time.seconds || 0) * 1000
  const minutes = (time.minutes || 0) * 60 * 1000
  const hours = (time.hours || 0) * 60 * 60 * 1000
  const days = (time.days || 0) * 24 * 60 * 60 * 1000
  const weeks = (time.weeks || 0) * 7 * 24 * 60 * 60 * 1000
  const months = (time.months || 0) * 30 * 24 * 60 * 60 * 1000
  const years = (time.years || 0) * 365 * 24 * 60 * 60 * 1000
  return milliseconds + seconds + minutes + hours + days + weeks + months + years
}