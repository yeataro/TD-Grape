"""Verify presentation metadata cannot cause a shader upgrade or change library identity."""
from pathlib import Path
import copy,importlib.util,json,re,subprocess,sys
root=Path(__file__).resolve().parents[2]
def load(name,source):
    spec=importlib.util.spec_from_file_location(name,source/'sgrape_core.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
current=load('browser_core',root/'src/core')
document=json.loads((root/'src/library/node_catalog.json').read_text('utf-8'))
current.validate_catalog(document)
assert all(row['definition']['revisionHash']==current.digest({k:v for k,v in row['definition'].items() if k!='revisionHash'}) for row in document['definitions'])
assert set(row['definition']['definitionUuid'] for row in document['definitions'])==set(d['definitionUuid'] for d in current.CATALOG.values())
normal=current.function_library();projected=current.function_library(with_browser=True)
assert normal==[{k:v for k,v in f.items() if k!='browser'} for f in projected]
assert all('browser' not in f for f in normal)
# The editor reads an embedded presentation projection, not catalog.browser.
# Exercise its actual category/search functions so a new operation cannot be
# correctly catalogued but disappear from the shipped browser UI.
html=(root/'src/editor/index.html').read_text('utf-8')
metadata=json.loads(re.search(r'<script id="node-browser-data" type="application/json">(.*?)</script>',html,re.S)[1])
matrix_keys={'matrix','matrix_combine','matrix_replace','matrix_split','matrix_get','matrix_set',
             'transpose','inverse','determinant','matrix_comp_mult','outer_product'}
browser_rows=[row for row in document['definitions'] if row['definition']['key'] in matrix_keys|{'scalar','vector'}]
assert len(browser_rows)==13
for row in browser_rows:
    assert metadata['nodes'][row['definition']['definitionUuid']]==row['browser'],row['definition']['key']
script="""
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const payload=JSON.parse(fs.readFileSync(0,'utf8'));
const context=vm.createContext({payload,assert,t:key=>key,FunctionModel:{CALL:'sgrape.function.call'},document:{getElementById:()=>({textContent:JSON.stringify(payload.metadata)})}});
vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),context);
vm.runInContext(`setTypeContract(payload.typeContract);
const entries=payload.definitions.map(d=>({d,meta:browserMeta(d)}));
const entry=entries.find(e=>e.d.key==='vector');
assert.equal(entry.meta.category,'vector');
assert.equal(browseEntries([entry],'',{tab:'categories',category:'vector',source:'all'}).length,1);
for(const query of ['vec2','vec3','vec4','Vector 3','dvec2','dvec3','dvec4'])assert.equal(browseEntries([entry],query,{source:'all'}).length,1,query);
assert.equal(creatorMeta(entry.d).category,'vector');
const matrixEntries=entries.filter(e=>e.meta.category==='matrix');
assert.equal(matrixEntries.length,11);
assert.equal(browseEntries(entries,'',{tab:'categories',category:'matrix',source:'all'}).length,11);
for(const e of matrixEntries)assert.equal(creatorMeta(e.d).category,'matrix');
for(const [query,key] of [['construct matrix','matrix_combine'],['columns','matrix_combine'],['columns','matrix_replace'],['columns','matrix_split'],['outerProduct','outer_product'],['matrixCompMult','matrix_comp_mult'],['read element','matrix_get'],['set column','matrix_set']])
  assert.ok(browseEntries(entries,query,{source:'all'}).some(e=>e.d.key===key),query+': '+key);
for(const key of ['scalar','vector','matrix']){
  const generic=entries.find(e=>e.d.key===key),types=selectableNodeTypes(generic.d);
  const fixed=types.map(type=>{const d={...generic.d,fixedType:type,label:type,entryKey:type};return {d,meta:browserMeta(d)};});
  for(const type of types){
    const result=browseEntries([generic,...fixed],type,{source:'all'});
    assert.equal(result.filter(e=>e.d.fixedType).length,1,type);
    assert.equal(result.find(e=>e.d.fixedType).d.fixedType,type);
    assert.ok(result.some(e=>e.d===generic.d),type+' finds generic');
    const aliases=fixed.find(e=>e.d.fixedType===type).meta.aliases;
    assert.ok(types.filter(other=>other!==type).every(other=>!aliases.includes(other)),type+' has no other type aliases');
    assert.equal(generic.d.label,({scalar:'Scalar',vector:'Vector',matrix:'Matrix'})[key]);
  }
}
assert.ok(browseEntries(entries,'double',{source:'all'}).some(e=>e.d.key==='scalar'));`,context);
"""
subprocess.run(['node','-e',script,str(root/'src/editor/graph_ui.js')],input=json.dumps({'metadata':metadata,'definitions':[row['definition'] for row in browser_rows],'typeContract':current.type_contract()}),text=True,check=True)
if len(sys.argv)>1:
    before=load('browser_baseline',Path(sys.argv[1]))
    assert current.CATALOG==before.CATALOG
    assert current.catalog_contract()==before.catalog_contract()
    assert normal==before.function_library()
    for target in ('mat','top'):
        for example in ('banana','color','tint'):
            graph=before.demo_graph(example,target=target)
            assert before.compile_graph(graph)==current.compile_graph(graph),(target,example)
print('Matrix categories/search and precise fixed/generic aliases passed; definition revisions and library identities preserved')
