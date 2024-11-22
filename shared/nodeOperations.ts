import { AppState, FosContextData, FosDataContent, FosNodeContent, FosNodeId, FosNodesData, FosPathElem, FosReactOptions, FosPath } from "../shared/types"

import { suggestTaskOptions } from "./suggestOption"
import { suggestStepsMagic } from "./suggestMagic"
import { suggestTaskSteps } from "./suggestSteps"
import { suggestStepsRecursive } from "./suggestRecursive"

import { getDownNode, getUpNode, pathEqual } from "./utils"

import { getExpressionInfo } from "./dag-implementation/expression"
import * as mut from "./mutations"
import { diff } from "@n1ru4l/json-patch-plus"




export const getNodeOperations = (options: FosReactOptions, appData: AppState["data"], setAppData: (state: AppState["data"]) => void, nodeRoute: FosPath, ) => {


    const { nodeType } = getExpressionInfo(nodeRoute, appData)


    const zoom =  async () => {
        // const {
        //     isCollapsedOption
        // } = getExpressionInfo(nodeRoute, appData)
        // TODO: modify zoom for collapsed options

        setAppData(mut.updateZoom(appData, nodeRoute))
    }

    const setNodeData = async (newNodeData: Partial<FosDataContent>) => {
        setAppData(mut.updateNodeData(appData, newNodeData, nodeRoute)) 
    }

    const setFocus =  async (focusChar: number) => {
        setAppData(mut.updateFocus(appData, focusChar, nodeRoute))
    }


    const snip = async () => {
        const newState = mut.snipNode(nodeRoute, appData)
        setAppData(newState)
    }
        
        


    const setDescription = async (description: string) => {
        const newState = mut.updateNodeData(appData, {description: {content: description}}, nodeRoute)
        setAppData(newState)   
    }

    const setFocusAndDescription = async (description: string, focusChar: number) => {
        const newState = mut.updateNodeData(appData, {description: {content: description}}, nodeRoute)
        const newState2 = mut.updateFocus(newState, focusChar, nodeRoute)
        setAppData(newState2)   
    }

    const setSelectedOption = async ( selectedOption: number) => {
        const { nodeData } = getExpressionInfo(nodeRoute, appData)
        const newState = mut.updateNodeData(appData, {
            option: {
                defaultResolutionStrategy: 'selected',
                ...nodeData,
                selectedIndex: selectedOption,
            }
        }, nodeRoute)
        setAppData(newState)
    }

    const addRowAsChild = async (newType: FosNodeId = nodeType) => {
        const { nodeType, nodeChildren } = getExpressionInfo(nodeRoute, appData)
        const newNodeContent: FosNodeContent = {
            data: {
                description: {
                    content: ""
                },
                option: {
                    selectedIndex: 0,
                    defaultResolutionStrategy: "selected" as "selected"
                },
                updated: {
                    time: Date.now()
                }
            },
            children: []
        }
        const { newState, childRoute }  = mut.addChild(appData, nodeRoute, newType, newNodeContent, nodeChildren.length)
        // console.log('newState', newState, diff({left: appData, right: newState}))
        const newStateWithFocus = mut.updateFocus(newState, 0, childRoute)
        console.log('newStateWithFocus', newStateWithFocus)
        setAppData(newStateWithFocus)
    }

    const deleteRow = async () => {
        const newState = mut.removeNode(appData, nodeRoute)
        setAppData(newState)
    }
    const addOption = async () => {
        
        const {  nodeData, nodeType, nodeContent, nodeId, nodeChildren, getParentInfo, isRoot, getOptionInfo, isOption } = getExpressionInfo(nodeRoute, appData)
        if (isRoot){
            throw new Error('Cannot add option to root node')
        } else if (isOption) {
            const { selectedIndex, selectedChildRoute } = getOptionInfo()
            const { 
                newId, 
                newState
            } = mut.cloneNode(appData, selectedChildRoute)
            const newRows: FosPathElem[] = [
                ...nodeContent.children.slice(0, selectedIndex), 
                [nodeType, newId], 
                ...nodeContent.children.slice(selectedIndex)
            ]
            const newNodeContent = {
                data: nodeData, 
                children: newRows
            }
            const newState2 = mut.updateNodeContent(newState, newNodeContent, nodeRoute)
            const cloneRoute: FosPath = [...nodeRoute, [nodeType, newId]]
            const newStateWithFocus = mut.updateFocus(newState2, 0, cloneRoute)
            setAppData(newStateWithFocus)
        } else {
            // add option node to parent, put current node under it, and add new option
            const { nodeData: parentData, nodeContent: parentContent, nodeChildren: parentChildren, indexInParent, nodeRoute: parentRoute } = getParentInfo()
            const { newId, newState: stateWithClone } = mut.cloneNode(appData, nodeRoute)
            const newOptionNodeChildren: FosNodeContent['children'] = [[nodeType, nodeId], [nodeType, newId]]
            const newOptionNodeContent: FosNodeContent = {
                data: {
                    description: {
                        content: `Choose method for ${nodeData.description?.content}`
                    },
                    option: {
                        selectedIndex: 1,
                        defaultResolutionStrategy: "selected"
                    }
                },
                children: newOptionNodeChildren
            }
            const { newState: stateWithNewOption, childRoute }  = mut.addChild(stateWithClone, parentRoute, 'option', newOptionNodeContent, parentChildren.length)

            const newStateWithFocus = mut.updateFocus(stateWithNewOption, 0, childRoute)
            setAppData(newStateWithFocus)

        }

    }

    const deleteOption = async () => {
        const { nodeData, nodeContent, nodeChildren, getParentInfo, isRoot, getOptionInfo, isOption, childRoutes } = getExpressionInfo(nodeRoute, appData)
        if (isRoot){
            throw new Error('Cannot delete option from root node')
        } else if (isOption) {
            if (nodeContent.children.length < 2){
                throw new Error('Should not have less than 2 options')
            } else if (nodeContent.children.length === 2){
                // delete option node and replace with remaining child
                const { nodeData: parentData, nodeContent: parentContent, nodeChildren: parentChildren, indexInParent, nodeRoute: parentRoute } = getParentInfo()
                const { selectedIndex, selectedChildRoute, nodeOptions } = getOptionInfo()
                const remainingChildElems = nodeChildren.slice(0, selectedIndex).concat(nodeChildren.slice(selectedIndex + 1)) 

                const newParentNodeContent: FosNodeContent = {
                    ...parentContent,
                    children: parentChildren.slice(0, indexInParent).concat(remainingChildElems).concat(parentChildren.slice(indexInParent + 1))
                }
                const newStateWithUpdatedParent = mut.updateNodeContent(appData, newParentNodeContent, parentRoute)

                const childPathElem = remainingChildElems[0]
                if (!childPathElem){
                    throw new Error('childPathElem not found')
                }
                const focusRoute: FosPath = [...parentRoute, childPathElem]
                const newStateWithFocus = mut.updateFocus(newStateWithUpdatedParent, 0, focusRoute)
                setAppData(newStateWithFocus)

            }
            const { selectedIndex, selectedChildRoute } = getOptionInfo()
            const newRows: FosPathElem[] = [
                ...nodeContent.children.slice(0, selectedIndex), 
                ...nodeContent.children.slice(selectedIndex + 1)
            ]
            const newNodeContent = {
                data: nodeData, 
                children: newRows
            }
            const newState = mut.updateNodeContent(appData, newNodeContent, nodeRoute)
            setAppData(newState)
        } else {
            throw new Error('Cannot delete option from non-option node')
        }    
    }
        const suggestOption = async () => {
            const newState = await suggestTaskOptions(options, nodeRoute, appData)
            setAppData(newState)

        }
        const suggestMagic = async () => {
            const newState = await suggestStepsMagic(options, nodeRoute, appData)
            setAppData(newState)
        }

        const suggestSteps = async () => {
            const newState = await suggestTaskSteps(options, nodeRoute, appData)
            setAppData(newState)
        } 

        const suggestRecursive = async <S, T>(promptOptions : {
            pattern: RegExp,
            parsePattern: (appData: AppState["data"], nodeRoute: FosPath, response: string) => S,
            systemPromptBase: string,
            getUserPromptBase: (appData: AppState["data"], nodeRoute: FosPath, nodeDescription: string, parentDescriptions: string[]) => string,
            systemPromptRecursive: string,
            getUserPromptRecursive: (appData: AppState["data"], nodeRoute: FosPath, nodeDescription: string, parentDescriptions: string[]) => string,
            getResourceInfo: (appData: AppState["data"], nodeRoute: FosPath) => T,
            updateResourceInfo: (appData: AppState["data"], nodeRoute: FosPath,  resourceInfo: S) => AppState["data"],
            checkResourceInfo: (appData: AppState["data"], nodeRoute: FosPath) => boolean
          }) => {

            


            const newState = await suggestStepsRecursive(options, nodeRoute, appData, promptOptions)
            setAppData(newState)

        }

        const toggleCollapse = async () => {
            const { isCollapsed } = getExpressionInfo(nodeRoute, appData)

            const newCollapsedList = isCollapsed 
                ? appData.trellisData.collapsedList.filter((route: FosPath) => !pathEqual(route, nodeRoute)) 
                : [...appData.trellisData.collapsedList, nodeRoute]

            const newState = {
                ...appData,
                data: {
                    ...appData,
                    trellisData: {
                        ...appData.trellisData,
                        collapsedList: newCollapsedList
                    }
                }
            }
            setAppData(newState)
        }

        const toggleOptionChildCollapse = async () => {
            const { getOptionInfo } = getExpressionInfo(nodeRoute, appData)
            const { isOptionChildCollapsed, selectedChildRoute } = getOptionInfo()
            
            const newCollapsedList = isOptionChildCollapsed 
                ? appData.trellisData.collapsedList.filter((route: FosPath) => !pathEqual(route, nodeRoute)) 
                : [...appData.trellisData.collapsedList, selectedChildRoute]

            const newState = {
                ...appData,
                data: {
                    ...appData,
                    trellisData: {
                        ...appData.trellisData,
                        collapsedList: newCollapsedList
                    }
                }
            }
            setAppData(newState)
        }


        const setSelectedIndex = async (selectedIndex: number) => {

          const { nodeData } = getExpressionInfo(nodeRoute, appData)
          const newState = mut.updateNodeData(appData, {
              option: {
                defaultResolutionStrategy: "selected",
                ...(nodeData.option || {}),
                selectedIndex
              }
          }, nodeRoute)
          setAppData(newState)
        }

        const moveFocusDown = async () => {
            const { focusChar, nodeDescription } = getExpressionInfo(nodeRoute, appData)
            console.log(appData.trellisData)
            const downNodeRoute = getDownNode(nodeRoute, appData)
            if (downNodeRoute){
                const newState = mut.updateFocus(appData, focusChar || 0, downNodeRoute)
                setAppData(newState)
            }
        }
        const moveFocusUp = async () => {
            const { focusChar, nodeDescription } = getExpressionInfo(nodeRoute, appData)
            console.log(appData.trellisData)
            const upNodeRoute = getUpNode(nodeRoute, appData)
            if (upNodeRoute){
                const newState = mut.updateFocus(appData, focusChar || 0, upNodeRoute)
                setAppData(newState)
            }
        }

        const moveFocusToEnd = async () => {
            const { nodeDescription } = getExpressionInfo(nodeRoute, appData)
            setFocus(nodeDescription.length - 1)
        }

        const moveFocusToStart = async () => {
            setFocus(0)
        }

        const moveLeft = async () => {
            const focusChar = appData.trellisData.focusChar || 0
            const { newState, newRoute } = mut.moveLeft(appData, nodeRoute)
            const newStateWithFocus = mut.updateFocus(newState, focusChar, newRoute)
            setAppData(newStateWithFocus)
        }

        const moveRight = async () => {
            const focusChar = appData.trellisData.focusChar || 0
            const { newState, newRoute } = mut.moveRight(appData, nodeRoute)
            const newStateWithFocus = mut.updateFocus(newState, focusChar, newRoute)
            console.log('newStateWithFocus', newStateWithFocus, appData)
            setAppData(newStateWithFocus)
        }
        const moveUp = async () => {
            const focusChar = appData.trellisData.focusChar || 0
            const { newState, newRoute } = mut.moveUp(appData, nodeRoute)
            const newStateWithFocus = mut.updateFocus(newState, focusChar, newRoute)
            setAppData(newStateWithFocus)
        }

        const moveDown = async () => {
            const focusChar = appData.trellisData.focusChar || 0
            const { newState, newRoute } = mut.moveDown(appData, nodeRoute)
            const newStateWithFocus = mut.updateFocus(newState, focusChar, newRoute)
            setAppData(newStateWithFocus)
        }

        const addDownSibling = async () => {
            const { nodeType, getParentInfo } = getExpressionInfo(nodeRoute, appData)
            const { indexInParent, nodeRoute: parentRoute } = getParentInfo()
            console.log('addDownSibling', nodeType, parentRoute, indexInParent)
            const { newState, childRoute } = mut.addChild(
                appData, 
                parentRoute, 
                nodeType, 
                {data: {description: {content: ""}}, children: []}, 
            indexInParent + 1)
            const newStateWithFocus = mut.updateFocus(newState, 0, childRoute)
            setAppData(newStateWithFocus)
        }

        const moveBelowRoute = async (targetRoute: FosPath) => {
            const focusChar = appData.trellisData.focusChar || 0
            const { newState, newRoute } = mut.moveNodeBelowRoute(appData, nodeRoute, targetRoute)
            const newStateWithFocus = mut.updateFocus(newState, focusChar, newRoute)
            setAppData(newStateWithFocus)

        }
        const moveAboveRoute = async (targetRoute: FosPath) => {
            const focusChar = appData.trellisData.focusChar || 0
            const { newState, newRoute } = mut.moveNodeAboveRoute(appData, nodeRoute, targetRoute)
            const newStateWithFocus = mut.updateFocus(newState, focusChar, newRoute)
            console.log('moveAboveRoute', appData, newState, newStateWithFocus)
            setAppData(newStateWithFocus)
        }

        const moveToTopChildOfRoute = async (targetRoute: FosPath) => {
            const focusChar = appData.trellisData.focusChar || 0
            const { newState, newRoute } = mut.moveNodeIntoRoute(appData, nodeRoute, targetRoute, 0)
            const newStateWithFocus = mut.updateFocus(newState, focusChar, newRoute)
            setAppData(newStateWithFocus)
            
        }

        const reorderNodeChildren = async (newOrder: number[]) => {
            const focusChar = appData.trellisData.focusChar || 0
            const newState = mut.reorderNodeChildren(appData, nodeRoute, newOrder)
            setAppData(newState)
        
        }


        const keyUpEvents = async (e: React.KeyboardEvent<HTMLDivElement>) => {
            const value = e.target
            const { focusChar, nodeDescription } = getExpressionInfo(nodeRoute, appData)


            if (e.key === 'Backspace' && focusChar === 0){
                moveFocusUp()
            }
            
            if (e.key === " ") {
                e.stopPropagation();
            }
        
            if (e.key === "Enter") {
                // console.log('trying to prevent default');
                // e.preventDefault()
                // e.stopPropagation()
                if (e.shiftKey){
                
                return
                } else {
                // console.log('addYoungerSibling - comboboxEditable', this.hasFocus(), this.getString().length, JSON.stringify(this.getString()))
                    if(focusChar === nodeDescription.length){
                        e.preventDefault()
                        addDownSibling()
                    }
                }
            }
            // console.log('keypress', e.key)
        
        
            if (e.key === "ArrowUp") {
                if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey){
        
                    moveFocusUp()
                    e.preventDefault()
                    e.stopPropagation()
                    return 
                }
                if (e.ctrlKey){
                    if (e.altKey){
                        moveUp()
                    } else {
                        moveFocusToStart()
                    }
                    e.stopPropagation();
                    return 
                }
            }
        
            
            if (e.key === "ArrowDown") {
                if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey){
                    e.preventDefault()
                    e.stopPropagation()
                    moveFocusDown()
                    return 
                }
                if (e.ctrlKey){
                    if (e.altKey){
                        moveDown()
                    } else {
                        moveFocusToEnd()
                    }
                    e.stopPropagation();
                    return;
                }
            }
        
            if (e.key === "ArrowRight"){
                if (e.altKey && e.ctrlKey){
                    console.log('moveRight - comboboxEditable', nodeDescription, nodeRoute)
                    moveRight()
                }
            }
        
            if (e.key === "ArrowLeft"){
                if (e.altKey && e.ctrlKey){
                    moveLeft()
                }
            }
        
            if (e.key === " " && e.ctrlKey){
                toggleCollapse()
            }


        }
        const keyDownEvents = async (e: React.KeyboardEvent<HTMLDivElement>) => {
            
            const { focusChar, nodeDescription, hasFocus } = getExpressionInfo(nodeRoute, appData)
            // console.log('keydown', e.key)
            if (e.key === " ") {
                e.stopPropagation();
            }
            if (e.key === 'Enter'){
                e.stopPropagation()
            }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault()
                e.stopPropagation()
            }
        
            if (e.key === "Backspace" && !nodeDescription){
                console.log('deleteRow - comboboxEditable', nodeDescription, nodeRoute)
                if (hasFocus && focusChar === 0){
                    if (!e.shiftKey){
                        snip()
                    }else{
                        deleteRow()
                    }
                }
            }
        
        }
        const keyPressEvents = async (event: React.KeyboardEvent<HTMLDivElement>) => {

        }

        const runTask = async () => {

          const { newState, newRoute } = mut.executeWorkflowAtRoute(appData, nodeRoute, [])
          
          const newStateWithFocus = mut.updateFocus(newState, 0, newRoute)

          const newStateWithChangedRootInstruction: AppState["data"] = {
              ...newStateWithFocus,
              fosData: {
                  ...newStateWithFocus.fosData,
                  route: newRoute
              }
            }
            setAppData(newStateWithChangedRootInstruction)
        }


        const addComment = async (text: string) => {


        }


        
        const setVote = async (id: string, vote: number) => {


        }


        const setApproval = async (id: string, approval: boolean) => {
         
            
        }


        const addCommit = async (branch: string, tag?: string) => {


        }


        const createBid = async (todoRoute: FosPath, bidInfo: {}) => {

        }


        const createBidRequest = async (todoRoute: FosPath, bidRequestInfo: {}) => {

        }

        const approveBid = async (bidRoute: FosPath) => {

        }

        const approveFulfillment = async (fulfillmentRoute: FosPath) => {


        }

        const approvePayment = async (paymentRoute: FosPath) => {


        }

        const createMergeRequest = async (route: FosPath) => {


        }

        const addPin = async (route: FosPath) => {

        }

        const removePin = async (route: FosPath) => {


        }
        

    return {
        zoom,
        snip,
        moveBelowRoute,
        moveAboveRoute,
        moveToTopChildOfRoute,
        runTask,
        toggleCollapse,
        toggleOptionChildCollapse,
        moveLeft,
        moveRight,
        moveUp,
        moveDown,
        addDownSibling,
        setFocus,
        setDescription,
        setFocusAndDescription,
        setSelectedOption,
        addRowAsChild,
        deleteRow,
        addOption,
        deleteOption,
        suggestOption,
        suggestMagic,
        suggestSteps,
        suggestRecursive,
        moveFocusDown,
        moveFocusUp,
        moveFocusToEnd,
        moveFocusToStart,
        keyUpEvents,
        keyDownEvents,
        keyPressEvents,
        setNodeData,
        setSelectedIndex,

    }
}

