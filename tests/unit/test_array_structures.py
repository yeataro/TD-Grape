"""Compound graph semantics, host definition ownership and type isolation."""
import copy
import unittest

import sgrape_core as c


SAMPLE = {'id':'sample','name':'Sample','provider':'generated','fields':[
    {'id':'offset','name':'offset','type':'vec2'}, {'id':'weight','name':'weight','type':'float'}]}


def graph(nodes,edges=(),result='get',ty='float',target='top',stage='pixel',definitions=()):
    g=c.demo_graph('color',target);g['declarations']=[]
    if definitions:g['typeDefinitions']=copy.deepcopy(list(definitions))
    observe=c.node('glsl_code','observe',functionName='observeValue',
        inputs=[{'id':'value','name':'value','type':ty}],
        outputs=[{'id':'color','name':'colour','type':'vec4'}],code='colour = vec4(1.0);')
    g['stages'][stage]={'nodes':list(nodes)+[observe,c.node(stage+'_out','result')],
        'edges':list(edges)+[c.edge(result,'observe','value'),c.edge('observe','result','color' if stage=='pixel' else 'position','color')]}
    return g


class ArrayStructures(unittest.TestCase):
    def test_large_external_array_type_does_not_expand_default_values(self):
        g=graph([c.node('uniform','source',declarationId='samples'),c.node('array_get','get')],
                [c.edge('source','get','Array')])
        g['declarations']=[dict(id='samples',kind='uniform',name='uSamples',type='float[10000]',nativeSequence='array',value=None)]
        result=c.compile_graph(g)
        self.assertIn('uniform float uSamples[10000];',result['pixel'])
        self.assertEqual(result['stages']['pixel']['ports']['get']['in']['Array'],'float[10000]')
        self.assertIsNone(c.filled_value('float[10000]'))
        self.assertLess(len(result['pixel']),10000)

    def test_contract_keeps_numeric_types_and_dynamic_nodes_bounded(self):
        contract=c.type_contract({'typeDefinitions':[SAMPLE]})
        self.assertEqual(len(contract['valueTypes']),38)
        self.assertEqual(len(contract['types']),39)
        self.assertIn('struct:sample',contract['composites']['structs'])
        for key in c.COMPOSITE_KEYS:
            row=contract['definitions'][c.CATALOG[key]['definitionUuid']]
            self.assertEqual(row['selector'],'dynamic');self.assertEqual(len(row['variants']),1)
        self.assertNotIn('struct:sample',c.type_contract()['composites']['structs'])

    def test_create_zero_for_all_value_types(self):
        for ty in c.TYPES:
            with self.subTest(ty=ty):
                g=graph([c.node('array','a',elementType=ty,length=2),c.node('array_get','get')],
                        [c.edge('a','get','Array')],ty=ty)
                result=c.compile_graph(g)
                self.assertEqual(result['stages']['pixel']['ports']['get']['out']['out'],ty)
                self.assertIn(c.type_registry().glsl_type(ty+'[2]')+'(',result['pixel'])
                self.assertIn('clamp(0, 0, 2 - 1)',result['pixel'])
                self.assertEqual(g['stages']['pixel']['nodes'][1]['params']['type'],'float[4]')
                with c.type_context(g):
                    values=c.filled_value(ty+'[2]')
                    expected=c.filled_value(ty)
                    self.assertEqual(values,[expected,expected])

    def test_replace_out_of_bounds_is_guarded_before_safe_subscript(self):
        for index in ('int','uint'):
            replacement=c.node('array_replace','replace',indexType=index)
            replacement['inputValues']={'i':123,'replacement':7.0}
            g=graph([c.node('array','a',length=3),replacement,c.node('array_get','get')],
                    [c.edge('a','replace','Array'),c.edge('replace','get','Array')])
            compiled=c.compile_graph(g)['pixel']
            line=next(line for line in compiled.splitlines() if 'if (' in line)
            self.assertIn('123u < uint(3)' if index=='uint' else '123 >= 0 && 123 < 3',line)
            self.assertIn('[min(123u, uint(3 - 1))]' if index=='uint' else '[clamp(123, 0, 3 - 1)]',line)

    def test_index_type_selection_is_not_inferred_from_opposite_scalar(self):
        for key in ('array_get','array_replace'):
            for selected,source in (('int','uint'),('uint','int')):
                with self.subTest(node=key,selected=selected,source=source):
                    operation=c.node(key,'operation',type='float[4]',indexType=selected)
                    g=graph([c.node('array','a',length=3),c.node('scalar','index',type=source,value=1),operation],
                            [c.edge('a','operation','Array'),c.edge('index','operation','i')],
                            result='operation',ty='float' if key=='array_get' else 'float[3]')
                    before=copy.deepcopy(g)
                    if c.conversion_kind(source,selected) is None:
                        with self.assertRaisesRegex(c.GraphError,source+' cannot connect to '+selected):c.compile_graph(g)
                    else:
                        compiled=c.compile_graph(g)
                        self.assertEqual(compiled['stages']['pixel']['ports']['operation']['in']['i'],selected)
                        self.assertEqual(compiled['stages']['pixel']['ports']['operation']['in']['Array'],'float[3]')
                        converted=c.convert_expression('sg_n_index',source,selected)
                        self.assertIn(converted,compiled['pixel'])
                        self.assertIn('min('+converted if selected=='uint' else 'clamp('+converted,compiled['pixel'])
                    self.assertEqual(g,before)
                    self.assertEqual(operation['params']['indexType'],selected)

    def test_array_length_is_compile_time_size(self):
        g=graph([c.node('array','a',length=9),c.node('array_length','get')],[c.edge('a','get','Array')],ty='int')
        result=c.compile_graph(g)
        self.assertIn(' = 9;',result['pixel'])
        self.assertNotIn('.length()',result['pixel'])
        self.assertNotIn('sg_n_a',result['pixel'])
        g['stages']['pixel']['nodes'][1]['params']['requireConstant']=True
        self.assertIn('const int',c.compile_graph(g)['pixel'])

    def test_custom_structure_array_and_stable_field_identity(self):
        custom=copy.deepcopy(SAMPLE);custom['fields'][1]['name']='amount'
        nodes=[c.node('array','a',elementType='struct:sample',length=2),c.node('array_get','pick'),
               c.node('struct_field','get',type='struct:sample',field='weight')]
        g=graph(nodes,[c.edge('a','pick','Array'),c.edge('pick','get','value')],definitions=[custom])
        text=c.compile_graph(g)['pixel']
        self.assertEqual(text.count('struct sg_type_sample {'),1)
        self.assertIn('float amount;',text);self.assertIn(').amount',text)
        self.assertNotIn(').weight',text)

    def test_structure_dependency_order_unused_definition_and_isolation(self):
        outer={'id':'outer','name':'Outer','fields':[{'id':'inner','name':'inner','type':'struct:sample'}]}
        unused={'id':'unused','name':'Unused','fields':[{'id':'a','name':'a','type':'int'}]}
        g=graph([c.node('array','a',elementType='struct:outer',length=1),c.node('array_get','get')],
                [c.edge('a','get','Array')],ty='struct:outer',definitions=[outer,SAMPLE,unused])
        text=c.compile_graph(g)['pixel']
        self.assertLess(text.index('struct sg_type_sample'),text.index('struct sg_type_outer'))
        self.assertNotIn('struct sg_type_unused',text)
        with self.assertRaises(c.GraphError):c.compile_graph({k:v for k,v in g.items() if k!='typeDefinitions'})

    def test_nested_array_shape_and_declarators(self):
        with c.type_context():
            registry=c.type_registry();d=registry.describe('vec3[2][3]')
            self.assertEqual((d['elementType'],d['length']),('vec3[3]',2))
            self.assertEqual(c.glsl_declaration('vec3[2][3]','values'),'vec3 values[2][3]')
            self.assertEqual(registry.glsl_type('vec3[2][3]'),'vec3[2][3]')
            self.assertEqual(len(c.filled_value('vec3[2][3]')),2)
            self.assertEqual(len(c.filled_value('vec3[2][3]')[0]),3)

    def test_uniform_array_declaration_and_get(self):
        g=graph([c.node('uniform','u',declarationId='weights'),c.node('array_get','get')],[c.edge('u','get','Array')])
        g['declarations']=[dict(id='weights',name='weights',kind='uniform',type='float[8]',nativeSequence='array',arraySource='../weights',value=[0]*8)]
        text=c.compile_graph(g)['pixel']
        self.assertIn('uniform float weights[8];',text)
        self.assertIn('clamp(0, 0, 8 - 1)',text)
        g['declarations'][0]['value']=None
        self.assertEqual(c.compile_graph(g)['pixel'],text)

    def test_builtin_top_structure_is_referenced_not_redeclared(self):
        g=graph([c.node('builtin_source','a',source='uTD2DInfos'),c.node('array_get','pick'),
                 c.node('struct_field','get',field='res')],
                [c.edge('a','pick','Array'),c.edge('pick','get','value')],ty='vec4')
        text=c.compile_graph(g)['pixel']
        self.assertNotIn('struct TDTexInfo',text)
        self.assertNotIn('uniform TDTexInfo',text)
        self.assertIn('#if TD_NUM_2D_INPUTS <= 0',text)
        self.assertIn('(uTD2DInfos)[clamp(0, 0, TD_NUM_2D_INPUTS - 1)]',text)

    def test_mat_structure_both_stages_and_wrong_target(self):
        for stage in ('vertex','pixel'):
            g=graph([c.node('builtin_source','a',source='uTDMats'),c.node('array_get','pick'),
                     c.node('struct_field','get',type='TDMatrix',field='world')],
                    [c.edge('a','pick','Array'),c.edge('pick','get','value')],ty='mat4',target='mat',stage=stage)
            text=c.compile_graph(g)[stage]
            self.assertIn(').world',text);self.assertNotIn('struct TDMatrix',text)
        g['target']='top';g['stages'].pop('vertex')
        with self.assertRaisesRegex(c.GraphError,'unavailable'):c.compile_graph(g)

    def test_sampler_array_get_is_reference_and_replace_is_rejected(self):
        nodes=[c.node('builtin_source','a',source='sTD2DInputs'),c.node('array_get','get')]
        g=graph(nodes,[c.edge('a','get','Array')],ty='sampler2D')
        text=c.compile_graph(g)['pixel']
        self.assertIn('nonuniformEXT(clamp(0, 0, TD_NUM_2D_INPUTS - 1))',text)
        self.assertNotIn('sampler2D sg_n_get',text)
        g['stages']['pixel']['nodes'][1]=c.node('array_replace','get')
        with self.assertRaisesRegex(c.GraphError,'Opaque'):c.compile_graph(g)

    def test_invalid_lengths_structure_recursion_and_identity(self):
        for ty in ('float[0]','float[-1]','float[1+1]','float[UNTRUSTED]','float[2147483648]','float[02]'):
            self.assertFalse(c.valid_port_type(ty),ty)
        cyc={'id':'cyclic','name':'Cyclic','fields':[{'id':'self','name':'selfValue','type':'struct:cyclic'}]}
        with self.assertRaisesRegex(c.GraphError,'Recursive'):c.type_contract({'typeDefinitions':[cyc]})
        self.assertIsNone(c.conversion_kind('float[3]','float[4]'))
        self.assertIsNone(c.conversion_kind('vec3[4]','mat4x3'))

    def test_shared_structure_dependencies_are_checked_once_and_do_not_leak(self):
        definitions=[dict(id='leaf',name='Leaf',fields=[dict(id='v',name='value',type='float')])]
        for level in range(10):
            previous='leaf' if level==0 else 'level'+str(level-1)
            definitions.append(dict(id='level'+str(level),name='Level '+str(level),fields=[
                dict(id='a',name='a',type='struct:'+previous),dict(id='b',name='b',type='struct:'+previous)]))
        with c.type_context({'typeDefinitions':definitions}):
            registry=c.type_registry()
            registry.check_environment('struct:level9','top','pixel')
            self.assertEqual(len(registry.checked),11)
            self.assertEqual(sum(ty.startswith('struct:') for ty,target,stage in registry.environments),11)
            self.assertIsNone(c.conversion_kind('struct:level0','struct:level1'))
        self.assertFalse(c.valid_port_type('struct:leaf'))

    def test_unsafe_definition_provider_or_field_names_are_rejected(self):
        for patch in ({'provider':'external'},{'fields':[dict(id='a',name='float',type='float')]},
                      {'fields':[dict(id='a',name='valid',type='float[not_trusted]')]}):
            with self.subTest(patch=patch),self.assertRaises(c.GraphError):
                c.type_contract({'typeDefinitions':[dict(SAMPLE,**patch)]})
        for malformed in (None,[],{'schemaVersion':99}):
            with self.assertRaises(c.GraphError):c.compile_graph(malformed)

    def test_glsl_code_compound_input_and_output(self):
        code=c.node('glsl_code','code',functionName='modify',inputs=[dict(id='a',name='items',type='struct:sample[2]')],
                    outputs=[dict(id='b',name='result',type='struct:sample[2]')],code='result = items; result[0].weight = 7.0;')
        g=graph([c.node('array','a',elementType='struct:sample',length=2),code,c.node('array_get','get')],
                [c.edge('a','code','a'),c.edge('code','get','Array','b')],ty='struct:sample',definitions=[SAMPLE])
        text=c.compile_graph(g)['pixel']
        self.assertIn('in sg_type_sample items[2], out sg_type_sample result[2]',text)
        self.assertLess(text.index('struct sg_type_sample'),text.index('void sg_code_'))

    def test_legacy_matrix_indexing_does_not_gain_array_policy(self):
        g=graph([c.node('matrix_get','get',type='mat3')],ty='vec3')
        text=c.compile_graph(g)['pixel']
        self.assertNotIn('clamp(',text)


if __name__=='__main__':unittest.main()
