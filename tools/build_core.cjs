// Emit one classic-script asset for the existing browser/TD loader. No bundler.
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),configPath=path.join(root,'tsconfig.json');
const config=ts.readConfigFile(configPath,ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
const program=ts.createProgram(parsed.fileNames,parsed.options);
const diagnostics=[...(config.error?[config.error]:[]),...parsed.errors,...ts.getPreEmitDiagnostics(program)];
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:p=>p,getNewLine:()=> '\n'}));process.exit(1);}
program.emit(undefined,(file,text)=>{
  const output='// Generated from src/core-ts/wire_planning.ts; run npm run build:core.\n'+text;
  if(process.argv.includes('--check')){
    if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==output.replace(/\r\n/g,'\n')){
      console.error('Stale generated asset: '+path.relative(root,file));process.exitCode=1;
    }
  }else fs.writeFileSync(file,output);
});
