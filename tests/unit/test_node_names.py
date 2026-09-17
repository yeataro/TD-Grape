"""Human-readable node names keep identity and GLSL symbol namespaces separate."""
import copy
import re
import unittest

import sgrape_core as c


def graph(nodes, edges=(), source='value'):
    result=c.normalize_top_sources(c.demo_graph('color','top'))[0]
    result['declarations']=[];result['topInputs']=[]
    result['stages']['pixel']={'nodes':list(nodes)+[c.node('pixel_out','result')],
                              'edges':list(edges)+[c.edge(source,'result','color')]}
    return result


def named(key, ident, name, **params):
    node=c.node(key,ident,**params);node['name']=name
    return node


def tint_graph(call_name='Tint'):
    fn=copy.deepcopy(c.function_library()[0])
    call={'id':'tint','definitionUuid':c.CALL,'params':{'functionId':fn['id']}}
    if call_name is not None:call['name']=call_name
    doc=graph([call],source='tint');doc['functions']=[fn]
    doc['stages']['pixel']['edges'][-1]['from'][1]='color'
    return doc


def alpha_text(text):
    symbols={}
    return re.sub(r'\bsg_n_[A-Za-z0-9_]+\b',
                  lambda m:symbols.setdefault(m[0],'node_'+str(len(symbols))),text)


class NodeNames(unittest.TestCase):
    def test_name_is_readable_code_but_identity_remains_stable(self):
        node=named('vector','stable_id','Surface_Color',type='vec4',components=[.1,.2,.3,1])
        doc=graph([node],source='stable_id');before=copy.deepcopy(doc)
        result=c.compile_graph(doc)
        self.assertIn('const vec4 sg_n_Surface_Color = vec4(0.1, 0.2, 0.3, 1.0);',result['pixel'])
        self.assertEqual(doc,before)
        self.assertTrue(any(row.get('node')=='stable_id' for row in result['sourceMap']['pixel']))
        node['name']='Base_Color'
        renamed=c.compile_graph(doc)
        self.assertNotEqual(renamed['hash'],result['hash'])
        self.assertIn('sg_n_Base_Color',renamed['pixel'])
        self.assertEqual(node['id'],'stable_id')

    def test_ui_presentation_does_not_change_semantic_name(self):
        node=named('vector','value','Vector_1',type='vec4')
        doc=graph([node]);result=c.compile_graph(doc)
        node['ui'].update(componentsExpanded=True,x=123,y=-99)
        self.assertEqual(c.compile_graph(doc),result)
        self.assertEqual(node['name'],'Vector_1')

    def test_invalid_identifiers_fail_before_emission(self):
        for name in ('','1Value','A B','\u984f\u8272','x;discard','float','gl_Value','A__B','sg_value','vec3'):
            doc=graph([named('float','value',name)])
            before=copy.deepcopy(doc)
            with self.subTest(name=name),self.assertRaisesRegex(c.GraphError,'Node name'):c.compile_graph(doc)
            self.assertEqual(doc,before)

    def test_duplicate_names_are_rejected_in_the_authored_scope(self):
        doc=graph([named('float','value','Value_1'),named('float','unused','Value_1')])
        with self.assertRaisesRegex(c.GraphError,'unique within this graph'):c.compile_graph(doc)

    def test_named_and_unnamed_node_ids_do_not_collide(self):
        doc=graph([named('float','a','b'),c.node('float','b'),c.node('add','sum')],
                  [c.edge('a','sum','a'),c.edge('b','sum','b')],source='sum')
        text=c.compile_graph(doc)['pixel']
        symbols=re.findall(r'float (sg_n_b_[a-f0-9]+) =',text)
        self.assertEqual(len(symbols),2)
        self.assertEqual(len(set(symbols)),2)
        self.assertIn('('+symbols[0]+' + '+symbols[1]+')',text)

    def test_repeated_subgraph_instances_keep_readable_unique_locals(self):
        doc=graph([{'id':'one','name':'Layer_1','definitionUuid':c.CALL,'params':{'functionId':'fn'}},
                   {'id':'two','name':'Layer_2','definitionUuid':c.CALL,'params':{'functionId':'fn'}},
                   c.node('add','sum',type='vec4')],
                  [c.edge('one','sum','a'),c.edge('two','sum','b')],source='sum')
        doc['functions']=[dict(id='fn',name='Example',scope='local',stages=['pixel'],inputs=[],
            outputs=[dict(id='out',name='Out',type='vec4',default=[0,0,0,1])],
            graph=dict(nodes=[{'id':'input','definitionUuid':c.FUNCTION_INPUT,'params':{}},
                named('vector','value','Color_1',type='vec4',components=[.1,.2,.3,1]),
                {'id':'output','definitionUuid':c.FUNCTION_OUTPUT,'params':{}}],
                edges=[c.edge('value','output','out')]))]
        compiled=c.compile_graph(doc)
        self.assertIn('const vec4 sg_n_Layer_1_Color_1 =',compiled['pixel'])
        self.assertIn('const vec4 sg_n_Layer_2_Color_1 =',compiled['pixel'])
        self.assertIn('sg_n_Layer_1_out',compiled['pixel']);self.assertIn('sg_n_Layer_2_out',compiled['pixel'])
        self.assertEqual(compiled,c.compile_graph(copy.deepcopy(doc)))

    def test_named_call_scopes_body_and_interface_relays_without_rewriting_graph(self):
        doc=tint_graph();before=copy.deepcopy(doc);result=c.compile_graph(doc)
        self.assertIn('vec4 sg_n_Tint_input_color =',result['pixel'])
        self.assertIn('vec4 sg_n_Tint_input_tint =',result['pixel'])
        self.assertIn('vec4 sg_n_Tint_Apply_Tint = (sg_n_Tint_input_color * sg_n_Tint_input_tint);',result['pixel'])
        self.assertIn('vec4 sg_n_Tint_color = sg_n_Tint_Apply_Tint;',result['pixel'])
        self.assertEqual(doc,before)
        legacy=copy.deepcopy(doc);del legacy['stages']['pixel']['nodes'][0]['name']
        unscoped=c.compile_graph(legacy)
        self.assertEqual(alpha_text(result['pixel']),alpha_text(unscoped['pixel']))
        self.assertEqual(result['bindings'],unscoped['bindings'])
        self.assertEqual(result['sourceMap'],unscoped['sourceMap'])

    def test_unnamed_legacy_call_keeps_original_internal_identifiers(self):
        doc=tint_graph(None)
        for node in doc['functions'][0]['graph']['nodes']:node.pop('name',None)
        text=c.compile_graph(doc)['pixel']
        self.assertIn('vec4 sg_n_f288db6566123d1fb5c4c7e038b3fe2f978031eb8 =',text)
        self.assertNotIn('sg_n_Tint_',text)
        doc['stages']['pixel']['nodes'][0]['name']='Tint'
        self.assertIn('vec4 sg_n_Tint_multiply =',c.compile_graph(doc)['pixel'])

    def test_nested_names_and_unnamed_child_use_the_named_ancestor_scope(self):
        from test_diagnostics import nested
        doc=nested();doc['stages']['pixel']['nodes'][0]['name']='Outer'
        child=doc['functions'][0]['graph']['nodes'][1];child['name']='Tint'
        result=c.compile_graph(doc)
        self.assertIn('sg_n_Outer_Tint_Apply_Tint',result['pixel'])
        self.assertIn('sg_n_Outer_Tint_input_color',result['pixel'])
        self.assertIn('sg_n_Outer_Tint_color',result['pixel'])
        self.assertIn('sg_n_Outer_color',result['pixel'])
        row=next(row for row in result['sourceMap']['pixel'] if row['node']=='multiply')
        self.assertEqual(row['trail'],['outer','library_tint_v1'])
        self.assertEqual(row['functionId'],'library_tint_v1')
        del child['name']
        self.assertIn('sg_n_Outer_call_inner_Apply_Tint',c.compile_graph(doc)['pixel'])
        child['name']='Tint';del doc['stages']['pixel']['nodes'][0]['name']
        text=c.compile_graph(doc)['pixel']
        self.assertIn('sg_n_Tint_Apply_Tint',text);self.assertNotIn('sg_n_Outer_',text)

    def test_scoped_body_collision_with_root_name_remains_unique(self):
        doc=tint_graph();data=doc['stages']['pixel']
        data['nodes'] += [named('vector','root','Tint_Apply_Tint',type='vec4'),c.node('add','sum',type='vec4')]
        data['edges']=[c.edge('tint','sum','a','color'),c.edge('root','sum','b'),c.edge('sum','result','color')]
        text=c.compile_graph(doc)['pixel']
        symbols=re.findall(r'vec4 (sg_n_Tint_Apply_Tint_[a-f0-9]{10}) =',text)
        self.assertEqual(len(set(symbols)),2)
        self.assertEqual(text,c.compile_graph(copy.deepcopy(doc))['pixel'])

    def test_scoped_long_paths_and_underscore_joins_are_bounded_and_safe(self):
        from test_diagnostics import nested
        doc=nested();doc['stages']['pixel']['nodes'][0]['name']='A'*47+'_'
        doc['functions'][0]['graph']['nodes'][1]['name']='B'*47+'_'
        doc['functions'][1]['graph']['nodes'][1]['name']='C'*47+'_'
        before=copy.deepcopy(doc);flat,_,_=c._expand(doc,c._functions(doc))
        stems=[node['_symbolStem'] for node in flat['stages']['pixel']['nodes'] if '_symbolStem' in node]
        self.assertTrue(stems);self.assertTrue(all(len(stem)<=128 and '__' not in stem for stem in stems))
        self.assertTrue(any(re.search(r'_[a-f0-9]{10}$',stem) for stem in stems))
        result=c.compile_graph(doc);self.assertEqual(doc,before)
        self.assertEqual(result,c.compile_graph(copy.deepcopy(doc)))
        self.assertNotRegex(result['pixel'],r'sg_n_\w*__')

    def test_graph_supplied_symbol_metadata_cannot_override_generated_names(self):
        doc=graph([named('float','value','Value')]);doc['stages']['pixel']['nodes'][0]['_symbolStem']='bad;discard'
        self.assertIn('sg_n_Value =',c.compile_graph(doc)['pixel'])
        self.assertNotIn('bad;discard',c.compile_graph(doc)['pixel'])
        doc=tint_graph();doc['functions'][0]['graph']['nodes'][1]['_symbolStem']='Injected'
        self.assertIn('sg_n_Tint_Apply_Tint',c.compile_graph(doc)['pixel'])
        self.assertNotIn('sg_n_Injected',c.compile_graph(doc)['pixel'])

    def test_code_output_and_plain_node_names_do_not_collide(self):
        code=named('glsl_code','code','Code_1',functionName='valueFunction',inputs=[],
                   outputs=[{'id':'color','name':'resultColor','type':'vec4'}],code='resultColor = vec4(1.0);')
        value=named('vec4','value','Code_1_color',value=[.1,.2,.3,1])
        doc=graph([code,value,c.node('add','sum',type='vec4')],
                  [c.edge('code','sum','a','color'),c.edge('value','sum','b')],source='sum')
        text=c.compile_graph(doc)['pixel']
        symbols=re.findall(r'vec4 (sg_n_Code_1_color_[a-f0-9]+)(?:;| =)',text)
        self.assertEqual(len(set(symbols)),2)

    def test_source_reference_keeps_declaration_symbol(self):
        doc=graph([c.node('uniform','value',declarationId='source')])
        doc['declarations']=[dict(id='source',kind='uniform',name='uTint',type='vec4',value=[1,1,1,1])]
        text=c.compile_graph(doc)['pixel']
        self.assertIn('uniform vec4 uTint;',text)
        self.assertIn('vec4 sg_n_value = uTint;',text)


if __name__=='__main__':unittest.main()
