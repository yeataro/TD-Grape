// Emit one classic-script asset for the existing browser/TD loader. No bundler.
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),configPath=path.join(root,'tsconfig.json');
const config=ts.readConfigFile(configPath,ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
const program=ts.createProgram(parsed.fileNames,parsed.options);
const diagnostics=[...(config.error?[config.error]:[]),...parsed.errors,...ts.getPreEmitDiagnostics(program)];
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:p=>p,getNewLine:()=> '\n'}));process.exit(1);}
function save(file,output){
  if(process.argv.includes('--check')){
    if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==output.replace(/\r\n/g,'\n')){
      console.error('Stale generated asset: '+path.relative(root,file));process.exitCode=1;
    }
  }else fs.writeFileSync(file,output);
}
program.emit(undefined,(file,text)=>{
  const output='// Generated from src/core-ts/*.ts; run npm run build:core.\n'+text;save(file,output);
  const context={};vm.runInNewContext(text,context);
  const definitions=context.GrapeTopCompiler.definitions,ordinary={};
  const catalogPath=path.join(root,'src/library/node_catalog.json');
  const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
  const generatedKeys=Object.entries(definitions).filter(([,spec])=>spec.product).map(([key])=>key);
  const removed=new Set((catalog.frontendGenerated||[]).filter(key=>!generatedKeys.includes(key)));
  if(catalog.history.some(row=>removed.has(row.definition.key)))throw Error('Removing a generated node with catalog history requires an explicit migration');
  catalog.definitions=catalog.definitions.filter(row=>!removed.has(row.definition.key));
  catalog.frontendGenerated=generatedKeys;
  // These selected rows are generated mirrors. Their authoring source is the
  // TS module; the rest of the catalog remains owned by the legacy system.
  const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>canonical(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  for(const [key,spec] of Object.entries(definitions)){
    if(!spec.product)continue;
    const identifier=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value);
    if(spec.kind!=='unary'||![key,spec.operator,spec.port].every(identifier))throw Error('Unsupported ordinary node primitive: '+key);
    const definition={key,label:spec.product.label,inputs:{[spec.port]:'T'},outputs:{out:'T'},stages:['vertex','pixel'],defaults:{type:'float'},descriptionKey:spec.product.descriptionKey,definitionUuid:'sgrape.builtin.'+key};
    definition.revisionHash=createHash('sha256').update(canonical(definition)).digest('hex');
    // Include primitive semantics in the catalog contract so saved artifacts
    // cannot survive an operator change with unchanged ports/presentation.
    const primitive={operator:spec.operator,port:spec.port};
    const row={definition,emitter:{id:key,version:1,primitive},browser:spec.product.browser};
    const index=catalog.definitions.findIndex(entry=>entry.definition.key===key);
    if(index<0)catalog.definitions.push(row);else catalog.definitions[index]=row;
    ordinary[key]=primitive;
  }
  save(catalogPath,JSON.stringify(catalog,null,2)+'\n');
  const htmlPath=path.join(root,'src/editor/index.html'),html=fs.readFileSync(htmlPath,'utf8');
  const pattern=/(<script id="node-browser-data" type="application\/json">)(.*?)(<\/script>)/s;
  const match=html.match(pattern);if(!match)throw Error('Missing editor node-browser projection');
  const navigation={...JSON.parse(match[2]),...catalog.browser,nodes:Object.fromEntries(catalog.definitions.map(row=>[row.definition.definitionUuid,row.browser]))};
  save(htmlPath,html.replace(pattern,(_all,open,_json,close)=>open+JSON.stringify(navigation)+close));
  save(path.join(root,'src/core/frontend_capabilities.json'),JSON.stringify({protocol:context.GrapeTopCompiler.protocol,definitions:Object.keys(definitions).sort().map(k=>'sgrape.builtin.'+k),ordinary},null,2)+'\n');
});
