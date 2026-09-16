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
vector=next(row for row in document['definitions'] if row['definition']['key']=='vector')
assert metadata['nodes'][vector['definition']['definitionUuid']]==vector['browser']
script="""
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const payload=JSON.parse(fs.readFileSync(0,'utf8'));
const context=vm.createContext({payload,assert,t:key=>key,FunctionModel:{CALL:'sgrape.function.call'},document:{getElementById:()=>({textContent:JSON.stringify(payload.metadata)})}});
vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),context);
vm.runInContext(`const entry={d:payload.definition,meta:browserMeta(payload.definition)};
assert.equal(entry.meta.category,'vector');
assert.equal(browseEntries([entry],'',{tab:'categories',category:'vector',source:'all'}).length,1);
for(const query of ['vec2','vec3','vec4','Vector 3'])assert.equal(browseEntries([entry],query,{source:'all'}).length,1,query);
assert.equal(creatorMeta(payload.definition).category,'vector');`,context);
"""
subprocess.run(['node','-e',script,str(root/'src/editor/graph_ui.js')],input=json.dumps({'metadata':metadata,'definition':vector['definition']}),text=True,check=True)
if len(sys.argv)>1:
    before=load('browser_baseline',Path(sys.argv[1]))
    assert current.CATALOG==before.CATALOG
    assert current.catalog_contract()==before.catalog_contract()
    assert normal==before.function_library()
    for target in ('mat','top'):
        for example in ('banana','color','tint'):
            graph=before.demo_graph(example,target=target)
            assert before.compile_graph(graph)==current.compile_graph(graph),(target,example)
print('Definition revisions, default library identities and compiler outputs preserved')
