# Data version and content addresses

Every node in the graph is addressed by a cid, the hash of its content. Every
cid carries the **data version** it was written in, and that same version is
the standard library's version. There is one constant for both:
`FOS_DATA_VERSION` in `shared/version.ts`.

Older data is **not migrated**. Data in another version is refused: the
store, replica or database holding it has to be reset.

## Format

```
v<FOS_DATA_VERSION>-<digest>      (digest: 64 hex characters)
```

* The digest is the sha3-256 hex of `{ data, children }`, where `data` is the
  node's data as JSON with object keys sorted deeply and `children` are the
  edges exactly as written: edge order and direction are part of a node's
  identity, so `[a, b]` and `[b, a]` differ and child order replicates.
* The version is part of the address, not of the data: a node's content never
  says which version addresses it. Since every edge holds child cids, the
  version also reaches every parent's digest.
* Parsing should tell a cid of another version apart from garbage. Only a cid
  in the current version verifies.

## Where the version is checked

* **Store.** A store must refuse any root or node key that is not a current
  cid, with an error telling the user to reset the stored data. There is no
  migration on load.
* **Device replicas.** A replica in another version is reset.
* **Backend.** An account whose rows are in another version must fail to load;
  the database has to be reset.
* **Sync.** Node exchange must refuse nodes and pinned shapes in another
  version, telling the user to update the app.
* **Library.** The library must carry `FOS_DATA_VERSION`; a library source or
  compiled bundle in another version is refused, so the library's version and
  the cid format cannot drift apart.

## Changing the version

Changing anything that changes cids (the canonical form, the digest, the node
schema of shipped data, or the standard library's content in a way that makes
old data meaningless) means a new data version:

1. Bump `FOS_DATA_VERSION` in `shared/version.ts`.
2. Rehash `.fos/library.json` into the new version (bottom-up, content
   unchanged: every cid in its nodes, edges and `rootNodeId` is recomputed with
   `hashContent`), set its `version`, and run
   `node scripts/compile-library.cjs`.
3. Regenerate any test fixture holding literal cids; never hand-edit them.
4. Deploy the backend and reset the data it holds. Clients in the old version
   are refused by node exchange until they update; their stored replicas reset
   on their first load in the new version.

Adding fields that old nodes simply lack, or library rows that seeding adds
where they are missing, does not need a new version.
