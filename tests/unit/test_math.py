"""Math is an ordered fold, not an expression parser or Max alias."""
import copy
import unittest
import sgrape_core as c

def fixture(ty='float',operator='add',expected=15):
    g=c.demo_graph('color');g['target']='top';g['stages'].pop('vertex',None)
    n=c.node('math','math',type=ty,mode='shared',operation=operator)
    n['inputValues']={f'input{i}':c.filled_value(ty,v) for i,v in enumerate((10,3,2))}
    probe=c.node('glsl_code','probe',functionName='probeMath',inputs=[{'id':'value','name':'value','type':ty}],outputs=[{'id':'color','name':'color','type':'vec4'}],code='color = (value == '+c.literal(c.filled_value(ty,expected),ty)+') ? vec4(1.0) : vec4(0.0);')
    g['stages']['pixel']={'nodes':[n,probe,c.node('pixel_out','pixel')],'edges':[c.edge('math','probe','value'),c.edge('probe','pixel','color','color')]}
    return g

class MathTests(unittest.TestCase):
    def test_operator_types_and_order(self):
        for ty in c.ARITHMETIC_TYPES:
            for op in c.MATH_OPERATORS:
                g=fixture(ty,op);before=copy.deepcopy(g)
                if c.arithmetic_result(op,ty,ty)!=ty:
                    with self.assertRaisesRegex(c.GraphError,'Math operands'):c.compile_graph(g)
                else:
                    code=c.compile_graph(g)['pixel'];self.assertIn(' '+c.MATH_OPERATORS[op]+' ',code)
                self.assertEqual(g,before)
        n=c.node('math','m');self.assertEqual(c.math_steps(n['params']),[{'operator':'add','input':1},{'operator':'add','input':2}])
    def test_rows_can_reuse_operands_and_retain_grouping(self):
        g=fixture();n=g['stages']['pixel']['nodes'][0];n['params'].update(mode='steps',steps=[{'operator':'subtract','input':1},{'operator':'multiply','input':1}])
        code=c.compile_graph(g)['pixel'];self.assertIn('((10.0 - 3.0) * 3.0)',code)
    def test_invalid_shapes_and_values(self):
        for params in ({'inputCount':1},{'inputCount':33},{'inputCount':True},{'mode':'eval'},{'operation':'pow'},{'steps':[]},{'steps':[{'operator':'add','input':9},{'operator':'add','input':2}]},{'type':'bool'}):
            g=fixture();g['stages']['pixel']['nodes'][0]['params'].update(params)
            with self.assertRaises(c.GraphError):c.compile_graph(g)
        n=c.node('math','m',inputCount=32);self.assertEqual(len(c.resolved_ports(c.CATALOG['math'],n['params'])['inputs']),32)
    def test_constant_and_specialization_retained(self):
        g=fixture();g['declarations']=[{'id':'factor','kind':'spec_constant','name':'uFactor','type':'float','constantId':0,'value':1}]
        g['stages']['pixel']['nodes'].append(c.node('spec_constant','factor',declarationId='factor'));g['stages']['pixel']['edges'].append(c.edge('factor','math','input1'))
        code=c.compile_graph(g)['pixel'];self.assertIn('uFactor',code);self.assertIn('math',c.CONSTANT_EXPRESSIONS)

if __name__=='__main__':unittest.main()
