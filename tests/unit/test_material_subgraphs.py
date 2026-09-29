"""Reusable material helpers: external sources, typed outputs and stage contracts."""
import copy
import json
from pathlib import Path
import unittest
import sgrape_core as c
import sgrape_library as personal


def library(key):
    return next(f for f in c.function_library() if f['source']['id']=='sgrape.library.'+key)


def color_graph(output='color',color=(.2,.4,.8,.3),multiplier=(2,.5,0),target='mat',stage='pixel'):
    graph=c.demo_graph('color',target);function=library('color_multiply');graph['functions']=[function]
    call={'id':'filter','name':'Adjust_Color','definitionUuid':c.CALL,'params':{'functionId':function['id']},
          'inputValues':{'color':list(color),'multiplier':list(multiplier)},'ui':{'x':100,'y':100}}
    nodes=[call,c.node(stage+'_out','result',700,100,dither=False,alphaTest=False,convertColorSpace=False)]
    edges=[];source='filter';port=output
    if output!='color':
        nodes.append(c.node('rgba','convert',400,100) if output=='rgb' else c.node('convert','convert',400,100,fromType='float',toType='vec4'))
        edges.append(c.edge(source,'convert','rgb' if output=='rgb' else 'value',port));source='convert';port='out'
    edges.append(c.edge(source,'result','color' if stage=='pixel' else 'position',port))
    graph['stages'][stage]={'nodes':nodes,'edges':edges}
    return graph


def normal_graph(color=(.5,.5,1,1),strength=1,sampled=False):
    presets=json.loads((Path(__file__).resolve().parents[2]/'src/library/material_presets.json').read_text(encoding='utf-8'))
    graph=copy.deepcopy(presets['pbr_textured']);function=library('normal_map')
    graph['declarations']=[d for d in graph['declarations'] if d['id'] in ('tex','tangent')]
    graph['functions']=[function]
    call={'id':'filter','name':'Surface_Normal','definitionUuid':c.CALL,'params':{'functionId':function['id']},
          'inputValues':{'color':list(color),'strength':strength},'ui':{'x':660,'y':160}}
    nodes=[c.node('vertex_input','inputs',20,200),call,c.node('rgba','rgba',1040,160),
           c.node('pixel_out','pixel',1360,160,dither=False,alphaTest=False,convertColorSpace=False)]
    edges=[c.edge('inputs','filter','tangentToWorld','tbn'),c.edge('inputs','filter','position','world'),
           c.edge('inputs','filter','normal','normal'),c.edge('filter','rgba','rgb','normal'),c.edge('rgba','pixel','color')]
    if sampled:
        graph['declarations'].append(dict(id='normalMap',kind='sampler',name='sNormalMap',type='sampler2D',source='builtin:normal'))
        nodes += [c.node('sampler','sampler',20,-140,declarationId='normalMap'),c.node('texture_sample','sample',330,-140),
                  c.node('swizzle','uv',330,180,type='vec3',mask='xy')]
        edges += [c.edge('sampler','sample','sampler'),c.edge('inputs','uv','value','uv'),
                  c.edge('uv','sample','uv'),c.edge('sample','filter','color')]
    graph['stages']['pixel']={'nodes':nodes,'edges':edges}
    return graph


class MaterialSubgraphs(unittest.TestCase):
    def test_color_outputs_compile_in_both_hosts_and_stages(self):
        for target,stage in [('top','pixel'),('mat','pixel'),('mat','vertex')]:
            for output in ('color','rgb','alpha'):
                with self.subTest(target=target,stage=stage,output=output):
                    graph=color_graph(output,target=target,stage=stage);before=copy.deepcopy(graph)
                    result=c.compile_graph(graph)
                    self.assertEqual(graph,before);self.assertTrue(result[stage])

    def test_color_multi_output_shares_one_rgb_multiplication(self):
        graph=color_graph();data=graph['stages']['pixel']
        data['nodes'].append(c.node('rgba','recombine'))
        data['edges']=[c.edge('filter','recombine','rgb','rgb'),c.edge('filter','recombine','alpha','alpha'),
                       c.edge('recombine','result','color')]
        code=c.compile_graph(graph)['pixel']
        self.assertEqual(sum(' = ' in line and 'Multiply_RGB =' in line for line in code.splitlines()),1)
        self.assertNotIn('clamp(',code);self.assertNotIn('TDConvertColorSpace(',code)

    def test_normal_accepts_external_texture_and_vertex_interfaces(self):
        for sampled in (False,True):
            graph=normal_graph(sampled=sampled);before=copy.deepcopy(graph);code=c.compile_graph(graph)['pixel']
            self.assertEqual(graph,before)
            for token in ('TDFrontFacing(', 'sg_v_tbn_0', 'sg_v_world_0', 'sg_v_normal_0', 'normalize('):self.assertIn(token,code)
            for token in ('dFdx(', 'dFdy(', 'TDConvertColorSpace('):self.assertNotIn(token,code)
            self.assertEqual('texture(sNormalMap' in code,sampled)

    def test_normal_stage_restriction_is_enforced(self):
        graph=normal_graph();graph['stages']['vertex']['nodes'].append(graph['stages']['pixel']['nodes'][1])
        with self.assertRaises(c.GraphError):c.compile_graph(graph)
        graph=normal_graph();graph['target']='top';del graph['stages']['vertex']
        with self.assertRaises(c.GraphError):c.compile_graph(graph)

    def test_helpers_are_portable_and_do_not_capture_sources(self):
        for graph in (color_graph(),normal_graph(sampled=True)):
            fn=graph['functions'][0]
            packet=personal.build(c,graph,fn['id']);restored=personal.entry(c,packet)
            self.assertEqual(restored['graph'],fn['graph'])
            self.assertEqual(restored.get('targets',['top','mat']),fn.get('targets',['top','mat']))
            self.assertFalse(any(n['definitionUuid'] in ('sgrape.builtin.sampler','sgrape.builtin.uniform','sgrape.builtin.texture_sample') for n in fn['graph']['nodes']))

    def test_browser_categories_and_source_versions(self):
        for f in c.function_library(with_browser=True)[-2:]:
            browser=f.pop('browser');source=f.pop('source')
            self.assertEqual(c.digest(f),source['version'])
            self.assertEqual(browser['category'],'texture' if f['name']=='Normal Map' else 'color')


if __name__=='__main__':unittest.main()
