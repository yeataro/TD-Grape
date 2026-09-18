"""Compare/If are typed expressions; both upstream branches remain emitted."""
import copy
import json
from pathlib import Path
import subprocess
import unittest
import sgrape_core as c


def control_graph(nodes, edges=(), target='top', stage='pixel'):
    graph=c.demo_graph('color',target)
    graph['declarations']=[]
    graph['stages'][stage]={'nodes':[*nodes,c.node(stage+'_out','result')],
                            'edges':[*edges,c.edge(nodes[-1]['id'],'result','color' if stage=='pixel' else 'position')]}
    return graph


class ControlNodes(unittest.TestCase):
    def test_compare_operators_scalar_types_and_shader_stages(self):
        for target,stage in [('top','pixel'),('mat','pixel'),('mat','vertex')]:
            for ty in c.COMPARE_TYPES:
                for operator in c.COMPARE_OPERATORS:
                    with self.subTest(target=target,stage=stage,type=ty,operator=operator):
                        compare=c.node('compare','compare',type=ty,operator=operator)
                        compare['inputValues']={'a':3,'b':2}
                        graph=control_graph([compare],target=target,stage=stage)
                        before=copy.deepcopy(graph);result=c.compile_graph(graph)
                        self.assertEqual(graph,before)
                        self.assertIn('const bool sg_n_compare = ('+c.literal(3,ty)+' '+operator+' '+c.literal(2,ty)+');',result[stage])
                        self.assertEqual(result['stages'][stage]['ports']['compare'],{'in':{'a':ty,'b':ty},'out':{'out':'bool'}})
                        self.assertEqual(result,c.compile_graph(json.loads(json.dumps(graph))))

    def test_if_unconnected_defaults_and_all_numeric_result_types(self):
        for ty in c.TYPES:
            branch=c.node('if','branch',type=ty)
            reduction=c.node('length','length',type=ty)
            graph=control_graph([branch,reduction],[c.edge('branch','length','value')])
            code=c.compile_graph(graph)['pixel']
            self.assertIn('const '+ty+' sg_n_branch = (false ? '+c.literal(c.filled_value(ty,1),ty)+' : '+c.literal(c.filled_value(ty,0),ty)+');',code)
            branch['inputValues']={'condition':True,'true':c.filled_value(ty,.25),'false':c.filled_value(ty,.75)}
            self.assertIn('(true ? '+c.literal(branch['inputValues']['true'],ty)+' : '+c.literal(branch['inputValues']['false'],ty)+')',c.compile_graph(graph)['pixel'])

    def test_compare_invalid_operator_type_and_input_are_rejected(self):
        for operator in ['===','=',') || true || (',None,False,[]]:
            graph=control_graph([c.node('compare','compare',operator=operator)])
            with self.subTest(operator=operator),self.assertRaisesRegex(c.GraphError,'Compare: choose') as caught:c.compile_graph(graph)
            self.assertEqual(caught.exception.node,'compare')
        for ty in ['vec2','vec3','vec4','bool','sampler2D']:
            with self.subTest(type=ty),self.assertRaises(c.GraphError):c.compile_graph(control_graph([c.node('compare','compare',type=ty)]))
        for source in [c.node('compare','source'),c.node('vec2','source')]:
            graph=control_graph([source,c.node('compare','compare')],[c.edge('source','compare','a')])
            with self.assertRaisesRegex(c.GraphError,'Compare accepts'):c.compile_graph(graph)
        for ty,bad in [('int',.5),('uint',-1),('int',2147483648),('uint',4294967296)]:
            compare=c.node('compare','compare',type=ty);compare['inputValues']={'a':bad}
            with self.subTest(type=ty,value=bad),self.assertRaises(c.GraphError):c.compile_graph(control_graph([compare]))

    def test_if_condition_is_strict_bool_and_result_does_not_silently_truncate(self):
        graph=control_graph([c.node('float','number'),c.node('if','branch')],[c.edge('number','branch','condition')])
        with self.assertRaisesRegex(c.GraphError,'float cannot connect to bool'):c.compile_graph(graph)
        graph['stages']['pixel']['edges']=[c.edge('branch','result','color')]
        graph['stages']['pixel']['nodes'][1]['inputValues']={'condition':1}
        with self.assertRaisesRegex(c.GraphError,'boolean constant'):c.compile_graph(graph)
        graph=control_graph([c.node('vec3','value'),c.node('if','branch',type='vec2')],[c.edge('value','branch','true')])
        with self.assertRaisesRegex(c.GraphError,'vec3 cannot connect to vec2'):c.compile_graph(graph)
        for ty in ['int','uint','bool','sampler2D']:
            with self.subTest(type=ty),self.assertRaises(c.GraphError):c.compile_graph(control_graph([c.node('if','branch',type=ty)]))

    def test_runtime_and_specialization_conditions_keep_both_dependencies(self):
        for kind,ty,value in [('uniform','float',.5),('spec_constant','int',0),('spec_constant','uint',4294967295)]:
            condition=c.node(kind,'mode',declarationId='mode')
            compare=c.node('compare','compare',type=ty,operator='==');compare['inputValues']={'b':0}
            branch=c.node('if','branch')
            graph=control_graph([condition,compare,c.node('sin','true_path'),c.node('cos','false_path'),branch],
                    [c.edge('mode','compare','a'),c.edge('compare','branch','condition'),c.edge('true_path','branch','true'),c.edge('false_path','branch','false')])
            graph['declarations']=[dict(id='mode',kind=kind,name='uMode',type=ty,value=value,**({'constantId':7} if kind=='spec_constant' else {}))]
            code=c.compile_graph(graph)['pixel']
            self.assertIn('bool sg_n_compare = (',code);self.assertNotIn('const bool sg_n_compare',code)
            self.assertIn('float sg_n_branch = (sg_n_compare ? sg_n_true_path : sg_n_false_path);',code)
            self.assertLess(code.index('sg_n_true_path ='),code.index('sg_n_branch ='));self.assertLess(code.index('sg_n_false_path ='),code.index('sg_n_branch ='))
            if kind=='spec_constant':
                self.assertIn('layout(constant_id = 7) const '+ty+' uMode',code)
                graph['declarations'][0]['value']=1
                changed=c.compile_graph(graph)['pixel']
                self.assertIn('(sg_n_compare ? sg_n_true_path : sg_n_false_path)',changed)

    def test_literal_condition_does_not_prune_runtime_branch_or_binding(self):
        branch=c.node('if','branch');branch['inputValues']={'condition':False}
        graph=control_graph([c.node('uniform','unused_at_runtime',declarationId='value'),branch],[c.edge('unused_at_runtime','branch','true')])
        graph['declarations']=[dict(id='value',kind='uniform',name='uStillNeeded',type='float',value=.75)]
        code=c.compile_graph(graph)['pixel']
        self.assertIn('uniform float uStillNeeded;',code)
        self.assertIn('(false ? sg_n_unused_at_runtime : 0.0)',code)
        self.assertNotIn('const float sg_n_branch',code)
        branch['params']['requireConstant']=True
        with self.assertRaisesRegex(c.GraphError,'Require Constant'):c.compile_graph(graph)

    def test_compare_if_constant_requirements_and_explicit_branch_casts(self):
        compare=c.node('compare','condition',requireConstant=True)
        branch=c.node('if','branch',requireConstant=True,type='vec4')
        graph=control_graph([compare,c.node('float','value'),branch],[c.edge('condition','branch','condition'),c.edge('condition','branch','false'),c.edge('value','branch','true')])
        code=c.compile_graph(graph)['pixel']
        self.assertIn('const bool sg_n_condition',code)
        self.assertIn('const vec4 sg_n_branch = (sg_n_condition ? vec4(sg_n_value) : vec4(sg_n_condition));',code)
        for ty,value in [('int',2147483647),('uint',4294967295),('bool',True)]:
            branch=c.node('if','branch')
            graph=control_graph([c.node('spec_constant','source',declarationId='source'),branch],[c.edge('source','branch','true')])
            graph['declarations']=[dict(id='source',kind='spec_constant',name='sValue',type=ty,value=value,constantId=2)]
            self.assertIn('(false ? float(sValue) : 0.0)',c.compile_graph(graph)['pixel'])

    def test_bool_subgraph_interface_can_feed_if(self):
        graph=control_graph([{'id':'call','definitionUuid':c.CALL,'params':{'functionId':'choose'}}])
        graph['functions']=[dict(id='choose',name='Choose',scope='local',stages=['pixel'],
            inputs=[dict(id='condition',name='Condition',type='bool',default=True)],outputs=[dict(id='out',name='Out',type='float',default=0)],
            graph=dict(nodes=[{'id':'input','definitionUuid':c.FUNCTION_INPUT,'params':{}},c.node('if','branch'),{'id':'output','definitionUuid':c.FUNCTION_OUTPUT,'params':{}}],
                       edges=[c.edge('input','branch','condition','condition'),c.edge('branch','output','out')]))]
        self.assertIn(' ? 1.0 : 0.0)',c.compile_graph(graph)['pixel'])

    def test_javascript_type_plans_defaults_and_transaction_roundtrips(self):
        root=Path(__file__).resolve().parents[2]
        payload={'catalog':list(c.CATALOG.values()),'contract':c.type_contract()}
        result=subprocess.run(['node',str(root/'tests/unit/test_control_nodes.js')],input=json.dumps(payload),text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr)
        for graph in json.loads(result.stdout)['graphs']:c.compile_graph(graph)


if __name__=='__main__':unittest.main()
