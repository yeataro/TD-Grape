/* Run the real recorders; keep native/live admission and snapshot ownership. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=process.argv[2]||path.resolve(__dirname,'../../src/editor');
const source=fs.readFileSync(path.join(dir,'app.js'),'utf8');
const start=source.indexOf('// History follows user commits'),end=source.indexOf('function scheduleGraphApply',start);
assert.ok(start>=0&&end>start);
const clone=v=>JSON.parse(JSON.stringify(v));
const cloneInputs=[];
const context=vm.createContext({assert,crypto:globalThis.crypto,graph:null,past:[],future:[],
  clone(value){cloneInputs.push(value);return clone(value);}});
vm.runInContext(source.slice(start,end),context);
vm.runInContext('renderHistoryActions=()=>{};',context);
const run=code=>vm.runInContext(code,context);
const document=()=>({schemaVersion:1,target:'top',declarations:[],functions:[],catalogSnapshot:{definitions:[{id:'catalog-only'}]},stages:{pixel:{nodes:[{id:'n',params:{value:1},ui:{x:1,y:2}}],edges:[]}}});
const fresh=()=>{context.graph=document();context.before=clone(context.graph);context.past=[];context.future=[{id:'redo'}];cloneInputs.length=0;};
const plain=value=>clone(value);
let passed=0;
const test=(name,fn)=>{fresh();fn();passed++;console.log('PASS '+name);};

test('graph no-op preserves redo, including native-token options',()=>{
 const redo=context.future;
 assert.equal(run('recordGraphHistory(before)'),null);
 assert.equal(run("recordGraphHistory(before,{nativeApplied:true,nativeBefore:'old',nativeAfter:'new'})"),null);
 assert.equal(context.past.length,0);assert.strictEqual(context.future,redo);
});
test('root catalog changes are ignored without mutating either input',()=>{
 context.graph.catalogSnapshot={definitions:[{id:'new-catalog'}]};const original=clone(context.graph);
 assert.equal(run('recordGraphHistory(before)'),null);assert.deepEqual(context.graph,original);
 cloneInputs.length=0;run('historyGraphKey(graph)');
 assert.equal(cloneInputs.length,1);assert.equal(Object.hasOwn(cloneInputs[0],'catalogSnapshot'),false,'comparison must not deep-copy the excluded catalog');
});
test('nested catalog names and layout remain document content',()=>{
 context.graph.stages.pixel.nodes[0].params.catalogSnapshot={value:2};
 assert.ok(run('recordGraphHistory(before)'));assert.equal(context.past.length,1);
 fresh();context.graph.stages.pixel.nodes[0].ui.x=7;
 assert.ok(run('recordGraphHistory(before)'));
});
test('object key order is ignored; array order remains significant',()=>{
 context.graph.stages.pixel.nodes[0].ui={y:2,x:1};assert.equal(run('recordGraphHistory(before)'),null);
 fresh();context.before.stages.pixel.nodes[0].params.items=[1,2];context.graph.stages.pixel.nodes[0].params.items=[2,1];
 assert.ok(run('recordGraphHistory(before)'));
});
test('JSON normalization and key semantics match the original algorithm',()=>{
 const originalKey=value=>{const v=clone(value);delete v.catalogSnapshot;const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;return JSON.stringify(ordered(v));};
 const fixtures=[document(),{a:undefined,b:NaN,c:Infinity,d:[undefined,null,1],catalogSnapshot:{ignored:true}},
  {a:{catalogSnapshot:{retained:1}},catalogSnapshot:null},{a:{z:1,b:2},v:[3,2,1]},{}];
 for(const item of fixtures){context.item=item;assert.equal(run('historyGraphKey(item)'),originalKey(item));}
});
test('changed graph records once, owns complete snapshots, and avoids duplicate keys',()=>{
 context.graph.stages.pixel.nodes[0].params.value=2;
 const step=run('recordGraphHistory(before)');assert.strictEqual(step,context.past[0]);
 assert.equal(context.future.length,0);assert.equal(context.past.length,1);
 assert.equal(cloneInputs.length,4,'two comparison clones and two owned snapshots');
 assert.equal(cloneInputs.filter(v=>Object.hasOwn(v,'catalogSnapshot')).length,2,'only stored snapshots clone catalog metadata');
 assert.deepEqual(plain(step.before.catalogSnapshot),document().catalogSnapshot);
 assert.deepEqual(plain(step.after.catalogSnapshot),document().catalogSnapshot);
 context.before.stages.pixel.nodes[0].params.value=99;context.graph.stages.pixel.nodes[0].params.value=100;
 context.before.catalogSnapshot.definitions[0].id='changed-before';context.graph.catalogSnapshot.definitions[0].id='changed-after';
 assert.equal(step.before.stages.pixel.nodes[0].params.value,1);assert.equal(step.after.stages.pixel.nodes[0].params.value,2);
 assert.equal(step.before.catalogSnapshot.definitions[0].id,'catalog-only');assert.equal(step.after.catalogSnapshot.definitions[0].id,'catalog-only');
});
test('native-only change retains its immutable delta tokens and same graph',()=>{
 const step=run("recordHistory({kind:'source',before:clone(before),after:clone(graph),nativeApplied:true,nativeBefore:'old',nativeAfter:'new'})");
 assert.ok(step);assert.equal(step.deltaBefore,'old');assert.equal(step.deltaAfter,'new');
 assert.deepEqual(plain(step.before),plain(step.after));assert.equal(context.future.length,0);
});
test('unchanged or unapplied native tokens do not create empty records',()=>{
 const redo=context.future;
 assert.equal(run("recordHistory({before,after:graph,nativeApplied:true,nativeBefore:'same',nativeAfter:'same'})"),null);
 assert.equal(run("recordHistory({before,after:graph,nativeApplied:false,nativeBefore:'old',nativeAfter:'new'})"),null);
 assert.strictEqual(context.future,redo);assert.equal(context.past.length,0);
});
test('live receipt reservation survives equal graphs and preserves receipt/future identity',()=>{
 context.receipt=Promise.resolve('fixture-receipt');const previousFuture=context.future;
 const step=run("recordHistory({kind:'liveValue',before:clone(before),after:clone(graph),liveReceipt:receipt,liveEmptyFuture:future})");
 assert.ok(step);assert.strictEqual(step.liveReceipt,context.receipt);assert.strictEqual(step.liveEmptyFuture,previousFuture);
 assert.strictEqual(step,context.past[0]);assert.equal(context.future.length,0);
});
test('graph edits with native receipts retain metadata and changed source IDs',()=>{
 context.before.declarations=[{id:'u',kind:'uniform',type:'float'}];context.graph.declarations=[{id:'u',kind:'uniform',type:'vec3'}];
 const step=run("recordGraphHistory(before,{nativeApplied:true,nativeBefore:'old',nativeAfter:'new'})");
 assert.deepEqual(plain(step.sourceIds),['u']);assert.equal(step.deltaBefore,'old');assert.equal(step.deltaAfter,'new');
});
test('history remains capped at 60 and records the current epoch',()=>{
 run('historyEpoch=7');
 for(let i=0;i<65;i++){context.before=clone(context.graph);context.graph.stages.pixel.nodes[0].params.value=i+2;run('recordGraphHistory(before)');}
 assert.equal(context.past.length,60);assert.equal(context.past[0].before.stages.pixel.nodes[0].params.value,6);
 assert.equal(context.past.at(-1).after.stages.pixel.nodes[0].params.value,66);assert.equal(context.past.at(-1).epoch,7);
});
console.log(`History recording: ${passed} tests passed`);
