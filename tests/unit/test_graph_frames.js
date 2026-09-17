const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({crypto:require('node:crypto').webcrypto,TextEncoder});
vm.runInContext(fs.readFileSync('src/editor/functions_model.js','utf8')+'\nthis.frames=GraphFrames;this.clip=GraphClipboard;this.model=FunctionModel;',context);
const {frames,clip,model}=context,plain=value=>JSON.parse(JSON.stringify(value));
const catalog=JSON.parse(fs.readFileSync('src/library/node_catalog.json','utf8')).definitions.map(d=>d.definition);
const node=id=>({id,definitionUuid:'sgrape.builtin.float',params:{value:.5},ui:{x:20,y:40}});
const frame=(id,nodes)=>({id,name:'Group '+id,nodes,color:'#aB12ef'});
const graph=()=>({target:'top',declarations:[],functions:[],stages:{pixel:{nodes:['a','b','c','d'].map(node),edges:[]}}});
const g=graph(),data=g.stages.pixel;
data.ui={view:{x:4},frames:[frame('first',['a','b']),frame('second',['b','c','missing']),null,{id:'invalid id',name:'Bad',nodes:['d']}]};
const before=JSON.stringify(data),read=plain(frames.read(data));
assert.deepEqual(read,[frame('first',['a','b']),frame('second',['c'])]);assert.equal(JSON.stringify(data),before);
for(const malformed of [null,{},[],{ui:{frames:null}},{nodes:null,ui:{frames:[null,{},frame('ok',['a'])]}}])assert.deepEqual(plain(frames.read(malformed)),[]);
frames.prune(data);assert.equal(frames.valid(data),true);assert.deepEqual(data.ui.view,{x:4});
data.nodes=data.nodes.filter(n=>n.id!=='a');frames.prune(data);assert.deepEqual(plain(data.ui.frames[0].nodes),['b']);
data.nodes=[];frames.prune(data);assert.deepEqual(data.ui,{view:{x:4}});delete data.ui.view;frames.write(data,[]);assert.equal(data.ui,undefined);

const source=graph(),s=source.stages.pixel;frames.write(s,[frame('pair',['a','b'])]);
const partial=clip.decode(clip.encode(source,s,['a'],'source'));assert.equal(partial.ui,undefined);
const packet=clip.decode(clip.encode(source,s,['a','b'],'source'));assert.deepEqual(plain(packet.ui.frames),[frame('pair',['a','b'])]);
const options={source:'other',target:'top',stage:'pixel',catalog,types:['float','vec2','vec3','vec4'],anchor:{x:200,y:300}};
const target=graph(),t=target.stages.pixel;t.nodes=[];
const pasted=clip.paste(target,t,packet,options),first=t.ui.frames[0];
assert.notEqual(first.id,'pair');assert.deepEqual(plain(first.nodes),plain(pasted));assert.equal(first.color,'#aB12ef');
const again=clip.paste(target,t,packet,options);assert.equal(t.ui.frames.length,2);assert.notEqual(first.id,t.ui.frames[1].id);assert.deepEqual(plain(t.ui.frames[1].nodes),plain(again));assert.equal(frames.valid(t),true);
for(const mutate of [f=>f.nodes.push('missing'),f=>f.nodes.push('a'),f=>f.color='red;position:fixed',f=>f.name='bad\nname',f=>f.name='x'.repeat(81),f=>f.id='unsafe id']){
  const bad=plain(packet);mutate(bad.ui.frames[0]);const dest=graph(),original=JSON.stringify(dest);
  assert.throws(()=>clip.paste(dest,dest.stages.pixel,bad,options),/clipboard.invalid/);assert.equal(JSON.stringify(dest),original);
}
const bad=graph();bad.stages.pixel.ui={frames:[frame('one',['a']),frame('two',['a'])]};assert.equal(frames.valid(bad.stages.pixel),false);
const color=graph();color.stages.pixel.ui={frames:[{...frame('safe',['a']),color:'url(evil)'}]};assert.equal(frames.read(color.stages.pixel)[0].color,undefined);

// Moving or copying Functions preserves graph-local frame identities and metadata.
const library={id:'library',name:'Library',scope:'library',source:{id:'library',version:'v1'},stages:['pixel'],inputs:[],outputs:[],graph:plain(s)};
const imported=graph(),fn=model.importLibrary(imported,library);assert.deepEqual(plain(fn.graph.ui.frames),[frame('pair',['a','b'])]);
const call={id:'call',definitionUuid:model.CALL,params:{functionId:fn.id}};imported.stages.pixel.nodes=[call];
const mapping=model.localize(imported,fn.id),local=model.find(imported,mapping.get('library'));assert.deepEqual(plain(local.graph.ui.frames),[frame('pair',['a','b'])]);
const independent=model.independent(imported,call);assert.deepEqual(plain(independent.graph.ui.frames),[frame('pair',['a','b'])]);

// Exercise the real extraction/duplicate functions without DOM interactions.
const sourceUI=fs.readFileSync('src/editor/functions_ui.js','utf8'),sourceGraph=fs.readFileSync('src/editor/graph_ui.js','utf8');
vm.runInContext(`
  var graph,selection,selected,selectedEdge,stage='pixel',catalog=[];
  const clone=x=>JSON.parse(JSON.stringify(x)),current=()=>graph.stages.pixel,canDeleteNode=()=>true;
  const uniqueNodeName=name=>name,assignCreatedNodeNames=()=>{};
  function change(fn){fn();for(const data of [...Object.values(graph.stages),...(graph.functions||[]).map(f=>f.graph)])GraphFrames.prune(data);}
  ${sourceUI.slice(sourceUI.indexOf('function groupSelection('),sourceUI.indexOf('function renameGraphFunction('))}
  ${sourceGraph.slice(sourceGraph.indexOf('function duplicateSelection('),sourceGraph.indexOf('function installGraphInteractions('))}
  this.extract=(value,ids)=>{graph=value;selection=new Set(ids);groupSelection();return graph;};
  this.duplicate=(value,ids)=>{graph=value;selection=new Set(ids);duplicateSelection();return graph;};
`,context);
const whole=graph();frames.write(whole.stages.pixel,[frame('whole',['a','b']),frame('rest',['c','d'])]);context.extract(whole,['a','b']);
assert.deepEqual(plain(whole.functions[0].graph.ui.frames),[frame('whole',['a','b'])]);assert.deepEqual(plain(whole.stages.pixel.ui.frames),[frame('rest',['c','d'])]);
const subset=graph();frames.write(subset.stages.pixel,[frame('split',['a','b','c'])]);context.extract(subset,['a','b']);
assert.equal(subset.functions[0].graph.ui,undefined);assert.deepEqual(plain(subset.stages.pixel.ui.frames),[frame('split',['c'])]);
const duplicate=graph();frames.write(duplicate.stages.pixel,[frame('pair',['a','b'])]);context.duplicate(duplicate,['a','b']);
assert.equal(duplicate.stages.pixel.ui.frames.length,2);assert.notEqual(duplicate.stages.pixel.ui.frames[1].id,'pair');assert.ok(duplicate.stages.pixel.ui.frames[1].nodes.every(id=>!['a','b'].includes(id)));assert.equal(frames.valid(duplicate.stages.pixel),true);
context.duplicate(duplicate,['a']);assert.equal(duplicate.stages.pixel.ui.frames.length,2);
console.log('Graph frames: safe reads, cleanup, colors, complete/partial clipboard, remapping, library copies, subgraph extraction and duplication passed');
