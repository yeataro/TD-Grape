"""Integrated material templates, reachable maps and editable serialization."""
import copy
import json
from pathlib import Path
import unittest
import sgrape_core as c

PRESETS=Path(__file__).resolve().parents[2]/'src/library/material_presets.json'


class TexturedMaterialPresets(unittest.TestCase):
    def test_every_map_reaches_the_output_and_round_trips(self):
        presets=json.loads(PRESETS.read_text(encoding='utf-8'))
        for model,count in [('pbr',10),('phong',9)]:
            g=presets[model+'_textured'];before=copy.deepcopy(g)
            result=c.compile_graph(g)
            self.assertEqual(before,g)
            self.assertEqual(result,c.compile_graph(json.loads(json.dumps(g))))
            samplers=[d for d in g['declarations'] if d['kind']=='sampler']
            self.assertEqual(len(samplers),count)
            for d in samplers:
                self.assertTrue(d['expose'])
                self.assertIn('texture('+d['name']+',',result['pixel'])
                self.assertEqual(d['source'],'builtin:normal' if d['id']=='normalMap' else 'builtin:white')
            nodes=g['stages']['pixel']['nodes']
            self.assertEqual(sum(n['definitionUuid']=='sgrape.builtin.material_'+model for n in nodes),1)
            self.assertFalse(any(n['definitionUuid']=='sgrape.builtin.glsl_code' for n in nodes))
            self.assertIn('TDCreateTBNMatrix(',result['vertex'])
            self.assertNotIn('dFdx(',result['pixel'])
            self.assertNotIn('dFdy(',result['pixel'])
            self.assertIn('smooth in mat3 sg_v_tbn_0',result['pixel'])
            for stage in g['stages'].values():
                ids=[n['id'] for n in stage['nodes']]
                grouped=[i for frame in stage['ui']['frames'] for i in frame['nodes']]
                self.assertEqual(len(ids),len(set(ids)))
                self.assertEqual(len(grouped),len(set(grouped)))
                self.assertTrue(set(grouped)<=set(ids))

    def test_neutral_map_and_finishing_contracts(self):
        presets=json.loads(PRESETS.read_text(encoding='utf-8'))
        for model in ('phong','pbr'):
            g=presets[model+'_textured'];nodes={n['id']:n for n in g['stages']['pixel']['nodes']}
            self.assertEqual({k:nodes['pixel']['params'][k] for k in ('dither','alphaTest','convertColorSpace')},
                             dict(dither=True,alphaTest=True,convertColorSpace=True))
            self.assertEqual(nodes['normalScale']['inputValues']['z'],1)
        nodes={n['id']:n for n in presets['pbr_textured']['stages']['pixel']['nodes']}
        self.assertEqual(nodes['reflectance']['inputValues']['b'],.08)
        self.assertEqual(nodes['safeRoughness']['inputValues']['b'],.0001)

    def test_flat_normal_is_a_valid_portable_sampler_source(self):
        self.assertTrue(c.texture_source_valid('builtin:normal'))


if __name__=='__main__':
    unittest.main()
