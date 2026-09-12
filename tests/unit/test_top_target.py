import copy,json,unittest
from pathlib import Path
import sgrape_core as c

class TopTargetTests(unittest.TestCase):
    def test_mat_compatibility(self):
        saved=json.loads((Path(__file__).resolve().parents[1]/'fixtures/baseline_mat.json').read_text(encoding='utf-8'))
        for name,expected in saved.items():
            actual=c.compile_graph(c.demo_graph(name))
            actual.pop('sourceMap')  # New diagnostic metadata is not emitted GLSL.
            from test_mat_buffers import legacy_single_buffer_result
            self.assertEqual(legacy_single_buffer_result(actual),expected)
    def test_top_sources_and_stages(self):
        for preset in ('banana','color','tint'):
            g=c.demo_graph(preset,target='top');before=copy.deepcopy(g);out=c.compile_graph(g)
            self.assertEqual(g,before);self.assertEqual(out['vertex'],'');self.assertEqual(set(out['stages']),{'pixel'})
            for token in ('TDAlphaTest','TDDither','TDCheckDiscard','TD_NUM_COLOR_BUFFERS','uniform sampler2D'):self.assertNotIn(token,out['pixel'])
            self.assertIn('vUV.st',out['pixel'])
        g=c.demo_graph(target='top');g['declarations'].insert(0,dict(g['declarations'][0],id='aaaa',name='unused'))
        out=c.compile_graph(g);self.assertIn('sTD2DInputs[0]',out['pixel']);self.assertNotIn('sTD2DInputs[1]',out['pixel'])
        self.assertEqual([d['id'] for d in out['bindings']],['texture_main'])
    def test_wrong_target_keeps_graph(self):
        for mutate in (lambda g:g.update(target='compute'),lambda g:g['stages'].update(vertex={'nodes':[],'edges':[]}),lambda g:g['declarations'][0].update(source='input:1')):
            g=c.demo_graph(target='top');mutate(g);before=copy.deepcopy(g)
            with self.assertRaises(c.GraphError):c.compile_graph(g)
            self.assertEqual(g,before)
        g=c.demo_graph();g['declarations'][0]['source']='input:0'
        with self.assertRaises(c.GraphError):c.compile_graph(g)
    def test_filter_library_on_top(self):
        for f in c.function_library():
            g=c.demo_graph(target='top');g['functions']=[f]
            g['stages']['pixel']['nodes'].append({'id':'filter','definitionUuid':c.CALL,'params':{'functionId':f['id']}})
            g['stages']['pixel']['edges']=[c.edge('texture','filter','color'),c.edge('filter','pixel','color','color')]
            self.assertIn('sTD2DInputs[0]',c.compile_graph(g)['pixel'])

if __name__=='__main__':unittest.main()
