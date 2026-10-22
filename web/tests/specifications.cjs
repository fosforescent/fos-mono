const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const NOTE_TYPE = 'lib:type:note'
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-spec-test-'))
try {
 buildSync({stdin:{contents:`export {App} from './src/app'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`,resolveDir:path.resolve(__dirname,'..')},bundle:true,platform:'node',format:'cjs',outfile:path.join(dir,'test.cjs')})
 const {App,createMemoryStorage,addSpecification,specificationRows,importSpecifications,addRow,view,queueSpecificationVerification,verificationRequest}=require(path.join(dir,'test.cjs'))
 const app=new App({baseUrl:'http://localhost',autoLogin:null,storage:createMemoryStorage()});app.scheduleSync=()=>{}
 const root=app.state.view
 let a=addSpecification(app.state.replica,root,'Parent',1),b=addSpecification(a.replica,a.path,'Child',2)
 let r=addRow(b.replica, b.path, NOTE_TYPE,'Evidence',3,{id:'evidence'})
 const specs=specificationRows(r,root);assert.equal(specs.length,2)
 const child=specs.find(row=>row.text==='Child'),parent=specs.find(row=>row.text==='Parent')
 r=importSpecifications(r,root,[{...child,parent:null},{...parent,parent:child.id}],4)
 assert.equal(view(r,[...root,child.id]).tasks.find(row=>row.id==='evidence').title,'Evidence')
 assert.equal(view(r,[...root,child.id]).tasks.find(row=>row.id===parent.id).title,'Parent')
 assert.throws(()=>importSpecifications(r,root,[],5),/non-specification children/)
 assert.throws(()=>importSpecifications(r,root,[{id:'evidence',parent:null,text:'collision'}],5),/collides/)
 assert.throws(()=>importSpecifications(r,root,[{...child,parent:child.id}],5),/cycle/)
 r=queueSpecificationVerification(r,root,'abc123','main',6)
 const queued=view(r,root).tasks.find(row=>row.title.startsWith('Verify specifications'))
 assert(queued);assert.equal(verificationRequest(r,[...root,queued.id]).status,'pending')
 r=queueSpecificationVerification(r,root,'abc123','main',7)
 assert.equal(view(r,root).tasks.filter(row=>row.title.startsWith('Verify specifications')).length,1)
 app.state.replica=r
 const report={commit:'abc123',specifications:specificationRows(r,root),results:specificationRows(r,root).map(row=>({id:row.id,status:'blocked',evidence:'Browser unavailable'}))}
 app.recordFeatureVerification(root,report)
 assert.equal(view(app.state.replica,root).tasks.filter(row=>row.title.startsWith('Blocked verification')).length,2)
 assert.throws(()=>app.recordFeatureVerification(root,report),/already been recorded/)
 console.log('specification projection and manual verification tests passed')
} finally {rmSync(dir,{recursive:true,force:true})}
