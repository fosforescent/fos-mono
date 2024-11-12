import { AppState, FosPath, FosReactOptions } from "../types"

import { suggestOption } from "./suggestOption"
import { suggestMagic } from "./suggestMagic"
import { suggestSteps } from "./suggestSteps"
import { suggestRecursive } from "./suggestRecursive"
import { addOption } from "../components/fos-react/modules/workflow"
import { getNodeInfo } from "./utils"



export const getNodeOperations = (options: FosReactOptions, appData: AppState, setAppData: (state: AppState) => void, nodeRoute: FosPath, ) => {
    return {
        zoom: async () => {

        },
        setFocus: async (focusChar: number) => {

        },
        setDescription: async (description: string) => {
            
        },
        setFocusAndDescription: async (description: string, focusChar: number) => {
            
        },
        setSelectedOption: async ( selectedOption: string) => {
            
        },
        addRow: async () => {
        },
        deleteRow: async () => {

        },
        addOption: async () => {

        },
        getFocus: async () => {
        },
        deleteOption: async () => {
            
        },
        suggestOption: async () => {

        },
        suggestMagic: async () => {

        },
        suggestSteps: async () => {

        }, 
        suggestRecursive: async () => {

        },
        suggestOptions: async () => {
            
        },
        moveFocusDown: async () => {
                
        },
        moveFocusUp: async () => {
                    
        },
        keyUpEvents: async (event: React.KeyboardEvent<HTMLDivElement>) => {
            const { focusChar } = getNodeInfo(nodeRoute, appData)
            meta.trellisNode.keyUpEvents(e)

            // console.log('keyup', focusChar, value.length)
            if (e.key === 'Enter' && focusChar === value.length){
                this.moveFocusDown()
            }
            if (e.key === 'Backspace' && focusChar === 0){
                meta.trellisNode.moveFocusUp()
            }
            // if (e.altKey && e.ctrlKey){
            //   console.log('test', selectedIndex, node.getChildren().length );
            //   handleChange( selectedIndex ? ( (selectedIndex - 1 + (children.length)) % children.length ).toString() : "0" )
            // }
        },
        keyDownEvents: async (event: React.KeyboardEvent<HTMLDivElement>) => {

        },
        keyPressEvents: async (event: React.KeyboardEvent<HTMLDivElement>) => {

        },

    }
}

