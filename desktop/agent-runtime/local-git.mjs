import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, readdir, writeFile, rename, unlink, realpath, lstat } from 'node:fs/promises'
import { join, resolve, basename, dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const execute = promisify(execFile)
const git = async (cwd, args) => (await execute('git', ['-C', cwd, ...args], { windowsHide: true, timeout: 120000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }, maxBuffer: 4 * 1024 * 1024 })).stdout.trim()
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
async function specDirectory(cwd, create = false) {
  const root = await realpath(cwd), dir = join(root, '.fos', 'specifications')
  for (const path of [join(root, '.fos'), dir]) { try { if ((await lstat(path)).isSymbolicLink()) throw new Error('Specification directories cannot be symlinks.') } catch (error) { if (error.code !== 'ENOENT') throw error } }
  if (create) await mkdir(dir, { recursive: true })
  return dir
}
export async function localGit(request) {
  const inputPath = resolve(request.cwd)
  const cwd = await git(basename(inputPath) === '.git' ? dirname(inputPath) : inputPath, ['rev-parse', '--show-toplevel'])
  if (request.action === 'agent-worktree') {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(request.id ?? '') || !/^[\w.-]+\/[\w.-]+$/.test(request.repo ?? '')) throw new Error('Invalid agent request or repository.')
    await git(cwd, ['check-ref-format', '--branch', request.branch])
    if (request.branch.startsWith('-')) throw new Error('Invalid branch.')
    const remote = await git(cwd, ['config', '--get', 'remote.origin.url'])
    const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(remote)
    if (!match || match[1].toLowerCase() !== request.repo.toLowerCase()) throw new Error('The local origin does not match the configured GitHub repository.')
    const root = await realpath(cwd), parent = join(root, '.fos', 'agent-worktrees')
    for (const path of [join(root, '.fos'), parent]) {
      try { if ((await lstat(path)).isSymbolicLink()) throw new Error('Agent worktree directories cannot be symlinks.') } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    await mkdir(parent, { recursive: true })
    await writeFile(join(parent, '.gitignore'), '*\n', { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error })
    const directory = join(parent, request.id)
    // A lost launch response never reuses a working directory that an agent may already be changing.
    try { await lstat(directory); throw new Error('This request already has a worktree. Review it before retrying.') } catch (error) { if (error.code !== 'ENOENT') throw error }
    await git(cwd, ['fetch', 'origin', `refs/heads/${request.branch}`])
    const sha = await git(cwd, ['rev-parse', 'FETCH_HEAD'])
    await git(cwd, ['worktree', 'add', '-b', `fos-agent/${request.id}`, directory, sha])
    return { cwd: directory, head: sha, branch: request.branch }
  }
  const branch = await git(cwd, ['branch', '--show-current']), head = await git(cwd, ['rev-parse', 'HEAD']).catch(() => '')
  const dir = await specDirectory(cwd)
  const names = (await readdir(dir).catch(error => { if (error.code === 'ENOENT') return []; throw error })).filter(name => name.endsWith('.json')).sort()
  if (names.length > 2000) throw new Error('Too many specification files.')
  const specifications = []
  for (const name of names) { if (!/^[a-zA-Z0-9_-]{1,128}\.json$/.test(name)) throw new Error('Invalid specification filename.'); const path = join(dir, name); if ((await lstat(path)).isSymbolicLink()) throw new Error('Specification files cannot be symlinks.'); const text = await readFile(path, 'utf8'); if (text.length > 120000) throw new Error('Specification file too large.'); const spec = JSON.parse(text); if (spec.id + '.json' !== name) throw new Error('Specification identity mismatch.'); specifications.push(spec) }
  const revision = digest({ branch, head, specifications })
  if (request.action === 'save-specifications') {
    if (request.expected !== revision) throw new Error('Git or specifications changed. Refresh before saving.')
    if (!Array.isArray(request.specifications) || request.specifications.length > 2000) throw new Error('Invalid specification list.')
    const ids = new Set()
    for (const spec of request.specifications) { if (!spec || !/^[a-zA-Z0-9_-]{1,128}$/.test(spec.id) || ids.has(spec.id) || typeof spec.text !== 'string' || spec.text.length > 100000) throw new Error('Invalid specification.'); ids.add(spec.id) }
    for (const spec of request.specifications) if (spec.parent !== null && !ids.has(spec.parent)) throw new Error('Missing specification parent.')
    if (JSON.stringify(request.specifications).length > 1_800_000) throw new Error('Specifications exceed the storage limit.')
    const parents = new Map(request.specifications.map(spec => [spec.id,spec.parent]))
    for (const id of ids) { const seen = new Set(); let at=id; while(at !== null) { if(seen.has(at)) throw new Error('Specification parent cycle.'); seen.add(at); at=parents.get(at) } }
    await specDirectory(cwd, true)
    const ignore = join(cwd, '.fos', '.gitignore')
    if (await lstat(ignore).then(stat => stat.isSymbolicLink()).catch(error => { if(error.code === 'ENOENT') return false; throw error })) throw new Error('Ignore file cannot be a symlink.')
    const previous = await readFile(ignore, 'utf8').catch(error => { if (error.code === 'ENOENT') return '*\n'; throw error })
    if (!previous.includes('!specifications/')) await writeFile(ignore, previous + '\n!specifications/\n!specifications/**\n')
    for (const spec of request.specifications) { const target = join(dir, spec.id + '.json'), tmp = target + '.' + randomUUID() + '.tmp'; await writeFile(tmp, JSON.stringify({ id: spec.id, parent: spec.parent, text: spec.text }, null, 2) + '\n'); await rename(tmp, target) }
    for (const name of names) if (!ids.has(name.slice(0,-5))) await unlink(join(dir, name))
    return localGit({ cwd, action: 'status' })
  }
  if (['create-branch','switch','merge'].includes(request.action)) {
    if (request.expected !== revision) throw new Error('Git changed. Refresh before changing branches.')
    if (await git(cwd, ['status','--porcelain'])) throw new Error('Commit or stash working-tree changes before switching or merging.')
    if (typeof request.branch !== 'string' || request.branch.startsWith('-')) throw new Error('Invalid branch name.')
    await git(cwd, ['check-ref-format', '--branch', request.branch])
    if (request.action === 'create-branch') await git(cwd, ['switch','-c', request.branch])
    else if (request.action === 'switch') await git(cwd, ['switch', request.branch])
    else await git(cwd, ['merge', '--no-edit', request.branch])
    const result = await localGit({ cwd, action: 'status', previousHead: head }); return { ...result, merged: request.action === 'merge' && result.head !== head }
  }
  if (request.action !== 'status') throw new Error('Unknown Git operation.')
  const branches = (await git(cwd, ['for-each-ref','--format=%(refname:short)', 'refs/heads/'])).split('\n').filter(Boolean)
  const mergeHead = head && (await git(cwd, ['rev-list','--parents','-n','1',head])).split(' ').length > 2
  let merged = false
  if (request.previousHead && /^[a-f0-9]{40,64}$/.test(request.previousHead) && head !== request.previousHead) {
    const commits = await git(cwd, ['rev-list','--merges', `${request.previousHead}..${head}`]).catch(() => '')
    const reflog = await git(cwd, ['reflog','-1','--format=%gs']).catch(() => '')
    merged = !!commits || /^(merge |pull[: ])/.test(reflog)
  }
  return { cwd, branch, head, revision, branches, specifications, mergeHead: !!mergeHead, merged, dirty: !!(await git(cwd, ['status','--porcelain'])) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 2_000_000) throw new Error('Request too large.') }
  try { process.stdout.write(JSON.stringify(await localGit(JSON.parse(input)))) } catch (error) { process.stderr.write(error.message); process.exitCode = 1 }
}
