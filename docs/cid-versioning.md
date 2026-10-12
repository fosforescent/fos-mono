# Versioned content addresses

Every node in the graph is addressed by a cid, the hash of its content. The
hash algorithm, the canonical form that is hashed, and the node schema will all
change over time. To keep old and new objects apart and upgrade them in order,
cids carry a format version, and the formats are migrated like database
schemas.

Code: `shared/dag-implementation/cid.ts` (formats, parsing, hashing,
verification) and `shared/dag-implementation/migrations.ts` (ordered
migrations, `migrateContext`).

## Format

```
v<N>-<digest>        current formats, e.g. v1-3f9a…   (N selects the algorithm)
<digest>             version 0: legacy bare hex written before versions existed
```

| version | digest                                                    | notes |
|---------|-----------------------------------------------------------|-------|
| 0       | sha3-256 of `{data: canonical JSON, children: sorted edges}` | read-only; never produced |
| 1       | same digest, prefixed `v1-`                               | superseded |
| 2       | edges hashed in order and direction                       | current |

`CID_FORMATS` in `cid.ts` is the registry. `hashContent` always writes the
current format; `verifyCid(cid, content)` checks a cid with the algorithm of
its own version, so legacy rows verify without being rehashed first.

The version is part of the address, not of the data: a node's content never
needs to describe which format addresses it.

## Migrations

`MIGRATIONS` in `migrations.ts` is an ordered list of steps
`{ from, to, description, upgrade? }`. `upgrade` transforms a node's own data
for the new format; edges are remapped automatically.

`migrateContext(context, target)` rehashes a serialized graph bottom-up: a
node's children are migrated first, its edges rewritten to the new cids, each
intermediate `upgrade` applied, and only then is the node hashed in the target
format. It returns the migrated context and an old→new mapping. Nodes already
in the target format whose edges are current keep their cid, so running it on
a current graph is a no-op; dangling references and newer-than-target nodes
throw `MigrationError`.

## Where migration happens

* **On load.** `new FosStore({ fosCtxData })` detects an older format,
  migrates, and records the report in `store.migration`; `store.remapCid(old)`
  gives the new address. Routes in the context and trellis data are remapped.
* **Backend.** `dbToStore` verifies rows with `verifyCid`, so legacy rows load;
  the store migrates; the next `storeToDb` writes the new nodes and repoints
  the user's root. Old rows remain in `FosNodeModel` untouched (they are still
  valid under their own version) and can be garbage-collected later.
* **Devices.** `loadReplica` migrates the stored graph and follows the sync
  base along the mapping.
* **Sync.** Requests and responses carry `cidVersion`; a peer in a different
  format gets `version-mismatch` (HTTP 409) and the app stops retrying until it
  is updated. Imported nodes must be in the current format and verify.

## Adding a format version

1. Add the new entry to `CID_FORMATS` (algorithm, canonical form) and bump
   `CURRENT_CID_VERSION`.
2. Append `{ from: N, to: N+1, description, upgrade }` to `MIGRATIONS`. Put
   schema changes to node data in `upgrade`.
3. Add a case to `cid.test.ts` that builds a graph in version N (see
   `downgradeToLegacy` there for the pattern) and proves it migrates.
4. Deploy the backend first: clients on the old format are refused with 409
   rather than mixing formats in one store.

v2 did exactly this: v0/v1 sorted the two cids *within* each edge and the
edges themselves, so `[a, b]` and `[b, a]` hashed the same and child order was
not part of identity. v2 hashes edges as written; stored v1 graphs migrate on
load with their stored order kept as the canonical order.
