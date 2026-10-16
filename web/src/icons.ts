import { icon, type IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faToolbox, faCalendarDays, faPlay, faImage, faVideo, faFile, faPen, faChevronDown, faChevronRight, faNoteSticky, faComment, faDollarSign, faBox, faPlus, faUserGroup, faShapes, faDesktop, faEllipsis, faRotateLeft, faRotateRight, faArrowsRotate, faHouse, faWandMagicSparkles, faCodeBranch, faCodePullRequest, faList, faDiagramProject, faComments, faTableCells, faCheckSquare, faMicrophone, faBars, faGear, faKeyboard, faClock, faXmark, faMagnifyingGlass, faFilter, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
const symbols: Record<string, IconDefinition> = { 'integration': faShapes, 'utilities': faToolbox, 'calendar': faCalendarDays, '▶': faPlay, 'image': faImage, 'video': faVideo, 'file': faFile, '✎': faPen, '▾': faChevronDown, '▸': faChevronRight, 'note': faNoteSticky, 'comment': faComment, 'money': faDollarSign, 'inventory': faBox, '+': faPlus, faChevronRight, faNoteSticky, faComment, faDollarSign, faBox, faPlus, '♙': faUserGroup, '▦': faTableCells, '▣': faDesktop, '⋯': faEllipsis, '↶': faRotateLeft, '↪': faRotateRight, '⟳': faArrowsRotate, '⌂': faHouse, '✦': faWandMagicSparkles, '⑂': faCodeBranch, '☷': faDiagramProject, 'pull-request': faCodePullRequest, '☏': faComments, '≡': faList, '☑': faCheckSquare, '🎙': faMicrophone, '☰': faBars, '⚙': faGear, 'keyboard': faKeyboard, 'clock': faClock, '×': faXmark, 'search': faMagnifyingGlass, 'filter': faFilter, 'open': faArrowUpRightFromSquare }
/** Hand-drawn glyphs that have no Font Awesome equivalent (the zoom dot is a ring with a filled centre). */
const custom: Record<string, string> = {
  '◉': '<svg class="svg-inline--fa" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.3"></circle><circle cx="8" cy="8" r="2.4" fill="currentColor"></circle></svg>'
}
export function iconSvg(symbol: string, label = ''): string | null {
  if (custom[symbol]) return custom[symbol]!
  const definition = label === 'Integrations' ? faShapes : symbols[symbol]
  return definition ? icon(definition, { attributes: { 'aria-hidden': 'true', focusable: 'false' } }).html.join('') : null
}
