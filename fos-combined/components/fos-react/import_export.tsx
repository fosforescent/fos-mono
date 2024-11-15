import React, { useState, useRef } from 'react';
import { ArrowUpToLine, ArrowDownToLine, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppState, FosContextData, FosDataContent, FosNodeContent, FosNodesData, FosReactOptions, FosRoute } from '../../types';

const ResourceComponent = ({ 
  data,
  setData,
  options,
  nodeRoute,
  ...props
} : {
  options: FosReactOptions
  data: AppState
  nodeRoute: FosRoute
  setData: (state: AppState) => void
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportHref, setExportHref] = useState<string | null>(null); // State to hold the download link
 
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file){
        throw new Error('File not found')
      }
      handleFileUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file){
        throw new Error('File not found')
      }
      handleFileUpload(file);
    }
  };

  const handleFileUpload = (file: File) => {
    let progress = 0;
    //import node
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        // Here you would typically handle the actual file upload
        options.toast && options.toast({
          title: 'File uploaded',
          description: file.name,
          duration: 5000,
        });
        setUploadProgress(0);
        console.log('File uploaded:', file.name);
      }
    }, 200);
  };


  const createExportFile = () => {
    //export node
    const jsonString = node.fosNode().serialize();

    const blob = new Blob([jsonString || ""], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    setExportHref(url);
  };

  React.useEffect(() => {
    createExportFile();
    return () => {
      if (exportHref) {
        URL.revokeObjectURL(exportHref);
      }
    };
  }, []);


  return (
    <div className="flex flex-row items-center justify-around w-full">
      <div className="flex items-center justify-center mr-3">
        <a href={exportHref || ""} download={`node_${node.getId()}.json`}>
          <Button disabled={!exportHref} >
            <ArrowDownToLine className="mr-2" />
            Export
          </Button>
        </a>
      </div>
      {uploadProgress === 0 && <div 
        className={`w-full p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
          isDragging ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="mx-auto flex items-center justify-center" >
          <ArrowUpToLine/> Drag and drop, or click to select</div>
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          onChange={handleFileChange}
          accept=".json"
        />
      </div>}
      {uploadProgress > 0 && (
        <div className="w-full mt-4">
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-center mt-2">{uploadProgress}% uploaded</p>
        </div>
      )}

    </div>
  );
};


const fosModule = {
  icon: <FileJson />,
  name: 'import_export',
  HeadComponent: ResourceComponent,
  // RowComponent: CostRowComponent,
}

export default fosModule




export const exportNode = (nodeRoute: FosPath): FosContextData => {

  // should I export all nodes referenced?  Just the child nodes? 
  // should I convert any to read-only/content-addressed?  Or just leave them linked?


  const nodeData = node.fosNode().serializeData()


  return nodeData
}

export const importNode = (data: FosContextData, nodeRoute: FosPath, initialContextData: FosContextData): FosContextData => {
  
  // should we do it by the reference, or by the current operator?
  // should we require that it be an option node? 
  // if option node, just add as alternative
  // if not, must do merge operation?



  const staticDataPeer = new FosPeer({
    data: {
      nodes: data.nodes,
      trail: initialContextData.trail,
      focus: initialContextData.focus,
    },
    pushToRemote: async () => {},
    pullFromRemote: async () => ({
      nodes: data.nodes,
      trail: initialContextData.trail,
      focus: initialContextData.focus,
    }),
    pushCondition: async () => false,
    pullCondition: async () => true,
    mergeData: (newData: FosContextData, baseData: FosContextData) => {
      // things to deal with:
      // we want to keep updates to existing nodes
      // (take newer timestamp, or do hash chains?)
      // (hash chains are per ailias, not content addressing)?
      // Should we change data structure to have content addressing + alias map? 
      // 
      const newContext = mergeNode(fosNode.getId(), baseData, fosNode.getId(), newData)
      return newContext


    }
  })

  const fosNode = node.fosNode()

  fosNode.addPeer(staticDataPeer)

  fosNode.pullFromPeer(staticDataPeer)

  const newContextData = fosNode.serializeData()
 

  return {
    nodes: {
      ...initialContextData.nodes,
      ...newContextData.nodes
    },
    trail: initialContextData.trail,
    focus: initialContextData.focus,
  }


}



const getRelevantNodes = (fosData: FosContextData, depth: number) => {
  // const node = ctx.getNode(trail)
  // console.log('getRelevantNodes', node)
  const getIdsHelper = (node: string, depth: number, ids: Set<string>) => {
    // console.log('getIdsHelper', trail, depth, ids)
    if (depth === 0){
      ids.add(node)
      return ids
    } else {
      const children = fosData.nodes[node]?.content
      
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

  const rootId = getRootId(fosData)
  const relevantNodeIds = getIdsHelper(rootId, depth || 1, new Set<string>())

  console.log('relevantNodeIds', relevantNodeIds, rootId, fosData)
  if (relevantNodeIds.size === 0){
    throw new Error('no relevantNodeIds')
  }

  const relevantNodes = [...relevantNodeIds].reduce((acc, id) => {
    const result = fosData.nodes[id]
    if (!result){
      throw new Error('no result')
    }
    return {...acc, [id] : result }
  }, {})
  return relevantNodes

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
  if (!data.route){
    throw new Error('!data.trail')
  }
  const rootElem = data.route?.[0]

  if (!rootElem){

    throw new Error('!rootElem')
  }

  return rootElem[1]

}



const mergeContextsAtNode = (oldData: FosContextData, newData: FosContextData): FosContextData => {
      
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
