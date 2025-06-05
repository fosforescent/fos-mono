

/**
 * 
 * Class - singleton?
 * - listens to events from all peers
 *   - where do peers come from?
 *      - immutable data within mutable node?
 * - sends event to all peers if no local workers
 *   - how to prevent concurrency issues? 
 *      - distributed locking mechanism
 *         - somehow pass lock along with message?
 *         - pass locking function? 
 *           - small proof of work/stake/etc to acquire lock?
 *   - when message is sent to mutable address, adds it as expr and mutates it
 *   - add expr ["instruction pattern", "[ send to <sender>, arg?" ]?
 *   - 
 * 
 * 
 * 
 * - subscribe to events from various remote peers
 *   - webrtc
 *   - websocket
 *   - http server
 * 
 * 
 * - have queue
 * - if events are encoded with our node key, decode message, append to queue
 * - otherwise, store in cache in case someone requests it
 * - if event is sent to CID channel, set up expression, record sender (+ path), reply with rewritten node
 *   - if CID is not known -> request cid from remote peers
 * - if event is sent to remote addr -> broadcast encoded message
 *   - if event is sent to local addr -> broadcast encoded message?
 *      - as temporary measure
 *   - set up local addr as relay to path (parent path?)
 *      - when we receive a message to the local addr, we substitute result into path (append to path?)
 * 
 * basic flow: 
 * - ui event (add / remove row etc)
 *   - reference to path & address
 * - execute event
 *   - reference to path & address
 *   - execute based on path expr -> eval it
 * - remote client update
 *   - reference to path & address sent to server
 *     - along with updated path & new nodes
 *   - server updates
 *     - store or merge
 *     - broadcast to other clients
 *     - updates node at address:path
 *   - our client updates
 *     - store or merge
 *     - broadcast to other clients
 *     - updates node at address:path
 * 
 * 
 * relationship to users/groups: 
 *   - channels act on behalf of users/groups
 *     - users/groups add channels as peers?
 *     - channels/agents provide all rewrite rules
 *     - agents can add clients as peers 
 *       - eval logic
 *       - UI/IO
 *       - storage
 *       - 
 *   - OR - channels add users/groups as peers?
 *     - users/groups do change state of channel... and trigger things to happen in channel
 *       - these are clients actually?
 *   - OR - both?
 * 
 * ?????????????????????
 * 
 * Channel is just transport layer wrapper around store
 * - store holds keys & signs
 * - channel accepts peers through various transport layers
 *   - determines if message is for this
 *   - attempts to read message with store key & responds appropriately if read
 * 
 * 
 * Store is mutable reference / UUID thing
 * - serialized as linked list of previous stores
 * - requires
 * - can provide content for CID's? (only if ID service - done through ID-based expr... requires interpreter)
 * - 
 * 
 * Make store lighter weight -- spin up different "specialist" stores
 * - storageStore -> just does ID (address = cid of ID?)
 *   - broadcast new nodes when created
 * - workerStore -> just runs expressions?
 * - 
 * 
 * 
 * 
 */

import { FosNode } from "./node";
import { FosStore } from "./store";



export class Channel {


    messages: FosNode[] = []

    constructor(public address: string) {
        new FosStore()

    }

    async run() {

    }

    recieve() {

    }

    listenHttp() {

    }

    receiveDomEvent() {

    }

    receiveWebRtc() {

    }

    send() {

    }




}