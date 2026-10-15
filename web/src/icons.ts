import { icon, type IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faUserGroup, faShapes, faDesktop, faEllipsis, faRotateLeft, faRotateRight, faArrowsRotate, faHouse, faWandMagicSparkles, faCodeBranch, faList, faComments, faTableCells, faCheckSquare, faMicrophone, faBars, faGear } from '@fortawesome/free-solid-svg-icons'
const symbols: Record<string, IconDefinition> = { '♙': faUserGroup, '▦': faTableCells, '▣': faDesktop, '⋯': faEllipsis, '↶': faRotateLeft, '↪': faRotateRight, '⟳': faArrowsRotate, '⌂': faHouse, '✦': faWandMagicSparkles, '⑂': faCodeBranch, '☷': faList, '☏': faComments, '≡': faList, '☑': faCheckSquare, '🎙': faMicrophone, '☰': faBars, '⚙': faGear }
export function iconSvg(symbol: string, label = ''): string | null {
  const definition = label === 'Integrations' ? faShapes : symbols[symbol]
  return definition ? icon(definition, { attributes: { 'aria-hidden': 'true', focusable: 'false' } }).html.join('') : null
}
