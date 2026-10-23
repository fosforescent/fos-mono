Fixes: 
- should have "connect" in node-by-node context menu along with in root
- Why does "bank" get added below current row?  We should transform current row into bank, or allocate it to 




Primary usecases for now: 
- manage a far-reaching vibecoded project by allowing specification at progressively fine-grained levels and integrating with agents which can carry out tasks
  - Create goals & subgoals
    - Access status of them across many devices
    - Allow users to bid on tasks in marketplace
    - setup payouts integration (probably with stripe)
    - view tasks from desktop and submit branches/prs as "proposals"
      - chat within task, share notes etc
    - triggers
      - cron-type workflwos that automatically get kicked off and can go to market
- collaborate to plan a group trip
  - create nested choices/branches that others can see and sort
  - allow multiple users to allocate from calendar and inventory
    - or vs and logic in person-calendar allocations
  - splitting charges
  - in-the-moment group choices about dinner etc
- research group share, collaboratively edit, and publish notes
- analyze messages within group
- 


Misc: 
- Let's also have the ability to create a group by creating a row and dragging and dropping peers onto that row.  Then those peers are the group members... Let's have hte fos server be a member by default but it can be removed
- Let's have root (client specific) be distinct from "home", which is a "group" of all the user's devices.  The fos server should show up in the "root", as well as other peers that attach to the users home node
 


- Points
  - Let's create fos points that are 


- Mailbox / relay will this way: 
  - each peer has a UUID and/or keypair
  - If peer B wants to relay a message through peer A, it submits a route requirement/request to Peer A including the timestamp.  Peer A submits them to its peers, starting with the fos server if it's available or peer C. If peer C has established routes to the recipient, it queries them 3 at a time in sequence to determine if any are online.  Then it sorts them based on the speed of response, if so it sends a message + signature requirement back to the original sender in response, otherwise it sends a route request to the next peer after an artificial delay of (now time - original route request times).  If it receives any route requests in the meantime to the same recipient, it ignores them.  Once a route is established, it's cached. 

  When the original sender receives the message + signature requirement, it then sends the message as well as an appropriate signature based on the signature requirement if available. 


Peer<id>: 
- transport



Group: 




Mailbox/Relay: 
- sender
- recipient
- signature
+ route




- Please remove the green "Add" button... it is redundant with the new row

- Let's make the text box in the "edit" button have a similar caret menu that allows switching between options.  
- We don't need so much info in the "status" badge in the top right
- As far as the "lazy node loading" -- the requests should be automatic.  Visually it should just look like you're on that node locally, but perhaps with a slightly different shade in the background.  By default when a user shares a linked node, it inherits the permissions of its parent.  However on the local mutable ref which is connected to the mutable ref on the peer side, the user shoudl be able to specify permission constructors under the node itself, and/or under a given peer which would then mask that data.  So the peer on the other side only receives a portion of the node, and possibly visa versa when they potentially modify the node


- The Connect GitHub repository button should be in the menu with all the other actions


- There's also the distinction of publishing for other people edit vs publishing something that people interact with... 
  - the first one the people are added as peers
  - the second they're 


- If we start fos from the cli with fos ., 
- It should automatically do a filesystem link at that directory and add the store
- we 



- The "Find fos users" search menu shoudl go under the "add peers" tab/section
- 



Notes 10/17:
---
- kanban - part of execution view
- edit/tree view can be part of execution view if executor needs to provide a workflow/function


Invoice flow: 
---
- create constructor for default/override/mask/merge thing..
- is about executing a function
  - requires list of time entries with descriptions etc... each masked
  - requires list of billing
  - requires contact
  - 



Use cases that can be helpful immediately: 
- email list/contact form
- quick server-required tasks that people don't want a server for
- comments section? 
- Blog-style CMS
- Payment splitting & polling (a la splitwise?)
- Invoicing
- simple inventorying


- there should be a std lib of derived handlers and standard capabilities that run off of the device-specific handlers and most basic capability definitions
- How do we discover new capabilities on current machine?
  - link them to local registry as mutable refs of certain type?  
    - nodes have their own registries -- just a mapping from alias + icon to uuid/cid? So that's how subhandlers can automatially be registered when a capability is registered? 
    - nodes can override previous scopes by linking to the registry? 
      - If a node and its parents/ancestors are both adding submissions to the same mutable ref, the child's override the parents' automatically

- peers are ultimately just handlers with bundled sub-handlers.  A capability can pattern match over the peer to determine if it has handlers for the required sub-capabilities


- we should seed new accounts with std lib.  
  - "solve" capability shoudl come in std lib? for calculations and logic programming
  - unmasked links correspond to equality constructors?  masked correspond to gte/lte?


- read/write/execute all blend in with each other.  The execute view needs to be able to read to show what's happening, and write to be able to change state.  Read view needs to be able to execute queries, which requires writes.  Write view needs to be able to read and execute queries
  
Execute view: 
  - kanban
    - mapping a list of items over a composed sequence of functions/templates
  - invoice
  - chat

Small notes:
- move "new row" back ot the bottom of the row list
- Std lib should be first in the capabiliites menu, then fos server, then device
- Triggers should not be a special menu.. they are handlers for other peers
  - There can be a "trigger" sub-tab in the std lib or fos server menu
- "add peer" should not be its own menu item.  It should have an entry under the device-specific menu (for server or p2p connections), or it should have more specific entries in the fos server menu which 
- "this device" and "this computer" shoudl not be separate menu items in the capability menu
- rename settings back to device root