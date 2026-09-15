import copy,unittest
import sgrape_core as c
import sgrape_document as document


class TopSourceInventory(unittest.TestCase):
    def test_migration_is_explicit_idempotent_and_preserves_connections(self):
        old=c.demo_graph(target='top');before=copy.deepcopy(old)
        decl=old['declarations'][0]
        old['stages']['pixel']['nodes'].extend([c.node('sampler','ref1',declarationId=decl['id']),c.node('sampler','ref2',declarationId=decl['id'])])
        old['declarations'].append(dict(decl,id='second',name='uSecond',source='builtin:white',defaultSource='builtin:banana'))
        report=document.inspect_upgrade(old,c,'top',require_baseline=False)
        self.assertTrue(report['required']);self.assertFalse(report['blocked'],report['issues'])
        new=report['candidate'];self.assertEqual(len(new['topInputs']),2)
        self.assertFalse(any(d['kind']=='sampler' for d in new['declarations']))
        self.assertTrue(all(e in new['stages']['pixel']['edges'] for e in before['stages']['pixel']['edges']))
        refs=[n for n in new['stages']['pixel']['nodes'] if n['id'] in ('ref1','ref2')]
        self.assertEqual(refs[0]['params']['inputId'],refs[1]['params']['inputId'])
        self.assertEqual(c.normalize_top_sources(new)[0],new)
        self.assertFalse(document.inspect_upgrade(new,c,'top')['required'])
        self.assertIn('defaultSource',old['declarations'][1])

    def test_empty_inventory_and_unconnected_sampling_allocate_nothing(self):
        g=c.normalize_top_sources(c.demo_graph('color','top'))[0];g['topInputs']=[]
        g['stages']['pixel']={'nodes':[c.node('texture_sample','sample'),c.node('pixel_out','out')], 'edges':[c.edge('sample','out','color')]}
        result=c.compile_graph(g)
        self.assertEqual(result['bindings'],[])
        self.assertNotIn('sTD2DInputs[',result['pixel'])
        self.assertIn('vec4(0.0, 0.0, 0.0, 1.0)',result['pixel'])

    def test_reference_count_never_changes_inventory_or_bindings(self):
        g=c.normalize_top_sources(c.demo_graph(target='top'))[0]
        original=c.compile_graph(g)['bindings']
        for i in range(12):g['stages']['pixel']['nodes'].append(c.node('top_input','ref'+str(i),inputId=g['topInputs'][0]['id']))
        self.assertEqual(c.compile_graph(g)['bindings'],original)
        g['declarations'].append({'id':'bad','name':'uBad','kind':'sampler','type':'sampler2D','source':'builtin:black'})
        with self.assertRaisesRegex(c.GraphError,'TOP Inputs'):c.compile_graph(g)

    def test_mat_model_is_unchanged(self):
        old=c.demo_graph(target='mat');new,changed=c.normalize_top_sources(old)
        self.assertEqual(new,old);self.assertEqual(changed,[])
