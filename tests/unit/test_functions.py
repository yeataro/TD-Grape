import copy
import unittest
import sgrape_core as c

def call(ident,fn='library_tint_v1',**values):
    return {'id':ident,'definitionUuid':c.CALL,'params':{'functionId':fn},'inputValues':values}

def graph():
    g=c.demo_graph('color'); g['functions']=c.function_library()
    g['stages']['pixel']={'nodes':[call('tint'),c.node('pixel_out','pixel')],
                          'edges':[c.edge('tint','pixel','color','color')]}
    return g

class Functions(unittest.TestCase):
    def test_library_calls_and_defaults(self):
        g=graph(); original=copy.deepcopy(g); r=c.compile_graph(g)
        self.assertIn('vec4(0.7, 0.3, 1.0, 1.0)',r['pixel'])
        self.assertEqual(g,original)
        self.assertEqual(c.function_library(),c.function_library())
        g['stages']['pixel']['nodes'].insert(0,call('another',color=[.2,.3,.4,1]))
        g['stages']['pixel']['edges'].append(c.edge('another','tint','color','color'))
        self.assertIn('vec4(0.2, 0.3, 0.4, 1.0)',c.compile_graph(g)['pixel'])

    def test_nested_calls_and_ui_not_semantic(self):
        g=graph(); fn=copy.deepcopy(g['functions'][0]); fn.update(id='nested',name='Nested',scope='local')
        fn['graph']['nodes'][1]=call('multiply')
        fn['graph']['edges']=[c.edge('input','multiply','color','color'),c.edge('input','multiply','tint','tint'),c.edge('multiply','output','color','color')]
        g['functions'].append(fn); g['stages']['pixel']['nodes'][0]['params']['functionId']='nested'
        r=c.compile_graph(g)
        fn['graph']['nodes'][0]['ui']={'x':242,'y':539}
        g['functions'].reverse()
        self.assertEqual(r['hash'],c.compile_graph(g)['hash'])
        self.assertEqual(r['pixel'],c.compile_graph(g)['pixel'])

    def test_recursion_and_missing_function_even_unused(self):
        g=graph(); fn=g['functions'][0]
        fn['graph']['nodes'].append(call('cycle'))
        with self.assertRaisesRegex(c.GraphError,'reference cycle'): c.compile_graph(g)
        fn['graph']['nodes'][-1]['params']['functionId']='missing'
        with self.assertRaisesRegex(c.GraphError,'Missing Subgraph'): c.compile_graph(g)

    def test_interface_types_and_bad_defaults(self):
        for mutation in ('type','port','default','output'):
            g=graph(); fn=g['functions'][0]
            if mutation=='type': fn['inputs'][0]['type']='vec3';fn['inputs'][0]['default']=[1,1,1]
            if mutation=='port': fn['inputs'][0]['id']='renamed'
            if mutation=='default': fn['inputs'][0]['default']=[1,2]
            if mutation=='output': fn['graph']['nodes']=fn['graph']['nodes'][:-1]
            with self.assertRaises(c.GraphError): c.compile_graph(g)

    def test_unused_function_validated(self):
        g=graph(); g['stages']['pixel']=c.demo_graph('color')['stages']['pixel']
        g['functions'][0]['graph']['nodes'][1]['params']['type']='vec3'
        with self.assertRaises(c.GraphError) as caught: c.compile_graph(g)
        self.assertEqual(caught.exception.functionId,'library_tint_v1')
        self.assertEqual(caught.exception.node,'multiply')

    def test_shader_local_changes_do_not_mutate_other_shader_or_library(self):
        a=graph(); b=graph(); original=c.function_library()
        a['functions'][0]['graph']['nodes'][1]['definitionUuid']=c.CATALOG['add']['definitionUuid']
        self.assertNotEqual(c.compile_graph(a)['pixel'],c.compile_graph(b)['pixel'])
        self.assertEqual(b['functions'],original)

if __name__=='__main__': unittest.main(verbosity=2)
