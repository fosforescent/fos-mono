# Data version and content addresses

Every node in the graph is addressed by a cid, the hash of its content. Every
cid carries the **data version** it was written in, and that same version is
the standard library's version. There is one constant for both:

```ts
// shared/version.ts
export const FOS_DATA_VERSION = '0.0.1'
```

Older data is **not migrated**. Data in another version is refused: the
store, replica or database holding it has to be reset. The project restarted
at 0.0.1 with this scheme; data written by earlier builds (cid formats v0 to
v5) is not readable.

Code: `shared/version.ts` (the constant), `shared/dag-implementation/cid.ts`
(format, parsing, hashing, verification), `shared/library-compiler.ts` (the
library's version check).

## Format

```
v<FOS_DATA_VERSION>-<digest>      e.g. v0.0.1-3f9a…   (64 hex characters)
```

* The digest is the sha3-256 hex of `{ data, children }`, where `data` is the
  node's data as JSON with object keys sorted deeply and `children` are the
  edges exactly as written: edge order and direction are part of a node's
  identity, so `[a, b]` and `[b, a]` differ and child order replicates.
* The version is part of the address, not of the data: a node's content never
  says which version addresses it. Since every edge holds child cids, the
  version also reaches every parent's digest.

Parsing (`parseCid`) accepts any versioned cid, `v<n>(.<n>)*-<64 hex>`, so a
cid of another version can be told apart from garbage; `cidVersion` also
reports a bare 64-hex digest (written before cids had versions) as
`unversioned`. Only the current version is current:

| function | does |
|---|---|
| `hashContent(content)` | the cid of `content` in the current version |
| `isCurrentCid(cid)` | the cid's prefix is exactly `v<FOS_DATA_VERSION>-` and the digest is well-formed |
| `verifyCid(cid, content)` | `cid` is current and addresses `content`; a cid of another version never verifies |
| `assertCurrentCid(cid)` | throws `UnsupportedDataVersionError` unless the cid is current |
| `isCid(value)` | a versioned cid of any version (wire validation) |
| `shortCid(cid)` | prefix plus the first hex characters, for logs |

## Where the version is checked

* **Store.** `new FosStore({ fosCtxData })` asserts that the root and every
  node key are current cids and throws `UnsupportedDataVersionError`
  ("Unsupported data version (…): this app reads data version 0.0.1 only.
  Reset the stored data.") otherwise. There is no migration on load.
* **Device replicas.** `loadReplica` (the web app's localStorage replica, the
  desktop and CLI `.fos/` replicas through the embedded core) catches the
  error, logs it and starts with a fresh replica: the stored data is reset.
* **Backend.** `dbToStore` asserts every row it reads is current before
  verifying it, so an account whose rows are in another version fails to load
  with the same error; the database has to be reset.
* **Sync.** The only cids node exchange carries are pinned templates and pinned
  grants. `validateNodeShape` refuses a shape pinned to another version with
  "This peer uses another data version (this app: 0.0.1). Update the app to
  sync.", and `importNodes` only accepts current nodes that verify.
* **Library.** `.fos/library.json` and the compiled
  `shared/sync/library.generated.json` carry `"version": "0.0.1"`.
  `compileLibrary` refuses a source whose version is not `FOS_DATA_VERSION`
  (and any node that is not a current cid) and stamps the constant on its
  output; `shared/sync/library.ts` sets `LIBRARY_VERSION = FOS_DATA_VERSION` and
  throws at load if the compiled bundle is in another version. The library's
  version and the cid format therefore cannot drift apart.

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
where they are missing (`seedLibraryRows`), does not need a new version.
