/**
 * Standard constructor names used by host adapters. A constructor must carry its own name as a string row;
 * library field names are lookup bindings and must not assign meaning to the node they expose. Structural
 * compatibility must be checked against graph predicates, not these strings or a reverse library index.
 */
export const TASK_TYPE = 'task'
/** The plain row: a row that is its text. Rows of a type this peer does not know render like it. */
export const PLAIN_TYPE = 'title'
/** A note: a title and a Markdown body. */
/** Rows that are feature specifications (notes a verifier checks after a merge). */
export const SPECIFICATION_TYPE = 'specification'
export const NOTE_TYPE = 'note'
export const COMMENT_TYPE = 'comment'
/** A reference: a row standing for another row by alias id (`data.ref`). */
export const REF_TYPE = 'ref'
export const QUERY_TYPE = 'query'
/** A resource bank (calendar, account, inventory, person, points, location): a ref row whose value holds its grants. */
export const RESOURCE_TYPE = 'resource'
/** A template row: the type of the tasks made from it. */
export const TEMPLATE_TYPE = 'template'
/** What a type accepts as children (sync/patterns.ts). */
export const HOME_TYPE = 'home'
export const DEVICE_ROOT_TYPE = 'deviceRoot'
/** A library ref's row type: a ref whose value is a library (a library defines it, so a library is told by what it holds). */
export const LIBRARY_TYPE = 'library'
export const DOCUMENT_ROOT_TYPE = 'documentRoot'
export const TEXT_TYPE = 'text'
/** Text rendered as Markdown (math, diagrams) with `{{name}}` bindings: a note's body. */
export const MARKDOWN_TYPE = 'markdown'
export const NUMBER_TYPE = 'number'
export const TIME_TYPE = 'time'
export const PEER_TYPE = 'peer'
