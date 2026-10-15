import { icon, type IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faChevronDown, faChevronRight, faNoteSticky, faComment, faDollarSign, faBox, faPlus, faUserGroup, faShapes, faDesktop, faEllipsis, faRotateLeft, faRotateRight, faArrowsRotate, faHouse, faWandMagicSparkles, faCodeBranch, faCodePullRequest, faList, faDiagramProject, faComments, faTableCells, faCheckSquare, faMicrophone, faBars, faGear } from '@fortawesome/free-solid-svg-icons'
const symbols: Record<string, IconDefinition> = { '▾': faChevronDown, '▸': faChevronRight, 'note': faNoteSticky, 'comment': faComment, 'money': faDollarSign, 'inventory': faBox, '+': faPlus, faChevronRight, faNoteSticky, faComment, faDollarSign, faBox, faPlus, '♙': faUserGroup, '▦': faTableCells, '▣': faDesktop, '⋯': faEllipsis, '↶': faRotateLeft, '↪': faRotateRight, '⟳': faArrowsRotate, '⌂': faHouse, '✦': faWandMagicSparkles, '⑂': faCodeBranch, '☷': faDiagramProject, 'pull-request': faCodePullRequest, '☏': faComments, '≡': faList, '☑': faCheckSquare, '🎙': faMicrophone, '☰': faBars, '⚙': faGear }
export function iconSvg(symbol: string, label = ''): string | null {
  const definition = label === 'Integrations' ? faShapes : symbols[symbol]
  return definition ? icon(definition, { attributes: { 'aria-hidden': 'true', focusable: 'false' } }).html.join('') : null
}
