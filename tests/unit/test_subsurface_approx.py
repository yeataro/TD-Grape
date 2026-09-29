"""Editable native back-light transmission, separate from spatial SSS."""
import copy
import unittest
import sgrape_core as c
import sgrape_library as library
from test_material_subgraphs import library as builtin
from test_view_material_helpers import helper_graph


def subsurface_graph(values=None, material=None):
    g=helper_graph('subsurface_approx',values)
    v=g['stages']['vertex'];p=g['stages']['pixel']
    boundary=next(n for n in v['nodes'] if n['id']=='vertex')
    boundary['params']['outputs']=[dict(id=k,name=k,type='vec3',interpolation='smooth') for k in ('world','normal')]
    v['nodes'] += [c.node('swizzle','world',type='vec4',mask='xyz'),
                   c.node('builtin_source','normal_source',source='TDNormal'),c.node('td_deform_normal','normal')]
    v['edges'] += [c.edge('deform','world','value'),c.edge('normal_source','normal','value'),
                   c.edge('world','vertex','world'),c.edge('normal','vertex','normal')]
    p['nodes'].append(c.node('vertex_input','inputs'))
    p['edges'] += [c.edge('inputs','helper','position','world')]
    if not values or 'normal' not in values:p['edges'].append(c.edge('inputs','helper','normal','normal'))
    if material:
        p['nodes']=[n for n in p['nodes'] if n['id']!='as_color']+[c.node('material_'+material,'material')]
        p['edges']=[e for e in p['edges'] if e['to'][0] not in ('as_color','pixel')]
        p['edges'] += [c.edge('helper','material','emission','color'),c.edge('inputs','material','position','world'),
                      c.edge('inputs','material','normal','normal'),c.edge('material','pixel','color')]
    return g


class SubsurfaceApprox(unittest.TestCase):
    def test_stage_host_contract_and_native_lights(self):
        g=subsurface_graph();before=copy.deepcopy(g);code=c.compile_graph(g)['pixel']
        self.assertEqual(g,before)
        for text in ('TDLighting(', 'TD_NUM_LIGHTS', 'sg_v_world_0', 'sg_v_normal_0', 'exp('):self.assertIn(text,code)
        for text in ('uTDLights[','TD_NUM_ENV_LIGHTS','ambientColor','uTDMats','texture('):self.assertNotIn(text,code)
        for target,stage in [('top','pixel'),('mat','vertex')]:
            with self.assertRaises(c.GraphError):c.compile_graph(helper_graph('subsurface_approx',target=target,stage=stage))

    def test_emission_connection_to_both_materials(self):
        for model in ('phong','pbr'):
            code=c.compile_graph(subsurface_graph(material=model))['pixel']
            self.assertIn('Subsurface_Approx_color',code)
            self.assertIn('TDLightingPBR(' if model=='pbr' else 'TDLighting(',code)

    def test_portable_editable_snapshot_and_named_defaults(self):
        g=subsurface_graph();f=g['functions'][0]
        self.assertEqual([p['id'] for p in f['inputs']],['position','normal','color','thickness','distance','strength','shadowStrength'])
        self.assertEqual([p['default'] for p in f['inputs']],[[0,0,0],[0,0,1],[1,1,1],.1,.1,1,1])
        self.assertEqual(f['stages'],['pixel']);self.assertEqual(f['targets'],['mat'])
        restored=library.entry(c,library.build(c,g,f['id']))
        self.assertEqual(restored['graph'],f['graph']);self.assertEqual(restored['targets'],['mat'])
        self.assertEqual(restored['stages'],['pixel'])
        self.assertFalse(any(n['definitionUuid'].endswith('.glsl_code') for n in f['graph']['nodes']))
        f['graph']['nodes'][1]['name']='Edited'
        self.assertNotEqual(f,builtin('subsurface_approx'))

    def test_library_identity_and_search(self):
        f=next(f for f in c.function_library(with_browser=True) if f['name']=='Subsurface Approx')
        browser=f.pop('browser');source=f.pop('source')
        self.assertEqual(c.digest(f),source['version'])
        self.assertEqual(browser['category'],'shader');self.assertIn('SSS',browser['aliases'])
        self.assertIn('translucency',browser['aliases'])


if __name__=='__main__':unittest.main()
