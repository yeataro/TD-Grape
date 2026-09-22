"""Switch keeps typed values, explicit fallback and an int selector."""
import copy
import unittest
import sgrape_core as c

def fixture(ty='float',index=0):
    g=c.demo_graph('color');g['target']='top';g['stages'].pop('vertex',None)
    switch=c.node('switch','choice',type=ty,caseCount=2)
    switch['inputValues']={'default':c.filled_value(ty,0),'index':index,'case0':c.filled_value(ty,1),'case1':c.filled_value(ty,2)}
    expected=switch['inputValues']['case'+str(index)] if index in (0,1) else switch['inputValues']['default']
    probe=c.node('glsl_code','probe',functionName='probeSwitch',inputs=[{'id':'value','name':'value','type':ty}],outputs=[{'id':'color','name':'color','type':'vec4'}],code='color = (value == '+c.literal(expected,ty)+') ? vec4(1.0) : vec4(0.0);')
    g['stages']['pixel']={'nodes':[switch,probe,c.node('pixel_out','pixel')],'edges':[c.edge('choice','probe','value'),c.edge('probe','pixel','color','color')]}
    return g

class SwitchTests(unittest.TestCase):
    def test_scalar_vector_matrix_types_and_fallbacks(self):
        for ty in c.TYPES:
            for index in (-2147483648,-1,0,1,2,2147483647):
                with self.subTest(type=ty,index=index):
                    g=fixture(ty,index);before=copy.deepcopy(g);code=c.compile_graph(g)['pixel']
                    self.assertIn('switch (',code);self.assertIn('case 0:',code);self.assertIn('case 1:',code);self.assertIn('default:',code);self.assertEqual(g,before)
    def test_exact_case_and_index_types(self):
        for port,source_type,value in [('case0','int',1),('default','vec3',[1,2,3]),('index','uint',0),('index','float',0.)]:
            with self.subTest(port=port,type=source_type):
                g=fixture();g['stages']['pixel']['nodes'].append(c.node('scalar' if source_type!='vec3' else 'vec3','input',**({'type':source_type,'value':value} if source_type!='vec3' else {'value':value})))
                g['stages']['pixel']['edges'].append(c.edge('input','choice',port))
                with self.assertRaisesRegex(c.GraphError,'exact type'):c.compile_graph(g)
    def test_invalid_count_and_stale_port(self):
        for count in (-1,17,True,1.5):
            g=fixture();g['stages']['pixel']['nodes'][0]['params']['caseCount']=count
            with self.assertRaisesRegex(c.GraphError,'0–16'):c.compile_graph(g)
        g=fixture();g['stages']['pixel']['nodes'][0]['inputValues']['case9']=0
        with self.assertRaisesRegex(c.GraphError,'default values'):c.compile_graph(g)
    def test_zero_cases_and_specialization_do_not_prune(self):
        g=fixture();n=g['stages']['pixel']['nodes'][0];n['params']['caseCount']=0;n['inputValues']={'default':0,'index':-1};self.assertNotIn('case 0:',c.compile_graph(g)['pixel'])
        g=fixture();g['declarations']=[{'id':'index','kind':'spec_constant','name':'uIndex','type':'int','constantId':0,'value':0}]
        g['stages']['pixel']['nodes'].append(c.node('spec_constant','index',declarationId='index'));g['stages']['pixel']['edges'].append(c.edge('index','choice','index'))
        code=c.compile_graph(g)['pixel'];self.assertIn('case 1:',code);self.assertIn('default:',code);self.assertIn('switch (uIndex)',code)

if __name__=='__main__':unittest.main()
