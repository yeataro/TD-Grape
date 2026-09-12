import copy
import unittest
import sgrape_core as c

class CompilerTests(unittest.TestCase):
    def test_examples_and_determinism(self):
        for preset in ('banana','color','tint'):
            g=c.demo_graph(preset); original=copy.deepcopy(g)
            result=c.compile_graph(g)
            self.assertEqual(g,original)
            changed=copy.deepcopy(g)
            for stage in changed['stages'].values():
                stage['nodes'].reverse(); stage['edges'].reverse()
                for n in stage['nodes']: n['ui']={'x':993,'y':-10}
            other=c.compile_graph(changed)
            self.assertEqual(result['hash'],other['hash'])
            self.assertEqual(result['pixel'],other['pixel'])
    def test_cycle_rejected_without_mutation(self):
        g=c.demo_graph('color'); p=g['stages']['pixel']
        p['nodes'] += [c.node('add','a'),c.node('add','b')]
        p['edges'] += [c.edge('a','b','a'),c.edge('b','a','a')]
        before=copy.deepcopy(g)
        with self.assertRaisesRegex(c.GraphError,'Cycle'): c.compile_graph(g)
        self.assertEqual(g,before)
    def test_type_mismatch_and_splat(self):
        g=c.demo_graph('color'); p=g['stages']['pixel']
        p['nodes'][0]=c.node('vec3','color')
        with self.assertRaisesRegex(c.GraphError,'vec3 cannot'): c.compile_graph(g)
        p['nodes'][0]=c.node('float','color')
        self.assertIn('vec4(sg_n_color)',c.compile_graph(g)['pixel'])
    def test_duplicate_link_and_version(self):
        g=c.demo_graph(); g['stages']['pixel']['edges'].append(copy.deepcopy(g['stages']['pixel']['edges'][0]))
        with self.assertRaisesRegex(c.GraphError,'one connection'): c.compile_graph(g)
        g['schemaVersion']=999
        with self.assertRaisesRegex(c.GraphError,'version'): c.compile_graph(g)
    def test_dead_nodes_and_semantic_change(self):
        g=c.demo_graph('color'); old=c.compile_graph(g)
        g['stages']['pixel']['nodes'].append(c.node('float','unused'))
        new=c.compile_graph(g)
        self.assertNotIn('sg_n_unused',new['pixel'])
        self.assertNotEqual(old['hash'],new['hash'])
        self.assertEqual(new['diagnostics'][0]['node'],'unused')
    def test_nonfinite_and_injection(self):
        g=c.demo_graph('color'); g['stages']['pixel']['nodes'][0]['params']['value'][0]=float('nan')
        with self.assertRaises(ValueError): c.compile_graph(g)
        g=c.demo_graph(); g['declarations'][0]['name']='bad; void main(){}'
        with self.assertRaises(c.GraphError): c.compile_graph(g)

if __name__=='__main__': unittest.main(verbosity=2)
