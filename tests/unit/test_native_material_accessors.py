import unittest
import sgrape_core as c
from native_material_accessor_fixture import accessor_graph

class NativeMaterialAccessors(unittest.TestCase):
    def test_live_header_only_and_source_map(self):
        graph=accessor_graph(c,'convert');result=c.compile_graph(graph)
        self.assertEqual(result['pixel'].count('#include <TDColorSpace>'),1)
        self.assertNotIn('TDColorSpace',result['vertex'])
        for row in result['sourceMap']['pixel']:
            if row['node']=='convert':
                self.assertIn('TDConvertColorSpace(',result['pixel'].splitlines()[row['line']-1])
        graph['stages']['pixel']['edges']=[]
        self.assertNotIn('TDColorSpace',c.compile_graph(graph)['pixel'])
        self.assertNotIn('TDColorSpace',c.compile_graph(c.demo_graph('color','mat'))['pixel'])

    def test_cross_stage_instance_and_source_contract(self):
        result=c.compile_graph(accessor_graph(c,'color_pixel'))
        self.assertIn('TDInstanceIndex()',result['vertex'])
        self.assertIn('flat in int sg_v_data_0',result['pixel'])
        self.assertIn('TDInstanceColor(',result['pixel'])
        result=c.compile_graph(accessor_graph(c,'color_vertex'))
        self.assertIn('TDInstanceColor(vec4(',result['vertex'])
        result=c.compile_graph(accessor_graph(c,'screen'))
        self.assertIn('TDScreenSpaceCoord().st',result['pixel'])
        # Old indexed Vertex-only node retains its identity and contract.
        self.assertEqual(c.CATALOG['td_instance_color']['stages'],['vertex'])
        for source,stage in [('TDScreenSpaceCoord','vertex'),('TDInstanceIndex','pixel')]:
            with self.assertRaises(c.GraphError):c.type_registry().source(source,'mat',stage)
        graph=accessor_graph(c,'convert');graph['target']='top';graph['stages'].pop('vertex')
        with self.assertRaises(c.GraphError):c.compile_graph(graph)

if __name__=='__main__':unittest.main()
