/* eslint-disable */

import { FosNodeBase } from "./fosNodeBase";
import { FosContextData } from "./temp-types";

export interface IFosPeer {
  pushToPeer: (data: FosContextData) => Promise<void>;
  pullFromPeer: () => Promise<FosContextData | undefined>;
}



type FosPeerData = {
  pushToRemote: (data: FosContextData) => Promise<void>
  pullFromRemote: () => Promise<FosContextData | undefined>
  pushCondition: (data: FosContextData) => Promise<boolean>
  pullCondition: (data: FosContextData) => Promise<boolean>
  data: FosContextData | undefined
  mergeData: (newData: FosContextData, baseData: FosContextData) => FosContextData
}


export class FosPeer implements IFosPeer{

  values: Omit<FosPeerData, "data">
  data: FosContextData | undefined

  constructor({
    pushToRemote,
    pullFromRemote,
    pushCondition,
    pullCondition,
    data = undefined,
    mergeData
  }: FosPeerData
  ) {
    this.values = {
      pushToRemote,
      pullFromRemote,
      pushCondition,
      pullCondition,
      mergeData
    }
    // console.log("CONSTRUCTING PEER", data)
    if (data) {
      if (Object.keys(data as FosContextData).length > 100) {
        throw new Error("Data too large to save to peer")
      }
    }
    this.data = data
  }


  async pushToPeer(data: FosContextData) {
    // console.log("Pushing to Peer", data, "thisdata", this.data)

    if (this.data){
      if (Object.keys(this.data as FosContextData).length > 60) {
        throw new Error("Data too large to push to peer")
      }  
      this.data = this.values.mergeData(this.data, data)
    } else {
      this.data = data;
    }
    if (await this.values.pushCondition(this.data)) {
      return await this.values.pushToRemote(this.data);
    }
  }

  async pullFromPeer() {
    // console.log("Pulling from Peer", "thisdata", this.data)
    const doPull = this.data ? await this.values.pullCondition(this.data) : true
    if (doPull) {
      const data = await this.values.pullFromRemote();
      // console.log("Pulled from Peer", data, "thisdata", this.data)
      this.data = data;
      return data;
    }
    // console.log("Didn't pull thisdata", this.data)
  }


  static fromContextData(data: FosContextData){
    const pushToRemote = async (newData: FosContextData) => {
      throw new Error("Pushing to Remote for static peer")
    }
    const pullFromRemote = async () => { return data }
    const pushCondition = async (newData: FosContextData) => { return false }
    const pullCondition = async (newData: FosContextData) => { return true }
    const mergeData = (newData: FosContextData, baseData: FosContextData) => { return newData }
    const newPeer = new FosPeer({
      pushToRemote,
      pullFromRemote,
      pushCondition,
      pullCondition,
      data,
      mergeData
    })
    return newPeer
  }

  getRootNode(){

    if (!this.data) {
      throw new Error("No data found in peer")
    }

    const rootElem = this.data?.trail?.[0]
    if (!rootElem) {
      throw new Error("No root element found in peer")
    }


    const peerRoot = new FosNodeBase(this.data, null, rootElem[1], rootElem[0])
    return peerRoot
  }

}