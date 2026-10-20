/**
 * The version of Fosforescent's data: the cid format (every cid is `v<FOS_DATA_VERSION>-<digest>`) and the standard
 * library (`.fos/library.json` and the compiled `shared/sync/library.generated.json` carry it as their `version`; the
 * library compiler refuses a source in another version). One constant, so the two cannot drift apart.
 *
 * Older data versions are not migrated: a store, a replica or a database row in another version is refused with
 * `UnsupportedDataVersionError` (reset the data), and a peer in another version is refused by node exchange
 * (`validateNodeShape`, "update the app"). See docs/cid-versioning.md.
 */
export const FOS_DATA_VERSION = '0.0.1'
