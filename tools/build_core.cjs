// Compose developer node modules into the existing classic-script asset.
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),src=path.join(root,'src/core-ts');
const config=ts.readConfigFile(path.join(root,'tsconfig.json'),ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.ts')?[path.join(dir,e.name)]:[]);}
const nodeFiles=files(path.join(src,'nodes'));
const entryPath=path.join(src,'__composition.ts').replace(/\\/g,'/');
const entry=`import * as wire from './wire_planning';
import * as graph from './graph';
import {createRegistry,resolvePorts,configureNode} from './node_module';
import {createCompiler} from './top_compiler';
${nodeFiles.map((f,i)=>`import n${i} from './${path.relative(src,f).replace(/\\/g,'/').replace(/\.ts$/,'')}';`).join('\n')}
export const registry=createRegistry([${nodeFiles.map((_,i)=>'n'+i).join(',')}]);
export const GrapeWirePlanning=wire;
export const GrapeTopCompiler=createCompiler(registry);
export const GrapeGraph={...graph,registry,createRegistry,createCompiler,resolvePorts,configureNode};
`;
const host=ts.createCompilerHost(parsed.options),read=host.readFile,exists=host.fileExists;
host.readFile=f=>f.replace(/\\/g,'/')===entryPath?entry:read(f);
host.fileExists=f=>f.replace(/\\/g,'/')===entryPath||exists(f);
const program=ts.createProgram([...parsed.fileNames,entryPath],parsed.options,host);
const diagnostics=[...(config.error?[config.error]:[]),...parsed.errors,...ts.getPreEmitDiagnostics(program)];
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:p=>p,getNewLine:()=> '\n'}));process.exit(1);}
const modules={};
program.emit(undefined,(file,text)=>{modules[path.relative(parsed.options.outDir,file).replace(/\\/g,'/').replace(/\.js$/,'')]=text;});
const bundled=`// Generated from src/core-ts; run npm run build:core.\nvar GrapeWirePlanning,GrapeTopCompiler,GrapeGraph;\n(function(){\n'use strict';\nconst factories={\n${Object.entries(modules).sort(([a],[b])=>a<b?-1:1).map(([id,text])=>JSON.stringify(id)+':function(require,module,exports){\n'+text+'\n}').join(',\n')}\n};
const cache=Object.create(null);
function load(id){
  if(cache[id])return cache[id].exports;
  if(!Object.prototype.hasOwnProperty.call(factories,id))throw Error('Unknown bundled module: '+id);
  const module={exports:{}};cache[id]=module;
  factories[id](request=>{
    if(!request.startsWith('.'))throw Error('Only relative core imports are supported');
    const parts=id.split('/');parts.pop();
    for(const part of request.split('/'))if(part==='..')parts.pop();else if(part!=='.')parts.push(part);
    return load(parts.join('/'));
  },module,module.exports);return module.exports;
}
const api=load('__composition');GrapeWirePlanning=api.GrapeWirePlanning;GrapeTopCompiler=api.GrapeTopCompiler;GrapeGraph=api.GrapeGraph;
})();\nif(typeof module!=='undefined'&&module.exports)module.exports=GrapeGraph;\n`;
const context={};vm.runInNewContext(bundled,context);
const ordinary={},nativeSignatures={},catalogPath=path.join(root,'src/library/node_catalog.json');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const rows=context.GrapeGraph.registry.modules.filter(m=>!m.structural).map(m=>JSON.parse(JSON.stringify(m.catalog)));
const keys=rows.map(row=>row.definition.key);
const removed=new Set((catalog.frontendGenerated||[]).filter(key=>!keys.includes(key)));
if(catalog.history.some(row=>removed.has(row.definition.key)))throw Error('Removing a generated node with catalog history requires an explicit migration');
catalog.definitions=catalog.definitions.filter(row=>!removed.has(row.definition.key));catalog.frontendGenerated=keys;
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>canonical(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
// Callback semantics, not just port metadata, invalidate saved artifacts.
const implementationHash=createHash('sha256').update(bundled).digest('hex');
catalog.frontendHash=implementationHash;
for(const row of rows){
  const d=row.definition;delete d.revisionHash;d.definitionUuid||='sgrape.builtin.'+d.key;
  d.revisionHash=createHash('sha256').update(canonical(d)).digest('hex');
  // Execution descriptors belong to the generated capability projection.
  // Keep the catalog emitter identity comparable with historical metadata;
  // the implementation hash above separately invalidates generated artifacts.
  if(row.emitter.primitive){ordinary[d.key]=row.emitter.primitive;delete row.emitter.primitive;}
  if(row.emitter.call){ordinary[d.key]=row.emitter.call;delete row.emitter.call;}
  const index=catalog.definitions.findIndex(r=>r.definition.key===d.key);
  if(index<0)catalog.definitions.push(row);else catalog.definitions[index]=row;
  const module=context.GrapeGraph.registry.get(d.definitionUuid);
  if(module.signatures)nativeSignatures[d.key]=module.signatures({id:'projection',definitionUuid:d.definitionUuid,params:d.defaults},{declaration:()=>undefined});
}
const htmlPath=path.join(root,'src/editor/index.html'),html=fs.readFileSync(htmlPath,'utf8');
const pattern=/(<script id="node-browser-data" type="application\/json">)(.*?)(<\/script>)/s;
const match=html.match(pattern);if(!match)throw Error('Missing editor node-browser projection');
const navigation={...JSON.parse(match[2]),...catalog.browser,nodes:Object.fromEntries(catalog.definitions.map(row=>[row.definition.definitionUuid,row.browser]))};
const outputs=new Map([
  [path.join(root,'src/editor/wire_planning.js'),bundled],
  [catalogPath,JSON.stringify(catalog,null,2)+'\n'],
  [htmlPath,html.replace(pattern,(_all,open,_json,close)=>open+JSON.stringify(navigation)+close)],
  [path.join(root,'src/core/frontend_capabilities.json'),JSON.stringify({protocol:context.GrapeTopCompiler.protocol,definitions:context.GrapeGraph.registry.modules.map(m=>m.catalog.definition.definitionUuid).sort(),ordinary,nativeSignatures},null,2)+'\n']
]);
// Publish only after all checks and projections have succeeded.
for(const [file,output] of outputs){
  if(process.argv.includes('--check')){
    if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==output.replace(/\r\n/g,'\n')){console.error('Stale generated asset: '+path.relative(root,file));process.exitCode=1;}
  }else fs.writeFileSync(file,output);
}
