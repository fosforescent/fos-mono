import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {localGit} from './local-git.mjs'
import {cliArguments} from './cli.mjs'
test('agent worktree uses the requested remote branch and preserves a dirty desktop checkout', async () => {
 const cwd=await mkdtemp(join(tmpdir(),'fos-agent-worktree-'))
 const git=(...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim()
 try {
  git('init','-b','main');git('config','user.email','test@example.invalid');git('config','user.name','Test')
  await writeFile(join(cwd,'README'),'main');git('add','.');git('commit','-m','initial')
  git('switch','-c','phone-feature');await writeFile(join(cwd,'README'),'feature');git('commit','-am','feature');git('switch','main')
  git('remote','add','origin','https://github.com/acme/project.git')
  git('config',`url.${cwd.replaceAll('\\','/')}/.insteadOf`,'https://github.com/acme/project.git')
  await writeFile(join(cwd,'README'),'uncommitted desktop edit')
  const before=git('status','--porcelain'), head=git('rev-parse','HEAD')
  const request={cwd,action:'agent-worktree',repo:'acme/project',branch:'phone-feature',id:'job-1'}
  const result=await localGit(request)
  assert.equal(await readFile(join(result.cwd,'README'),'utf8'),'feature')
  assert.equal(await readFile(join(cwd,'README'),'utf8'),'uncommitted desktop edit')
  assert.equal(git('branch','--show-current'),'main');assert.equal(git('rev-parse','HEAD'),head);assert.equal(git('status','--porcelain'),before)
  await assert.rejects(localGit(request),/already has a worktree/)
  await assert.rejects(localGit({...request,id:'job-2',repo:'different/repo'}),/does not match/)
  await assert.rejects(localGit({...request,id:'../escape'}),/Invalid agent request/)
 } finally { await rm(cwd,{recursive:true,force:true}) }
})
test('CLI uses scoped MCP and ordinary approvals',()=>{
 const context={url:'http://127.0.0.1:123/mcp',config:'C:/path with spaces/mcp.json'}
 assert.deepEqual(cliArguments('claude',context,{chrome:true}),['--permission-mode','default','--mcp-config',context.config,'--chrome'])
 const args=cliArguments('codex',context)
 assert(args.includes('workspace-write'));assert(args.includes('on-request'));assert(args.includes("mcp_servers.fos.bearer_token_env_var='FOS_CONTEXT_TOKEN'"))
 assert(cliArguments('codex',context,{verify:true}).includes('read-only'))
 assert.throws(()=>cliArguments('unknown',context))
})
test('Git merges specification files and protects stale writes',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'fos-git-test-'))
 const git=(...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim()
 const status=()=>localGit({cwd,action:'status'})
 const save=async(specifications)=>localGit({cwd,action:'save-specifications',expected:(await status()).revision,specifications})
 try {
  git('init','-b','main');git('config','user.email','test@example.invalid');git('config','user.name','Test')
  await writeFile(join(cwd,'README'),'test');git('add','.');git('commit','-m','initial')
  const base={id:'base',parent:null,text:'Base specification'}
  await save([base]);git('add','.fos/specifications');git('commit','-m','specification')
  const initial=await status()
  assert.equal((await localGit({cwd:join(cwd,'.git'),action:'status'})).head,initial.head)
  await localGit({cwd,action:'create-branch',branch:'feature',expected:initial.revision})
  await save([base,{id:'child',parent:'base',text:'Nested feature'}]);git('add','.fos/specifications');git('commit','-m','feature')
  await localGit({cwd,action:'switch',branch:'main',expected:(await status()).revision})
  await save([base,{id:'other',parent:null,text:'Other feature'}]);git('add','.fos/specifications');git('commit','-m','other')
  const before=await status()
  const merged=await localGit({cwd,action:'merge',branch:'feature',expected:before.revision})
  assert(merged.merged);assert.equal(merged.specifications.length,3)
  assert((await localGit({cwd,action:'status',previousHead:before.head})).merged)
  await assert.rejects(localGit({cwd,action:'save-specifications',expected:before.revision,specifications:[]}),/changed/)
  await assert.rejects(save([{id:'cycle',parent:'cycle',text:'cycle'}]),/cycle/)
  await assert.rejects(save([{id:'../escape',parent:null,text:'invalid'}]),/Invalid/)
  await writeFile(join(cwd,'.fos','private-token'),'secret')
  assert.equal(git('check-ignore','.fos/private-token'),'.fos/private-token')
  assert.match(await readFile(join(cwd,'.fos','.gitignore'),'utf8'),/!specifications/)
  await writeFile(join(cwd,'README'),'dirty')
  await assert.rejects(localGit({cwd,action:'switch',branch:'feature',expected:merged.revision}),/Commit or stash/)
 } finally {await rm(cwd,{recursive:true,force:true})}
})
