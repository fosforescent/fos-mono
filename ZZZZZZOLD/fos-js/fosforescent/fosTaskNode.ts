/* eslint-disable */

import { FosNodeContent, FosContextData, FosRoute, FosTrail, FosNodesData, FosPath, SelectionPath,  FosNodeId } from './temp-types'
import { FosPeer, IFosPeer } from './fosPeer'
import { FosNodeBase } from './fosNodeBase'

import _ from 'lodash'


export class FosTaskNode extends FosNodeBase {

  activeOptionIndex: number | null = null
  activeRowIndex: number | null = null

  constructor(context: FosContextData, parent: FosNodeBase | null, id: FosNodeId) {
    super(context, parent, id, "workflow")
  }
 


  addOptionToNode(nodeOptionData?: FosNodeContent, index?: number) {
    // add parent node of type option
  }


}




