"""Matrix shape, native expressions, and double precision graph contracts."""
import copy
import json
import unittest

import sgrape_core as c


def graph(nodes, edges=(), source='matrix', ty='mat3', output='out', target='top', stage='pixel'):
    result=c.demo_graph('color',target)
    result['declarations']=[]
    descriptor=c.TYPE_DESCRIPTORS[ty]
    access='value[0][0]' if ty in c.MATRIX_TYPES else 'value.x' if descriptor['components']>1 else 'value'
    observer=c.node('glsl_code','observe',functionName='observeValue',
                    inputs=[{'id':'value','name':'value','type':ty}],
                    outputs=[{'id':'color','name':'colorValue','type':'vec4'}],
                    code='colorValue = vec4(float('+access+'));')
    result['stages'][stage]={'nodes':list(nodes)+[observer,c.node(stage+'_out','result')],
        'edges':list(edges)+[c.edge(source,'observe','value',output),c.edge('observe','result','color' if stage=='pixel' else 'position','color')]}
    return result


class MatrixFoundation(unittest.TestCase):
    def test_all_shapes_identity_and_contract(self):
        contract=c.type_contract()
        self.assertEqual(len(c.MATRIX_TYPES),18)
        self.assertEqual(len(c.TYPES),38)
        for family in ('float','double'):
            for columns in range(2,5):
                for rows in range(2,5):
                    ty=c.matrix_type(family,columns,rows)
                    descriptor=contract['types'][ty]
                    self.assertEqual((descriptor['shape'],descriptor['columns'],descriptor['rows'],descriptor['components']),('matrix',columns,rows,columns*rows))
                    expected=[int(column==row) for column in range(columns) for row in range(rows)]
                    self.assertEqual(c.node('matrix','matrix',type=ty)['params']['values'],expected)
                    self.assertEqual(contract['matrices']['identityValues'][ty],expected)
                    self.assertEqual(c.resolved_ports(c.CATALOG['matrix'],{'type':ty})['outputs'],{'out':ty})
        self.assertEqual(contract['matrices']['storage'],'column-major')
        self.assertEqual(contract['matrices']['indexTypes'],['int','uint'])

    def test_invalid_shape_value_count_and_fixed_type_rejected(self):
        for family,columns,rows in [('int',3,3),('float',1,3),('double',3,5),('float',2.0,3)]:
            with self.assertRaises(c.GraphError):c.matrix_type(family,columns,rows)
        for ty in ('mat1','mat5','mat3x1','dmat4x5','imat3'):
            with self.assertRaises(c.GraphError):c.resolved_ports(c.CATALOG['matrix'],{'type':ty})
        with self.assertRaisesRegex(c.GraphError,'6 components'):c.literal([0]*9,'mat2x3')
        with self.assertRaisesRegex(c.GraphError,'Fixed value type'):c.definition_ports(c.CATALOG['matrix'],{'type':'mat4','fixedType':'mat3'})

    def test_all_matrix_literals_reach_both_stages_and_roundtrip(self):
        for ty in c.MATRIX_TYPES:
            for target,stage in [('top','pixel'),('mat','pixel'),('mat','vertex')]:
                with self.subTest(type=ty,target=target,stage=stage):
                    values=[i+.125 for i in range(c.type_components(ty))]
                    result=graph([c.node('matrix','matrix',type=ty,values=values)],ty=ty,target=target,stage=stage)
                    before=copy.deepcopy(result)
                    compiled=c.compile_graph(result)
                    self.assertIn(c.literal(values,ty),compiled[stage])
                    self.assertEqual(result,before)
                    self.assertEqual(compiled,c.compile_graph(json.loads(json.dumps(result))))

    def test_matrix_conversions_are_identity_only_and_legacy_pairs_unchanged(self):
        for source in c.MATRIX_TYPES:
            for target in c.TYPES:
                self.assertEqual(c.conversion_kind(source,target),'identity' if source==target else None)
                self.assertEqual(c.conversion_kind(target,source),'identity' if source==target else None)
        for source in c.LEGACY_TYPES:
            for target in c.LEGACY_TYPES:
                a,b=c.TYPE_DESCRIPTORS[source],c.TYPE_DESCRIPTORS[target]
                expected='identity' if source==target else None
                if a['family']!='bool' and b['family']!='bool' and (a['components']==b['components'] or a['components']==1):expected='cast' if source!=target else 'identity'
                if a['components']==1 and b['components']>1 and a['family']==b['family']:expected='splat'
                self.assertEqual(c.conversion_kind(source,target),expected,(source,target))

    def test_column_and_element_ports_exist_together(self):
        for ty in c.MATRIX_TYPES:
            descriptor=c.TYPE_DESCRIPTORS[ty]
            expected={}
            for column in range(descriptor['columns']):
                port='c'+str(column);expected[port]=c.shaped_type(descriptor['family'],descriptor['rows'])
                expected.update({port+axis:descriptor['family'] for axis in 'xyzw'[:descriptor['rows']]})
            self.assertEqual(c.matrix_interface('matrix_combine',{'type':ty})['inputs'],expected)
            self.assertEqual(c.matrix_interface('matrix_replace',{'type':ty})['inputs'],{'value':ty,**expected})
            self.assertEqual(c.matrix_interface('matrix_split',{'type':ty})['outputs'],expected)

    def test_combine_scalar_overrides_column_and_local_values(self):
        result=graph([c.node('matrix_combine','matrix',type='mat2x3',values=[1,2,3,4,5,6]),
                      c.node('vec3','column',value=[7,8,9]),c.node('float','element',value=10)],
                     [c.edge('column','matrix','c0'),c.edge('element','matrix','c0y')],ty='mat2x3')
        code=c.compile_graph(result)['pixel']
        self.assertIn('mat2x3(vec3((sg_n_column)[0], sg_n_element, (sg_n_column)[2]), vec3(4.0, 5.0, 6.0))',code)

    def test_replace_inherits_baseline_and_disconnect_restores_saved_values(self):
        matrix=c.node('matrix_replace','matrix',type='mat2',values=[7,8,9,10])
        result=graph([matrix,c.node('uniform','baseline',declarationId='source'),c.node('float','element',value=5)],
                     [c.edge('baseline','matrix','value'),c.edge('element','matrix','c1x')],ty='mat2')
        result['declarations']=[dict(id='source',kind='uniform',name='uMatrix',type='mat2',value=[1,2,3,4],nativeSequence='matrix')]
        code=c.compile_graph(result)['pixel']
        self.assertIn('mat2((sg_n_baseline)[0], vec2(sg_n_element, (sg_n_baseline)[1][1]))',code)
        self.assertNotIn('vec2(7.0, 8.0)',code)
        result['stages']['pixel']['edges'].remove(c.edge('baseline','matrix','value'))
        code=c.compile_graph(result)['pixel']
        self.assertIn('mat2(vec2(7.0, 8.0), vec2(sg_n_element, 10.0))',code)
        self.assertEqual(matrix['params']['values'],[7,8,9,10])

    def test_shadowed_runtime_baseline_is_not_emitted(self):
        result=graph([c.node('matrix_replace','matrix',type='mat2',requireConstant=True),
                      c.node('uniform','baseline',declarationId='source'),
                      c.node('vec2','first',value=[1,2]),c.node('vec2','second',value=[3,4])],
                     [c.edge('baseline','matrix','value'),c.edge('first','matrix','c0'),c.edge('second','matrix','c1')],ty='mat2')
        result['declarations']=[dict(id='source',kind='uniform',name='uMatrix',type='mat2',value=[1,2,3,4],nativeSequence='matrix')]
        compiled=c.compile_graph(result)
        self.assertNotIn('uMatrix',compiled['pixel'])
        self.assertNotIn('baseline',compiled['stages']['pixel']['live'])
        self.assertEqual(compiled['bindings'],[])
        self.assertIn('const mat2 sg_n_matrix',compiled['pixel'])

    def test_scalar_overrides_can_shadow_an_entire_runtime_column(self):
        result=graph([c.node('matrix_combine','matrix',type='mat2',requireConstant=True),
                      c.node('uniform','column',declarationId='source'),
                      c.node('float','first',value=2),c.node('float','second',value=3)],
                     [c.edge('column','matrix','c0'),c.edge('first','matrix','c0x'),c.edge('second','matrix','c0y')],ty='mat2')
        result['declarations']=[dict(id='source',kind='uniform',name='uColumn',type='vec2',value=[4,5])]
        compiled=c.compile_graph(result)
        self.assertNotIn('uColumn',compiled['pixel'])
        self.assertEqual(compiled['bindings'],[])
        self.assertIn('mat2(vec2(sg_n_first, sg_n_second), vec2(0.0, 1.0))',compiled['pixel'])

    def test_split_column_and_scalar_read_correct_coordinates(self):
        nodes=[c.node('matrix','source',type='mat4x2'),c.node('matrix_split','matrix',type='mat4x2')]
        for port,ty,access in [('c3','vec2','[3]'),('c3y','float','[3][1]')]:
            code=c.compile_graph(graph(nodes,[c.edge('source','matrix','value')],ty=ty,output=port))['pixel']
            self.assertIn('(sg_n_source)'+access,code)

    def test_get_and_set_keep_dynamic_native_indexing(self):
        for ty in ('mat2x3','dmat3x2'):
            descriptor=c.TYPE_DESCRIPTORS[ty]
            for index_type in ('int','uint'):
                for mode in ('column','element'):
                    selected=descriptor['family'] if mode=='element' else c.shaped_type(descriptor['family'],descriptor['rows'])
                    operation=c.node('matrix_set','set',type=ty,indexType=index_type,mode=mode)
                    operation['inputValues']={'replacement':c.filled_value(selected,2)}
                    nodes=[operation,c.node('matrix_get','matrix',type=ty,indexType=index_type,mode=mode),
                           c.node('uniform','index',declarationId='index')]
                    edges=[c.edge('set','matrix','value'),c.edge('index','set','column'),c.edge('index','matrix','column')]
                    if mode=='element':edges.extend([c.edge('index','set','row'),c.edge('index','matrix','row')])
                    result=graph(nodes,edges,ty=selected)
                    result['declarations']=[dict(id='index',kind='uniform',name='uIndex',type=index_type,value=1)]
                    code=c.compile_graph(result)['pixel']
                    suffix='[sg_n_index]'* (2 if mode=='element' else 1)
                    self.assertIn('sg_n_set'+suffix+' = '+c.literal(c.filled_value(selected,2),selected)+';',code)
                    self.assertIn('(sg_n_set)'+suffix,code)
                    self.assertNotIn('clamp(',code)
        for invalid in ({'mode':'row'},{'indexType':'float'}):
            with self.assertRaises(c.GraphError):c.matrix_interface('matrix_get',dict(type='mat3',**invalid))

    def test_function_shapes_and_outputs(self):
        for ty in c.MATRIX_TYPES:
            descriptor=c.TYPE_DESCRIPTORS[ty]
            transposed=c.matrix_type(descriptor['family'],descriptor['rows'],descriptor['columns'])
            self.assertEqual(c.matrix_interface('transpose',{'type':ty})['outputs'],{'out':transposed})
            self.assertEqual(c.matrix_interface('outer_product',{'type':ty})['inputs'],{
                'a':c.shaped_type(descriptor['family'],descriptor['rows']),
                'b':c.shaped_type(descriptor['family'],descriptor['columns'])})
            for key in ('transpose','matrix_comp_mult','outer_product'):
                result_type=transposed if key=='transpose' else ty
                code=c.compile_graph(graph([c.node(key,'matrix',type=ty)],ty=result_type))['pixel']
                self.assertIn({'matrix_comp_mult':'matrixCompMult','outer_product':'outerProduct'}.get(key,key)+'(',code)
            if descriptor['columns']==descriptor['rows']:
                for key,result_type in [('inverse',ty),('determinant',descriptor['family'])]:
                    code=c.compile_graph(graph([c.node(key,'matrix',type=ty)],ty=result_type))['pixel']
                    self.assertIn(key+'(',code)
            else:
                for key in ('inverse','determinant'):
                    with self.assertRaises(c.GraphError):c.resolved_ports(c.CATALOG[key],{'type':ty})

    def test_matrix_declarations_and_function_interfaces(self):
        for ty in ('mat3x2','dmat2x4'):
            for kind in ('constant','uniform'):
                result=graph([c.node(kind,'matrix',declarationId='source')],ty=ty)
                declaration=dict(id='source',kind=kind,name='uMatrix',type=ty,value=c.matrix_identity(ty))
                if kind=='uniform':declaration['nativeSequence']='matrix'
                result['declarations']=[declaration]
                code=c.compile_graph(result)['pixel']
                self.assertIn(('const' if kind=='constant' else 'uniform')+' '+ty+' uMatrix',code)
                self.assertIn('in '+ty+' value',code)

    def test_matrix_subgraph_ports_and_defaults_roundtrip(self):
        for ty in ('mat2x3','dmat4x2'):
            value=[i+.25 for i in range(c.type_components(ty))]
            function={'id':'matrixFunction','name':'Matrix Function','scope':'local','stages':['vertex','pixel'],
                      'inputs':[{'id':'value','name':'Value','type':ty,'default':value}],
                      'outputs':[{'id':'result','name':'Result','type':ty,'default':c.matrix_identity(ty)}],
                      'graph':{'nodes':[{'id':'input','definitionUuid':c.FUNCTION_INPUT,'params':{}},
                                        {'id':'output','definitionUuid':c.FUNCTION_OUTPUT,'params':{}}],
                               'edges':[c.edge('input','output','result','value')]}}
            call={'id':'matrix','definitionUuid':c.CALL,'params':{'functionId':'matrixFunction'}}
            result=graph([call],ty=ty,output='result');result['functions']=[function]
            compiled=c.compile_graph(result)
            self.assertIn(c.literal(value,ty),compiled['pixel'])
            self.assertEqual(compiled,c.compile_graph(json.loads(json.dumps(result))))

    def test_heterogeneous_arithmetic_remains_outside_current_batch(self):
        for key in ('add','multiply'):
            self.assertNotIn('mat3',c.node_parameter_types(c.CATALOG[key]))
            self.assertNotIn('double',c.node_parameter_types(c.CATALOG[key]))


class DoubleFoundation(unittest.TestCase):
    def test_literals_keep_binary64_precision_and_range(self):
        self.assertEqual(c.literal(1.0000000000000002,'double'),'1.0000000000000002LF')
        self.assertEqual(c.literal(9007199254740991,'double'),'9007199254740991.0LF')
        self.assertEqual(c.literal(1e100,'double'),'1e+100LF')
        self.assertEqual(c.literal([1,2],'dvec2'),'dvec2(1.0LF, 2.0LF)')
        for value in (True,float('inf'),float('nan'),10**1000):
            with self.assertRaises(c.GraphError):c.literal(value,'double')

    def test_scalar_vector_sources_and_numeric_wires(self):
        for ty in ('double','dvec2','dvec3','dvec4'):
            source=c.node('scalar','matrix',type=ty,value=1.0000000000000002) if ty=='double' else c.node('vector','matrix',type=ty,components=[1.0000000000000002]*4)
            code=c.compile_graph(graph([source],ty=ty))['pixel']
            self.assertIn('1.0000000000000002LF',code)
            self.assertEqual(c.conversion_kind('double',ty),'identity' if ty=='double' else 'splat')
        self.assertEqual(c.convert_expression('x','dvec3','vec3'),'vec3(x)')
        self.assertIsNone(c.conversion_kind('dvec2','vec3'))


if __name__=='__main__':unittest.main(verbosity=2)
