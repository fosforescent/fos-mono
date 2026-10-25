const assert=require('node:assert/strict')
const {buildSync}=require('esbuild')
const {mkdtempSync,rmSync}=require('node:fs')
const path=require('node:path')
const {JSDOM}=require('jsdom')
const dir=mkdtempSync(path.join(require('node:os').tmpdir(),'fos-git-ui-'))
const dom=new JSDOM('',{url:'http://localhost'})
for(const key of ['window','document','localStorage','Option']) globalThis[key]=dom.window[key]
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true}
const originalTimer=globalThis.setTimeout
let poll
// Drive the background watcher without sleeping or launching real agents.
globalThis.setTimeout=(callback,delay,...args)=>delay===3000?(poll=callback,0):originalTimer(callback,delay,...args)
buildSync({stdin:{contents:`export {localGitControls,openSpecificationVerification} from './src/local-git'; export {App} from './src/app';export {createMemoryStorage} from './src/storage';export * from '../shared/sync/index'`,resolveDir:path.resolve(__dirname,'..')},bundle:true,platform:'node',format:'cjs',outfile:path.join(dir,'app.cjs')})
const {App,createMemoryStorage,localGitControls,openSpecificationVerification,specificationRows,view,verificationRequest}=require(path.join(dir,'app.cjs'))
async function main(){
 const app=new App({baseUrl:'http://localhost',autoLogin:null,storage:createMemoryStorage()});app.scheduleSync=()=>{}
 const root=app.applyConstructor(app.state.view,{type:'title',text:'Repository',done:false,peer:'filesystem'},false,undefined,'/repo')
 app.addFeatureSpecification(root)
 const specs=specificationRows(app.state.replica,root)
 let snapshot={cwd:'/repo',branch:'main',head:'a'.repeat(40),revision:'a',specifications:[],branches:['main'],merged:false,dirty:false}
 const calls=[]; let userLaunch=false, launched
 window.__TAURI__={core:{invoke:async(command,{request})=>{
  calls.push(command)
  if(command==='agent_start' && userLaunch) {launched=request; return 'run-1'}
  if(command==='agent_poll' && userLaunch) return {finished:true,events:[{type:'completed'}]}
  assert.equal(command,'local_git','background synchronization never spawns an agent')
  if(request.action==='save-specifications'){assert.equal(request.expected,snapshot.revision);snapshot={...snapshot,specifications:request.specifications,revision:'saved'}}
  return structuredClone(snapshot)
 }}}
 localGitControls(app)
 await new Promise(setImmediate)
 assert.deepEqual(snapshot.specifications,specs)
 snapshot={...snapshot,head:'b'.repeat(40),revision:'merged',merged:true,specifications:[...specs,{id:'new-spec',parent:null,text:'Merged feature'}]}
 poll(); await new Promise(setImmediate)
 assert.equal(specificationRows(app.state.replica,root).length,2)
 const tasks=view(app.state.replica,root).tasks.filter(row=>verificationRequest(app.state.replica,[...root,row.id]))
 assert.equal(tasks.length,1)
 assert.equal(verificationRequest(app.state.replica,[...root,tasks[0].id]).status,'pending')
 poll(); await new Promise(setImmediate)
 assert.equal(view(app.state.replica,root).tasks.filter(row=>verificationRequest(app.state.replica,[...root,row.id])).length,1)
 assert(calls.every(command=>command==='local_git'))
 userLaunch=true
 await openSpecificationVerification(app,root)
 const launch=[...document.querySelectorAll('button')].find(button=>button.textContent==='Verify with Codex')
 assert(launch,'verification action offers an explicit agent choice')
 launch.click(); await new Promise(setImmediate)
 assert.equal(launched.provider,'codex');assert.equal(launched.verify,true)
 assert(!launched.mcp,'verification receives read-only snapshot context, not the node MCP')
 assert(launched.prompt.includes(snapshot.head));assert(launched.context.nodes.some(node=>node.text==='Merged feature'))
 console.log('PASS: Git peer projects specs and queues manual verification without launching agents')
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{globalThis.setTimeout=originalTimer;dom.window.close();rmSync(dir,{recursive:true,force:true})})
