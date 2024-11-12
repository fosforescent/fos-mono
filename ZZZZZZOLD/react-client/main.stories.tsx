import React from 'react'
import {Meta, StoryFn} from "@storybook/react";
// import Main, { FosReactOptions }  from './components/fos/index'

import { defaultNodesDemo, defaultContext } from './components/fos/initialData';

export default {
  // component: div,
  title: 'Workflow',
} as Meta;

interface TplProps {
  workflowName: string
}

const Template: StoryFn<TplProps> = (args: any) => {
  // const [_, node] = getExampleRoot().getTask(args.workflowName)
  // const [ct, setCt] = React.useState(0)
  // const view = getExampleRoot().getEdgeType('workflow')

  // const forceUpdate = () => setCt(ct + 1)

  // const options: FosReactOptions & { mock?: boolean } = {
  //   mock: true,
  // }
  // const fos = useFos(options)
  // const interpreter = fos.createTransaction()

  const [data, setData] = React.useState<any>(defaultContext)

  return (
    <div>
      {args.workflowName}
      {/* <Main interpreter={interpreter} /> */}
      {/* <Main data={data} setData={setData} /> */}
    </div>
    // <WorkflowComponent node={node} edge={view} path={[[view, node]]} forceUpdate={forceUpdate} />
  )
}


export const WithDemo = Template.bind({})
WithDemo.args = {
  workflowName: 'with-demo',
}

export const WithoutDemo = Template.bind({})
WithDemo.args = {
  workflowName: 'without-demo',
}