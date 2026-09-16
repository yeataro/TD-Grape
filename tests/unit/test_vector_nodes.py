"""Vector boundaries, constant qualification, legacy compatibility and real UI plans."""
import copy
import json
from pathlib import Path
import subprocess
import unittest
import sgrape_core as c


def vector_graph(nodes,edges,output='join',port='out'):
    graph=c.normalize_top_sources(c.demo_graph('color','top'))[0]
    graph['topInputs']=[]
    graph['stages']['pixel']={'nodes':nodes+[c.node('pixel_out','result')],
                              'edges':edges+[c.edge(output,'result','color',port)]}
    return graph


class VectorNodes(unittest.TestCase):
    def test_all_exact_component_partitions(self):
        for ty in c.VECTOR_TYPES:
            layouts=c.combine_layouts(ty)
            self.assertEqual(len(layouts),2**(c.type_components(ty)-1))
            for row in layouts:
                cursor=0
                for port,part_type in row['inputs'].items():
                    self.assertEqual(port,'xyzw'[cursor]);cursor+=c.type_components(part_type)
                self.assertEqual(cursor,c.type_components(ty))
                self.assertEqual(c.vector_interface('combine',{'type':ty,'groups':row['groups']})['inputs'],row['inputs'])

    def test_vec4_constructors_keep_every_input_in_order(self):
        for row in c.combine_layouts('vec4'):
            nodes=[];edges=[];names=[]
            for port,ty in row['inputs'].items():
                nodes.append(c.node(ty,port,value=c.filled_value(ty,.25)))
                edges.append(c.edge(port,'join',port));names.append('sg_n_'+port)
            nodes.append(c.node('combine','join',type='vec4',groups=row['groups']))
            graph=vector_graph(nodes,edges);before=copy.deepcopy(graph)
            result=c.compile_graph(graph)
            self.assertIn('const vec4 sg_n_join = vec4('+', '.join(names)+');',result['pixel'])
            self.assertEqual(graph,before)

    def test_constant_chain_is_qualified_without_freezing_uniforms(self):
        join=c.node('combine','join',type='vec4',groups={'x':'vec2'},components=[0,0,.3,1],requireConstant=True)
        graph=vector_graph([c.node('vec2','a',value=[.1,.2]),c.node('multiply','gain',type='vec2'),join],
                           [c.edge('a','gain','a'),c.edge('gain','join','x')])
        result=c.compile_graph(graph)
        self.assertIn('const vec2 sg_n_a',result['pixel']);self.assertIn('const vec2 sg_n_gain',result['pixel'])
        self.assertIn('vec4(sg_n_gain, 0.3, 1.0)',result['pixel'])
        graph['declarations'].append(dict(id='u',kind='uniform',name='uValue',type='vec2',value=[.1,.2]))
        graph['stages']['pixel']['nodes'][0]=c.node('uniform','a',declarationId='u')
        before=copy.deepcopy(graph)
        with self.assertRaises(c.GraphError) as caught:c.compile_graph(graph)
        self.assertEqual(caught.exception.node,'join');self.assertIn('Require Constant',str(caught.exception))
        self.assertEqual(graph,before)
        del join['params']['requireConstant']
        self.assertIn('vec4 sg_n_join',c.compile_graph(graph)['pixel'])
        self.assertNotIn('const vec4 sg_n_join',c.compile_graph(graph)['pixel'])

    def test_swizzle_repeat_reorder_and_split_with_constant_chain(self):
        graph=vector_graph([c.node('vec2','source',value=[.2,.7]),c.node('vector_split','split'),
                            c.node('combine','pair'),c.node('swizzle','join',mask='yxxy')],
                           [c.edge('source','split','value'),c.edge('split','pair','x','x'),
                            c.edge('split','pair','y','y'),c.edge('pair','join','value')])
        shader=c.compile_graph(graph)['pixel']
        self.assertIn('(sg_n_source).x',shader);self.assertIn('(sg_n_source).y',shader)
        self.assertIn('const vec4 sg_n_join = (sg_n_pair).yxxy;',shader)
        graph['stages']['pixel']['nodes'][-2]['params']['mask']='zw'
        with self.assertRaisesRegex(c.GraphError,'Swizzle'):c.compile_graph(graph)

    def test_invalid_boundaries_and_no_implicit_truncation(self):
        for groups in ({'x':'vec3','y':'vec2'},{'w':'vec2'},{'x':'float'},{'z':'sampler2D'},None):
            with self.assertRaises(c.GraphError):c.vector_interface('combine',{'type':'vec4','groups':groups})
        for mask in ('','xyzwx','uv','rgba','x;bad',None):
            with self.assertRaises(c.GraphError):c.vector_interface('swizzle',{'type':'vec4','mask':mask})
        graph=vector_graph([c.node('vec3','source'),c.node('combine','join',type='vec4')],[c.edge('source','join','x')])
        with self.assertRaisesRegex(c.GraphError,'exact type'):c.compile_graph(graph)
        graph['stages']['pixel']['nodes'][0]=c.node('float','source')
        graph['stages']['pixel']['nodes'][1]['params']['groups']={'x':'vec2'}
        with self.assertRaisesRegex(c.GraphError,'exact type'):c.compile_graph(graph)

    def test_constant_requirement_crosses_a_subgraph_boundary(self):
        graph=vector_graph([c.node('vec2','source',value=[.2,.7]),
                           {'id':'fn','definitionUuid':c.CALL,'params':{'functionId':'vector_fn'}},
                           c.node('swizzle','join',mask='xyxy',requireConstant=True)],
                          [c.edge('source','fn','value'),c.edge('fn','join','value')])
        graph['functions']=[dict(id='vector_fn',name='Vector',scope='local',stages=['pixel'],
            inputs=[dict(id='value',name='Value',type='vec2',default=[0,0])],
            outputs=[dict(id='out',name='Out',type='vec2',default=[0,0])],
            graph=dict(nodes=[{'id':'in','definitionUuid':c.FUNCTION_INPUT,'params':{}},
                              c.node('multiply','scale',type='vec2'),
                              {'id':'out','definitionUuid':c.FUNCTION_OUTPUT,'params':{}}],
                       edges=[c.edge('in','scale','a','value'),c.edge('scale','out','out')]))]
        self.assertIn('const vec4 sg_n_join',c.compile_graph(graph)['pixel'])

    def test_editor_uses_same_layouts_and_preserves_edits(self):
        root=Path(__file__).resolve().parents[2]
        payload={'catalog':list(c.CATALOG.values()),'contract':c.type_contract()}
        result=subprocess.run(['node',str(root/'tests/unit/test_vector_nodes.js')],input=json.dumps(payload),
                              text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr)
        for graph in json.loads(result.stdout)['graphs']:c.compile_graph(graph)


if __name__=='__main__':unittest.main()
