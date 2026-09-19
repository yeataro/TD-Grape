/* Verify user-visible save states through real handlers, including in-flight edits. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.resolve(__dirname,'../../src/editor'),elements=new Map();
const element=()=>({setAttribute(){},textContent:'',title:'',disabled:false,hidden:false,addEventListener(){},replaceChildren(){},
  classList:{add(){},remove(){},toggle(){}}});
const context=vm.createContext({assert,console,crypto:globalThis.crypto,location:{pathname:'/',hash:''},history:{replaceState(){}},window:{addEventListener(){}},
  document:{addEventListener(){},querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s);},querySelectorAll(){return [];}},
  sessionStorage:{getItem(){return '';},setItem(){},removeItem(){}},setTimeout(){return 1;},clearTimeout(){}});
for(const name of ['functions_model.js','functions_ui.js','graph_ui.js','inspector.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context);
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
vm.runInContext(app.slice(0,app.indexOf("$('#canvas').addEventListener('dragover'")),context);
vm.runInContext(`
(async()=>{
render=()=>{};preview=async()=>{};refreshUniforms=()=>{};renderNativeSourceValues=()=>{};
const fixture={schemaVersion:1,target:'top',declarations:[],functions:[{id:'f',graph:{nodes:[{id:'inner',params:{value:1},ui:{x:0,y:0}}],edges:[]}}],
  stages:{pixel:{nodes:[{id:'value',params:{value:1},ui:{x:0,y:0}}],edges:[]}}};
const setup=()=>{graph=clone(fixture);revision=41;dirty=false;readonly=false;submitBusy=false;conflicted=false;connectionInterrupted=false;applyNeedsReview=false;
  editVersion=0;graphTrail=[];past=[];future=[];historyNativeToken=null;historyBusy=false;nativeMutationBusy=false;applyInFlight=null;rememberSavedGraph(graph);renderGraphSaveState();};
const move=()=>{const before=clone(graph);graph.stages.pixel.nodes[0].ui.x+=24;recordGraphHistory(before);mark();};
let respond;
api=(route,body)=>{assert.equal(route,'apply');return new Promise(resolve=>{respond=(shaderUpdated=false)=>resolve({state:{graph:body.graph,revision:body.revision+1},shaderUpdated,target:'/test/shader'});});};
const check=(badge,message)=>{assert.equal($('#dirty').textContent,badge);if(message)assert.equal($('#status').textContent,message);};
setup();check('graph.saved');move();check('graph.savePending');
let pending=applyGraph();check('graph.savePending','graph.saving');respond();await pending;
check('graph.saved','graph.saved');assert.equal(revision,42);assert.equal(dirty,false);
assert.ok($('#dirty').title.endsWith('42'),'revision stays available in the tooltip');
await undo();check('graph.savePending');pending=applyGraph();respond();await pending;check('graph.saved');
await undo(true);check('graph.savePending');pending=applyGraph();respond();await pending;check('graph.saved');
// A movement cannot downgrade an outstanding parameter or wire edit.
setup();graph.stages.pixel.nodes[0].params.value=2;mark();move();check('graph.pending');
pending=applyGraph();check('graph.pending','material.compiling');respond(true);await pending;check('graph.applied','material.applied');
setup();graph.stages.pixel.edges.push({from:['a','out'],to:['b','in']});mark();move();check('graph.pending');
// After a Shader request completes, a later movement only needs position saving.
setup();graph.stages.pixel.nodes[0].params.value=2;mark();pending=applyGraph();move();respond(true);await pending;
check('graph.savePending','graph.savePending');assert.equal(dirty,true);
pending=applyGraph();check('graph.savePending','graph.saving');respond();await pending;check('graph.saved');
// A position response cannot hide a newer parameter edit or declare it saved.
setup();move();pending=applyGraph();graph.stages.pixel.nodes[0].params.value=3;mark();respond();await pending;
check('graph.pending','graph.pending');assert.equal(dirty,true);
// The actual server result wins if a stale native Shader needed rebuilding.
setup();move();pending=applyGraph();respond(true);await pending;check('graph.applied','material.applied');
// Failed saves remain pending and do not advance the revision.
setup();move();api=async()=>{throw Error('fixture failure');};await applyGraph();
check('graph.savePending','graph.saveFailedfixture failure');assert.equal(dirty,true);assert.equal(revision,41);
// Subgraph positions are layout; code labels and settings are not.
setup();graph.functions[0].graph.nodes[0].ui.y=48;mark();check('graph.savePending');
setup();graph.stages.pixel.nodes[0].ui.componentsExpanded=true;mark();check('graph.savePending');
setup();graph.functions[0].graph.nodes[0].ui.componentsExpanded=false;mark();check('graph.savePending');
setup();graph.stages.pixel.nodes[0].ui.width=420;mark();check('graph.savePending');
setup();graph.functions[0].graph.nodes[0].ui.width=360;mark();check('graph.savePending');
setup();graph.stages.pixel.nodes[0].ui.height=300;mark();check('graph.savePending');
setup();graph.functions[0].graph.nodes[0].ui.height=500;mark();check('graph.savePending');
setup();graph.stages.pixel.nodes[0].ui.label='GLSL comment';mark();check('graph.pending');
setup();graph.stages.pixel.nodes[0].ui.typeMode='locked';mark();check('graph.pending');
setup();graph.catalogSnapshot={serverMetadata:true};move();check('graph.savePending');
console.log('Editor save status passed: positions, undo/redo, mixed edits, delayed responses, server rebuild, failure and subgraphs');
})()
`,context).catch(error=>{console.error(error);process.exitCode=1;});
