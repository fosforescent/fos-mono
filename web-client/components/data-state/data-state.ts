import * as React from 'react'
import { useTraceUpdate } from '../trace-update'
import { useWindowSize } from '../window-size'

import { AppData, AppState, SubscriptionInfo, DataState, initialDataState} from './index'
import {FosContextData,  } from '@fosforescent/react-client'

import { diff, patch, Delta } from '@n1ru4l/json-patch-plus'
import { useDebouncedApiState } from './debouncedApiState'
import { useDebouncedLocalStorageState } from './debouncedLocalStorageState'

import * as _ from 'lodash'

const deepClone = <T>(obj: T) => JSON.parse(JSON.stringify(obj));


export const useDataState = ({
  data: apiDataState,
  setData: setApiDataState,
  loggedIn
} : {
  data: FosContextData,
  setData: (newData: FosContextData) => Promise<FosContextData>,
  loggedIn: boolean
}) => {


  // console.log('apiDataState', apiDataState, loggedIn)


  const [dataState, setDataStateRaw] = React.useState<DataState>({
    ...initialDataState,
    fosData: apiDataState || initialDataState.fosData
  })

  const dataStateBuffered = React.useMemo(() => {
    return dataState
  }, [JSON.stringify(dataState.fosData)])

  const setDataState = React.useCallback((newData: DataState | ( (prevData: DataState) => DataState)) => {
    if (typeof newData === 'function'){
      
      const result = newData(dataState)
      if (_.isEqual(dataState.fosData, result.fosData)) {
        return
      } else {
        console.log('setDataState', result)
        checkDataFormat(result.fosData)
        setDataStateRaw({
          ...result,
          synced: false,
          stored: false
        })
      }
    } else {
      
      if (_.isEqual(dataState.fosData, newData.fosData)) {
        return 
      } else {
        console.log('setDataState', newData)
        checkDataFormat(newData.fosData)
        setDataStateRaw({
          ...newData,
          synced: false,
          stored: false
        })
      }

    }
  }, [dataState])


  
  const { storeData }  = useDebouncedLocalStorageState({
    data: dataStateBuffered,
    setData: setDataStateRaw,
  })

  const { syncData } = useDebouncedApiState({
    apiData: apiDataState,
    setApiData: setApiDataState,
    appData: dataStateBuffered,
    setAppData: setDataStateRaw,
    loggedIn
  })

  const canUndo = dataState?.undoStack?.length > 0
  const canRedo = dataState?.redoStack?.length > 0


  const undo = () => {


    const [lastDiff, ...newUndoStack] = dataState.undoStack
  
    if (!lastDiff) {
      throw new Error('!lastDiff');
    }
  

    const undoneFosData = patch({
      left: deepClone(dataState.fosData), 
      delta: lastDiff
    })

    const redoDiff = diff({
      left: undoneFosData,
      right: dataState.fosData
    })

    // console.log('redoDiff', redoDiff, lastDiff, dataState.fosData, undoneFosData)


    const updatedDataState = {
      ...dataState,
      fosData: undoneFosData,
      undoStack: newUndoStack,
      redoStack: redoDiff ? [redoDiff, ...dataState.redoStack] : dataState.redoStack
    };

    // console.log('undo', deepClone(undoneFosData), lastDiff, dataState.fosData, updatedDataState.fosData)

    setDataState((prevDataState) => {
      if (_.isEqual(prevDataState.fosData,updatedDataState.fosData)) {
        return prevDataState;
      }
      return updatedDataState
    });
  };

  const redo = () => {


    const [redoDiff, ...newRedoStack] = dataState.redoStack

    if (!redoDiff ) {
      throw new Error('!redoDiff');
    }
  
    const redoneFosData = patch({
      left: deepClone(dataState.fosData), 
      delta: redoDiff
    })

    const undoDiff = diff({
      left: redoneFosData,
      right: dataState.fosData
    })
    
    const newDataState = {
      ...redoneFosData,
      redoStack: newRedoStack,
      undoStack: undoDiff ? [undoDiff, ...dataState.undoStack] : dataState.undoStack
    };
  
    setDataState((prevDataState) => {
      if (_.isEqual(prevDataState.fosData,newDataState.fosData)) {
        return prevDataState;
      }
      return newDataState
      });
  };

 
 
  const setAppData = React.useCallback(async (newFosData: AppData) => {
    console.log("setAppData", newFosData)

    setDataState((prevDataState) => {

      const difference = diff({ left: prevDataState.fosData, right: newFosData });
      console.log('prevDataState', difference, prevDataState.fosData, newFosData)
      return {
        ...prevDataState,
        fosData: newFosData,
        synced: false,
        stored: false,
        redoStack: difference ? [] : prevDataState.redoStack,
        undoStack: difference ? [difference, ...prevDataState.undoStack] : prevDataState.undoStack
      };
    });
  }, [dataState]);


  const exposedData : DataState = React.useMemo(() => {
    // console.log('dataState', dataState, initialDataState,'apidatastate', apiDataState)
    // console.log('exposedData', dataState)
    checkDataFormat(dataState?.fosData)
    // console.log('exposedData', dataState)
    return dataState 
  } , [dataState])

  // console.log('useDataState', appState)


  const syncAndStore = async () => {
    if (loggedIn){
      syncData(dataState);
    } else {
      storeData(dataState);
    }
    console.log('syncAndStore');
  }

  // useTraceUpdate({ dataState, exposedData })

  return { fosData: exposedData.fosData, data: exposedData , setFosData: setAppData, undo, redo, canUndo, canRedo, syncAndStore, checkDataFormat }  as const
}




const checkDataFormat = (data: AppData) => {

  if (!data){
    throw new Error('!data')
  }

  if ((data as any)?.data){
    throw new Error('data.data')
  }

  if (!(data as any)?.nodes){
    console.log('data', data)
    throw new Error('no data.nodes')
  }

  const hasRoot = Object.keys(data.nodes).some(key => {
    const content = data.nodes[key]?.content
    return content && content.some(([type, id]) => {
      return type === 'task'
  })
  })

  if (!hasRoot){
    console.log('data', data, data.nodes)
    throw new Error('no node root')
  }

}
