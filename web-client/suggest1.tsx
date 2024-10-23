import * as React from 'react'
import { suggestService } from './services/suggestion.service'

const Index = (props: any) => {
  const [isClient, setIsClient] = React.useState(false)
  const [goalAndContext, setGoalAndContext] = React.useState('')

  const [terms, setTerms] = React.useState({
    type: 'task',
    alias: 'test-task2',
    context: [
      {
        type: 'text',
        alias: 'test-task2-description',
        description: '',
      },
    ],
    outputs: [
      {
        type: 'boolean',
        alias: 'test-task2-status',
      },
    ],
    inputs: [],
  })

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true)
    }
  })

  const termTpl: any = {
    type: 'task',
    alias: new Date().toISOString() + '-task',
    context: [
      {
        type: 'text',
        alias: new Date().toISOString() + '-description',
        description: '',
      },
    ],
    outputs: [
      {
        type: 'boolean',
        alias: new Date().toISOString() + '-status',
      },
    ],
    inputs: [],
  }

  // console.log('GoalAndContext', goalAndContext)
  const getGPTSubtasks = async (taskDescription: any) => {
    const result = await suggestService.getSuggestion(goalAndContext, taskDescription)
    console.log('sugg result', result)
    function extractJson(str: any) {
      // const regex = /^.*\`{3}json[\s]*(\{[.\s\S]*\})[\s]*\`{3}.*$/g;
      // const stringToMatch = str.replace(/\\n/g, "\n");
      // const matches = stringToMatch.match(regex);
      // console.log('string to match', stringToMatch, matches)
      // if (matches) {
      // return JSON.parse(matches[0]);
      // } else {
      // console.log('string to match', stringToMatch, matches)
      // return null;
      // }
      return JSON.parse(str)
    }
    const extractedResults = extractJson(result[0].text) || {}
    const extractedSubs = extractedResults.subtasks
    console.log('suggetsion extracted result', extractedResults, extractedSubs, result)
    // console.log('suggestion result', result, extractJson(result.text))
    return extractedSubs
  }

  if (isClient) {
    return (
      // <TermInline
      //   term={terms}
      //   onChange={setTerms}
      //   getGPTSubtasks={getGPTSubtasks}
      //   termTpl={termTpl}
      //   goalAndContext={goalAndContext}
      //   firstChild={true}
      //   setGoalAndContext={setGoalAndContext}
      // />
      <div></div>
    )
  } else {
    return <></>
  }
}

export default Index
