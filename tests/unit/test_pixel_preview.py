"""Preview is a Pixel terminal override, not a second Color Output or wire cast."""
import copy
import itertools
import unittest

import sgrape_core as c
import sgrape_document as document


def preview_graph(ty='float', target='top', connected=True):
    graph=c.demo_graph('color',target)
    data=graph['stages']['pixel']
    value=c.filled_value(ty,1)
    source=c.node('glsl_code','sample',functionName='previewValue',inputs=[],
                  outputs=[{'id':'out','name':'value','type':ty}],
                  code='value = '+c.literal(value,ty)+';')
    data['nodes'] += [source,c.node('preview','preview')]
    if connected:data['edges'].append(c.edge('sample','preview','value'))
    return graph


class PixelPreview(unittest.TestCase):
    def test_twenty_scalar_vector_types_have_exact_rgba_mapping(self):
        for target,ty in itertools.product(('mat','top'),c.SCALAR_VECTOR_TYPES):
            graph=preview_graph(ty,target);before=copy.deepcopy(graph)
            with self.subTest(target=target,type=ty):
                result=c.compile_graph(graph);text=result['pixel']
                count=c.TYPE_DESCRIPTORS[ty]['components']
                vector='sg_n_sample_out'
                converted=vector if ty in ('float','vec2','vec3','vec4') else ('float' if count==1 else 'vec'+str(count))+'('+vector+')'
                expected={1:'vec4(vec3('+converted+'), 1.0)',
                          2:'vec4('+converted+', 0.5, 1.0)',
                          3:'vec4('+converted+', 1.0)',4:converted}[count]
                self.assertIn('vec4 sg_preview_color = '+expected+';',text)
                self.assertIn('sg_color = sg_preview_color;',text)
                self.assertIn('vec4 sg_color = sg_n_color;',text)
                self.assertEqual(result['stages']['pixel']['ports']['preview'],{'in':{'value':ty},'out':{}})
                self.assertEqual(graph,before)

    def test_inert_unconnected_preview_leaves_shader_unchanged(self):
        for target in ('mat','top'):
            graph=c.demo_graph('color',target);before=c.compile_graph(graph)
            node=c.node('preview','preview');node['inputValues']={'value':.75}
            graph['stages']['pixel']['nodes'].append(node)
            after=c.compile_graph(graph)
            for field in ('vertex','pixel','bindings','sourceMap'):
                self.assertEqual(before[field],after[field],(target,field))
            self.assertNotIn('preview',after['stages']['pixel']['live'])
            self.assertEqual(after['diagnostics'],before['diagnostics']+[
                {'node':'preview','stage':'pixel','message':'Disconnected node is not emitted'}])

    def test_disconnect_and_remove_restore_original_primary(self):
        for target in ('mat','top'):
            original=c.compile_graph(c.demo_graph('color',target))
            graph=preview_graph('vec2',target);data=graph['stages']['pixel']
            self.assertNotEqual(original['pixel'],c.compile_graph(graph)['pixel'])
            data['edges']=[e for e in data['edges'] if e['to'][0]!='preview']
            self.assertEqual(original['pixel'],c.compile_graph(graph)['pixel'])
            data['nodes']=[n for n in data['nodes'] if n['id']!='preview']
            self.assertEqual(original['pixel'],c.compile_graph(graph)['pixel'])

    def test_root_dependency_preserves_all_other_buffers_and_shared_source(self):
        graph=preview_graph('vec3','mat');data=graph['stages']['pixel']
        output=next(n for n in data['nodes'] if n['id']=='pixel')
        output['params']['bufferCount']=8
        data['edges'] += [c.edge('color','pixel',port) for port in c.PIXEL_BUFFER_PORTS[1:]]
        result=c.compile_graph(graph);text=result['pixel']
        self.assertIn('sg_n_color',text)
        self.assertIn('sg_buffer < TD_NUM_COLOR_BUFFERS',text)
        for index in range(1,8):
            self.assertIn('#if TD_NUM_COLOR_BUFFERS > '+str(index),text)
            self.assertIn('fragColor['+str(index)+'] = TDOutputSwizzle(sg_n_color);',text)
        self.assertIn('sg_color = sg_preview_color;',text)

    def test_original_primary_uniform_and_sampler_bindings_stay_live(self):
        for target in ('mat','top'):
            graph=c.demo_graph('tint',target);data=graph['stages']['pixel']
            graph['declarations'].append(dict(id='baseTint',kind='uniform',name='uBaseTint',type='vec4',value=[.2,.4,.6,1]))
            data['nodes']=[c.node('uniform','tint',declarationId='baseTint') if n['id']=='tint' else n for n in data['nodes']]
            if target=='mat':next(n for n in data['nodes'] if n['id']=='pixel')['params'].update(c.PIXEL_FINISHING_DEFAULTS)
            original=c.compile_graph(graph)
            data['nodes'] += [c.node('float','sample',value=.25),c.node('preview','preview')]
            data['edges'].append(c.edge('sample','preview','value'))
            before=copy.deepcopy(graph);result=c.compile_graph(graph);text=result['pixel']
            with self.subTest(target=target):
                self.assertEqual(result['bindings'],original['bindings'])
                self.assertEqual({b['id'] for b in result['bindings']},{'texture_main','baseTint'})
                self.assertIn('texture',result['stages']['pixel']['live'])
                self.assertIn('tint',result['stages']['pixel']['live'])
                original_color=text.index('vec4 sg_color = sg_n_multiply;')
                override=text.index('sg_color = sg_preview_color;')
                self.assertLess(original_color,override)
                if target=='mat':
                    for call in ('TDDither(','TDAlphaTest(','TDConvertColorSpace('):self.assertLess(override,text.index(call))
                self.assertEqual(result['vertex'],original['vertex'])
                self.assertEqual(graph,before)

    def test_finishing_flags_and_terminal_effects_remain_independent(self):
        for flags in itertools.product((False,True),repeat=3):
            graph=preview_graph('float','mat');data=graph['stages']['pixel']
            output=next(n for n in data['nodes'] if n['id']=='pixel')
            output['params'].update(dict(zip(c.PIXEL_FINISHING_DEFAULTS,flags)))
            data['nodes'] += [c.node('depth_out','depth'),c.node('discard','discard')]
            text=c.compile_graph(graph)['pixel']
            for flag,call in zip(flags,('TDDither(','TDAlphaTest(','TDConvertColorSpace(')):
                self.assertEqual(call in text,flag,(flags,call))
            self.assertIn('gl_FragDepth',text)
            self.assertIn('discard;',text)
            self.assertIn('TDCheckDiscard();',text)

    def test_preview_supplies_primary_when_color_output_empty(self):
        graph=preview_graph('float','mat');data=graph['stages']['pixel']
        data['edges']=[e for e in data['edges'] if e['to'][0]!='pixel']
        text=c.compile_graph(graph)['pixel']
        self.assertIn('fragColor[0] = TDOutputSwizzle(TDDither(sg_color));',text)

    def test_preview_types_follow_router_chain_without_mutating_fallback(self):
        graph=preview_graph('bvec3');data=graph['stages']['pixel']
        data['nodes'] += [c.node('router','route_a'),c.node('router','route_b')]
        data['edges']=[e for e in data['edges'] if e['to'][0]!='preview']
        data['edges'] += [c.edge('sample','route_a','value'),c.edge('route_a','route_b','value'),c.edge('route_b','preview','value')]
        before=copy.deepcopy(graph);result=c.compile_graph(graph)
        self.assertIn('vec4(vec3(sg_n_sample_out), 1.0)',result['pixel'])
        self.assertEqual(result['stages']['pixel']['ports']['preview']['in']['value'],'bvec3')
        self.assertEqual(graph,before)

    def test_rejects_non_value_shapes_without_repairing_import(self):
        from test_array_structures import SAMPLE
        cases=[(c.node('matrix','source',type='mat3'),[]),
               (c.node('array','source',elementType='float',length=3),[]),
               (c.node('struct_create','source',type='struct:sample'),[SAMPLE]),
               (c.node('sampler','source',declarationId='testSampler'),[])]
        for source,definitions in cases:
            graph=c.demo_graph('color','mat');data=graph['stages']['pixel']
            graph['typeDefinitions']=copy.deepcopy(definitions)
            if source['definitionUuid']=='sgrape.builtin.sampler':
                graph['declarations'].append(dict(id='testSampler',kind='sampler',name='uTestSampler',type='sampler2D',source='builtin:banana'))
            data['nodes'] += [source,c.node('preview','preview')]
            data['edges'].append(c.edge('source','preview','value'))
            before=copy.deepcopy(graph)
            with self.subTest(source=source['definitionUuid']):
                with self.assertRaisesRegex(c.GraphError,'Preview accepts scalar or vector'):c.compile_graph(graph)
                self.assertEqual(document.inspect_document(graph,c,'mat')['status'],'blocked')
                self.assertEqual(graph,before)

    def test_duplicate_vertex_and_subgraph_placements_rejected(self):
        graph=preview_graph();graph['stages']['pixel']['nodes'].append(c.node('preview','other'))
        with self.assertRaisesRegex(c.GraphError,'Only one Preview'):c.compile_graph(graph)
        self.assertEqual(document.inspect_document(graph,c,'top')['status'],'blocked')
        graph=c.demo_graph('color','mat');graph['stages']['vertex']['nodes'].append(c.node('preview','preview'))
        with self.assertRaisesRegex(c.GraphError,'stage'):c.compile_graph(graph)
        graph=c.demo_graph('color','mat');graph['functions']=[copy.deepcopy(c.function_library()[0])]
        fn=graph['functions'][0];fn['graph']['nodes'].append(c.node('preview','preview'))
        with self.assertRaisesRegex(c.GraphError,'root Pixel stage') as caught:c.compile_graph(graph)
        self.assertEqual(caught.exception.functionId,fn['id'])
        self.assertEqual(document.inspect_document(graph,c,'mat')['status'],'blocked')

    def test_preview_does_not_replace_required_output_or_hide_invalid_graph(self):
        graph=preview_graph();data=graph['stages']['pixel']
        data['nodes']=[n for n in data['nodes'] if n['id']!='pixel']
        data['edges']=[e for e in data['edges'] if e['to'][0]!='pixel']
        with self.assertRaisesRegex(c.GraphError,'Exactly one pixel output'):c.compile_graph(graph)
        graph=preview_graph();data=graph['stages']['pixel']
        data['nodes'].append(c.node('router','cycle'));data['edges'].append(c.edge('cycle','cycle','value'))
        with self.assertRaisesRegex(c.GraphError,'Cycle'):c.compile_graph(graph)
        graph=preview_graph();graph['stages']['pixel']['edges'].append(c.edge('missing','pixel','color'))
        with self.assertRaisesRegex(c.GraphError,'no longer exists'):c.compile_graph(graph)

    def test_type_contract_and_source_mapping_are_complete(self):
        row=c.type_contract()['definitions']['sgrape.builtin.preview']
        self.assertEqual({v['type'] for v in row['variants']},set(c.SCALAR_VECTOR_TYPES))
        self.assertTrue(all(v['outputs']=={} and v['inputs']=={'value':v['type']} for v in row['variants']))
        self.assertEqual(c.CATALOG['preview']['stages'],['pixel'])
        result=c.compile_graph(preview_graph('ivec2'))
        line=next(i for i,s in enumerate(result['pixel'].splitlines(),1) if 'vec4 sg_preview_color' in s)
        self.assertTrue(any(row['node']=='preview' and row['line']==line for row in result['sourceMap']['pixel']))


class TransientPreviewProjection(unittest.TestCase):
    def test_detached_idempotent_projection_restores_formal_compilation(self):
        for target in ('mat','top'):
            graph=preview_graph('bvec4',target);before=copy.deepcopy(graph)
            formal=c.without_preview(graph)
            self.assertEqual(graph,before)
            self.assertEqual(c.without_preview(formal),formal)
            self.assertIsNot(formal,graph)
            self.assertFalse(any(n['definitionUuid']=='sgrape.builtin.preview' for n in formal['stages']['pixel']['nodes']))
            self.assertFalse(any(e['to'][0]=='preview' for e in formal['stages']['pixel']['edges']))
            self.assertEqual(c.compile_graph(formal)['pixel'],c.compile_graph(c.demo_graph('color',target))['pixel'])
            formal['declarations'].clear()
            self.assertEqual(graph,before)

    def test_removes_all_occurrences_including_invalid_scopes_and_duplicates(self):
        graph=c.demo_graph('color','mat');graph['functions']=copy.deepcopy(c.function_library()[:2])
        expected=copy.deepcopy(graph)
        scopes=list(graph['stages'].values())+[fn['graph'] for fn in graph['functions']]
        for data in scopes:
            data['nodes'] += [c.node('preview','preview'),c.node('preview','duplicate')]
            data['edges'] += [c.edge('preview','duplicate','value'),c.edge('duplicate','preview','value')]
        before=copy.deepcopy(graph)
        formal=c.without_preview(graph)
        self.assertEqual(formal,expected)
        self.assertEqual(graph,before)
        c.compile_graph(formal)

    def test_prunes_membership_and_edge_metadata_but_preserves_ordinary_router(self):
        graph=preview_graph('vec3');data=graph['stages']['pixel']
        data['nodes'].append(c.node('router','router'))
        data['edges']=[e for e in data['edges'] if e['to'][0]!='preview']
        kept=c.edge('sample','router','value');kept['ui']={'style':'link','futureRouting':[1,2]}
        data['edges'] += [kept,dict(c.edge('router','preview','value'),ui={'style':'link'})]
        data['ui']={'viewport':{'x':4,'y':5},'frames':[
            {'id':'mixed','name':'Mixed','nodes':['sample','preview'],'color':'#123456','future':'keep'},
            {'id':'preview_only','name':'Preview only','nodes':['preview']},
            {'id':'untouched','name':'Router','nodes':['router']}]}
        before=copy.deepcopy(graph);formal=c.without_preview(graph);out=formal['stages']['pixel']
        self.assertEqual(graph,before)
        self.assertIn(kept,out['edges'])
        self.assertTrue(any(n['id']=='router' for n in out['nodes']))
        self.assertEqual(out['ui'],{'viewport':{'x':4,'y':5},'frames':[
            {'id':'mixed','name':'Mixed','nodes':['sample'],'color':'#123456','future':'keep'},
            {'id':'untouched','name':'Router','nodes':['router']}]})
        c.validate_graph_frames(out)
        c.compile_graph(formal)

    def test_scope_local_ids_do_not_remove_other_scope_nodes_or_connections(self):
        graph=c.demo_graph('color','mat')
        graph['stages']['pixel']['nodes'].append(c.node('preview','position'))
        before_vertex=copy.deepcopy(graph['stages']['vertex'])
        formal=c.without_preview(graph)
        self.assertEqual(formal['stages']['vertex'],before_vertex)
        c.compile_graph(formal)

    def test_no_general_repair_or_recursive_scrubbing_of_unknown_metadata(self):
        graph=preview_graph();data=graph['stages']['pixel']
        # Preserve malformed unrelated evidence for normal document validation.
        malformed={'to':'unrelated','from':[]}
        data['edges'].append(malformed)
        data['ui']={'frames':[{'id':'already_empty','nodes':[]},None]}
        graph['futureMetadata']={'nodes':[{'definitionUuid':'sgrape.builtin.preview'}]}
        formal=c.without_preview(graph)
        self.assertIn(malformed,formal['stages']['pixel']['edges'])
        self.assertEqual(formal['stages']['pixel']['ui'],data['ui'])
        self.assertEqual(formal['futureMetadata'],graph['futureMetadata'])
        for malformed_graph in (None,[],{'stages':None,'functions':'unknown'}, {'stages':{'pixel':None}}):
            self.assertEqual(c.without_preview(malformed_graph),malformed_graph)

    def test_formal_export_round_trip_keeps_no_transient_node_or_edge(self):
        import json
        graph=preview_graph('ivec2','mat');before=copy.deepcopy(graph)
        exported=document.stamp_catalog(c.without_preview(graph),c)
        reloaded=json.loads(json.dumps(exported))
        report=document.inspect_document(reloaded,c,'mat')
        self.assertEqual(report['status'],'valid')
        self.assertEqual(report['candidate'],reloaded)
        self.assertNotIn('sg_preview_color',c.compile_graph(reloaded)['pixel'])
        self.assertEqual(graph,before)


if __name__=='__main__':unittest.main()
