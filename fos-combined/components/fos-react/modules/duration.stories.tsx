



import React, { useEffect } from 'react'
import { Meta, StoryFn } from "@storybook/react";
import { DurationInput }  from './duration'

import '../../../global.css'
import '../../../index.css'

export default {
  // component: div,
  title: 'Duration Input',
  design: {
    type: "figma",
    url: "https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File",
  },
} as Meta;

interface TplProps {
  startValue: number
  locked: boolean
}

const Template: StoryFn<TplProps> = (args: TplProps) => {
  // const [_, node] = getExampleRoot().getTask(args.workflowName)
  // const [ct, setCt] = React.useState(0)
  // const view = getExampleRoot().getEdgeType('workflow')

  // const forceUpdate = () => setCt(ct + 1)

  // const fos = useFos(options)
  // const interpreter = fos.createTransaction()

  const [data, setData] = React.useState<number>(args.startValue)

  const [focusChar, setFocusChar] = React.useState<number>(0)


  const onValueChange = (value: number) => {
    console.log('onValueChange', value)
    setData(value);
  }



  return (
    <div className="fos-root">
      {/* <Main interpreter={interpreter} /> */}
      <DurationInput 
        value={data}
        disabled={args.locked}
        onUpdate={onValueChange}
        />
    </div>
    // <WorkflowComponent node={node} edge={view} path={[[view, node]]} forceUpdate={forceUpdate} />
  )
}


export const Default = Template.bind({})
Default.args = {
  startValue: 560654065,
  locked: false,
}





