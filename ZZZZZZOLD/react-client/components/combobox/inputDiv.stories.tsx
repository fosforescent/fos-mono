import React, { useEffect } from 'react'
import { Meta, StoryFn } from "@storybook/react";
import { InputDiv, InputDivProps }  from './inputDiv'

import '../../global.css'
import '../../index.css'

export default {
  // component: div,
  title: 'Input Div',
  
} as Meta;

interface TplProps {
  startText: string
  locked: boolean
  autoFocus: boolean
  placeholder: string
  focusChar: number
}

const Template: StoryFn<TplProps> = (args: any) => {
  // const [_, node] = getExampleRoot().getTask(args.workflowName)
  // const [ct, setCt] = React.useState(0)
  // const view = getExampleRoot().getEdgeType('workflow')

  // const forceUpdate = () => setCt(ct + 1)

  // const fos = useFos(options)
  // const interpreter = fos.createTransaction()

  const [data, setData] = React.useState<string>(args.startText)

  const [focusChar, setFocusChar] = React.useState<number>(0)
  const [autoFocus, setAutoFocus] = React.useState<boolean>(args.autoFocus)

  useEffect(() => {
    setAutoFocus(args.autoFocus)
  }, [args.autoFocus])


  useEffect(() => {
    setFocusChar(args.focusChar)
  }, args.focusChar)

  useEffect(() => {
    console.log('focusCar', focusChar)
  }, [focusChar])

  const onTextChange = (value: string, pos: number) => {
    setData(value);
    setFocusChar(pos);
    console.log('change: ', value, pos);
  }

  const keyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    console.log('keydown: ', e.target);
  }

  const keyPresses = (e: React.KeyboardEvent<HTMLDivElement>) => {
    console.log('keypress: ', e.target);
  }

  const onFocus = (value: number) => {
    console.log('onFocus: ', value );
  }

  const getFocus = () => {
    setAutoFocus(true)
  }

  return (
    <div className="fos-root">
      {args.workflowName}
      {/* <Main interpreter={interpreter} /> */}
      <InputDiv 
        value={data}
        disabled={args.locked}
        shouldFocus={args.autoFocus}
        placeholder={args.placeholder}
        className="rounded-r-none w-full cursor-text"
        onChange={onTextChange}
        onClick={(e) => { /* console.log("here"); */ e.stopPropagation()}}
        onKeyDown={keyDown}
        onKeyUp={keyPresses}
        onFocus={onFocus}
        focusChar={focusChar}
        getFocus={getFocus}
        />
    </div>
    // <WorkflowComponent node={node} edge={view} path={[[view, node]]} forceUpdate={forceUpdate} />
  )
}


export const Default = Template.bind({})
Default.args = {
  startText: "",
  locked: false,
  autoFocus: false,
  placeholder: 'Enter a task to plan',
  focusChar: 0
}

