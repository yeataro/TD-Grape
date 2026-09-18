import copy,json,unittest
import sgrape_core as c

class TopInputs(unittest.TestCase):
 def graph(self):
  g=c.demo_graph('color','top');g['declarations']=[]
  g['topInputs']=[{'id':'a','name':'A','defaultSource':'builtin:black'},{'id':'b','name':'B','defaultSource':'builtin:white'}]
  g['stages']['pixel']={'nodes':[c.node('top_input','input',inputId='b'),c.node('texture_sample','sample'),c.node('pixel_out','output')],'edges':[c.edge('input','sample','sampler'),c.edge('sample','output','color')]}
  return g
 def test_slots_kept_even_when_unused_and_references_follow_id(self):
  g=self.graph();first=c.compile_graph(g)
  self.assertEqual([b['topInputId'] for b in first['bindings']],['a','b'])
  self.assertIn('texture(sTD2DInputs[1]',first['pixel'])
  g['topInputs'].reverse();self.assertIn('texture(sTD2DInputs[0]',c.compile_graph(g)['pixel'])
  self.assertEqual(c.compile_graph(json.loads(json.dumps(g))),c.compile_graph(g))
 def test_size_and_reciprocal_come_from_same_slot(self):
  g=self.graph();p=g['stages']['pixel'];p['nodes'].append(c.node('rgba','color'));p['edges']=[c.edge('input','color','rgb','size'),c.edge('color','output','color')]
  # vec2 -> vec3 is intentionally unsupported; test the expression via dot first.
  p['nodes'].append(c.node('dot','dot',type='vec2'));p['edges']=[c.edge('input','dot','a','size'),c.edge('input','dot','b','pixelSize'),c.edge('dot','output','color')]
  code=c.compile_graph(g)['pixel'];self.assertIn('uTD2DInfos[1].res.zw',code);self.assertIn('uTD2DInfos[1].res.xy',code)
 def test_bad_slots_and_wrong_target_fail_before_runtime(self):
  for mutate in [lambda g:g.update(topInputs=[]),lambda g:g['topInputs'].append(copy.deepcopy(g['topInputs'][0])),lambda g:g['topInputs'][0].update(defaultSource='input:4'),lambda g:g['topInputs'].pop()]:
   g=self.graph();mutate(g)
   with self.assertRaises(c.GraphError):c.compile_graph(g)
  g=c.demo_graph('color','mat');g['topInputs']=self.graph()['topInputs']
  with self.assertRaises(c.GraphError):c.compile_graph(g)
 def test_legacy_input_zero_aliases_first_slot(self):
  g=c.demo_graph('banana','top');g['topInputs']=self.graph()['topInputs'];out=c.compile_graph(g)
  self.assertEqual(len(out['bindings']),2);self.assertIn('texture(sTD2DInputs[0]',out['pixel'])
  g['topInputLegacyId']='a';g['topInputs'].reverse();self.assertIn('texture(sTD2DInputs[1]',c.compile_graph(g)['pixel'])
 def test_named_constants_are_constant_expressions_and_not_uniforms(self):
  for target in ['top','mat']:
   for ty in c.FLOAT_TYPES:
    g=c.demo_graph('color',target);g['declarations']=[{'id':'c','kind':'constant','name':'cValue','type':ty,'value':c.filled_value(ty,.25)}]
    g['stages']['pixel']={'nodes':[c.node('constant','c',declarationId='c'),c.node('length','length',type=ty),c.node('pixel_out','output')],'edges':[c.edge('c','length','value'),c.edge('length','output','color')]}
    code=c.compile_graph(g)['pixel'];self.assertIn('const '+ty+' cValue = ',code);self.assertIn('length(cValue)',code);self.assertNotIn('uniform '+ty+' cValue',code);self.assertNotIn('sg_n_c =',code)
    g['declarations'][0]['value']=c.filled_value(ty,.5);self.assertNotEqual(code,c.compile_graph(g)['pixel'])
