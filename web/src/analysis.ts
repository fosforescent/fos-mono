import type { App } from './app'
import { view, type Replica, type Scope, type TaskView } from '../../shared/sync/index'
import { iconSvg } from './icons'

type Entry = { path: Scope; parent: Scope; row: TaskView }
export function analysisRows(replica: Replica, root: Scope): Entry[] {
  const rows: Entry[] = []
  const walk = (path: Scope, depth: number) => {
    if (depth > 32 || rows.length >= 2000) return
    for (const row of view(replica, path)?.tasks ?? []) {
      if (row.construction || rows.length >= 2000) continue
      const at = [...path, row.id]; rows.push({ row, path: at, parent: path })
      // Linked peers retain their own permission boundary and are not traversed here.
      if (row.refId === undefined && !row.refPeer) walk(at, depth + 1)
    }
  }
  walk(root, 0); return rows
}
/** `type` filters by the row type's name ("Task", "Note", a template's title). */
const typeLabel = (row: TaskView) => row.typeName ?? 'Row'
export function queryAnalysis(rows: Entry[], pattern: string, type: string, status: string) {
  const tokens = pattern.toLocaleLowerCase().split('*')
  const matches = (text: string) => { let from = 0; for (const token of tokens) { const at = text.toLocaleLowerCase().indexOf(token, from); if (at < 0) return false; from = at + token.length }; return true }
  return rows.filter(({ row }) => (!type || typeLabel(row) === type) && (!status || row.checkable && (status === 'complete' ? row.done === true : row.done === false)) && matches(row.title))
}
export function analysisTotals(rows: Entry[]) {
  const kinds: Record<string, number> = {}, allocations: Record<string, { count: number; sum: number; min: number; max: number }> = {}
  for (const { row } of rows) {
    kinds[typeLabel(row)] = (kinds[typeLabel(row)] ?? 0) + 1
    if (row.allocation) {
      const { type, unit, amount } = row.allocation, key = `${type} / ${unit}`
      const total = allocations[key] ?? { count: 0, sum: 0, min: amount, max: amount }
      total.count++; total.sum += amount; total.min = Math.min(total.min, amount); total.max = Math.max(total.max, amount); allocations[key] = total
    }
  }
  return { count: rows.length, kinds, allocations }
}
export function openAnalysis(app: App): void {
  const store = app.state.replica.store, root = [...app.state.view]
  const dialog = document.createElement('dialog'); dialog.className = 'analysis-page'; dialog.setAttribute('aria-label', 'Node analysis')
  // Prevent editor keyboard/clipboard/drop handlers from handling analysis interactions.
  for (const name of ['keydown', 'paste', 'drop', 'dragover']) dialog.addEventListener(name, event => event.stopPropagation())
  const controls = document.createElement('header'), back = document.createElement('button'); back.type = 'button'; back.className = 'icon'; back.innerHTML = iconSvg('back')!; back.setAttribute('aria-label', 'Back to tree'); back.onclick = () => dialog.close()
  const pattern = document.createElement('input'); pattern.type = 'search'; pattern.placeholder = 'Text pattern (use * for any text)'; pattern.setAttribute('aria-label', 'Analysis pattern')
  const kind = document.createElement('select'); kind.setAttribute('aria-label', 'Object type'); kind.append(new Option('All types', ''))
  const status = document.createElement('select'); status.setAttribute('aria-label', 'Task status'); status.append(new Option('Any status', ''), new Option('Open tasks', 'open'), new Option('Completed tasks', 'complete'))
  const mode = document.createElement('select'); mode.setAttribute('aria-label', 'Analysis presentation'); mode.append(new Option('Grid', 'grid'), new Option('Graph', 'graph'))
  const refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = 'Refresh'
  const summary = document.createElement('section'), results = document.createElement('section'); results.className = 'analysis-results'
  let source = analysisRows(app.state.replica, root)
  for (const value of [...new Set(source.map(e => typeLabel(e.row)))].sort()) kind.append(new Option(value, value))
  const render = () => {
    const rows = queryAnalysis(source, pattern.value, kind.value, status.value), totals = analysisTotals(rows)
    summary.replaceChildren(); const count = document.createElement('p'); count.textContent = `${source.length >= 2000 ? "First 2000 objects only. " : ""}${totals.count} matching objects ? ${Object.entries(totals.kinds).map(([k, n]) => `${k}: ${n}`).join(' ? ')}`; summary.append(count)
    for (const [unit, total] of Object.entries(totals.allocations)) { const line = document.createElement('p'); line.textContent = `${unit}: sum ${total.sum}, average ${total.sum / total.count}, min ${total.min}, max ${total.max}`; summary.append(line) }
    results.replaceChildren()
    if (mode.value === 'grid') {
      const table = document.createElement('table'), head = document.createElement('tr')
      for (const text of ['Object', 'Type', 'Status', 'Allocation', 'Path']) { const th = document.createElement('th'); th.textContent = text; head.append(th) }; table.append(head)
      for (const { row, path } of rows) { const tr = document.createElement('tr'); for (const text of [row.title, typeLabel(row), !row.checkable ? '' : row.done ? 'Complete' : 'Open', row.allocation ? `${row.allocation.amount} ${row.allocation.unit}` : '', path.slice(root.length).join(' / ')]) { const td = document.createElement('td'); td.textContent = text; tr.append(td) }; table.append(tr) }
      results.append(table)
    } else {
      const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Matching nodes and their parent links'); svg.setAttribute('width', '100%'); svg.setAttribute('height', String(Math.max(100, rows.length * 48))); svg.setAttribute('viewBox', `0 0 1000 ${Math.max(100, rows.length * 48)}`)
      const positions = new Map(rows.map((entry, i) => [JSON.stringify(entry.path), { x: Math.min(600, (entry.path.length - root.length) * 60), y: i * 48 + 24 }]))
      for (const { row, path, parent } of rows) {
        const p = positions.get(JSON.stringify(path))!, from = positions.get(JSON.stringify(parent))
        if (from) { const line = document.createElementNS(ns, 'line'); for (const [key, value] of Object.entries({ x1: from.x, y1: from.y, x2: p.x, y2: p.y })) line.setAttribute(key, String(value)); line.setAttribute('stroke', 'currentColor'); svg.append(line) }
        const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('cx', String(p.x)); dot.setAttribute('cy', String(p.y)); dot.setAttribute('r', '5'); dot.setAttribute('fill', 'currentColor'); svg.append(dot)
        const text = document.createElementNS(ns, 'text'); text.setAttribute('x', String(p.x + 12)); text.setAttribute('y', String(p.y + 5)); text.setAttribute('fill', 'currentColor'); text.textContent = row.title.slice(0, 60); const title = document.createElementNS(ns, 'title'); title.textContent = `${typeLabel(row)}: ${row.title}`; text.append(title); svg.append(text)
      }
      results.append(svg)
    }
  }
  pattern.oninput = render; kind.onchange = status.onchange = mode.onchange = render
  refresh.onclick = () => { if (app.state.replica.store !== store) { dialog.close(); return }; source = analysisRows(app.state.replica, root); render() }
  controls.append(back, pattern, kind, status, mode, refresh); dialog.append(controls, summary, results)
  const unsubscribe = app.subscribe(state => { if (state.replica.store !== store) { dialog.close(); dialog.remove() } })
  dialog.addEventListener('close', () => { unsubscribe(); dialog.remove() }); document.body.append(dialog); render(); dialog.showModal()
}
