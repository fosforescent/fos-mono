Here's the design of the Fos runtime: 

- All data is stored in the form of content-addressed nodes


# Components 
===



Fos Bus: 
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
