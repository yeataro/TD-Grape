/* Exercise preview controls, including stopping while a connection ticket is pending. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(path.resolve(__dirname,'../../src/editor/app.js'),'utf8');
function setup(enabled=true){
  const nodes=new Map(),stored=new Map([['sgrapeAutoPreview',String(enabled)]]),errors=[];
  const $=selector=>{
    if(!nodes.has(selector))nodes.set(selector,{attrs:{},state:'disconnected',style:{},
      setAttribute(k,v){this.attrs[k]=v;},addEventListener(){},classList:{toggle(){}},
      getClientRects(){return [{}];}});
    return nodes.get(selector);
  };
  const panel=$('#preview');let connects=0,disconnects=0,requests=0;
  panel.connect=async()=>{connects++;panel.state='connected';};
  panel.disconnect=()=>{disconnects++;panel.state='disconnected';};
  panel.report=(state,message)=>{panel.state=state;panel.message=message;};
  const context=vm.createContext({$,graph:{},document:{hidden:false},window:{addEventListener(){}},
    location:{hostname:'localhost',href:'http://localhost:1234/shader/test/'},URL,performance,setTimeout,clearTimeout,
    localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},t:k=>k,
    customElements:{whenDefined:async()=>{}},status:message=>errors.push(message),
    editorRequest:async()=>{requests++;return {port:8920,source:'/project1/grape/shader',ticket:'test'};}});
  vm.runInContext(app.slice(app.indexOf('let lastPreviewAt='),app.indexOf('\nfunction fit()')),context);
  vm.runInContext(app.slice(app.indexOf('async function setPreviewEnabled('),app.indexOf('\nasync function refreshProjectFile(')),context);
  return {$,context,stored,errors,panel,stats:()=>({connects,disconnects,requests}),run:code=>vm.runInContext(code,context)};
}
(async()=>{
  const off=setup(false);
  await off.run('preview()');assert.equal(off.stats().requests,0);
  await off.run("$('#refreshpreview').onclick()");
  assert.equal(off.stats().connects,1);assert.equal(off.stored.get('sgrapeAutoPreview'),'true');
  assert.equal(off.$('#autopreview').attrs['aria-pressed'],'true');
  await off.run("$('#autopreview').onclick()");
  assert.equal(off.panel.state,'disconnected');assert.equal(off.stored.get('sgrapeAutoPreview'),'false');
  assert.equal(off.$('#autopreview').attrs['aria-pressed'],'false');
  await off.run("$('#autopreview').onclick()");assert.equal(off.stats().connects,2);

  // Automatic graph refreshes may not reclaim a preview another page took over.
  off.panel.state='replaced';await off.run('preview()');assert.equal(off.stats().connects,2);
  await off.run("$('#refreshpreview').onclick()");assert.equal(off.stats().connects,3);

  const pending=setup();let release,requested;
  const started=new Promise(resolve=>{requested=resolve;});
  pending.context.editorRequest=()=>new Promise(resolve=>{release=resolve;requested();});
  const attempt=pending.run("$('#refreshpreview').onclick()");await started;
  await pending.run("$('#autopreview').onclick()");
  release({port:8920,source:'/project1/grape/shader',ticket:'test'});await attempt;
  assert.equal(pending.stats().connects,0,'stopping must cancel a pending forced connection');
  assert.equal(pending.$('#autopreview').attrs['aria-pressed'],'false');
  assert.equal(pending.$('#livebody').attrs['aria-busy'],'false');

  const failed=setup();failed.context.editorRequest=async()=>{throw new Error('unavailable');};
  await failed.run("$('#refreshpreview').onclick()");
  assert.equal(failed.panel.state,'error');assert.equal(failed.$('#refreshpreview').disabled,false);
  assert.deepEqual(failed.errors,['unavailable']);
  assert.deepEqual(off.errors,[]);assert.deepEqual(pending.errors,[]);
  console.log('Preview controls passed: stop/start, persisted preference, reclaim, pending cancellation, error recovery');
})().catch(error=>{console.error(error);process.exitCode=1;});
