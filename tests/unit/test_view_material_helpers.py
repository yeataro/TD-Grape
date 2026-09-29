"""Editable camera, dielectric and coordinate helpers and their host contracts."""
import copy
import unittest
import sgrape_core as c
import sgrape_library as library
from test_material_subgraphs import library as builtin


KEYS = ('view_direction', 'fresnel', 'facing', 'mapping', 'rim_light')


def helper_graph(key, values=None, target='mat', stage='pixel', live_camera=False, port=None):
    g=c.demo_graph('color',target);g['declarations']=[]
    fn=builtin(key);g['functions']=[fn]
    call={'id':'helper','name':fn['name'].replace(' ','_'),'definitionUuid':c.CALL,
          'params':{'functionId':fn['id']},'inputValues':copy.deepcopy(values or {}),'ui':{'x':600,'y':160}}
    output=next(p for p in fn['outputs'] if p['id']==port) if port else fn['outputs'][0];vector=output['type']=='vec3'
    convert=c.node('rgba','as_color') if vector else c.node('convert','as_color',fromType='float',toType='vec4')
    link=c.edge('helper','as_color','rgb' if vector else 'value',output['id'])
    final=c.node('pixel_out','pixel',dither=False,alphaTest=False,convertColorSpace=False)
    if stage=='pixel':
        g['stages']['pixel']={'nodes':[call,convert,final],'edges':[link,c.edge('as_color','pixel','color')]}
    else:
        v=g['stages']['vertex'];v['nodes'] += [call,convert];v['edges'] += [link,c.edge('as_color','vertex','value')]
        next(n for n in v['nodes'] if n['id']=='vertex')['params']['outputs']=[dict(id='value',name='Value',type='vec4',interpolation='smooth')]
        g['stages']['pixel']={'nodes':[c.node('vertex_input','input'),final],'edges':[c.edge('input','pixel','color','value')]}
    if live_camera:
        v=g['stages']['vertex'];v['nodes'] += [c.node('swizzle','world',type='vec4',mask='xyz'),c.node('builtin_source','camera_index',source='TDCameraIndex')]
        v['edges'].append(c.edge('deform','world','value'))
        if stage=='vertex':v['edges'] += [c.edge('world','helper','position'),c.edge('camera_index','helper','camera')]
        else:
            next(n for n in v['nodes'] if n['id']=='vertex')['params']['outputs']=[
                dict(id='world',name='World',type='vec3',interpolation='smooth'),dict(id='camera',name='Camera',type='int',interpolation='flat')]
            v['edges'] += [c.edge('world','vertex','world'),c.edge('camera_index','vertex','camera')]
            g['stages']['pixel']['nodes'].append(c.node('vertex_input','input'))
            g['stages']['pixel']['edges'] += [c.edge('input','helper','position','world'),c.edge('input','helper','camera','camera')]
    return g


class ViewMaterialHelpers(unittest.TestCase):
    def test_every_helper_compiles_in_supported_hosts_and_stages(self):
        for key in KEYS:
            for target,stage in [('mat','pixel'),('mat','vertex'),('top','pixel')]:
                if key=='view_direction' and target=='top':continue
                with self.subTest(key=key,target=target,stage=stage):
                    g=helper_graph(key,target=target,stage=stage);before=copy.deepcopy(g)
                    compiled=c.compile_graph(g)
                    self.assertEqual(g,before);self.assertTrue(compiled[stage]);self.assertEqual(compiled['bindings'],[])

    def test_view_direction_uses_the_supplied_world_position_and_flat_camera(self):
        for stage in ('vertex','pixel'):
            code=c.compile_graph(helper_graph('view_direction',stage=stage,live_camera=True))[stage]
            for fragment in ('uTDMats','camInverse','.proj','TD_NUM_CAMERAS','sqrt('):self.assertIn(fragment,code)
        with self.assertRaises(c.GraphError):c.compile_graph(helper_graph('view_direction',target='top'))

    def test_defaults_and_named_ports(self):
        expected={'view_direction':['position','camera'],'fresnel':['normal','viewDirection','ior'],
                  'facing':['normal','viewDirection'],'mapping':['vector','translation','rotation','scale'],
                  'rim_light':['normal','viewDirection','color','strength','power']}
        for key,inputs in expected.items():self.assertEqual([p['id'] for p in builtin(key)['inputs']],inputs)
        self.assertEqual(builtin('fresnel')['inputs'][-1]['default'],1.45)
        self.assertEqual(builtin('mapping')['inputs'][-1]['default'],[1,1,1])

    def test_library_roundtrip_keeps_editable_graphs_and_isolates_edits(self):
        for key in KEYS:
            g=helper_graph(key);f=g['functions'][0]
            packet=library.build(c,g,f['id']);restored=library.entry(c,packet)
            self.assertEqual(restored['graph'],f['graph'])
            self.assertFalse(any(n['definitionUuid'].endswith(('.glsl_code','.sampler','.uniform')) for n in f['graph']['nodes']))
            f['graph']['nodes'][1]['name']='Edited'
            self.assertNotEqual(f,builtin(key))

    def test_metadata_hashes_and_categories(self):
        expected={'view_direction':'vector','mapping':'vector','fresnel':'shader','facing':'shader','rim_light':'shader'}
        for f in c.function_library(with_browser=True):
            key=f['source']['id'].removeprefix('sgrape.library.')
            if key not in KEYS:continue
            browser=f.pop('browser');source=f.pop('source')
            self.assertEqual(c.digest(f),source['version']);self.assertEqual(browser['category'],expected[key])

    def test_rim_mask_is_independent_of_color_and_strength(self):
        f=builtin('rim_light')
        self.assertEqual([(p['id'],p['type']) for p in f['outputs']],[('color','vec3'),('factor','float')])
        for target,stage in [('top','pixel'),('mat','pixel'),('mat','vertex')]:
            code=c.compile_graph(helper_graph('rim_light',dict(color=[8,4,2],strength=0),target=target,stage=stage,port='factor'))[stage]
            self.assertIn('pow(',code)
            self.assertNotIn('Rim_Light_input_color',code)
            self.assertNotIn('Rim_Light_input_strength',code)


if __name__=='__main__':unittest.main()
