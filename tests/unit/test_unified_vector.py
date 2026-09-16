"""Unified Vector's effective dataflow, component groups and compatibility."""
import copy
import json
import unittest

import sgrape_core as c
import sgrape_document as document


def graph(nodes, edges=(), source='vector', output='out'):
    result=c.normalize_top_sources(c.demo_graph('color','top'))[0]
    result['topInputs']=[];result['declarations']=[]
    result['stages']['pixel']={
        'nodes':list(nodes)+[c.node('pixel_out','result')],
        'edges':list(edges)+[c.edge(source,'result','color',output)],
    }
    return result


def uniform(result, ident='baseline', ty='vec4'):
    result['declarations'].append(dict(id=ident,kind='uniform',name='u'+ident.title(),type=ty,value=c.filled_value(ty,.5)))
    result['stages']['pixel']['nodes'].append(c.node('uniform',ident,declarationId=ident))


class UnifiedVector(unittest.TestCase):
    def test_interface_supports_whole_value_and_final_components(self):
        for ty in c.VECTOR_TYPES:
            for layout in c.combine_layouts(ty):
                interface=c.vector_interface('vector',{'type':ty,'groups':layout['groups']})
                self.assertEqual(interface['inputs'],{'value':ty,**layout['inputs']})
                self.assertEqual(interface['outputs'],{'out':ty,**dict.fromkeys('xyzw'[:c.type_components(ty)],'float')})
        contract=c.type_contract()
        self.assertIn('vector',contract['constantExpressions'])
        self.assertEqual([v['type'] for v in contract['definitions'][c.CATALOG['vector']['definitionUuid']]['variants']],list(c.VECTOR_TYPES))

    def test_defaults_are_constants_and_components_are_final_outputs(self):
        result=graph([c.node('vector','vector',type='vec4',components=[.1,.2,.3,.4])])
        text=c.compile_graph(result)['pixel']
        self.assertIn('const vec4 sg_n_vector = vec4(0.1, 0.2, 0.3, 0.4);',text)
        for index,port in enumerate('xyzw'):
            result['stages']['pixel']['edges'][-1]['from'][1]=port
            text=c.compile_graph(result)['pixel']
            self.assertIn('const float sg_v_vector_'+port+' = '+c.number([.1,.2,.3,.4][index])+';',text)
            self.assertNotIn('vec4 sg_n_vector =',text)

    def test_every_contiguous_group_uses_exact_constructor_arguments(self):
        for layout in c.combine_layouts('vec4'):
            nodes=[c.node('vector','vector',type='vec4',groups=layout['groups'],requireConstant=True)]
            edges=[];arguments=[]
            for port,ty in layout['inputs'].items():
                nodes.append(c.node(ty,port,value=c.filled_value(ty,.25)))
                edges.append(c.edge(port,'vector',port));arguments.append('sg_n_'+port)
            result=graph(nodes,edges);before=copy.deepcopy(result)
            shader=c.compile_graph(result)
            self.assertIn('const vec4 sg_n_vector = vec4('+', '.join(arguments)+');',shader['pixel'])
            self.assertEqual(result,before)
            self.assertEqual(shader,c.compile_graph(json.loads(json.dumps(result))))

    def test_baseline_and_yz_override_then_disconnect_restore_values(self):
        node=c.node('vector','vector',type='vec4',components=[.1,.2,.3,.4],groups={'y':'vec2'})
        result=graph([node,c.node('vec2','pair',value=[.8,.9])],
                     [c.edge('baseline','vector','value'),c.edge('pair','vector','y')])
        uniform(result)
        compiled=c.compile_graph(result)
        self.assertIn('vec4 sg_n_vector = vec4((sg_n_baseline).x, sg_n_pair, (sg_n_baseline).w);',compiled['pixel'])
        self.assertNotIn('const vec4 sg_n_vector',compiled['pixel'])
        # Disconnect the grouped override: all components inherit the baseline.
        result['stages']['pixel']['edges'].remove(c.edge('pair','vector','y'))
        node['params']['groups']={}
        self.assertIn('vec4 sg_n_vector = vec4(sg_n_baseline);',c.compile_graph(result)['pixel'])
        # Disconnect the baseline: the saved manual values were never erased.
        result['stages']['pixel']['edges'].remove(c.edge('baseline','vector','value'))
        compiled=c.compile_graph(result)
        self.assertIn('const vec4 sg_n_vector = vec4(0.1, 0.2, 0.3, 0.4);',compiled['pixel'])
        self.assertEqual(compiled['bindings'],[])

    def test_baseline_fully_overridden_does_not_taint_or_evaluate(self):
        node=c.node('vector','vector',type='vec4',groups={'x':'vec2','z':'vec2'},requireConstant=True)
        result=graph([node,c.node('vec2','xy',value=[.1,.2]),c.node('vec2','zw',value=[.3,.4])],
                     [c.edge('baseline','vector','value'),c.edge('xy','vector','x'),c.edge('zw','vector','z')])
        uniform(result)
        compiled=c.compile_graph(result)
        self.assertIn('const vec4 sg_n_vector = vec4(sg_n_xy, sg_n_zw);',compiled['pixel'])
        self.assertNotIn('sg_n_baseline',compiled['pixel'])
        self.assertNotIn('uBaseline',compiled['pixel'])
        self.assertEqual(compiled['bindings'],[])
        self.assertNotIn('baseline',compiled['stages']['pixel']['live'])

    def test_only_selected_constant_component_is_evaluated(self):
        node=c.node('vector','vector',type='vec4')
        add=c.node('add','gain',requireConstant=True)
        add['inputValues']={'b':.1}
        result=graph([node,c.node('float','replacement',value=.3),add],
                     [c.edge('baseline','vector','value'),c.edge('replacement','vector','z'),c.edge('vector','gain','a','z')],source='gain')
        uniform(result)
        compiled=c.compile_graph(result)
        self.assertIn('const float sg_v_vector_z = sg_n_replacement;',compiled['pixel'])
        self.assertIn('const float sg_n_gain = (sg_v_vector_z + 0.1);',compiled['pixel'])
        self.assertNotIn('sg_n_baseline',compiled['pixel'])
        self.assertEqual(compiled['bindings'],[])
        # Requiring the entire vector to be constant is still invalid.
        node['params']['requireConstant']=True
        with self.assertRaisesRegex(c.GraphError,'Require Constant'):c.compile_graph(result)

    def test_mixed_output_can_emit_const_scalar_and_runtime_whole_together(self):
        result=graph([c.node('vector','vector',type='vec4'),c.node('float','replacement',value=.3),c.node('multiply','gain',type='vec4')],
                     [c.edge('baseline','vector','value'),c.edge('replacement','vector','x'),
                      c.edge('vector','gain','a'),c.edge('vector','gain','b','x')],source='gain')
        uniform(result)
        compiled=c.compile_graph(result)
        self.assertIn('const float sg_v_vector_x = sg_n_replacement;',compiled['pixel'])
        self.assertIn('vec4 sg_n_vector = vec4(sg_n_replacement, (sg_n_baseline).yzw);',compiled['pixel'])
        self.assertNotIn('const vec4 sg_n_vector =',compiled['pixel'])
        self.assertIn('vec4(sg_v_vector_x)',compiled['pixel'])

    def test_runtime_baseline_does_not_reach_through_fully_replaced_subgraph(self):
        result=graph([{'id':'fn','definitionUuid':c.CALL,'params':{'functionId':'replace'}}],
                     [c.edge('baseline','fn','value')],source='fn')
        uniform(result)
        result['functions']=[dict(id='replace',name='Replace',scope='local',stages=['pixel'],
            inputs=[dict(id='value',name='Value',type='vec4',default=[0,0,0,0])],
            outputs=[dict(id='out',name='Out',type='vec4',default=[0,0,0,0])],
            graph=dict(nodes=[{'id':'input','definitionUuid':c.FUNCTION_INPUT,'params':{}},
                c.node('vector','vector',type='vec4',groups={'x':'vec4'},requireConstant=True),
                c.node('vec4','fixed',value=[.1,.2,.3,.4]),
                {'id':'output','definitionUuid':c.FUNCTION_OUTPUT,'params':{}}],
                edges=[c.edge('input','vector','value','value'),c.edge('fixed','vector','x'),c.edge('vector','output','out')]))]
        compiled=c.compile_graph(result)
        self.assertNotIn('uBaseline',compiled['pixel']);self.assertEqual(compiled['bindings'],[])

    def test_group_replacement_preserves_source_and_unaffected_connections(self):
        node=c.node('vector','vector',type='vec4',groups={'z':'vec2'},components=[.1,.2,.3,.4])
        result=graph([node,c.node('vec2','old',value=[.7,.8]),c.node('vec2','new',value=[.5,.6])],
                     [c.edge('old','vector','z')])
        self.assertIn('vec4(0.1, 0.2, sg_n_old)',c.compile_graph(result)['pixel'])
        # The editor supplies this atomic final graph: YZ replaces ZW, so W
        # returns to its stored value and the old source remains in the graph.
        result['stages']['pixel']['edges'][0]=c.edge('new','vector','y')
        node['params']['groups']={'y':'vec2'}
        compiled=c.compile_graph(result)
        self.assertIn('vec4(0.1, sg_n_new, 0.4)',compiled['pixel'])
        self.assertTrue(any(n['id']=='old' for n in result['stages']['pixel']['nodes']))
        self.assertNotIn('old',compiled['stages']['pixel']['live'])

    def test_invalid_and_stale_group_layouts_are_rejected_without_mutation(self):
        cases=[]
        for groups in ({'x':'vec3','y':'vec2'},{'w':'vec2'},{'z':'vec3'},{'x':'float'},None):
            cases.append(graph([c.node('vector','vector',type='vec4',groups=groups)]))
        cases.append(graph([c.node('vector','vector',type='vec4',groups={'x':'vec2'})]))
        cases.append(graph([c.node('vector','vector',type='vec4'),c.node('vec2','source')],[c.edge('source','vector','y')]))
        cases.append(graph([c.node('vector','vector',type='vec4'),c.node('vec3','source')],[c.edge('source','vector','value')]))
        hidden=graph([c.node('vector','vector',type='vec4',groups={'x':'vec2'}),c.node('vec2','source'),c.node('float','hidden')],
                     [c.edge('source','vector','x'),c.edge('hidden','vector','y')])
        cases.append(hidden)
        ambiguous=c.node('vector','vector',type='vec4');ambiguous['inputValues']={'x':9}
        cases.append(graph([ambiguous]))
        for result in cases:
            before=copy.deepcopy(result)
            with self.subTest(graph=result),self.assertRaises(c.GraphError):c.compile_graph(result)
            self.assertEqual(result,before)

    def test_even_dormant_connections_cannot_create_cycles(self):
        result=graph([c.node('vector','vector',type='vec4',groups={'x':'vec4'}),c.node('vec4','fixed')],
                     [c.edge('vector','vector','value'),c.edge('fixed','vector','x')])
        with self.assertRaisesRegex(c.GraphError,'Cycle'):c.compile_graph(result)

    def test_component_symbol_cannot_collide_with_a_legal_node_id(self):
        result=graph([c.node('vector','vector',type='vec4'),c.node('float','vector_x',value=.2),c.node('add','sum')],
                     [c.edge('vector','sum','a','x'),c.edge('vector_x','sum','b')],source='sum')
        text=c.compile_graph(result)['pixel']
        self.assertIn('float sg_v_vector_x = 0.0;',text)
        self.assertIn('float sg_n_vector_x = 0.2;',text)
        self.assertIn('(sg_v_vector_x + sg_n_vector_x)',text)

    def test_component_expansion_is_saved_ui_without_shader_or_upgrade_changes(self):
        original=document.stamp_catalog(graph([c.node('vector','vector',type='vec4')]),c)
        compiled=c.compile_graph(original)
        for expanded in (True,False):
            edited=copy.deepcopy(original)
            edited['stages']['pixel']['nodes'][0]['ui']['componentsExpanded']=expanded
            before=copy.deepcopy(edited)
            self.assertEqual(c.compile_graph(edited),compiled)
            self.assertEqual(c.clean_semantic(edited),c.clean_semantic(original))
            review=document.inspect_upgrade(edited,c,'top')
            self.assertFalse(review['required']);self.assertFalse(review['blocked'])
            self.assertIs(review['candidate']['stages']['pixel']['nodes'][0]['ui']['componentsExpanded'],expanded)
            saved=document.inspect_saved_state(json.dumps(dict(revision=4,graph=edited,appliedHash=compiled['hash'],lastError='')),c,'top')
            self.assertEqual(saved['status'],'valid')
            self.assertIs(saved['state']['graph']['stages']['pixel']['nodes'][0]['ui']['componentsExpanded'],expanded)
            self.assertEqual(edited,before)

    def test_component_expansion_in_subgraph_does_not_change_shader(self):
        original=document.stamp_catalog(graph([{'id':'call','definitionUuid':c.CALL,'params':{'functionId':'component_fn'},'ui':{'x':0,'y':0}}],source='call'),c)
        original['functions']=[dict(id='component_fn',name='Components',scope='local',stages=['pixel'],inputs=[],
            outputs=[dict(id='out',name='Out',type='vec4',default=[0,0,0,1])],
            graph=dict(nodes=[c.node('vector','vector',type='vec4',components=[.1,.2,.3,1]),
                {'id':'input','definitionUuid':c.FUNCTION_INPUT,'params':{},'ui':{'x':0,'y':0}},
                {'id':'output','definitionUuid':c.FUNCTION_OUTPUT,'params':{},'ui':{'x':500,'y':0}}],edges=[c.edge('vector','output','out')]))]
        compiled=c.compile_graph(original)
        edited=copy.deepcopy(original);edited['functions'][0]['graph']['nodes'][0]['ui']['componentsExpanded']=True
        self.assertEqual(c.compile_graph(edited),compiled)
        self.assertEqual(c.clean_semantic(edited),c.clean_semantic(original))
        review=document.inspect_upgrade(edited,c,'top')
        self.assertFalse(review['required']);self.assertFalse(review['blocked'])
        self.assertTrue(review['candidate']['functions'][0]['graph']['nodes'][0]['ui']['componentsExpanded'])


if __name__=='__main__':unittest.main()
