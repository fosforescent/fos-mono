import { readNodeValue, writeNodeValue } from './evaluation'
import { addRow, addTask, deleteTask, moveNode, renameTask, view, type Replica } from './replica'
import { newId, type Scope } from './graph'
export type FeatureSpecification = { id: string; parent: string | null; text: string }
export function specificationRows(r: Replica, root: Scope): FeatureSpecification[] {
  const result: FeatureSpecification[] = []
  const walk = (path: Scope, parent: string | null, depth: number) => {
    if (depth > 64 || result.length >= 2000) throw new Error('Too many nested specifications.')
    for (const row of view(r, path)?.tasks ?? []) {
      if (row.kind === 'ref' || row.refPeer || row.construction) continue
      const at = [...path, row.id], spec = readNodeValue(r, at, 'fos:specification') !== null
      if (spec) result.push({ id: row.id, parent, text: row.title })
      walk(at, spec ? row.id : parent, depth + 1)
    }
  }
  walk(root, null, 0); return result.sort((a,b) => a.id.localeCompare(b.id))
}
export function addSpecification(r: Replica, parent: Scope, text: string, now: number) {
  const id = newId(), path = [...parent, id]
  r = addRow(r, parent, 'note', text, now, { id })
  return { replica: writeNodeValue(r, path, 'fos:specification', { version: 1 }, now), path }
}
export function validateSpecifications(value: unknown): FeatureSpecification[] {
  if (!Array.isArray(value) || value.length > 2000) throw new Error('Invalid specification list.')
  const rows = value as FeatureSpecification[], ids = new Set(rows.map(row => row?.id))
  if (ids.size !== rows.length || rows.some(row => !row || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(row.id) || typeof row.text !== 'string' || row.text.length > 100000 || row.parent !== null && !ids.has(row.parent))) throw new Error('Invalid specification or parent.')
  for (const row of rows) { const seen = new Set<string>(); let next: FeatureSpecification | undefined = row; while (next) { if (seen.has(next.id)) throw new Error('Specification parent cycle.'); seen.add(next.id); next = rows.find(candidate => candidate.id === next!.parent) } }
  return rows
}
export function importSpecifications(r: Replica, root: Scope, value: unknown, now: number): Replica {
  const next = validateSpecifications(value), existing = specificationRows(r, root)
  const paths = new Map<string, Scope>(), all = new Set<string>()
  const collect = (at: Scope) => { for (const row of view(r, at)?.tasks ?? []) { all.add(row.id); if (row.kind === 'ref' || row.refPeer || row.construction) continue; const path = [...at,row.id]; if (existing.some(spec => spec.id === row.id)) paths.set(row.id,path); collect(path) } }
  collect(root)
  const keep = new Map(next.map(row => [row.id,row]))
  for (const row of next) if (all.has(row.id) && !paths.has(row.id)) throw new Error('Specification ID collides with another graph row.')
  for (const [id,path] of paths) if (!keep.has(id) && (view(r,path)?.tasks ?? []).some(child => !paths.has(child.id))) throw new Error('Move the non-specification children before removing this specification.')
  const topologyChanged = existing.some(row => !keep.has(row.id) || keep.get(row.id)!.parent !== row.parent)
  if (topologyChanged) {
    // Park retained subtrees before changing their parents; never recreate them.
    const anchor = newId()
    r = addRow(r,root,'note','Moving specifications',now,{id:anchor})
    for (const [id,path] of [...paths].sort((a,b) => b[1].length-a[1].length)) {
      if (!keep.has(id)) r = deleteTask(r,path.slice(0,-1),id,now)
      else { r = moveNode(r,path.slice(0,-1),id,root,{relativeTo:anchor,position:'above'},now); paths.set(id,[...root,id]) }
    }
    r = deleteTask(r,root,anchor,now)
  }
  const placed = new Map<string, Scope>()
  const put = (row: FeatureSpecification): void => {
    if (placed.has(row.id)) return
    if (row.parent) put(keep.get(row.parent)!)
    const parent = row.parent ? placed.get(row.parent)! : root
    let path = paths.get(row.id)
    if (!path) { r = addRow(r,parent,'note',row.text,now,{id:row.id}); path=[...parent,row.id] }
    else {
      if (topologyChanged && row.parent) { r=moveNode(r,path.slice(0,-1),row.id,parent.slice(0,-1),{into:parent.at(-1)!},now); path=[...parent,row.id] }
      r = renameTask(r,path.slice(0,-1),row.id,row.text,now)
    }
    r = writeNodeValue(r,path,'fos:specification',{version:1},now); placed.set(row.id,path)
  }
  next.forEach(put); return r
}

export function queueSpecificationVerification(r: Replica, root: Scope, commit: string, branch: string, now: number): Replica {
  if (!specificationRows(r, root).length) return r
  const key = `fos:verification:${commit}`
  if (readNodeValue(r, root, key)) return r
  const id = newId(), specs = specificationRows(r, root)
  r = addTask(r, root, `Verify specifications after merge (${branch}, ${commit.slice(0,8)})`, now, id)
  r = writeNodeValue(r, [...root,id], 'fos:verification-request', { commit, branch, specifications: specs, status: 'pending' }, now)
  return writeNodeValue(r, root, key, { task: id }, now)
}
