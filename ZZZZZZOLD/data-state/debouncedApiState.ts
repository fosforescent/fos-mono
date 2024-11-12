import * as React from 'react'
import { useTraceUpdate } from '../trace-update'
import { useWindowSize } from '../window-size'

import { AppData, AppState, SubscriptionInfo, DataState, initialDataState} from './index'
import { FosContextData, FosNodesData } from '@/react-client'

import { diff, patch, Delta } from '@n1ru4l/json-patch-plus'

import * as _ from 'lodash'




const deepClone = <T>(obj: T) => JSON.parse(JSON.stringify(obj));



export const handleDataError = (dataState: DataState, setFetching: (fetching: boolean) => void) => (error: Error) => {


  if (error.cause === 'unauthorized'){
    const returnVal: DataState = { 
      ...dataState, 
      synced: false,
      locked: false 
    }
  }
  // setInfoState({ synced: false, profile: {...infoState, ...newUserInfo } })
  setFetching(false)
  throw error
}


export const handleDataChange = (oldDataState: DataState) => {

  // console.log('handleDataChange', appData)

  return (newDataState: DataState): DataState => {

    if (dataIsEmpty(newDataState.appData.fosData) && dataIsEmpty(oldDataState.appData.fosData)){
      console.log('handleDataChange --- all Empty', newDataState)
        const updatedDataState = {
          appData: initialDataState.appData,
          synced: true,
          stored: true,
          locked: false,
          lastSyncTime: oldDataState.lastSyncTime,
          lastStoreTime: oldDataState.lastStoreTime,
          undoStack: oldDataState.undoStack,
          redoStack: oldDataState.redoStack
        }
        localStorage.setItem("data", JSON.stringify(newDataState))
        return updatedDataState  
    } else if (dataIsEmpty(newDataState.appData.fosData)){
      console.log('handleDataChange --- new is Empty', newDataState)

      return oldDataState

    } else if (dataIsEmpty(oldDataState.appData.fosData)){
      console.log('handleDataChange --- old is Empty', newDataState)

      const updatedDataState = {
        appData: {
          ...oldDataState.appData,
          fosData: newDataState.appData.fosData
        },
        synced: true,
        stored: true,
        locked: false,
        lastSyncTime: newDataState.lastSyncTime,
        lastStoreTime: newDataState.lastStoreTime,
        undoStack: oldDataState.undoStack,
        redoStack: oldDataState.redoStack
      }
      return updatedDataState
    } else {

        
      const mergedData = mergeContexts(oldDataState.appData.fosData, newDataState.appData.fosData)
      console.log('handleDataChange --- Merging', mergedData)

      
      checkDataFormat(mergedData)


      const mergedDataState = {
          appData: {
            fosData: mergedData,
            trellisData: oldDataState.appData.trellisData
          },
          synced: true,
          stored: true,
          locked: false,
          lastSyncTime: newDataState.lastSyncTime,
          lastStoreTime: newDataState.lastStoreTime,
          undoStack: oldDataState.undoStack,
          redoStack: oldDataState.redoStack
      }
      localStorage.setItem("data", JSON.stringify(mergedDataState))

      return mergedDataState
    }

  }
}


export const useDebouncedApiState = ({
  apiData, 
  setApiData,
  appData,
  setAppData,
  loggedIn
} : {
  apiData: AppData,
  setApiData: (data: AppData) => Promise<AppData>,
  appData: DataState,
  setAppData: (data: DataState) => void,
  loggedIn: boolean
}) => {

 


  // console.log('apiDataState -- apiState', apiData, loggedIn)




  const [syncTimeout, setSyncTimeout] = React.useState<any | undefined>()

  const [fetching, setFetching] = React.useState(false)

  React.useEffect(() => {

    if (_.isEqual(apiData, appData.appData.fosData)){
      return
    }

    const newDataState = {
      appData: {
        fosData: {
          ...appData.appData.fosData,
          nodes: {
            ...appData.appData.fosData.nodes,
            ...(apiData?.fosData?.nodes || {}),
          }
        },
        trellisData: appData.appData.trellisData
      },
      synced: true,
      stored: true,
      locked: false,
      lastSyncTime: appData.lastSyncTime,
      lastStoreTime: appData.lastStoreTime,
      undoStack: appData.undoStack,
      redoStack: appData.redoStack
    }

    setAppData(newDataState)
  }, [apiData])


  React.useEffect(() => {
    // console.log('useDebouncedApiState', loggedIn, apiData, fetching)
    if (loggedIn && !apiData && !fetching){
      setFetching(true)
      getData()
      setFetching(false)
    }
  }, [loggedIn, apiData])


  React.useEffect(() => {
    // console.log('syncTimeout', syncTimeout, loggedIn, appData.synced, syncTimeout)
    if (!loggedIn){
      return
    }
    // console.log('syncTimeout', syncTimeout)
    if (syncTimeout){
      // console.log('clearTimeout')
      clearTimeout(syncTimeout)
    }

    if(!appData.synced){
      const timeout = setTimeout(() => { 
        setSyncTimeout(undefined); 
        // console.log('here --- timed out') 
      } , 9000)
      setSyncTimeout(timeout)
      return () => clearTimeout(timeout)
    }
  }, [appData.synced, loggedIn])



  React.useEffect(() => {
    // console.log('syncTimeout changed', syncTimeout, loggedIn, appData.synced)
    if(!syncTimeout){
      // console.log("HERE", loggedIn, appData.synced, appData)
      loggedIn && !appData.synced && syncData(appData)
    }
  }, [syncTimeout])

  const windowSize = useWindowSize()

  const rowDepth = React.useMemo(() => {
    if (windowSize.width !== undefined){
      return Math.floor( (windowSize.width - 500 )/ 100) 
      // return 1
    } else {
      return 0
    }
  }, [windowSize])


  const getRelevantNodes = (data: DataState, depth: number) => {
    // const node = ctx.getNode(trail)
    // console.log('getRelevantNodes', node)
    const getIdsHelper = (node: string, depth: number, ids: Set<string>) => {
      // console.log('getIdsHelper', trail, depth, ids)
      if (depth === 0){
        ids.add(node)
        return ids
      } else {
        const children = data.appData.fosData.nodes[node]?.content
        
        children?.forEach(([type, child]: [string, string]) => {
          // console.log('child', child)
          const descendentIds = getIdsHelper(child, depth - 1, ids)
          console.log('descendentIds', descendentIds)
          const id = child
          ids.add(id)
          descendentIds.forEach(id => ids.add(id))
        })
        ids.add(node)
        console.log('ids', ids)
        return ids
      }
    }

    const rootId = getRootId(data.appData.fosData)
    const relevantNodeIds = getIdsHelper(rootId, depth || 1, new Set<string>())

    console.log('relevantNodeIds', relevantNodeIds, rootId, data)
    if (relevantNodeIds.size === 0){
      throw new Error('no relevantNodeIds')
    }

    const relevantNodes = [...relevantNodeIds].reduce((acc, id) => {
      const result = data.appData.fosData.nodes[id]
      if (!result){
        throw new Error('no result')
      }
      return {...acc, [id] : result }
    }, {})
    return relevantNodes

  }

  const getData = React.useCallback(() => {
    if (!loggedIn){
      return
    }
       
    (async () => {   
      const newState = await setApiData({} as AppData).then((newAppData) => handleDataChange(appData)({...appData, appData: newAppData })).catch(handleDataError(appData, setFetching))
      setAppData(newState)
    })()
  }, [appData, loggedIn])

  const syncData = React.useCallback((newDataState: DataState) => {
    // console.log('syncData', newDataState, appData)
    if (!loggedIn){
      return
    }

    // console.log('here1')
    // if (_.isEqual(newDataState.fosData, appData.fosData)){

    //   console.log('here3')
    //   return 
    // }

    if (_.isEqual(newDataState.appData.fosData, apiData)){

      // console.log('here2')
      return
    }

    if (fetching){
      // console.log('here3')
      return
    }

   
    (async () => {
      console.log("here5")
      setAppData({...appData, locked: true })
      const postFosData = {
        ...newDataState.appData.fosData,
        nodes: getRelevantNodes(newDataState, rowDepth)
      }
      
      // console.log('postFosData  --- SYNC', postFosData);
      setFetching(true)
      const newState = await setApiData(appData.appData).then(() => handleDataChange(appData)).catch(handleDataError(appData, setFetching))
      setFetching(false)

      // console.log('newState --- SYNC', newState)

      // console.log("here6")
      const stateDiff = diff({left: apiData, right: newState })
      // console.log("here7")
      // const hasMergeNode = Object.keys(dataState.fosData.nodes).some(key => dataState.fosData.nodes[key]?.mergeNode)
      // console.log('hasMergeNode', hasMergeNode)
      if(stateDiff){
        setAppData({
          ...newDataState,
        })
      }
    })()
  }, [appData, apiData, fetching, rowDepth])

  
  // useTraceUpdate({  })

  return { syncData }  as const
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
      // console.log("key", key, type, id)
      return type === 'workflow'
  })
  })

  if (!hasRoot){
    console.log('data', data, data.nodes)
    throw new Error('no node root')
  }

}

const getRootId = (data: FosContextData) => {
  if (!data.trail){
    throw new Error('!data.trail')
  }
  const rootElem = data.trail?.[0]

  if (!rootElem){

    throw new Error('!rootElem')
  }

  return rootElem[1]

}

const mergeContexts = (oldData: FosContextData, newData: FosContextData): FosContextData => {
      
  const oldRootNodeId = getRootId(oldData)
  const oldRootNode = oldData.nodes[oldRootNodeId]

  const newRootNodeId = getRootId(newData)
  const newRootNode = newData.nodes[newRootNodeId]

  if (!newRootNode){
    throw new Error('!newRootNode')
  }

  if (!oldRootNode){
    checkDataFormat(newData)
    return newData
  }

  const mergedContext = mergeNode(oldRootNodeId, oldData, newRootNodeId, newData)

  return mergedContext
}


const mergeNode = (oldId: string, oldData: FosContextData, newId: string, newData: FosContextData): FosContextData => {

  const oldRootNode = oldData.nodes[oldId]

  const newRootNode = newData.nodes[newId]


  if (!newRootNode){
    console.log('oldData', oldData, newData, oldId, newId, )
    throw new Error('!newRootNode')
  }

  if (!oldRootNode){
    checkDataFormat(newData)
    return newData
  }


  const nodeIsEmpty = (context: FosContextData, id: string) => {
    const node = context.nodes[id]
    if (!node){
      throw new Error('!node')
    }
    const contentEmpty = node.content.length === 0
    const dataEmpty = !node?.data.description?.content && (Object.keys(node.data).length < 2)
    return contentEmpty && dataEmpty
  }

  const mergedRootContentOldOnly = oldRootNode.content.filter(([type, id]) => {
    const newContent = newRootNode.content.find(([newType, newId]) => newId === id && newType === type)
    return !newContent && !nodeIsEmpty(oldData, id)
  })

  const mergedRootContentNewOnly = newRootNode.content.filter(([type, id]) => {
    const oldContent = oldRootNode.content.find(([oldType, oldId]) => oldId === id && oldType === type)
    return !oldContent && !nodeIsEmpty(newData, id)
  })

  const mergedRootContentBoth = oldRootNode.content.filter(([type, id]) => {
    const newContent = newRootNode.content.find(([newType, newId]) => newId === id && newType === type)
    if (!oldData.nodes[id]){
      throw new Error('!oldData.nodes[id]')
    }
    if (!newData.nodes[id]){
      throw new Error('!newData.nodes[id]')
    }
    return !!newContent 
  })

  const mergedRootContentNewOnlyNodes: FosNodesData = mergedRootContentNewOnly.reduce((acc, [type, id]) => {
    return {
      ...acc,
      [id]: newData.nodes[id],
      ...(newData.nodes[type] || {})
    }
  }, {})

  const mergedRootContentOldOnlyNodes: FosNodesData = mergedRootContentOldOnly.reduce((acc, [type, id]) => {
    return {
      ...acc,
      [id]: oldData.nodes[id],
      ...(oldData.nodes[type] || {})
    }
  }, {})

  const mergedRootContentBothMergedContext = mergedRootContentBoth.reduce((acc, [type, id]) => {
    const oldNode = oldData.nodes[id]
    const newNode = newData.nodes[id]
    if (!oldNode){
      throw new Error('!oldNode')
    }

    if (!newNode){
      console.log('oldData', oldData, newData, oldId, newId, id, acc)
      throw new Error('!newNode')
    }

    const mergedNodeContext = mergeNode(id, oldData, id, newData)

    return {
      ...mergedNodeContext,
      nodes: {
        ...acc.nodes,
        [id]: {
          data: {
            ...oldNode.data,
            ...newNode.data
          },
          content: [
            ...oldNode.content,
            ...newNode.content
          ]
        }
      }
    }

  }, { ...newData, 
    nodes: {
      [newId]: {
        data: {
          ...oldRootNode.data,
          ...newRootNode.data
        },
        content: [
          ...mergedRootContentNewOnly,
          ...mergedRootContentBoth,
          ...mergedRootContentOldOnly,
        ]
      },
      ...mergedRootContentNewOnlyNodes,
      ...mergedRootContentOldOnlyNodes
    } 
  })
  
  return mergedRootContentBothMergedContext

}

export const dataIsEmpty = (data: FosContextData) => {
  if (!data.nodes) {
    return true
  }

  const rootNodeId = getRootId(data)
  const rootNode = data.nodes[rootNodeId]
  if (rootNode && rootNode.content.length < 2) {
    if (rootNode.data.description?.content){
      return false
    }
    return true
  } else {
    return false
  }
}
