

import { suggestTaskOptions } from "./suggestOption"
import { suggestTaskSteps } from "./suggestSteps"

import { setCostInfo, getCostInfo } from "../frontend/components/fields/cost" 
import { setDurationInfo, getDurationInfo } from "../frontend/components/fields/duration"
import { AppState, FosNodeContent, FosReactOptions, FosPath } from "../shared/types"


import { FosExpression,  } from "./dag-implementation/expression"



export const suggestStepsMagic = async (
  expression: FosExpression,
  options: FosReactOptions,
  ): Promise<AppStateLoaded["data"]> => {


  const nodeRoute = expression.route
  const childRoutes = expression.childRoutes()



  if (!options.canPromptGPT || !options.promptGPT) {
    throw new Error('GPT not available')
  }

  const pastRoutes: FosPath[] = nodeRoute.slice(2, -1).map((_, i) => nodeRoute.slice(0, i + 1)) as FosPath[]


  
  const siblingDescriptions = childRoutes.map((childRoute) => {
    const childExpression = new FosExpression(expression.store, childRoute)
    return childExpression.getDescription()
  })
  

  const descriptions = pastRoutes.map((nodeRoute, index: number) => {
    const nodeExpression = new FosExpression(expression.store, nodeRoute)
    return nodeExpression.getDescription()
  })

  const [mainTask, ...contextTasks] = descriptions.slice().reverse()

  const getChildTimes = async (lNodeRoute: FosPath, index: number, parentDescriptions: string[], gptOptions?: { temperature?: number | undefined; }): Promise<AppStateLoaded["data"]> => {

    const lExpression = new FosExpression(expression.store, lNodeRoute)
    const lDesc = lExpression.getDescription()
    const lChildRoutes = lExpression.childRoutes()
    const lNodeData = lExpression.targetNode.getData()

    if (lChildRoutes.length === 0) {
          let systemPrompt: string;
          let userPrompt: string;
          const keys: (keyof FosNodeContent['data'])[] = ["duration"]
          keys.forEach(async (resourceName: keyof FosNodeContent['data']) => {
              
          if (!lNodeData?.[resourceName]){
      
              switch(resourceName) {
              case 'cost':
                systemPrompt = `Take a deep breath.  Please respond only with a single valid JSON object with the key "cost" and a number value`
                userPrompt = `How much does it cost to ${lNodeData.description?.content || ""} in the as a subtask of ${parentDescriptions.join(' subtask of the task ')}`
                break;
              case 'duration': 
                systemPrompt = `Take a deep breath.  Please respond only with a single valid JSON object with the optional keys "milliseconds", "seconds", "minutes", "hours", "days", "weeks", "months", or "years" and a number value`
                userPrompt = `How long does it take to ${lNodeData.description?.content || ""} in the as a subtask of ${parentDescriptions.join(' subtask of the task ')} please express in terms of milliseconds, seconds, minutes, hours, days, weeks, months, or years.`
                break;

            }
            

              if (!options.canPromptGPT || !options.promptGPT) {
                throw new Error('GPT not available')
              }



            const response: any = await options.promptGPT(systemPrompt, userPrompt, gptOptions).catch((error: Error) => {
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

            const oldContent = lExpression.targetNode.getContent()


            switch (resourceName) {
              case 'duration':
                const newContent = {
                  data: {
                    ...oldContent.data,
                    duration: { plannedMarginal: parseTime(resultParsed), entries: [] }
                  },
                  children: oldContent.children
                }
    
                expression.updateTargetContent(newContent)
                break;

            }
          }

        });

 
    } else {


        const keys: (keyof FosNodeContent['data'])[] = ["duration"]

        const lExpression = new FosExpression(expression.store, lNodeRoute)
        
        keys.forEach(async (resourceName: keyof FosNodeContent['data']) => {

          if (!options.canPromptGPT || !options.promptGPT) {
            throw new Error('GPT not available')
          }


          for (const childExpr of lExpression.getTargetChildren()) {


            
            let j = 0
            for ( const grandchildRoute of childExpr.childRoutes()) {
              await getChildTimes(grandchildRoute, j, [...parentDescriptions, expression.getDescription()], gptOptions)
              j++
            }
          }


          if (!expression.targetNode.getData()[resourceName]){

            const durationInfo = getDurationInfo(lNodeRoute)

            let systemPrompt: string;
            let userPrompt: string;

            switch(resourceName) {
              case 'duration': 
                systemPrompt = `Take a deep breath.  Please respond only with a single valid JSON object with the optional keys "milliseconds", "seconds", "minutes", "hours", "days", "weeks", "months", or "years" and a number value`
                userPrompt = `How long does it take to ${lNodeInfo.nodeData?.description?.content || ""} in the as a subtask of ${parentDescriptions.join(' subtask of the task ')} please express in terms of milliseconds, seconds, minutes, hours, days, weeks, months, or years., but factoring out the time of its subtasks, which are estimated to take somewhere between ${durationInfo.min} and ${durationInfo.max}, averaging ${durationInfo.average}. This will leave only the marginal time, which is the information we want.`
                break;
              default:
                throw new Error(`Resource ${resourceName} not recognized`)
            }

                  
            const response: any = await options.promptGPT(systemPrompt, userPrompt).catch((error: Error) => {
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
                setDurationInfo(lNodeRoute, { plannedMarginal: parseTime(resultParsed), entries: []})
                break;

            }
    

        } 
      });


      if (getDurationInfo(lNodeRoute, mAppData).average > (30 * 60 * 1000)) {

        // suggest steps

        await suggestTaskSteps(options, nodeRoute, appState)


        
        const numOptions = lNodeInfo.childRoutes.length


        for (const i of Array(numOptions).keys()) {
          
          
          mAppData = await suggestTaskOptions(options, lNodeRoute, mAppData)

        }

        const contextWithupdates = await getChildTimes(mAppData, lNodeRoute, index, parentDescriptions, gptOptions)

        // if length of option is less than 3, suggest options until there are 3
        return contextWithupdates

      }

      return mAppData
      
    }
    return lAppData
  }

  
  
  const contextWithTimes = await getChildTimes(appState, nodeRoute, 0, descriptions)

  return contextWithTimes

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