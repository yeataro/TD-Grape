import copy
import unittest
import sgrape_core as c

class InputValues(unittest.TestCase):
    def test_wire_overrides_but_preserves_default(self):
        graph=c.demo_graph('color')
        p=graph['stages']['pixel']
        value=c.node('multiply','gain',type='vec4')
        value['inputValues']={'a':[.2,.4,.6,1],'b':[.5,.5,.5,1]}
        p['nodes'].append(value)
        p['edges']=[c.edge('gain','pixel','color')]
        before=copy.deepcopy(graph)
        self.assertIn('(vec4(0.2, 0.4, 0.6, 1.0) * vec4(0.5, 0.5, 0.5, 1.0))',c.compile_graph(graph)['pixel'])
        p['edges'].append(c.edge('color','gain','a'))
        self.assertIn('(sg_n_color * vec4(0.5, 0.5, 0.5, 1.0))',c.compile_graph(graph)['pixel'])
        self.assertEqual(value['inputValues'],before['stages']['pixel']['nodes'][-1]['inputValues'])
        p['edges'].pop()
        self.assertEqual(c.compile_graph(graph)['pixel'],c.compile_graph(before)['pixel'])

    def test_special_uv_and_explicit_output(self):
        graph=c.demo_graph(); p=graph['stages']['pixel']
        p['edges']=p['edges'][1:]
        self.assertIn('texture(uTexture, sg_uv)',c.compile_graph(graph)['pixel'])
        p['nodes'][1]['inputValues']={'uv':[.5,.5]}
        self.assertIn('texture(uTexture, vec2(0.5, 0.5))',c.compile_graph(graph)['pixel'])
        p['edges']=[]; p['nodes'][-1]['inputValues']={'color':[.1,.2,.3,1]}
        self.assertIn('sg_color = vec4(0.1, 0.2, 0.3, 1.0)',c.compile_graph(graph)['pixel'])

    def test_bad_saved_values_rejected_even_when_connected(self):
        graph=c.demo_graph(); texture=graph['stages']['pixel']['nodes'][1]
        for value in [float('inf'),[1],[1,'bad'],[True,2]]:
            texture['inputValues']={'uv':value}
            with self.assertRaises(ValueError): c.compile_graph(graph)

if __name__=='__main__': unittest.main(verbosity=2)
