/* Generated names must survive creation/copy and the real compiler validator. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,stateFile,folder]=process.argv.slice(2),root=path.resolve(__dirname,'../..'),python=process.env.PYTHON_EXECUTABLE||'python';
 fs.mkdirSync(folder,{recursive:true});
 const fixture=path.join(folder,'state.json');
 execFileSync(python,[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture]);
 const demo=JSON.parse(execFileSync(python,['-B','-c',"import sys,json;sys.path.insert(0,'src/core');import sgrape_core as c;print(json.dumps(c.demo_graph('color','mat')))"],{cwd:root,encoding:'utf8'}));
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
 const graphs=[];
 try{
  await page.selectOption('#language','en');
  await page.evaluate(demo=>{
   uniformLive.disconnect();uniformLive.connect=()=>{};nativeSourcePolling=uniformPolling=customPolling=true;
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=historyBusy=nativeMutationBusy=false;
   graph=demo;graphTrail=[];stage='vertex';editorTarget='mat';past=[];future=[];dirty=false;selected=selectedEdge=null;selection.clear();render();
   window.createNamed=(key,x,y)=>{let created;const changed=change(()=>created=instantiate(catalog.find(d=>d.key===key),x,y));if(!changed)throw Error('Creation rejected');return created.id;};
   window.arrayIds=[createNamed('array_get',440,60),createNamed('array_get',440,360)];
  },demo);await settle();
  assert.deepEqual(await page.evaluate(()=>arrayIds.map(id=>current().nodes.find(n=>n.id===id).name)),['Array_i','Array_i_1']);
  checks.push('Creating two Array[i] nodes produces unique valid names without a trailing separator');

  await page.evaluate(()=>{
   const source=testNode('cameras','builtin_source',30,60,{source:'uTDCamInfos'}),router=testNode('route','router',300,300);
   change(()=>current().nodes.push(source,router));
   const connect=(from,to,port)=>{if(!connectPorts({node:from,kind:'outputs',port:'out'},{node:to,kind:'inputs',port}))throw Error('Connection rejected');};
   connect(source.id,arrayIds[0],'Array');connect(source.id,router.id,'value');connect(router.id,arrayIds[1],'Array');
   selected=arrayIds[1];selection=new Set([selected]);inspectorTab='parameters';workspaceLayout.setFloatingParameter(true);render();
  });await settle();
  assert.deepEqual(await page.evaluate(()=>arrayIds.map(id=>ports(current().nodes.find(n=>n.id===id),'outputs').out)),['TDCameraInfo','TDCameraInfo']);
  graphs.push(await page.evaluate(()=>clone(graph)));
  checks.push('Direct and Router-connected uTDCamInfos arrays retain the same TDCameraInfo output');

  const beforeDuplicate=await page.evaluate(()=>JSON.stringify(graph));
  await page.evaluate(()=>duplicateSelection());await settle();
  assert.equal(await page.evaluate(()=>nodeNameValid(current().nodes.find(n=>n.id===selected).name)),true);
  graphs.push(await page.evaluate(()=>clone(graph)));
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeDuplicate);
  await page.evaluate(()=>undo(true));await settle();
  checks.push('Duplicate creates a valid name and one Undo restores the complete graph');

  const paste=await page.evaluate(()=>{selected=arrayIds[1];selection=new Set([selected]);render();return copyGraphSelection();}),beforePaste=await page.evaluate(()=>JSON.stringify(graph));
  assert.equal(await page.evaluate(text=>pasteGraphSelection(text,{x:800,y:300}),paste),true);await settle();
  graphs.push(await page.evaluate(()=>clone(graph)));
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforePaste);
  await page.evaluate(()=>undo(true));await settle();
  checks.push('Copy/paste resolves the name collision and remains independently undoable');

  // An older saved Array_i_ and an explicit trailing underscore remain legal;
  // only names assigned to new nodes are normalized.
  await page.evaluate(()=>{const old=current().nodes.find(n=>n.id===arrayIds[0]);old.name='Array_i_';selected=old.id;selection=new Set([old.id]);duplicateSelection();});
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id===arrayIds[0]).name),'Array_i_');
  graphs.push(await page.evaluate(()=>clone(graph)));
  checks.push('Duplicating a legacy trailing-underscore name keeps the original unchanged');

  const cases=await page.evaluate(()=>{
   const hints=['Array[i]','Value_','Value!!!','A'.repeat(37)+'_Tail','float','gl_Value','___','中文',...catalog.map(d=>d.label)];
   return hints.map(hint=>{const nodes=[];for(let i=0;i<4;i++)nodes.push({name:uniqueNodeName(hint,null,nodes),params:{}});return {hint,names:nodes.map(n=>n.name)};});
  });
  for(const row of cases){assert.equal(new Set(row.names).size,row.names.length);for(const name of row.names)assert.ok(!name.includes('__')&&name.length<=48,JSON.stringify(row));}
  const payload=path.resolve(folder,'compiler-input.json');fs.writeFileSync(payload,JSON.stringify({graphs,cases}));
  const compiled=JSON.parse(execFileSync(python,['-B','-c',[
   'import sys,json,copy',"sys.path.insert(0,'src/core')",'import sgrape_core as c',
   "data=json.load(open(sys.argv[1],encoding='utf-8'))",
   'for row in data["cases"]:',
   ' for name in row["names"]: assert c.glsl_code_name(name),(row["hint"],name)',
   'for graph in data["graphs"]:',
   ' before=copy.deepcopy(graph);c.compile_graph(graph);assert graph==before',
   'bad=copy.deepcopy(data["graphs"][0])',
   'node=next(n for n in bad["stages"]["vertex"]["nodes"] if n["definitionUuid"]=="sgrape.builtin.array_get")',
   'node["name"]="Array_i__1"',
   'try: c.compile_graph(bad)',
   'except c.GraphError as error: assert "Node name" in str(error) and error.node==node["id"]',
   'else: raise AssertionError("Reserved identifiers must remain rejected")',
   'print(json.dumps({"graphs":len(data["graphs"]),"names":sum(len(row["names"]) for row in data["cases"])}))'
  ].join('\n'),payload],{cwd:root,encoding:'utf8'}));
  checks.push(`Real compiler accepts ${compiled.graphs} created/copied graphs and ${compiled.names} generated names; the reported double-underscore name remains rejected`);
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
