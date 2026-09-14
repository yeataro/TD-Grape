"""Handwritten functions use stable graph ports and native GLSL diagnostics."""
from pathlib import Path
import copy
import json
import subprocess
import unittest

import sgrape_core as c
import sgrape_document as document


def fixture(target='top', code='c = a + b;'):
    graph=c.demo_graph('color',target)
    custom=c.node('glsl_code','custom',96,144)
    custom['params']['code']=code
    custom['inputValues']={'a':.2,'b':.3}
    graph['stages']['pixel']={'nodes':[custom,c.node('pixel_out','pixel',432,144)],
                             'edges':[c.edge('custom','pixel','color','c')]}
    return graph,custom


class GLSLCodeTests(unittest.TestCase):
    def test_multiple_outputs_one_call_and_defaults(self):
        for target in ('top','mat'):
            graph,n=fixture(target)
            n['params']['outputs'].append({'id':'rgba','name':'rgbaValue','type':'vec4'})
            n['params']['code']='c = a + b;\nrgbaValue = vec4(c);'
            data=graph['stages']['pixel'];data['nodes'].append(c.node('add','sum',type='vec4'))
            data['edges']=[c.edge('custom','sum','a','c'),c.edge('custom','sum','b','rgba'),c.edge('sum','pixel','color')]
            before=copy.deepcopy(graph);result=c.compile_graph(graph);source=result['pixel']
            self.assertIn('out float c, out vec4 rgbaValue)',source)
            self.assertIn('c = 0.0;',source);self.assertIn('rgbaValue = vec4(0.0, 0.0, 0.0, 0.0);',source)
            self.assertEqual(source.count('sg_code_custom_add('),2)  # Definition + one call.
            self.assertIn('sg_code_custom_add(0.2, 0.3, sg_n_custom_c, sg_n_custom_rgba);',source)
            self.assertIn('(vec4(sg_n_custom_c) + sg_n_custom_rgba)',source)
            self.assertEqual(graph,before)

    def test_order_and_names_are_independent_of_connection_ids(self):
        graph,n=fixture()
        n['params']['inputs'].reverse();n['params']['outputs'][0]['name']='sumValue'
        n['params']['code']='sumValue = a + b;'
        source=c.compile_graph(graph)['pixel']
        self.assertIn('(in float b, in float a, out float sumValue)',source)
        self.assertIn('sg_code_custom_add(0.3, 0.2, sg_n_custom_c)',source)
        self.assertEqual(graph['stages']['pixel']['edges'][0]['from'],['custom','c'])

    def test_sampler_input_and_defined_missing_source(self):
        for target in ('top','mat'):
            graph,n=fixture(target);n.pop('inputValues')
            n['params']['inputs']=[{'id':'tex','name':'tex','type':'sampler2D'},{'id':'uv','name':'uv','type':'vec2'}]
            n['params']['outputs'][0]['type']='vec4';n['params']['code']='c = texture(tex, uv);'
            result=c.compile_graph(graph)
            self.assertIn('in sampler2D tex',result['pixel'])
            self.assertEqual(result['bindings'][0]['source'],'builtin:black')
            self.assertNotIn('sampler2D sg_n_',result['pixel'])
            self.assertIn('sTD2DInputs[0]' if target=='top' else 'sg_fallbackTexture',result['pixel'])
            graph['declarations']=[{'id':'image','kind':'sampler','name':'uImage','type':'sampler2D','source':'builtin:banana'}]
            graph['stages']['pixel']['nodes'].append(c.node('sampler','source',declarationId='image'))
            graph['stages']['pixel']['edges'].append(c.edge('source','custom','tex'))
            self.assertEqual(c.compile_graph(graph)['bindings'][0]['id'],'image')

    def test_body_boundaries_and_comment_handling(self):
        accepted=['','// a comment ending at EOF','/* } #error */\nif (a > b) { c = a; } else { c = b; }',
                  'c = a; // {\nc += b;','for (int i=0; i<3; ++i) { c += a; }\nreturn;']
        for body in accepted:
            graph,_=fixture(code=body);self.assertIn('void sg_code_custom_add',c.compile_graph(graph)['pixel'])
        rejected=['}\nvoid main() {','if (true) {','/* missing end','#define c a','// slash\\\n}',
                  'c = a;\x00','x'*(c.GLSL_CODE_MAX_LENGTH+1)]
        for body in rejected:
            graph,_=fixture(code=body)
            with self.assertRaises(c.GraphError) as raised:c.compile_graph(graph)
            self.assertEqual(raised.exception.node,'custom');self.assertEqual(raised.exception.stage,'pixel')

    def test_invalid_interfaces_retain_node_context(self):
        variants=[{'functionName':'main'},{'functionName':'vec4'}, {'functionName':'sg_test'},
                  {'inputs':None},{'outputs':[]},{'outputs':[{'id':'x','name':'tex','type':'sampler2D'}]},
                  {'outputs':[{'id':'a','name':'c','type':'float'}]},
                  {'outputs':[{'id':'c','name':'a','type':'float'}]},
                  {'outputs':[{'id':'c','name':'bad name','type':'float'}]},
                  {'inputs':[{'id':'p'+str(i),'name':'v'+str(i),'type':'float'} for i in range(17)]}]
        for patch in variants:
            graph,n=fixture();n['params'].update(patch)
            with self.assertRaises(c.GraphError) as raised:c.compile_graph(graph)
            self.assertEqual(raised.exception.node,'custom')
            self.assertEqual(document.inspect_document(graph,c,'top')['status'],'blocked')

    def test_body_and_call_locations_in_nested_subgraph(self):
        graph,n=fixture('mat',code='c = a;\nc += missingValue;');n['ui']['label']='手寫加法'
        fn={'id':'local_code','name':'Code','scope':'local','stages':['pixel'],
            'inputs':[], 'outputs':[{'id':'result','name':'Result','type':'float','default':0}],
            'graph':{'nodes':[n,{'id':'input','definitionUuid':c.FUNCTION_INPUT,'params':{}},
                             {'id':'output','definitionUuid':c.FUNCTION_OUTPUT,'params':{}}],
                     'edges':[c.edge('custom','output','result','c')]}}
        graph['functions']=[fn];graph['stages']['pixel']={'nodes':[{'id':'call','definitionUuid':c.CALL,'params':{'functionId':fn['id']}},c.node('pixel_out','pixel')],
            'edges':[c.edge('call','pixel','color','result')]}
        compiled=c.compile_graph(graph)
        row=next(row for row in compiled['sourceMap']['pixel'] if row.get('codeLine')==2)
        self.assertEqual(row['node'],'custom');self.assertEqual(row['functionId'],fn['id']);self.assertEqual(row['trail'],[fn['id']])
        self.assertIn('missingValue',compiled['pixel'].splitlines()[row['line']-1])
        diagnostics=c.native_compile_diagnostics('ERROR: /shader/pixel: '+str(row['line'])+': bad',compiled,{'pixel':'/shader/pixel'})
        self.assertEqual(diagnostics,[])  # Exact TD line syntax is required.
        diagnostics=c.native_compile_diagnostics('ERROR: /shader/pixel:'+str(row['line'])+': bad',compiled,{'pixel':'/shader/pixel'})
        self.assertEqual(diagnostics[0]['codeLine'],2)
        for data in [*graph['stages'].values(),fn['graph']]:
            for node in data['nodes']:node.setdefault('ui',{'x':0,'y':0})
        report=document.inspect_document(json.loads(json.dumps(graph)),c,'mat')
        self.assertEqual(report['status'],'valid');self.assertEqual(report['candidate'],graph)

    def test_duplicate_nodes_and_vertex_function_names(self):
        graph,n=fixture('mat');other=copy.deepcopy(n);other['id']='other'
        data=graph['stages']['pixel'];data['nodes'].extend([other,c.node('add','sum')]);data['edges']=[c.edge('custom','sum','a','c'),c.edge('other','sum','b','c'),c.edge('sum','pixel','color')]
        vertex=c.node('glsl_code','vertexCode');vertex['params']['inputs']=[];vertex['params']['outputs'][0]['type']='vec4'
        vertex['params']['code']='c = TDWorldToProj(TDDeform(TDPos()));'
        graph['stages']['vertex']={'nodes':[vertex,c.node('vertex_out','position')],'edges':[c.edge('vertexCode','position','position','c')]}
        compiled=c.compile_graph(graph)
        self.assertIn('void sg_code_custom_add',compiled['pixel']);self.assertIn('void sg_code_other_add',compiled['pixel'])
        self.assertIn('void sg_code_vertexCode_add(out vec4 c)',compiled['vertex'])
        for stage in ('vertex','pixel'):
            for row in compiled['sourceMap'][stage]:
                if 'codeLine' in row:self.assertIn('c = ',compiled[stage].splitlines()[row['line']-1])

    def test_editor_model_contract_and_connection_policy(self):
        root=Path(__file__).resolve().parents[2]
        graph,n=fixture()
        payload={'contract':c.type_contract(),'catalog':list(c.CATALOG.values()),'graph':graph}
        result=subprocess.check_output(['node',str(root/'tests/unit/test_glsl_code_ui.js'),str(root/'src/editor/graph_ui.js')],input=json.dumps(payload),text=True)
        self.assertIn('GLSL Code model passed',result)


if __name__=='__main__':unittest.main()
