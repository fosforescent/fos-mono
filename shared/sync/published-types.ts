/**
 * The library row types a published page renders specially (`sharing.ts` projects them, `web/src/site.ts` renders
 * them). A row's type is the left node of its edge; every pinned version of a library type shares its id. Only
 * imports the import-free library-types, so the standalone embed script can use it.
 */
import { NUMBER_TYPE, PEER_TYPE, TEXT_TYPE, TIME_TYPE } from './library-types'
export { MARKDOWN_TYPE, NOTE_TYPE, NUMBER_TYPE, PEER_TYPE, PLAIN_TYPE, TEXT_TYPE, TIME_TYPE } from './library-types'
/** Scalar field types: the fields of a row's product, asked of visitors when empty. */
export const FIELD_TYPES: readonly string[] = [TEXT_TYPE, NUMBER_TYPE, TIME_TYPE, PEER_TYPE]
/** The name of the proposal holding one visitor's candidate field values (one per visitor, replaced on resubmit). */
export const VISITOR_SUBMISSION = 'fos:visitor-submission'
