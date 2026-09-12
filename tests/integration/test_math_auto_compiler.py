"""Compare resolved Auto graphs with identical graphs containing concrete types only."""
from pathlib import Path
import copy,importlib.util,json,sys
source,cases,report=map(Path,sys.argv[1:4])
spec=importlib.util.spec_from_file_location('auto_core',source/'sgrape_core.py');core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
checks=[]
for case in json.loads(cases.read_text(encoding='utf-8')):
 graph=case['graph'];compiled=core.compile_graph(graph);fixed=copy.deepcopy(graph)
 for data in list(fixed['stages'].values())+[f['graph'] for f in fixed['functions']]:
  for n in data['nodes']:
   n.get('ui',{}).pop('typeMode',None);n.get('ui',{}).pop('inputValuesByType',None)
 reference=core.compile_graph(fixed)
 assert all(compiled[k]==reference[k] for k in ['pixel','vertex','bindings','hash']),case['name']
 checks.append({'name':case['name'],'passed':True,'sameAsConcreteGraph':True})
result={'passed':True,'count':len(checks),'checks':checks};report.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({'passed':True,'count':len(checks)}))
