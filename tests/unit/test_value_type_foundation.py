"""All value families keep exact literals, legal signatures and explicit conversions."""
import copy
import json
import unittest

import sgrape_core as c
from test_matrix_foundation import graph as observed_graph


def typed_value(ty, ident='source'):
    family=c.TYPE_DESCRIPTORS[ty]['family']
    values={'float':[.25,-.5,.75,1], 'int':[2147483647,-2147483648,16777217,-3],
            'uint':[4294967295,2147483648,16777217,3], 'bool':[True,False,True,False],
            'double':[1.0000000000000002,-.5,.75,1]}[family]
    if ty in c.MATRIX_TYPES:return c.node('matrix',ident,type=ty,values=[values[i%4] for i in range(c.type_components(ty))])
    if c.type_components(ty)==1:return c.node('scalar',ident,type=ty,value=values[0])
    return c.node('vector',ident,type=ty,components=values)


def typed_graph(nodes, edges, result, ty, target='top', stage='pixel'):
    # The original 16-family fixtures exercise Convert and its old shader text.
    # New value types use a handwritten observer so their checks do not depend
    # on Convert's implementation or an unrelated matrix flattening policy.
    if ty not in c.LEGACY_TYPES:return observed_graph(copy.deepcopy(nodes),copy.deepcopy(edges),source=result,ty=ty,target=target,stage=stage)
    graph=c.demo_graph('color',target)
    graph['declarations']=[]
    nodes=copy.deepcopy(nodes);edges=copy.deepcopy(edges)
    width=c.type_components(ty);viewtype=c.shaped_type('float',width)
    nodes.append(c.node('convert','view',fromType=ty,toType=viewtype))
    edges.append(c.edge(result,'view','value'));result='view'
    if width in (2,3):
        nodes.append(c.node('combine','rgba',type='vec4',groups={'x':viewtype},components=[0,0,0,1]))
        edges.append(c.edge(result,'rgba','x'));result='rgba'
    nodes.append(c.node(stage+'_out','result'))
    edges.append(c.edge(result,'result','color' if stage=='pixel' else 'position'))
    graph['stages'][stage]={'nodes':nodes,'edges':edges}
    return graph


class ValueTypeFoundation(unittest.TestCase):
    def test_registry_and_contract_are_family_aware(self):
        contract=c.type_contract()
        self.assertEqual(len(contract['valueTypes']),38)
        self.assertEqual(len(contract['numericTypes']),16)
        self.assertEqual(contract['convert']['types'],list(c.TYPES))
        for ty in c.TYPES:
            descriptor=contract['types'][ty]
            expected=c.matrix_type(descriptor['family'],descriptor['columns'],descriptor['rows']) if descriptor.get('shape')=='matrix' else c.shaped_type(descriptor['family'],descriptor['components'])
            self.assertEqual(ty,expected)
            self.assertEqual(descriptor['scalarType'],descriptor['family'])
        for key in c.CATALOG:
            c.resolved_ports(c.CATALOG[key],c.node(key,'probe')['params'],{'type':'float'})

    def test_exact_32_bit_integer_and_boolean_literals(self):
        self.assertEqual(c.literal([4294967295,16777217],'uvec2'),'uvec2(4294967295u, 16777217u)')
        self.assertEqual(c.literal([-2147483648,2147483647],'ivec2'),'ivec2((-2147483647 - 1), 2147483647)')
        self.assertEqual(c.literal([True,False,True],'bvec3'),'bvec3(true, false, true)')
        for ty in c.TYPES:
            family=c.TYPE_DESCRIPTORS[ty]['family'];zero={'float':'0.0','int':'0','uint':'0u','bool':'false','double':'0.0LF'}[family]
            expected=zero if c.type_components(ty)==1 else ty+'('+', '.join([zero]*c.type_components(ty))+')'
            self.assertEqual(c.literal(c.filled_value(ty),ty),expected)
        for value,ty in [([1,False],'bvec2'),([.5,1],'ivec2'),([-1,1],'uvec2'),([4294967296,0],'uvec2'),([2147483648,0],'ivec2')]:
            with self.subTest(type=ty,value=value),self.assertRaises(c.GraphError):c.literal(value,ty)

    def test_scalar_and_vector_values_compile_all_targets_without_mutation(self):
        for ty in c.TYPES:
            for target,stage in [('top','pixel'),('mat','pixel'),('mat','vertex')]:
                with self.subTest(type=ty,target=target,stage=stage):
                    source=typed_value(ty)
                    graph=typed_graph([source],[],'source',ty,target,stage);before=copy.deepcopy(graph)
                    result=c.compile_graph(graph)
                    self.assertEqual(graph,before)
                    self.assertEqual(result,c.compile_graph(json.loads(json.dumps(graph))))
                    expected=source['params'].get('value',source['params'].get('values',source['params'].get('components',[])[:c.type_components(ty)]))
                    self.assertIn(c.literal(expected,ty),result[stage])

    def test_math_signature_families_and_integer_operators(self):
        numeric=('add','subtract','multiply','divide','min','max','clamp','mod')
        floating=('sin','cos','pow','mix','sqrt','floor','round','ceil','trunc','fract','length','normalize','dot','remap','range_from','range_to','loop','zigzag')
        for key,allowed in [(key,c.LEGACY_NUMERIC_TYPES) for key in numeric]+[(key,c.FLOAT_TYPES) for key in floating]+[(key,c.SIGNED_TYPES) for key in ('abs','sign')]:
            if key in c.DOUBLE_MATH_KEYS:allowed+=c.DOUBLE_TYPES
            if key in c.ARITHMETIC_KEYS:allowed=c.ARITHMETIC_TYPES
            self.assertEqual(c.node_parameter_types(c.CATALOG[key]),allowed)
            for ty in c.TYPES:
                with self.subTest(node=key,type=ty):
                    operation=c.node(key,'operation',type=ty)
                    resulttype=c.TYPE_DESCRIPTORS[ty]['family'] if key in ('dot','length') else ty
                    graph=typed_graph([operation],[],'operation',resulttype)
                    if ty not in allowed:
                        with self.assertRaises(c.GraphError):c.compile_graph(graph)
                    else:
                        code=c.compile_graph(graph)['pixel']
                        if key=='mod':self.assertIn('mod(' if c.TYPE_DESCRIPTORS[ty]['family'] in ('float','double') else ' % ',code)
                        if key=='divide':self.assertIn(' / ',code)

    def test_named_graph_constants_keep_each_declared_family_and_literal(self):
        for ty in c.TYPES:
            source=typed_value(ty)
            value=source['params']['value'] if c.type_components(ty)==1 else source['params']['values'] if ty in c.MATRIX_TYPES else source['params']['components'][:c.type_components(ty)]
            graph=typed_graph([c.node('constant','source',declarationId='constant')],[],'source',ty)
            graph['declarations']=[dict(id='constant',kind='constant',name='cTyped',type=ty,value=value)]
            before=copy.deepcopy(graph)
            code=c.compile_graph(graph)['pixel']
            self.assertIn('const '+ty+' cTyped = '+c.literal(value,ty)+';',code)
            self.assertNotIn('uniform '+ty+' cTyped',code)
            self.assertEqual(graph,before)

    def test_implicit_cast_matrix_has_no_dimension_drop_or_bool_numeric_cast(self):
        for source in c.TYPES:
            a=c.TYPE_DESCRIPTORS[source]
            for target in c.TYPES:
                b=c.TYPE_DESCRIPTORS[target]
                allowed=source==target or (source not in c.MATRIX_TYPES and target not in c.MATRIX_TYPES and (
                    (a['components']==1 and a['family']==b['family']) or (
                    a['family']!='bool' and b['family']!='bool' and (a['components']==1 or a['components']==b['components']))))
                self.assertEqual(c.conversion_kind(source,target) is not None,allowed,(source,target))
                if allowed:self.assertEqual(c.convert_expression('value',source,target),'value' if source==target else target+'(value)')

    def test_convert_all_constructor_shapes_and_constant_propagation(self):
        # Keep all legacy family combinations, including the newly exposed
        # legal GLSL unary vector truncation and scalar extraction cases.
        for source in c.LEGACY_TYPES:
            for target in c.LEGACY_TYPES:
                with self.subTest(source=source,target=target):
                    convert=c.node('convert','cast',fromType=source,toType=target,requireConstant=True)
                    graph=typed_graph([typed_value(source),convert],[c.edge('source','cast','value')],'cast',target)
                    if c.type_components(source)!=1 and c.type_components(source)<c.type_components(target):
                        with self.assertRaisesRegex(c.GraphError,'Convert'):c.compile_graph(graph)
                    else:self.assertIn('const '+target+' sg_n_cast = '+target+'(sg_n_source);',c.compile_graph(graph)['pixel'])

    def test_if_returns_each_family_with_scalar_boolean_condition(self):
        for ty in c.node_parameter_types(c.CATALOG['if']):
            branch=c.node('if','choice',type=ty);branch['inputValues']={'condition':True}
            graph=typed_graph([typed_value(ty),branch],[c.edge('source','choice','true')],'choice',ty)
            code=c.compile_graph(graph)['pixel']
            self.assertIn('const '+ty+' sg_n_choice = (true ? sg_n_source : '+c.literal(c.filled_value(ty),ty)+');',code)

    def test_split_swizzle_combine_and_replace_preserve_family(self):
        for ty in c.VECTOR_TYPES:
            width=c.type_components(ty);family=c.TYPE_DESCRIPTORS[ty]['family']
            source=typed_value(ty)
            nodes=[source,c.node('vector_split','split',type=ty),c.node('combine','join',type=ty),
                   c.node('swizzle','swizzle',type=ty,mask='xyzw'[:width][::-1]),c.node('replace','replace',type=ty)]
            edges=[c.edge('source','split','value'),c.edge('join','swizzle','value'),c.edge('swizzle','replace','value')]
            edges.extend(c.edge('split','join',axis,axis) for axis in 'xyzw'[:width])
            graph=typed_graph(nodes,edges,'replace',ty)
            result=c.compile_graph(graph)
            self.assertEqual(result['stages']['pixel']['ports']['split']['out'],dict.fromkeys('xyzw'[:width],family))
            self.assertIn('const '+ty+' sg_n_join = '+ty+'(',result['pixel'])
            self.assertIn('const '+ty+' sg_n_swizzle = (sg_n_join).'+('xyzw'[:width][::-1]),result['pixel'])
            for layout in c.combine_layouts(ty):
                self.assertTrue(all(c.TYPE_DESCRIPTORS[part]['family']==family for part in layout['inputs'].values()))

    def test_glsl_code_and_subgraph_interfaces_accept_all_value_types(self):
        for ty in c.TYPES:
            code=c.node('glsl_code','code',functionName='passValue',inputs=[dict(id='value',name='value',type=ty)],
                        outputs=[dict(id='out',name='resultValue',type=ty)],code='resultValue = value;')
            graph=typed_graph([code],[],'code',ty)
            self.assertIn('out '+ty+' resultValue',c.compile_graph(graph)['pixel'])
            default=c.filled_value(ty)
            graph=typed_graph([{'id':'call','definitionUuid':c.CALL,'params':{'functionId':'typed'}}],[],'call',ty)
            graph['functions']=[dict(id='typed',name='Typed',scope='local',stages=['pixel'],
                inputs=[dict(id='value',name='Value',type=ty,default=default)],outputs=[dict(id='out',name='Out',type=ty,default=default)],
                graph=dict(nodes=[{'id':'input','definitionUuid':c.FUNCTION_INPUT,'params':{}},{'id':'output','definitionUuid':c.FUNCTION_OUTPUT,'params':{}}],edges=[c.edge('input','output','out','value')]))]
            self.assertIn(c.literal(default,ty),c.compile_graph(graph)['pixel'])


if __name__=='__main__':unittest.main()
