
import { BrainCircuit, ChevronLeft, ChevronRight, Timer } from 'lucide-react';
import React, { useEffect, useRef, useState, DetailedHTMLProps, HTMLAttributes } from 'react'

import { SelectionPath, FosDataContent, FosReactOptions } from "../../types"
import { Button } from '@/components/ui/button';
import { AppState, FosRoute } from '@/fos-combined/types';



const parseDurationFromMs = (time: number) => {
  const years = Math.floor(time / (1000 * 60 * 60 * 24 * 365))
  const timeMinusYears = time - years * (1000 * 60 * 60 * 24 * 365)
  const months = Math.floor(timeMinusYears / (1000 * 60 * 60 * 24 * 30))
  const timeMinusMonths = timeMinusYears - months * (1000 * 60 * 60 * 24 * 30)
  const weeks = Math.floor(timeMinusMonths / (1000 * 60 * 60 * 24 * 7))
  const timeMinusWeeks = timeMinusMonths - weeks * (1000 * 60 * 60 * 24 * 7)
  const days = Math.floor(timeMinusWeeks / (1000 * 60 * 60 * 24))
  const timeMinusDays = timeMinusWeeks - days * (1000 * 60 * 60 * 24)
  const hours = Math.floor(timeMinusDays / (1000 * 60 * 60))
  const timeMinusHours = timeMinusDays - hours * (1000 * 60 * 60)
  const minutes = Math.floor(timeMinusHours / (1000 * 60))
  const timeMinusMinutes = timeMinusHours - minutes * (1000 * 60)
  const seconds = Math.floor(timeMinusMinutes / 1000)
  const timeMinusSeconds = timeMinusMinutes - seconds * 1000
  const milliseconds = timeMinusSeconds

  return { years, months, weeks, days, hours, minutes, seconds, milliseconds };
};

const durationToMs = (time: {milliseconds?: number, seconds?: number, minutes?: number, hours?: number, days?: number, weeks?: number, months?: number, years?: number}) => {
  // turn object into int number of milliseconds
  try {
    const milliseconds = time.milliseconds || 0
    const seconds = (time.seconds || 0) * 1000
    const minutes = (time.minutes || 0) * 60 * 1000
    const hours = (time.hours || 0) * 60 * 60 * 1000
    const days = (time.days || 0) * 24 * 60 * 60 * 1000
    const weeks = (time.weeks || 0) * 7 * 24 * 60 * 60 * 1000
    const months = (time.months || 0) * 30 * 24 * 60 * 60 * 1000
    const years = (time.years || 0) * 365 * 24 * 60 * 60 * 1000
    return milliseconds + seconds + minutes + hours + days + weeks + months + years  
  } catch (e) {
    console.error('Error converting duration to ms', time, e)
    throw e
  }
}

export const durationDisplay = (time: number) => {
  
  const {
    years, months, weeks, days, hours, minutes, seconds, milliseconds
  } = parseDurationFromMs(time)

  const inputs = [
    { label: 'Years', name: 'years', value: years },
    { label: 'Months', name: 'months', value: months },
    { label: 'Weeks', name: 'weeks', value: weeks },
    { label: 'Days', name: 'days', value: days },
    { label: 'Hours', name: 'hours', value: hours },
    { label: 'Minutes', name: 'minutes', value: minutes },
    { label: 'Seconds', name: 'seconds', value: seconds },
    { label: 'Milliseconds', name: 'milliseconds', value: milliseconds }
  ];

  
  const indexToUse = inputs.findIndex(({ value }) => value > 0)
  const actualIndex = indexToUse > -1 
    ? indexToUse > inputs.length - 2 ? indexToUse - 2 
      : indexToUse < 1 ? indexToUse : indexToUse - 1
    : 5

  const inputsToUse = inputs.slice(actualIndex, actualIndex + 2)

  const timeString = inputsToUse.reduce((acc, { label, value, name }) => {

    if(name === 'milliseconds'){
      return `.${(milliseconds / 1000).toFixed(3).slice(2)}`
    } else if (name === 'seconds'){
      const secondsString = seconds < 10 ? `0${seconds}` : `${seconds}`
      return acc ? `${acc}:${secondsString}` : `${value}`
    } else if (name === 'minutes'){
      const minutesString = minutes < 10 ? `0${minutes}` : `${minutes}`
      return acc ? `${acc}:${minutesString}` : `${value}`
    } else if (name === 'hours'){
      if (value <= 0 ){ return acc }
      return acc ? `${acc} ${value}` : `${value}`
    } else if (name === 'days'){
      if (value <= 0 ){ return acc }
      return acc ? `${acc} ${value} d` : `${value} d`
    } else if (name === 'weeks'){
      if (value <= 0 ){ return acc }
      return acc ? `${acc} ${value} wk` : `${value} wk`
    } else if (name === 'months'){
      if (value <= 0 ){ return acc }
      return acc ? `${acc} ${value} mo` : `${value} mo`
    } else if (name === 'years'){
      if (value <= 0 ){ return acc }
      return acc ? `${acc} ${value} yr` : `${value} yr`
    }


    return `${acc}${value} ${label}, `
  }, '')

  return timeString
}



export const DurationInput = ({ 
  value: time, 
  onUpdate, 
  disabled = false,
  ...props
} : { 
  value: number, 
  onUpdate: (value: number) => void,
  disabled?: boolean,  
} & Partial<DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>> ) => {






  const {
    years, months, weeks, days, hours, minutes, seconds, milliseconds
  } = parseDurationFromMs(time)


  const inputs = [
    { label: 'Years', name: 'years', value: years },
    { label: 'Months', name: 'months', value: months },
    { label: 'Weeks', name: 'weeks', value: weeks },
    { label: 'Days', name: 'days', value: days },
    { label: 'Hours', name: 'hours', value: hours },
    { label: 'Minutes', name: 'minutes', value: minutes },
    { label: 'Seconds', name: 'seconds', value: seconds },
    { label: 'Milliseconds', name: 'milliseconds', value: milliseconds }
  ];


  const indexToUse = inputs.findIndex(({ value }) => value > 0)
  const actualIndex = indexToUse > -1 
    ? indexToUse > inputs.length - 2 ? indexToUse - 2 
      : indexToUse < 1 ? indexToUse : indexToUse - 1
    : 5

  const containerRef = useRef<HTMLDivElement>(null);
  // const [visibleColumns, setVisibleColumns] = useState(0);
  const [startIndex, setStartIndex] = useState(actualIndex);

  useEffect(() => {
    const indexToUse = inputs.findIndex(({ value }) => value > 0)
    const actualIndex = indexToUse > -1 
      ? indexToUse > inputs.length - 2 ? indexToUse - 2 
        : indexToUse < 1 ? indexToUse : indexToUse - 1
      : 5
    setStartIndex(actualIndex)

    // console.log('dur index', indexToUse, actualIndex, inputs.length)

  }, [time])

  // // Calculate the number of visible columns based on container width
  // useEffect(() => {
  //   const updateVisibleColumns = () => {
  //     // console.log('updateVisibleColumns', containerRef.current?.offsetWidth, containerRef.current)
  //     if (containerRef.current) {
  //       const containerWidth = containerRef.current.offsetWidth;
  //       const columnWidth = 60; // Approximate width of each column in pixels
  //       // console.log('updateVisibleColumns', containerRef.current?.offsetWidth, containerRef.current, Math.floor(containerWidth / columnWidth))
  //       setVisibleColumns(Math.floor( (containerWidth - 50) / columnWidth) || 1);
  //     }
  //   };

  //   updateVisibleColumns();
  //   window.addEventListener('resize', updateVisibleColumns);

  //   return () => {
  //     window.removeEventListener('resize', updateVisibleColumns);
  //   };
  // }, []);

  const visibleColumns = 3

  const handleNext = () => {
    setStartIndex((prev) => Math.min(prev + 1, inputs.length - visibleColumns));
  };

  const handlePrev = () => {
    setStartIndex((prev) => Math.max(prev - 1, 0));
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const newTime = { years, months, weeks, days, hours, minutes, seconds, milliseconds }
    newTime[name as keyof typeof newTime] = parseInt(value)
    onUpdate(durationToMs(newTime))
  }


  return (
    <div className={`border-primary border rounded-md ${props.className || ''}`} style={{...(props.style || {}), ...{}}}>
      <div className='flex'>
        {(visibleColumns < (inputs.length -1)) && <button onClick={handlePrev} disabled={startIndex === 0}>
          <ChevronLeft className={`border-r ${startIndex <= 0 ? "text-primary/30" : ""}`} />
        </button>}
        <div ref={containerRef} style={{
          // width: 'calc(100% - 20px)'
        }} className="flex flex-row">
          {inputs.slice(startIndex, startIndex + visibleColumns).map(({ label, name, value }) => (
            <div key={name} className="w-10 text-xs mx-1">
              <label className="block">
                {label}:
                <input
                  type="number"
                  name={name}
                  className="w-full text-lg border-secondary border"
                  value={value}
                  onChange={handleChange}
                  disabled={disabled}
                />
              </label>
            </div>
          ))}
        </div>
        {visibleColumns < (inputs.length) && <button onClick={handleNext} disabled={startIndex + visibleColumns >= inputs.length}>
          <ChevronRight className={`border-l  ${(startIndex >= (inputs.length - 3)) ? "text-primary/30" : ""}`} />
        </button>}
      </div>
    </div>
  )


}







const ResourceComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: [string, string][]
  setData: (state: AppState) => void
}) => {






  const durationInfo = getDurationInfo(node.fosNode())


  const handleDurationEdit = (value: DurationData) => {
    setDurationInfo(node.fosNode(), value)
  }
  
  const handleMinDurationPath = async () => {
    node.fosNode().setPath(durationInfo.minPaths)
    // console.log('min path', durationInfo.minPaths)

  }
  
  const handleMaxDurationPath = async () => {
    node.fosNode().setPath(durationInfo.maxPaths)
    // console.log('max path', durationInfo.maxPaths)
  }
  

  


  const systemPromptBase = `Take a deep breath.  Please respond only with a single valid JSON object with the optional keys "milliseconds", "seconds", "minutes", "hours", "days", "weeks", "months", or "years" and a number value`
  const getUserPromptBase = (thisDescription: string, parentDescriptions: string[], node: IFosNode) => `How long does it take to ${thisDescription} in the as a subtask of ${parentDescriptions.join(' subtask of the task ')} please express in terms of milliseconds, seconds, minutes, hours, days, weeks, months, or years.`
  const systemPromptRecursive = `Take a deep breath.  Please respond only with a single valid JSON object with the optional keys "milliseconds", "seconds", "minutes", "hours", "days", "weeks", "months", or "years" and a number value`
  const getUserPromptRecursive = (thisDescription: string, parentDescriptions: string[], node: IFosNode) => {
    const resourceInfo = getDurationInfo(node)
    return `How long does it take to ${thisDescription} in the as a subtask of ${parentDescriptions.join(' subtask of the task ')} please express in terms of milliseconds, seconds, minutes, hours, days, weeks, months, or years., but factoring out the time of its subtasks, which are estimated to take somewhere between ${resourceInfo.min} and ${resourceInfo.max}, averaging ${resourceInfo.average}. This will leave only the marginal time, which is the information we want.`
  }
  const pattern = /.*(\{[^{}]*\}).*/m
  const parsePattern = (result: any, node: IFosNode): DurationData => {

    // console.log('parsePattern', result)

    const resultParsed = result as {
      milliseconds?: number,
      seconds?: number,
      minutes?: number,
      hours?: number,
      days?: number,
      weeks?: number,
      months?: number,
      years?: number
    }

  
    
    return { plannedMarginal: durationToMs(resultParsed), entries: [] } 
  } 



  const handleSuggestDuration = async () => {
    if (options?.canPromptGPT && options?.promptGPT){
      try {
        await suggestRecursive(options.promptGPT, node.fosNode(), {
          systemPromptBase,
          getUserPromptBase,
          systemPromptRecursive,
          getUserPromptRecursive,
          pattern,
          parsePattern,
          getResourceInfo: getDurationInfo,
          setResourceInfo: setDurationInfo,
          checkResourceInfo: checkDurationInfo,
        } )
  
      } catch (err) {
        options?.toast && options.toast({
          title: 'Error',
          description: `No suggestions could be generated: ${err}`,
          duration: 5000,
        })
  
      }

    } else {
      console.error('No authedApi')
      const err =  new Error('No authedApi')
      err.cause = 'unauthorized'
      throw err
    }
  }

  const hasChildren = node.fosNode().getChildren().length > 0

  return (<div className='w-full text-center overflow-hidden flex flex-row wrap '>
    <div className='flex flex-row justify-center items-center mx-auto flex-wrap' style={{ maxWidth: '600px' }}>
      <div className='items-center justify-center gap-1 flex items-center' style={{ width: '250px' }}>
        <Button variant={"secondary"} className='bg-emerald-900 inline-block w-14' onClick={handleSuggestDuration} title="Get estimated duration"><BrainCircuit /></Button>
        <DurationInput value={durationInfo.marginal} onUpdate={(value) => handleDurationEdit({ plannedMarginal: value, entries: []})} className='' style={{
          width: '195px',
          display: 'inline-block',
        }} />
      </div>
      {hasChildren && <div className="flex flex-row align-center justify-center" style={{ width: '250px' }}>
        <div className='px-1 overflow-hidden' style={{ width: '75px' }}>
          <Button variant={"secondary"} className='bg-emerald-900 p-1' onClick={handleMinDurationPath} title="Set min duration path"> <div className='w-full'>Min: {durationDisplay(durationInfo.min)} </div></Button>
        </div>
        <div className='px-1 overflow-hidden' style={{ width: '100px' }}>
          <div title="Time of Currently Selected Path"> Curr: {durationDisplay(durationInfo.current)} </div>
          <div title="Time of Average Path"> Avg: {durationDisplay(durationInfo.average)} </div>
        </div>
        <div className='px-1 overflow-hidden' style={{ width: '75px' }}>
          <Button variant={"secondary"} className='bg-emerald-900 p-1' onClick={handleMaxDurationPath} title="Set max duration path"> <div className='w-full'>Max: {durationDisplay(durationInfo.max)} </div></Button>
        </div>
      </div>}
    </div>
  </div>)





}



type DurationData = FosDataContent["duration"]


type DurationInfo = {
  min: number,
  max: number,
  average: number,
  current: number,
  minPaths: SelectionPath,
  maxPaths: SelectionPath,
  marginal: number
}

export const getDurationInfo = (nodeRoute: FosRoute, appState: AppState): DurationInfo => {


    
  const children = thisNode.getChildren()


  const reduceTaskDurations = (acc: DurationInfo, child: IFosNode, i: number): DurationInfo => {
        
    const childDurationInfo = getDurationInfo(child)
    const childId = child.getId()

    const result: DurationInfo = {
      min: acc.min + childDurationInfo.min,
      max: acc.max + childDurationInfo.max,
      average: acc.average + childDurationInfo.average,
      current: acc.current + childDurationInfo.current,
      minPaths: {...acc.minPaths, [childId]: childDurationInfo.minPaths},
      maxPaths: {...acc.maxPaths, [childId]: childDurationInfo.maxPaths},
      marginal: acc.marginal
    }
    return result
  }

  const reduceOptionDurations = (acc: DurationInfo, child: IFosNode, i: number): DurationInfo => {

    const childDurationInfo = getDurationInfo(child)

    const newAvg = ( ( acc.average * i ) + childDurationInfo.average ) / ( i + 1 )

    const isSelected = (thisNode.getData().option?.selectedIndex || 0) === i

    const isMin = acc.min > childDurationInfo.min
    const isMax = acc.max < childDurationInfo.max


    const childId = child.getId()

    return {
      min: acc.min > childDurationInfo.min ? childDurationInfo.min : acc.min,
      max: acc.max > childDurationInfo.max ? acc.max : childDurationInfo.max,
      average: newAvg,
      current: isSelected ? childDurationInfo.current : acc.current,
      minPaths: isMin ? { [childId] : childDurationInfo.minPaths } : acc.minPaths,
      maxPaths: isMax ? { [childId] : childDurationInfo.maxPaths } : acc.maxPaths,
      marginal: acc.marginal
    }

  }

  const thisNodeDuration = thisNode.getData().duration?.plannedMarginal

  const thisType = thisNode.getNodeType()

  const reduceFunction: undefined | ((acc: DurationInfo, child: IFosNode, i: number) => DurationInfo) = {
    task: reduceTaskDurations,
    option: reduceOptionDurations
  }[thisType]

  if (!reduceFunction){
    throw new Error(`Unsupported node type ${thisType}`)
  }

  const startVal: DurationInfo = {
    min: children.length > 0 ? Number.MAX_SAFE_INTEGER : thisNodeDuration || 0,
    max: thisNodeDuration || 0,
    average: thisNodeDuration || 0,
    current: thisNodeDuration || 0,
    minPaths: {},
    maxPaths: {},
    marginal: thisNodeDuration || 0
  }

  const result: DurationInfo = children.reduce(reduceFunction, startVal)

  return result

}






export const setDurationInfo = (node: IFosNode, value: DurationData) => {
  const nodeData = node.getData()

  if (value){
    node.setData({
      ...nodeData,
      duration: {
        ...nodeData.duration,
        ...(value || {})
      } 
    })  
  }

}

export const checkDurationInfo = (node: IFosNode) => {
  const nodeData = node.getData()
  return !!nodeData.duration
}



const DurationRowComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: [string, string][]
  setData: (state: AppState) => void
}) => {


  return (<div className="flex flex-initial grow">
    If you are seeing this, there is an error. (duration)
  </div>)
}




const module = {
  icon: <Timer />,
  name: 'duration',
  HeadComponent: ResourceComponent,
  // RowComponent: DurationRowComponent,
}

export default module