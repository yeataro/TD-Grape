import copy,unittest
import sgrape_core as c
from native_projection_fixture import projection_graph

class ProjectionMapTests(unittest.TestCase):
    def test_connected_type_and_runtime_call(self):
        for mode,ty,fn in [('lod','vec4','TDProjTextureLod'),('size','ivec3','TDProjTextureSize')]:
            graph=projection_graph(c,mode,light=1,lod=2.5);before=copy.deepcopy(graph)
            result=c.compile_graph(graph)
            self.assertEqual(graph,before)
            self.assertIn(fn+'(',result['pixel'])
            self.assertNotIn(fn+'(',result['vertex'])
            self.assertEqual(c.CATALOG['td_projtexture_'+mode]['outputs']['out'],ty)
            self.assertFalse(c._legacy_nodes.CALLS['td_projtexture_'+mode]['constant'])
            if mode=='lod':self.assertIn('2.5',result['pixel'])

    def test_wrong_target_and_stage_rejected(self):
        for mode in ('lod','size'):
            graph=projection_graph(c,mode);graph['target']='top';graph['stages'].pop('vertex')
            with self.assertRaisesRegex(c.GraphError,'requires a MAT graph'):c.compile_graph(graph)
            graph=c.demo_graph('color','mat');vertex=graph['stages']['vertex']
            vertex['nodes'].append(c.node('td_projtexture_'+mode,'probe'))
            vertex['edges']=[c.edge('probe','vertex','position')]
            with self.assertRaisesRegex(c.GraphError,'wrong shader stage'):c.compile_graph(graph)
