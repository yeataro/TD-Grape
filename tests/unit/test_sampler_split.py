import copy,json,unittest
import sgrape_core as c
import sgrape_document as document
import sgrape_library as library

def graph(target='mat',connected=True):
    g=c.demo_graph('color',target)
    g['declarations']=[{'id':'image','kind':'sampler','name':'uImage','type':'sampler2D','source':'builtin:white','fallback':'opaque-black'}] if connected else []
    p=g['stages']['pixel'];p['nodes']=[c.node('texture_sample','sample'),c.node('pixel_out','output')];p['edges']=[c.edge('sample','output','color')]
    if connected:p['nodes'].append(c.node('sampler','source',declarationId='image'));p['edges'].append(c.edge('source','sample','sampler'))
    return g

def fn():
    return {'id':'sampleFn','name':'Sample','scope':'local','stages':['pixel'],
      'inputs':[{'id':'image','name':'Image','type':'sampler2D','default':None}],
      'outputs':[{'id':'image','name':'Image','type':'sampler2D','default':None}],
      'graph':{'nodes':[{'id':'input','definitionUuid':c.FUNCTION_INPUT,'params':{},'ui':{'x':0,'y':0}},
        {'id':'output','definitionUuid':c.FUNCTION_OUTPUT,'params':{},'ui':{'x':200,'y':0}}],
        'edges':[{'from':['input','image'],'to':['output','image']}]}}

class SamplerSplit(unittest.TestCase):
 def test_shared_source_does_not_create_local_sampler_or_duplicate_binding(self):
  for target in ('mat','top'):
   g=graph(target);p=g['stages']['pixel'];p['nodes'] += [c.node('texture_sample','second'),c.node('mix','mix')]
   p['edges']=[e for e in p['edges'] if e['to'][0]!='output']+[c.edge('source','second','sampler'),c.edge('sample','mix','a'),c.edge('second','mix','b'),c.edge('mix','output','color')]
   before=copy.deepcopy(g);compiled=c.compile_graph(g);self.assertEqual(g,before)
   self.assertEqual(len(compiled['bindings']),1);self.assertEqual(compiled['bindings'][0]['id'],'image')
   self.assertNotIn('sampler2D sg_n_',compiled['pixel']);self.assertEqual(compiled['pixel'].count('texture('),2)
 def test_unconnected_uses_one_defined_black_binding(self):
  for target in ('mat','top'):
   g=graph(target,False);compiled=c.compile_graph(g);binding=compiled['bindings'][0]
   self.assertEqual(binding['source'],'builtin:black');self.assertTrue(binding['internal'])
   self.assertIn('texture(',compiled['pixel']);self.assertNotIn('sampler2D sg_n_',compiled['pixel'])
   self.assertTrue(any('unconnected' in d['message'] for d in compiled['diagnostics']))
   self.assertEqual(g['declarations'],[])
 def test_nested_sampler_interfaces_are_aliases_and_portable(self):
  for target in ('mat','top'):
   g=graph(target);f=fn();nested=copy.deepcopy(f);nested['id']='nested';nested['graph']['nodes'].append({'id':'inner','definitionUuid':c.CALL,'params':{'functionId':f['id']},'ui':{'x':100,'y':0}})
   nested['graph']['edges']=[{'from':['input','image'],'to':['inner','image']},{'from':['inner','image'],'to':['output','image']}]
   g['functions']=[f,nested];p=g['stages']['pixel'];p['nodes'].append({'id':'call','definitionUuid':c.CALL,'params':{'functionId':'nested'},'ui':{'x':0,'y':0}})
   p['edges']=[c.edge('source','call','image'),c.edge('call','sample','sampler','image'),c.edge('sample','output','color')]
   compiled=c.compile_graph(g);self.assertEqual(len(compiled['bindings']),1);self.assertNotIn('sampler2D sg_n_',compiled['pixel'])
   packet=library.build(c,g,'nested');self.assertEqual(library.validate(c,packet),packet)
   p['edges']=[e for e in p['edges'] if e['from'][0]!='source'];compiled=c.compile_graph(g)
   self.assertEqual([d['source'] for d in compiled['bindings']],['builtin:black'])
 def test_numeric_sampler_connections_and_defaults_rejected(self):
  g=graph();g['stages']['pixel']['edges'].append(c.edge('source','sample','uv'))
  with self.assertRaises(c.GraphError):c.compile_graph(g)
  g=graph();g['stages']['pixel']['nodes'][0]['inputValues']={'sampler':0}
  with self.assertRaises(c.GraphError):c.compile_graph(g)
  g=graph();f=fn();f['inputs'][0]['default']=[0,0,0,1];g['functions']=[f]
  with self.assertRaises(c.GraphError):c.compile_graph(g)
 def test_missing_declaration_is_not_silently_created(self):
  g=graph();g['declarations']=[]
  with self.assertRaises(c.GraphError):c.compile_graph(g)
 def test_reserved_fallback_identity_and_source_in_library_rejected(self):
  g=graph();g['declarations'][0]['id']='grapeFallbackSampler'
  with self.assertRaises(c.GraphError):c.compile_graph(g)
  f=fn();f['graph']['nodes'].append(c.node('sampler','source',declarationId='image'));g=graph();g['functions']=[f]
  with self.assertRaises(ValueError):library.build(c,g,f['id'])
 def test_resource_document_roundtrip(self):
  g=graph('top');g['functions']=[fn()]
  report=document.inspect_document(json.loads(json.dumps(g)),c,'top')
  self.assertEqual(report['status'],'valid');self.assertEqual(report['candidate'],g)
 def test_legacy_definition_identity_preserved(self):
  import pathlib
  baseline=json.loads((pathlib.Path(__file__).resolve().parents[1]/'fixtures/type_contract_baseline.json').read_text(encoding='utf-8'))
  self.assertEqual(c.digest({k:v for k,v in c.CATALOG.items() if k not in (*c.MATRIX_KEYS,'matrix_convert','sampler','texture_sample','constant','top_input','glsl_code','vec4','combine','vector_split','swizzle','vector','replace','spec_constant','comment','compare','if','sign','sqrt','floor','round','ceil','trunc','mod','rgb_to_hsv','hsv_to_rgb','remap','range_from','range_to','loop','zigzag','perlin_noise','simplex_noise','scalar','convert')}),baseline['catalogHash'])

if __name__=='__main__':unittest.main()
