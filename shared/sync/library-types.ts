/**
 * The standard library's row types: fields of the library (`lib.task`, `lib.note`, ...), by field name. A row is the
 * edge `[type, row]`: its left node is what it is, and code tells rows apart by the library field that node is
 * (graph.ts `isRowOfType`, `rowTypeIdOf`); there is no other row discriminator. No imports, so the standalone embed
 * script can use it.
 */
export const TASK_TYPE = 'task'
/** The plain row: a row that is its text. Rows of a type this peer does not know render like it. */
export const PLAIN_TYPE = 'plain'
/** A note: one title line, a Markdown body row (`MARKDOWN_TYPE`, its `body` field) and open child rows. */
/** Rows that are feature specifications (notes a verifier checks after a merge). */
export const SPECIFICATION_TYPE = 'specification'
export const NOTE_TYPE = 'note'
export const COMMENT_TYPE = 'comment'
/** A reference: a row standing for another row by alias id (`data.ref`). */
export const REF_TYPE = 'ref'
export const QUERY_TYPE = 'query'
/** A resource bank (calendar, account, inventory, person, points, location): allocations are drawn from it. */
export const RESOURCE_TYPE = 'resource'
/** A signed entry of a resource: negative = what the parent needs (a requirement), positive = what is supplied. */
export const ALLOCATION_TYPE = 'allocation'
/** Money: negative = a request for payment, positive = a payment. Told apart by sign alone. */
export const MONEY_TYPE = 'money'
/** A template row: the type of the tasks made from it. */
export const TEMPLATE_TYPE = 'template'
/** What a type accepts as children (sync/patterns.ts). */
export const PATTERN_TYPE = 'pattern'
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

/** The allocation type and its sub-types: rows that are signed entries of a resource. */
export const ALLOCATION_TYPES: readonly string[] = [ALLOCATION_TYPE, MONEY_TYPE]
export const isAllocationType = (typeId: string | null | undefined): boolean => !!typeId && ALLOCATION_TYPES.includes(typeId)
