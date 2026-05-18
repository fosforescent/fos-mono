


Goals: 
- graph store
- universal syncing
    - http
    - websockets
    - webrtc
    - tcp
- mesh
- message passing
- channels


How to pass messages as part of graph syncing: 
- nodes "query" to find messages meant for them?
- nodes broadcast messages?
- message relaying is another capability
- message sending is just triggering registered capabilities
- message forward is another capability?


How to sync graph across peers as part of primitives?
===


Capability registratino: 
- client needs "register capability" capability 



the capability is registered on the recipient/actor/registeree side as a listener of some kind wtih a type?, but on the sender/delegator/registrar side it's represented as a constructor or default argument to pass or handler for an effect type.  So then it could include the connection details... 

if those details are unknown, it could be handled via a message relaying handler that wraps up the message and asks peers to relay it so we need to write a "send" handler that knows how to do that, which will be assigned as the fallback handler, where the base case handler will use the aforementioned connection objects with connection details. 

it seems like ideally the constructor  woudl include the intended type so that the sender can determine which actions should trigger that capability



Capabilities / messages: 
- send for `addr`
- recieve for `addr`
- 


Write time, lint time, typecheck time, compile time, commit time, trigger time, eval time, complete time, archive time

Storage: 



Node A:  

- peers (network)
  - relay memberships?

- members (logical)
- memberships (logical)




Messaging: 
===
- Message takes the form of proposed new root node
  - push
  - pull
    - recipient queries peers: 
      - propose a new root node which contains a workflow which will [execute some routine], then
        - propose new root node to original sender with relevant info at a given UUID alias
        - execute some routine: 
- Missing content addressed nodes
  - Either: 
    * requestor proposes new root node to potential fulfillers/peers
      - which includes
        - proposing channels for each element of node (perhaps subchannels of original proposed channel from requestor?)
    * Treated as capability & forwarded to peers for remote execution (no automatic distribution?)
      - How to verify?
    + just seed it natively with some reputation or mining incentive 


Min:
---



how to bootstrap link:
- send capability registration

messages passing:
  - how to pass messages
    - queue? 
  - recipient creates new "next" entry? (internal queue)
  - how does blockchain do it?
  - event bus (recipient maintains cursor and pulls?)

message format:
  - alias/channel + new proposed hash
  - 

syncing logic:
  - query n peers, if X% agree, use that


triggers:
