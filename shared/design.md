Here's the design of the Fos runtime: 


- All data is stored in the form of content-addressed nodes


# Components 
===






## Messaging / Events: 
===

- p2p messaging is just another kind of messaging - associated with registered user
- shoudl consume same interface as integrations for discord, whatsapp, signal, twilio for text, email, etc.
- messages are just specific kinds of events which are handled by adding to state with sender signed with public key?
- 
### Listeners
- Web
  - WebRTC
  - http emit
  - websockets
- Server
  - http handlers (express)
  - websockets
  - WebRTC
  - File-based?
  - Database triggers?
  - 
- Mobile
  - web
- Desktop
- Repo
  - File-based


### Handlers/Capabilities
- Web
  - update dom
  - notify / prompt
  - 
- Server
  - persist
  - forward traffic
  - create user accounts
  - fetch from oauth services
  - fetch from other API's
  - temporal?
- Mobile
  - notify / prompt
- Desktop
- Repo
  - 

### Emitters/Event sources
- Web
  - DOM events
  - network events
  - webrtc events
  - user media events
- Server
  - 
- Mobile
  - location events
- Desktop
- Repo
  - push
  - pull
  - merge
  - update head
    - (becomes "vote"/"proposal" by repo)

### Events: 
Events that affect a programming language: 
- evaluation triggered by CLI execution (main fn called with args => continuation constructed & evaluated with response + context)
- evaluation triggered by GUI execution (main fn called with args & OS input polling)
- continued evaluation after awaiting input (algebraic effect returns & continuation evaluated with repsonse + context)
- continued evaluation after awaiting network response (algebraic efffect returns & continuation evaluated with response + context => co)


If we want to continue from scratch: 
- continuation must get reconstructed 
  - relevant context 
    - existing, must be persisted (tuple space / graph etc)
    - new relevant context must be generated (by event info?)
    - which one is more relevant must be determined
    - distributed via DHT?
    - may differ by user ... 
  - continuation-triggering events must be listened 
    - for
      - network response
      - user input
    - by
      - event queue
        - persisted how?
        - published how?
    - with features
      - events generateed in context of certain user
      - signed with public key (for sending)
      - decoded by private key (when recieving)
      - provides some default arguments, others get provided by user ctx, checking various scopes


Events get queued?  Listener holds cursor?  


Fos Graph Space: 
---
- Events come which aren't necessarily well-formed
- Channels?

Fos Events:
---
- Patterns
  - 


Fos Handlers:
---
- Part of fos store?
- Use patterns to determine which events are relevant to them
- Handle "effects" (i.e. sending over network IO<@other>, storage)
- Each computation triggered by IO<@me> event 
  - (entire set of handlers applied to "realword" context?)
  - 
- IO<@me> = get human input = send over bus to input process? prompt user? (get active device & notify)
  - Forward to IO<@myphone> & send back to IO<@me>
    - "Proxy" effect? -> basically remote execution.. register as capability?
      - IO<'a'> - generic proxying capability?
      - IO<@me | @userx | @usery> - can proxy IO for certain users
      - must provide/maintain channel for response
  - Sub-capabilities: 
    - Notify<'a'>; Notify<'Text<'a'>'>
    - Input<'a'>
  - HTTP
  - keyboard & mouse events
  - WebRTC
  - Websocket
- Persistence handler
  - listen for write events to store?
  - Persist<@me | @userx | @usery> - can persist for many users (sub-capability of IO?)
- Recursion effect handler
- Typecheck effect handler
  - Runs before any other effects?
- Exception effect handler
  - Doesn't trigger persistence handler?
    - OR: adds exception warning to relevant node (well typed)
- Each handler has queue?



Fos Store: 
---
Per-agent access to nodes
- Must be provided with 
  - list of instructions
- Must be provided with:
  - storage/fetch agent
    - serialize/deserialize & store to disk
    - fetch from DHT
  - query agent?
  - key pair
- 

Fos Agora: 
---
Backend app that provides many basic capabilities
- 
