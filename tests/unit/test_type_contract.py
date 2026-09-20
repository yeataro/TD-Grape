"""Core/UI conformance plus immutable 0.6.0 compatibility fingerprints."""
import copy,json,subprocess,unittest
from pathlib import Path
import sgrape_core as c
root=Path(__file__).parent
baseline=json.loads((root.parent/'fixtures/type_contract_baseline.json').read_text(encoding='utf-8'))
def legacy_function_library():
 # The pinned 0.6.0 snapshots predate semantic names in bundled Subgraphs.
 # Restore only that intentional asset change; retain the historical math,
 # topology, IDs, defaults, layout and compiler fingerprints unchanged.
 library=c.function_library()
 for function in library:
  source=function.pop('source')
  for node in function['graph']['nodes']:node.pop('name',None)
  source['version']=c.digest(function);function['source']=source
 return library

class TypeContract(unittest.TestCase):
 def test_contract_is_pure_and_deterministic(self):
  first=c.type_contract();self.assertEqual(first,c.type_contract())
  expected=dict(first);expected.pop('hash');self.assertEqual(first['hash'],c.digest(expected))
  first['definitions'].clear();self.assertEqual(len(c.type_contract()['definitions']),len(c.CATALOG))
  self.assertEqual(c.digest({k:v for k,v in c.CATALOG.items() if k not in (*c.COMPOSITE_KEYS,*c.MATRIX_KEYS,'matrix_convert','buffer_fetch','buffer_length','pop_buffer','attribute','sampler','texture_sample','constant','top_input','glsl_code','vec4','combine','vector_split','swizzle','vector','replace','spec_constant','comment','compare','if','sign','sqrt','floor','round','ceil','trunc','mod','rgb_to_hsv','hsv_to_rgb','remap','range_from','range_to','loop','zigzag','perlin_noise','simplex_noise','scalar','convert')}),baseline['catalogHash']);self.assertEqual(c.digest(legacy_function_library()),baseline['libraryHash'])

 def test_value_descriptors_and_literals(self):
  descriptor=c.type_contract()['types'];self.assertEqual(tuple(descriptor),c.PORT_TYPES)
  for ty,count in [('float',1),('vec2',2),('vec3',3),('vec4',4)]:
   self.assertEqual(descriptor[ty],{'family':'float','components':count,'scalarType':'float','vectorPrefix':'vec'})
   value=c.filled_value(ty,.125)
   self.assertEqual(value,.125 if count==1 else [.125]*count)
   self.assertEqual(c.literal(value,ty),'0.125' if count==1 else ty+'('+', '.join(['0.125']*count)+')')
   if count>1:
    with self.assertRaises(c.GraphError):c.literal([1]*(count-1),ty)
    with self.assertRaises(c.GraphError):c.literal(1,ty)
  descriptor['float']['components']=4
  self.assertEqual(c.type_contract()['types']['float']['components'],1)
  for ty in ['mat5','sampler2D','?',None]:
   for operation in [lambda:c.literal(1,ty),lambda:c.filled_value(ty)]:
    with self.assertRaises(c.GraphError):operation()

 def test_all_conversion_pairs_and_unknowns(self):
  for a in list(c.PORT_TYPES)+['?']:
   for b in list(c.PORT_TYPES)+['?']:
    allowed=(a==b and a in c.PORT_TYPES) or (a in c.NUMERIC_TYPES and b in c.NUMERIC_TYPES and (c.type_components(a)==1 or c.type_components(a)==c.type_components(b))) or (a=='bool' and b in ('bvec2','bvec3','bvec4'))
    self.assertEqual(c.conversion_kind(a,b) is not None,allowed)
    if allowed:self.assertEqual(c.convert_expression('v',a,b),'v' if a==b else b+'(v)')
    else:
     with self.assertRaises(c.GraphError):c.convert_expression('v',a,b)

 def test_existing_graphs_produce_identical_results(self):
  graphs=[c.demo_graph(preset,target) for target in ('mat','top') for preset in ('banana','color','tint')]
  for key,d in c.CATALOG.items():
   if key in (*c.COMPOSITE_KEYS,*c.MATRIX_KEYS,'matrix_convert','buffer_fetch','buffer_length','pop_buffer','attribute','sampler','texture_sample','constant','top_input','glsl_code','vec4','combine','vector_split','swizzle','vector','replace','spec_constant','comment','compare','if','sign','sqrt','floor','round','ceil','trunc','mod','rgb_to_hsv','hsv_to_rgb','remap','range_from','range_to','loop','zigzag','perlin_noise','simplex_noise','scalar','convert'):continue  # New nodes have dedicated tests; keep all 138 old fingerprints.
   for ty in c.FLOAT_TYPES:
    g=c.demo_graph('color');stage=d['stages'][0];node=c.node(key,'probe',type=ty)
    if key=='uniform':g['declarations'].append({'id':'test_uniform','kind':'uniform','name':'uTest','type':ty,'value':.25 if ty=='float' else [.25]*int(ty[-1])});node['params']['declarationId']='test_uniform'
    if key.endswith('_out'):g['stages'][stage]['nodes']=[node];g['stages'][stage]['edges']=[]
    else:g['stages'][stage]['nodes'].append(node)
    graphs.append(g)
  for fn in legacy_function_library():
   for target in ('mat','top'):
    g=c.demo_graph('color',target);g['functions']=[fn]
    g['stages']['pixel']={'nodes':[{'id':'filter','definitionUuid':c.CALL,'params':{'functionId':fn['id']}},c.node('pixel_out','output')],'edges':[c.edge('filter','output','color','color')]};graphs.append(g)
  for graph,expected in zip(graphs,baseline['compiledHashes'],strict=True):
   before=copy.deepcopy(graph);actual=c.compile_graph(graph)
   actual.pop('sourceMap')
   for item in actual['diagnostics']:item.pop('stage',None);item.pop('trail',None)
   from test_mat_buffers import legacy_single_buffer_result
   self.assertEqual(c.digest(legacy_single_buffer_result(actual)),expected);self.assertEqual(graph,before)
  self.assertEqual(len(graphs),138)

 def test_javascript_ports_and_creator_match_core(self):
  # Browser code consumes the core's resolved variants, including declaration-selected Uniforms.
  rows=[]
  for d in c.CATALOG.values():
   for ty in (c.VECTOR_TYPES if d['key'] in c.VECTOR_KEYS else c.node_parameter_types(d)):
    node=c.node(d['key'],'probe',type=ty)
    for decltype in (c.SPEC_TYPES if d['key']=='spec_constant' else c.node_parameter_types(d) if d['key'] in ('pop_buffer','attribute') else c.TYPES):
     decl={'type':decltype};rows.append({'definition':d,'params':node['params'],'declaration':decl,'expected':c.resolved_ports(d,node['params'],decl)})
  payload={'contract':c.type_contract(),'rows':rows,'catalog':list(c.CATALOG.values())}
  result=subprocess.check_output(['node',str(root/'test_types_ui.js'),str(root.parents[1]/'src/editor/graph_ui.js')],input=json.dumps(payload),text=True)
  self.assertIn(str(len(payload['rows']))+' port rows',result)

if __name__=='__main__':unittest.main(verbosity=2)
