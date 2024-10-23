- [DAG](#dag)
- [Interpreter](#interpreter)
- [Client](#client)
- [Future](#future)


## DAG
- The DAG is currently stored as a content-addressed map of lists of tuples.  

e.g.
```
<Node8 Hash>:
  - [<Node1 Hash>, <Node3 Hash>]
  - [<Node1 Hash>, <Node4 Hash>]
  - [<Node2 Hash>, <Node5 Hash>]
<Node9 Hash>:
  - [<Node1 Hash>, <Node6 Hash>]
  - [<Node2 Hash>, <Node7 Hash>]
```
These nodes have a class which exposes immutable functions for manipulating them to create new nodes (with corresponding hashes)

These nodes are stored to and retrieved from the store, which provides the primary interface for interacting with the DAG, allowing querying based on pattern matching

## Interpreter

The interpreter currently supports creating tasks & subtasks.  It maintains referential consistency despite the content addressed nodes by storing the path from the root node to the node which is mutated and updated the hash of each parent it encounters.  It calculates the new root hash based on the mutation.  These mutations are considered transactions, and the interpreter can propose to commit them or not. 


## Client
The client interface should expose the following data and methods

- Authenticate to a peer (using keys)
- Current DAG as constructed from root hash
- Create / Propose Commit / Abort transaction
- 
- Directly evaluate expression (adds task to peer)


## Future

Peer:
(dependent on finalized semantics) A "peer" is a construct within the DAG which provides the basis for authentication, user permissions, and groups, and exensible effects.  The base peer requires no authentication.  All data within a peer is transparent to any clients connected to that peer.  Peers should be able to register handlers and corresponding effect types which become available from the base peer to be assigned to them.  Instructions which are assigned to peers other than the base peer are tagged with the effect type.
