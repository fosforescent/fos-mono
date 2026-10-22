/**
 * The standard library's row types by graph identity. A row is the edge `[type, row]`: its left node is what it is,
 * and every pinned version of a library type shares that type's id (`data.alias.id`). Code that must tell rows
 * apart compares these ids (graph.ts `isRowOfType`, `rowTypeIdOf`); there is no other row discriminator. No imports,
 * so the standalone embed script can use it.
 */
export const TASK_TYPE = 'lib:type:task'
/** The plain row: a row that is its text. Rows of a type this peer does not know render like it. */
export const PLAIN_TYPE = 'lib:type:plain'
/** A note: one title line, a Markdown body row (`MARKDOWN_TYPE`, its `body` field) and open child rows. */
/** Rows that are feature specifications (notes a verifier checks after a merge). */
export const SPECIFICATION_TYPE = 'lib:type:specification'
export const NOTE_TYPE = 'lib:type:note'
export const COMMENT_TYPE = 'lib:type:comment'
/** A reference: a row standing for another row by alias id (`data.ref`). */
export const REF_TYPE = 'lib:type:ref'
export const QUERY_TYPE = 'lib:type:query'
/** A resource bank (calendar, account, inventory, person, points, location): allocations are drawn from it. */
export const RESOURCE_TYPE = 'lib:type:resource'
/** A signed entry of a resource: negative = what the parent needs (a requirement), positive = what is supplied. */
export const ALLOCATION_TYPE = 'lib:type:allocation'
/** Money: negative = a request for payment, positive = a payment. Told apart by sign alone. */
export const MONEY_TYPE = 'lib:type:allocation:money'
/** A template row: the type of the tasks made from it. */
export const TEMPLATE_TYPE = 'lib:type:template'
/** What a type accepts as children (sync/patterns.ts). */
export const PATTERN_TYPE = 'lib:type:pattern'
export const HOME_TYPE = 'lib:type:home'
export const DEVICE_ROOT_TYPE = 'lib:type:device-root'
/** A library ref's row type: a ref whose value is a library (a library defines it, so a library is told by what it holds). */
export const LIBRARY_TYPE = 'lib:type:library'
export const DOCUMENT_ROOT_TYPE = 'lib:type:document-root'
export const TEXT_TYPE = 'lib:type:text'
/** Text rendered as Markdown (math, diagrams) with `{{name}}` bindings: a note's body. */
export const MARKDOWN_TYPE = 'lib:type:markdown'
export const NUMBER_TYPE = 'lib:type:number'
export const TIME_TYPE = 'lib:type:time'
export const PEER_TYPE = 'lib:type:peer'

/** The allocation type and its sub-types: rows that are signed entries of a resource. */
export const ALLOCATION_TYPES: readonly string[] = [ALLOCATION_TYPE, MONEY_TYPE]
export const isAllocationType = (typeId: string | null | undefined): boolean => !!typeId && ALLOCATION_TYPES.includes(typeId)
