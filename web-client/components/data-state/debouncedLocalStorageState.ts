import * as React from 'react'
import { useTraceUpdate } from '../trace-update'
import { useWindowSize } from '../window-size'

import { AppData, AppState, SubscriptionInfo, DataState, initialDataState} from './index'
import {FosContextData,  } from '@fosforescent/react-client'

import { diff, patch, Delta } from '@n1ru4l/json-patch-plus'

import * as _ from 'lodash'


export const useDebouncedLocalStorageState = ({
  data: appData,
  setData: setAppData,
} : {
  data: DataState,
  setData: (newData: DataState | ( (prevData: DataState) => DataState)) => void,
}) => {

 
  const [storeTimeout, setStoreTimeout] = React.useState<any | undefined>()


  const storedData = React.useMemo(() => {
    const storedData = JSON.parse(localStorage.getItem("data") || "{}") as DataState
    return storedData
  }, [appData])


  React.useEffect(() => {
    console.log('dataState--tiemout', appData.stored, storeTimeout, appData)
    if (storeTimeout && appData.stored){
      clearTimeout(storeTimeout)
    }

    if(!appData.stored){
      console.log('setting timeout')
      const timeout = setTimeout(() => setStoreTimeout(undefined), 900)
      setStoreTimeout(timeout)
      return () => clearTimeout(timeout)
    }
  }, [appData.stored])



  React.useEffect(() => {
    const isDifferent = !_.isEqual(storedData.fosData, appData.fosData)
    // console.log('here3')
    if (isDifferent){
      setAppData((prevDataState) => {
        return {
          ...prevDataState,
          fosData: appData.fosData,
          synced: false,
          stored: true,
        };
      });
    }

  }, [appData])



  React.useEffect(() => {
    if(!storeTimeout){
      storeData(appData)
    }
  }, [storeTimeout])



  const storeData = (newDataState: DataState) => {

    localStorage.setItem("data", JSON.stringify(newDataState)) 

  }



  return { storeData }  as const
}

