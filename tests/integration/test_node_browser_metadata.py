"""Verify presentation metadata cannot cause a shader upgrade or change library identity."""
from pathlib import Path
import copy,importlib.util,json,sys
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
