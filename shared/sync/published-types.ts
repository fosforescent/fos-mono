/**
 * The library row types a published page renders specially (`sharing.ts` projects them, `web/src/site.ts` renders
 * them). A row's type is the left node of its edge; every pinned version of a library type shares its id. No imports,
 * so the standalone embed script can use it.
 */
export const NOTE_TYPE = 'lib:type:note'
export const TEXT_TYPE = 'lib:type:text'
export const NUMBER_TYPE = 'lib:type:number'
export const TIME_TYPE = 'lib:type:time'
export const PEER_TYPE = 'lib:type:peer'
/** Scalar field types: the fields of a row's product, asked of visitors when empty. */
export const FIELD_TYPES: readonly string[] = [TEXT_TYPE, NUMBER_TYPE, TIME_TYPE, PEER_TYPE]
/** The name of the proposal holding one visitor's candidate field values (one per visitor, replaced on resubmit). */
export const VISITOR_SUBMISSION = 'fos:visitor-submission'
