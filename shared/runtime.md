


Goals: 
- graph store
- universal syncing
    - http
    - websockets
    - webrtc
    - tcp
- mesh
- message passing


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



the capability is registered on the recipient/actor side as a type, but on the sender/delegator side it's represented as a constructor or default argument to pass or handler for an effect type.  So then it could include the connection details... 

if those details are unknown, it could be handled via a message relaying handler that wraps up the message and asks peers to relay it so we need to write a "send" handler that knows how to do that, which will be assigned as the fallback handler, where the base case handler will use the aforementioned connection objects with connection details. 

it seems like ideally the constructor  woudl include the intended type so that the sender can determine which actions should trigger that capability



Capabilities / messages



Write time, commit time, trigger time, eval time, complete time

Storage: 



Node A:  

- peers (network)
  - relay memberships?

- members (logical)
- memberships (logical)


