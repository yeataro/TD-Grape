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
import * as values from './values';
import {createRegistry,resolvePorts,configureNode} from './node_module';
import {createCompiler} from './top_compiler';
import {overLimit} from './capacity';
import {structureProblems,offered,removable} from './structure';
import {createEditorContract} from './editor_contract';
import {formatProblem} from './model';
import {ghostsOf} from './ghosts';
import {declarationKinds,declarationNameProblem,freeDeclarationName} from './declarations';
${nodeFiles.map((f,i)=>`import n${i} from './${path.relative(src,f).replace(/\\/g,'/').replace(/\.ts$/,'')}';`).join('\n')}
export const registry=createRegistry([${nodeFiles.map((_,i)=>'n'+i).join(',')}]);
export const GrapeTopCompiler=createCompiler(registry);
export const GrapeGraph={...graph,plan:wire.plan,values,registry,createRegistry,createCompiler,resolvePorts,configureNode,createEditorContract,overLimit,structureProblems,offered,removable,formatProblem,ghostsOf,declarationKinds,declarationNameProblem,freeDeclarationName};
`;
const host=ts.createCompilerHost(parsed.options),read=host.readFile,exists=host.fileExists;
host.readFile=f=>f.replace(/\\/g,'/')===entryPath?entry:read(f);
host.fileExists=f=>f.replace(/\\/g,'/')===entryPath||exists(f);
const program=ts.createProgram([...parsed.fileNames,entryPath],parsed.options,host);
const diagnostics=[...(config.error?[config.error]:[]),...parsed.errors,...ts.getPreEmitDiagnostics(program)];
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:p=>p,getNewLine:()=> '\n'}));process.exit(1);}
const modules={};
program.emit(undefined,(file,text)=>{modules[path.relative(parsed.options.outDir,file).replace(/\\/g,'/').replace(/\.js$/,'')]=text;});
const bundled=`// Generated from src/core-ts; run npm run build:core.\nvar GrapeTopCompiler,GrapeGraph;\n(function(){\n'use strict';\nconst factories={\n${Object.entries(modules).sort(([a],[b])=>a<b?-1:1).map(([id,text])=>JSON.stringify(id)+':function(require,module,exports){\n'+text+'\n}').join(',\n')}\n};
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
const api=load('__composition');GrapeTopCompiler=api.GrapeTopCompiler;GrapeGraph=api.GrapeGraph;
})();\nif(typeof module!=='undefined'&&module.exports)module.exports=GrapeGraph;\n`;
const context={};vm.runInNewContext(bundled,context);
const rows=context.GrapeGraph.registry.modules.filter(m=>!m.structural).map(m=>JSON.parse(JSON.stringify(m.catalog)));
// Callback semantics, not just port metadata, invalidate saved artifacts.
const implementationHash=createHash('sha256').update(bundled).digest('hex');
const defaultGraph={format:'grape-graph',version:1,target:'top',declarations:[],subgraphs:[],structDefinitions:[],stages:{pixel:{
  nodes:['color','pixel_out'].map((key,i)=>{const d=context.GrapeGraph.registry.get('sgrape.builtin.'+key).catalog.definition;return {id:key,nodeType:d.definitionUuid,params:JSON.parse(JSON.stringify(d.defaults)),ui:{x:80+i*360,y:120}};}),
  edges:[{id:'color_output',from:['color','out'],to:['pixel_out','color']}]}}};
const defaultDocument={graph:defaultGraph,compiled:context.GrapeTopCompiler.compile(defaultGraph)};
// Native source labels are cold host metadata, independent of Python graph compilation.
const sourceCatalog=JSON.parse(fs.readFileSync(path.join(root,'src/library/source_catalog.json'),'utf8'));
const sourceContract=Object.fromEntries(['version','uniformPresets','menuGroups','nodeSources'].map(key=>[key,sourceCatalog[key]]));
for(const row of rows)row.definition.definitionUuid||='sgrape.builtin.'+row.definition.key;
// Generated files live in src/generated/ (Refactor.25): the new editor, TD's Manager and tests read
// them; never edit them by hand. 產生的檔案放 src/generated/，新編輯器、TD Manager、測試共用；不要手改。
const generated=path.join(root,'src/generated');
const outputs=new Map([
  [path.join(generated,'grape_core.js'),bundled],
  [path.join(generated,'editor-bootstrap.json'),JSON.stringify({version:1,producer:'frontend-modules',
    catalogHash:implementationHash,defaultDocument,catalog:rows.map(row=>row.definition),
    typeContract:{...context.GrapeGraph.createEditorContract(context.GrapeGraph.registry,'top'),sources:sourceContract}},null,2)+'\n']
]);
// Publish only after all checks and projections have succeeded.
for(const [file,output] of outputs){
  if(process.argv.includes('--check')){
    if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==output.replace(/\r\n/g,'\n')){console.error('Stale generated asset: '+path.relative(root,file));process.exitCode=1;}
  }else fs.writeFileSync(file,output);
}
