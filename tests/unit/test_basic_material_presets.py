"""Portable material preset and opt-in native output contracts."""
import copy,json,unittest
from pathlib import Path
import sgrape_core as c
PRESETS=Path(__file__).resolve().parents[2]/'src/library/material_presets.json'

class BasicMaterialPresets(unittest.TestCase):
 def test_editable_graphs_with_explicit_native_paths(self):
  for model,g in json.loads(PRESETS.read_text(encoding='utf-8')).items():
   before=copy.deepcopy(g);result=c.compile_graph(g);self.assertEqual(g,before)
   keys=[c.BY_UUID[n['definitionUuid']]['key'] for stage in g['stages'].values() for n in stage['nodes']]
   self.assertNotIn('glsl_code',keys);self.assertNotIn('material_'+model,keys)
   self.assertIn('td_lighting_all' if model=='phong' else 'td_lighting_pbr_all',keys)
   if model=='pbr':self.assertIn('td_env_lighting_pbr_all',keys)
   self.assertIn('TDTexAttrib_Tex(0u)',result['vertex']);self.assertIn('TDInstanceTexCoord(',result['vertex'])
   self.assertIn('TDInstanceColor(',result['vertex']);self.assertIn('TDPixelColor(',result['pixel'])
   self.assertIn('TDFrontFacing(',result['pixel']);self.assertIn('TDFog(',result['pixel'])
   self.assertEqual(result['pixel'].count('#include <TDColorSpace>'),1)
   code=result['pixel'];self.assertLess(code.index('sg_color = TDDither'),code.index('TDAlphaTest(sg_color.a)'));self.assertLess(code.index('TDAlphaTest(sg_color.a)'),code.index('TDConvertColorSpace(sg_color)'))
   self.assertIn('uShadowStrength',code)
   for d in g['declarations']:
    if d['id'] in ('baseColor','diffuse','ambient','specular','specular2','shadowColor'):
     self.assertEqual(d.get('nativeSequence'),'color');self.assertEqual(d['type'],'vec3')
   for stage in g['stages'].values():
    claimed=[n for frame in stage['ui']['frames'] for n in frame['nodes']]
    self.assertEqual(len(claimed),len(set(claimed)))
    self.assertTrue(set(claimed)<=set(n['id'] for n in stage['nodes']))
   self.assertEqual(next(n for n in g['stages']['vertex']['nodes'] if n['id']=='vertex')['params']['outputs'][-1]['id'],'uv')
 def test_native_output_is_explicit_and_mat_only(self):
  g=c.demo_graph('color','mat');original=c.compile_graph(g)['pixel'];output=g['stages']['pixel']['nodes'][-1]
  output['params']['nativeFinishing']=False;self.assertEqual(c.compile_graph(g)['pixel'],original)
  output['params']['nativeFinishing']=True;self.assertIn('TDConvertColorSpace(sg_color)',c.compile_graph(g)['pixel'])
  output['params']['nativeFinishing']='true'
  with self.assertRaisesRegex(c.GraphError,'must be a boolean'):c.compile_graph(g)
  g=c.demo_graph('color','top');g['stages']['pixel']['nodes'][-1]['params']['nativeFinishing']=True
  with self.assertRaisesRegex(c.GraphError,'requires a MAT graph'):c.compile_graph(g)
