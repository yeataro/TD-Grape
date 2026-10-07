// Old graph (schemaVersion 1) -> grape-graph 1, following the mapping table in
// docs/architecture/GRAPH_FORMAT.md (design-interview Q44). Developer tool, not product:
// it converts the test OP once and adapts legacy-oracle test cases. The future old-graph
// importer implements the same table. Unknown fields are kept as authored (Ghost rule);
// fields whose new home is not defined yet are kept untouched and listed in `pending`.
// 舊圖 → grape-graph 的開發工具（不是產品）：照 GRAPH_FORMAT.md 的對照表轉換；
// 新位置還沒定的欄位原樣保留並列在 pending。
'use strict';
const {randomUUID}=require('node:crypto');

const copy=value=>structuredClone(value);  // keeps -0 and other exact values
const newEdgeId=taken=>{for(;;){const id='e'+randomUUID().replace(/-/g,'');if(!taken.has(id))return id;}};

function convertNode(node,where,pending){
  const {id,definitionUuid,revisionHash,...rest}=node;
  const out={id,nodeType:definitionUuid,...rest};
  const ui=out.ui&&typeof out.ui==='object'&&!Array.isArray(out.ui)?{...out.ui}:undefined;
  if(ui){
    const notes=[];
    // ui.label is dropped; text that differs from the node name moves into comment.
    if(typeof ui.label==='string'&&ui.label.trim()&&ui.label!==out.name)notes.push(ui.label);
    delete ui.label;
    if(typeof ui.comment==='string'&&ui.comment.trim())notes.push(ui.comment);
    delete ui.comment;
    if(notes.length)out.comment=[out.comment,...notes].filter(v=>typeof v==='string'&&v).join('\n');
    if(ui.typeMode==='locked')delete ui.typeMode;
    else if(ui.typeMode!==undefined)pending.push(where+'.ui.typeMode='+JSON.stringify(ui.typeMode)+' (auto type has no field yet)');
    out.ui=ui;
  }
  return out;
}

function convertNetwork(data,where,pending){
  const {edgeSequence,...rest}=data;
  const taken=new Set((data.edges||[]).map(e=>e&&e.id).filter(Boolean));
  return {...rest,
    nodes:(data.nodes||[]).map(n=>convertNode(n,where+'/'+n.id,pending)),
    edges:(data.edges||[]).map(e=>{if(e.id)return {...e};const id=newEdgeId(taken);taken.add(id);return {id,...e};})};
}

function convertDeclaration(d,pending){
  const out={...d};
  delete out.sourceMissing;                                   // TD state, never graph data
  if(out.nativeSequence!=='color')delete out.nativeSequence;  // derivable from kind + type
  for(const key of ['nativeSequence','initialDriver','exposeName','defaultSource','source'])
    if(out[key]!==undefined)pending.push('declaration '+d.id+'.'+key+' (new field defined in its feature round)');
  return out;
}

/** Returns {graph, pending}. Throws for parts whose conversion is defined in a later round. */
function convertOldGraph(old){
  if(!old||typeof old!=='object'||old.schemaVersion!==1)throw Error('Not an old (schemaVersion 1) graph');
  const pending=[];
  const {schemaVersion,functions,typeDefinitions,topInputs,stages,declarations,...rest}=copy(old);
  if(Array.isArray(topInputs)&&topInputs.length)throw Error('TOP inputs convert in the texture-input round');
  const graph={format:'grape-graph',version:1,...rest,
    declarations:(declarations||[]).map(d=>convertDeclaration(d,pending)),
    subgraphs:(functions||[]).map(f=>{
      const {source,graph:inner,...def}=f;
      return {...def,...(def.origin===undefined&&source!==undefined?{origin:source}:{}),graph:convertNetwork(inner,'subgraph '+f.id,pending)};
    }),
    structDefinitions:typeDefinitions||[],
    stages:Object.fromEntries(Object.entries(stages||{}).map(([k,v])=>[k,convertNetwork(v,k,pending)]))};
  return {graph,pending};
}

module.exports={convertOldGraph};

if(require.main===module){
  // node tools/dev/old_graph.cjs <old.json> <new.json>
  const fs=require('node:fs'),[input,output]=process.argv.slice(2);
  if(!input||!output)throw Error('usage: node tools/dev/old_graph.cjs <old.json> <new.json>');
  const {graph,pending}=convertOldGraph(JSON.parse(fs.readFileSync(input,'utf8')));
  fs.writeFileSync(output,JSON.stringify(graph,null,1)+'\n');
  console.log(JSON.stringify({output,pending},null,1));
}
