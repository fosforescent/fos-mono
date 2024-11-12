import * as React from 'react'
import { useTraceUpdate } from '../trace-update'
import { useWindowSize } from '../window-size'

import { AppData, AppState, SubscriptionInfo, DataState, initialDataState } from './index'
import { FosContextData  } from '@/react-client'

import { diff, patch, Delta } from '@n1ru4l/json-patch-plus'
import { useDebouncedApiState } from './debouncedApiState'
import { useDebouncedLocalStorageState } from './debouncedLocalStorageState'

import * as _ from 'lodash'

const deepClone = <T>(obj: T) => JSON.parse(JSON.stringify(obj));


export const useDataState = ({
  data: apiAppData,
  setData: setApiDataState,
  loggedIn
} : {
  data: AppData,
  setData: (newData: FosContextData) => Promise<FosContextData>,
  loggedIn: boolean
}) => {


  // console.log('apiDataState2',  apiAppData?.fosData, apiAppData?.trellisData)


  const [dataState, setDataStateRaw] = React.useState<DataState>({
    ...initialDataState,
    appData: {
      ...initialDataState.appData,
      fosData: apiAppData?.fosData || initialDataState.appData.fosData
    }
  })

  const dataStateBuffered = useDeepCompareMemoize(dataState)

  const setDataState = React.useCallback((newData: DataState | ( (prevData: DataState) => DataState)) => {
    console.log('setDataState', newData)
    if (typeof newData === 'function'){
      
      const result = newData(dataState)
      if (_.isEqual(dataState.appData, result.appData)) {
        return
      } else {
        console.log('setDataState', result)
        checkDataFormat(result.appData.fosData)
        setDataStateRaw({
          ...result,
          synced: false,
          stored: false
        })
      }
    } else {
      
      if (_.isEqual(dataState.appData, newData.appData)) {
        return 
      } else {
        console.log('setDataState', newData)
        checkDataFormat(newData.appData.fosData)
        setDataStateRaw({
          ...newData,
          synced: false,
          stored: false
        })
      }

    }
  }, [dataState])


  // React.useEffect(() => {
  //   console.log('dataStateBuffered', dataStateBuffered)
  // }, [dataStateBuffered])

  // React.useEffect(() => {
  //   console.log('dataState', dataState)
  // }, [dataState])


  
  const { storeData }  = useDebouncedLocalStorageState({
    data: dataStateBuffered,
    setData: setDataStateRaw,
  })

  const formatDataAndSendToApi = async (currentAppData: AppData) => {
    const fosResult = await setApiDataState(currentAppData.fosData)
    const fullResult: AppData = {
      ...currentAppData,
      fosData: fosResult
    }
    return fullResult
  }

  const { syncData } = useDebouncedApiState({
    apiData: apiAppData,
    setApiData: formatDataAndSendToApi,
    appData: dataStateBuffered,
    setAppData: setDataStateRaw,
    loggedIn
  })

  const canUndo = dataState?.undoStack?.length > 0
  const canRedo = dataState?.redoStack?.length > 0


  const undo = React.useCallback(() => {


    const [lastDiff, ...newUndoStack] = dataState.undoStack
  
    if (!lastDiff) {
      throw new Error('!lastDiff');
    }
  

    const undoneFosData = patch({
      left: deepClone(dataState.appData), 
      delta: lastDiff
    })

    const redoDiff = diff({
      left: undoneFosData,
      right: dataState.appData
    })

    // console.log('redoDiff', redoDiff, lastDiff, dataState.fosData, undoneFosData)


    const updatedDataState: DataState = {
      ...dataState,
      appData: undoneFosData,
      undoStack: newUndoStack,
      redoStack: redoDiff ? [redoDiff, ...dataState.redoStack] : dataState.redoStack
    };

    // console.log('undo', deepClone(undoneFosData), lastDiff, dataState.fosData, updatedDataState.fosData)

    setDataState((prevDataState) => {
      if (_.isEqual(prevDataState.appData,updatedDataState.appData)) {
        return prevDataState;
      }
      return updatedDataState
    });
  }, [dataState]);

  const redo = React.useCallback(() => {


    const [redoDiff, ...newRedoStack] = dataState.redoStack

    if (!redoDiff ) {
      throw new Error('!redoDiff');
    }
  
    const redoneFosData = patch({
      left: deepClone(dataState.appData), 
      delta: redoDiff
    })

    const undoDiff = diff({
      left: redoneFosData,
      right: dataState.appData
    })
    
    const newDataState: DataState = {
      ...redoneFosData,
      redoStack: newRedoStack,
      undoStack: undoDiff ? [undoDiff, ...dataState.undoStack] : dataState.undoStack
    };
  
    setDataState((prevDataState) => {
      if (_.isEqual(prevDataState.appData,newDataState.appData)) {
        return prevDataState;
      }
      return newDataState
      });
  }, [dataState]);

 
 
  const setAppData = React.useCallback(async (newData: AppData) => {
    console.log("setAppData", newData)

    setDataState((prevDataState: DataState) => {

      const difference = diff({ left: prevDataState.appData, right: newData });
      console.log('prevDataState', difference, prevDataState.appData.fosData, newData)
      return {
        ...prevDataState,
        fosData: newData.fosData,
        synced: false,
        stored: false,
        redoStack: difference ? [] : prevDataState.redoStack,
        undoStack: difference ? [difference, ...prevDataState.undoStack] : prevDataState.undoStack
      };
    });
  }, [dataState]);


  const exposedData : DataState = React.useMemo(() => {
    // console.log('dataState', dataState, initialDataState,'apidatastate', apiDataState)
    console.log('exposedData', dataState)
    checkDataFormat(dataState.appData.fosData)
    // console.log('exposedData', dataState)
    return dataStateBuffered 
  } , [dataStateBuffered])

  // console.log('useDataState', appState)


  const syncAndStore = React.useCallback(async () => {
    if (loggedIn){
      syncData(dataState);
    } else {
      storeData(dataState);
    }
    console.log('syncAndStore');
  }, [dataState, loggedIn, syncData, storeData])


  return { fosData: exposedData.appData, data: exposedData , setFosData: setAppData, undo, redo, canUndo, canRedo, syncAndStore, checkDataFormat }  as const
}




const checkDataFormat = (data: FosContextData) => {

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
      return type === 'workflow'
  })
  })

  if (!hasRoot){
    console.log('data', data, data.nodes)
    throw new Error('no node root')
  }

}

const isEqual = (a: any, b: any) => {
  // console.log('isEqual', a == b, a === b, diff({ left: a, right: b }),  a, b)
  const noDiff = !diff({ left: a, right: b })
  console.log('isEqual', noDiff, a, b)
  return !diff({ left: a, right: b })
}


// eslint-disable-next-line @typescript-eslint/ban-types
const useDeepCompareMemoize = <T extends {}>(value: T): T => {
  const ref = React.useRef<T | undefined>();
  if (!ref.current) ref.current = value
  if (!isEqual(value, ref.current)) {
    console.log('data update - A', value, ref.current)
    ref.current = value;
    console.log('data update - B', value, ref.current)
    // throw new Error('data update')
  }
  return ref.current;
};

