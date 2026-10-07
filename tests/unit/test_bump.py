"""Bump uses an editable surface-gradient graph and explicit geometry inputs."""
import copy
import json
from pathlib import Path
import unittest
import sgrape_core as c
import sgrape_library as personal
from test_material_subgraphs import library
from test_view_material_helpers import helper_graph


def bump_graph(values=None, slope=(1, .5, 0), geometry_normal=False, texture=None, material=None):
    g=c.demo_graph('color','mat');g['declarations']=[];fn=library('bump');g['functions']=[fn]
    v=g['stages']['vertex'];out=next(n for n in v['nodes'] if n['id']=='vertex')
    out['params']['outputs']=[dict(id='world',name='World',type='vec3',interpolation='smooth'),
                              dict(id='normal',name='Normal',type='vec3',interpolation='smooth')]
    v['nodes'] += [c.node('swizzle','world',type='vec4',mask='xyz'),
                   c.node('builtin_source','normal_source',source='TDNormal'),c.node('td_deform_normal','normal')]
    v['edges'] += [c.edge('deform','world','value'),c.edge('world','vertex','world'),
                  c.edge('normal_source','normal','value'),c.edge('normal','vertex','normal')]
    call=dict(id='bump',name='Bump',definitionUuid=c.CALL,params={'functionId':fn['id']},
              inputValues=copy.deepcopy(values or {}),ui={'x':650,'y':100})
    nodes=[c.node('vertex_input','inputs',30,100),call,c.node('dot','height',300,100,type='vec3'),
           c.node('rgba','rgba',1020,100),c.node('pixel_out','pixel',1300,100,dither=False,alphaTest=False,convertColorSpace=False)]
    nodes[2]['inputValues']={'b':list(slope)}
    edges=[c.edge('inputs','height','a','world'),c.edge('height','bump','height'),
           c.edge('inputs','bump','position','world'),c.edge('bump','rgba','rgb','normal'),c.edge('rgba','pixel','color')]
    if 'position' in call['inputValues']:edges=[e for e in edges if e['to']!=['bump','position']]
    if 'height' in call['inputValues']:edges=[e for e in edges if e['to']!=['bump','height']]
    if geometry_normal:edges.append(c.edge('inputs','bump','normal','normal'))
    if texture:
        g['declarations']=[dict(id='height_map',kind='sampler',name='sHeightMap',type='sampler2D',source='op:'+texture)]
        nodes += [c.node('sampler','sampler',declarationId='height_map'),c.node('texture_sample','sample'),
                  c.node('swizzle','uv',type='vec3',mask='xy'),c.node('multiply','uv_scale',type='vec2'),c.node('add','offset',type='vec2'),
                  c.node('swizzle','channel',type='vec4',mask='x')]
        nodes[-3]['inputValues']={'b':[.1,.1]}
        nodes[-2]['inputValues']={'b':[.5,.5]}
        edges=[e for e in edges if e['to']!=['bump','height']]
        edges += [c.edge('inputs','uv','value','world'),c.edge('uv','uv_scale','a'),c.edge('uv_scale','offset','a'),c.edge('offset','sample','uv'),
                  c.edge('sampler','sample','sampler'),c.edge('sample','channel','value'),c.edge('channel','bump','height')]
    if material:
        nodes.append(c.node(material,'material',950,400))
        edges=[e for e in edges if e['to']!=['pixel','color']]
        edges += [c.edge('bump','material','normal','normal'),c.edge('inputs','material','position','world'),c.edge('material','pixel','color')]
    g['stages']['pixel']=dict(nodes=nodes,edges=edges)
    return g


class BumpTests(unittest.TestCase):
    def test_geometry_and_sampled_or_procedural_height_compile(self):
        for args in ({},{'geometry_normal':True},{'texture':'/height'},
                     {'values':{'position':[0,0,0],'normal':[0,0,0],'strength':0}},
                     {'material':'material_phong'},{'material':'material_pbr'}):
            with self.subTest(args=args):
                graph=bump_graph(**args);before=copy.deepcopy(graph);compiled=c.compile_graph(graph)
                self.assertEqual(before,graph)
                self.assertIn('dFdx(',compiled['pixel']);self.assertIn('dFdy(',compiled['pixel'])
                self.assertNotIn('dFdx(',compiled['vertex'])

    def test_stage_and_target_are_enforced(self):
        for target,stage in [('mat','vertex'),('top','pixel')]:
            with self.assertRaises(c.GraphError):c.compile_graph(helper_graph('bump',target=target,stage=stage))

    def test_voronoi_distance_is_a_height_source(self):
        graph=bump_graph();p=graph['stages']['pixel'];p['nodes'].append(c.node('voronoi','cells'))
        p['edges']=[e for e in p['edges'] if e['to']!=['bump','height']]
        p['edges'] += [c.edge('inputs','cells','vector','world'),c.edge('cells','bump','height','distance')]
        code=c.compile_graph(graph)['pixel']
        self.assertIn('dFdx(',code);self.assertIn('voronoi',code.lower())

    def test_interface_and_library_roundtrip(self):
        fn=library('bump')
        self.assertEqual([p['id'] for p in fn['inputs']],['position','normal','height','strength','distance'])
        self.assertEqual(fn['outputs'],[dict(id='normal',name='Normal',type='vec3',default=[0,0,1])])
        self.assertEqual(fn['inputs'][-1]['default'],.1)
        graph=bump_graph();packet=personal.build(c,graph,fn['id'])
        self.assertEqual(personal.entry(c,packet)['graph'],fn['graph'])
        self.assertEqual(personal.entry(c,packet)['targets'],['mat'])
        for n in fn['graph']['nodes']:
            self.assertNotIn(n['definitionUuid'],['sgrape.builtin.'+k for k in ['sampler','texture_sample','uniform','glsl_code','td_front_facing']])

    def test_local_edits_do_not_mutate_builtin(self):
        fn=library('bump');fn['inputs'][-1]['default']=20
        self.assertEqual(library('bump')['inputs'][-1]['default'],.1)

    def test_target_restrictions_survive_export_and_unused_definitions(self):
        fn=personal.entry(c,personal.build(c,bump_graph(),library('bump')['id']))
        graph=c.demo_graph('color','top');graph['functions']=[fn]
        with self.assertRaises(c.GraphError):c.compile_graph(graph)
        graph=bump_graph();graph['functions'][0]['targets']='mat'
        with self.assertRaises(c.GraphError):c.compile_graph(graph)

    def test_metadata_and_help(self):
        fn=next(f for f in c.function_library(with_browser=True) if f['name']=='Bump')
        browser=fn.pop('browser');source=fn.pop('source')
        self.assertEqual(c.digest(fn),source['version']);self.assertEqual(browser['category'],'texture')
        locale=json.loads((Path(__file__).resolve().parents[2]/'src/editor-react/static/locales.json').read_text('utf-8'))
        self.assertEqual(set(locale['messages']['help.subgraph.bump']),set(locale['languages']))


if __name__=='__main__':unittest.main()
