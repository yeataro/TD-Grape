"""Explicit constructors, matrix If and the precise native fp64 overload set."""
import copy
import json
import unittest

import sgrape_core as c
from test_matrix_foundation import graph


def value_node(ty, ident='source'):
    count = c.type_components(ty)
    family = c.TYPE_DESCRIPTORS[ty]['family']
    values = [True, False, True, False] if family == 'bool' else [1, 2, 3, 4]
    if ty in c.MATRIX_TYPES:
        return c.node('matrix', ident, type=ty, values=[i+.25 for i in range(count)])
    if count == 1:return c.node('scalar', ident, type=ty, value=values[0])
    return c.node('vector', ident, type=ty, components=values)


class ExplicitConstructors(unittest.TestCase):
    def test_all_unary_constructor_pairs_agree_with_ports_contract_and_emission(self):
        contract = c.type_contract()['convert']
        self.assertEqual(contract['types'], list(c.TYPES))
        self.assertEqual(set(contract['pairs']), set(c.TYPES))
        for source in c.TYPES:
            for target in c.TYPES:
                # GLSL supplies constructor arguments in sequence. A matrix
                # constructor from one matrix is the special resize case.
                expected = (source in c.MATRIX_TYPES and target in c.MATRIX_TYPES or
                            c.type_components(source) == 1 or
                            c.type_components(source) >= c.type_components(target))
                with self.subTest(source=source, target=target):
                    self.assertEqual(c.explicit_conversion_valid(source,target), expected)
                    self.assertEqual(target in contract['pairs'][source], expected)
                    node = c.node('convert', 'cast', fromType=source, toType=target, requireConstant=True)
                    if not expected:
                        with self.assertRaisesRegex(c.GraphError,'Convert'):
                            c.resolved_ports(c.CATALOG['convert'],node['params'])
                        continue
                    ports = c.resolved_ports(c.CATALOG['convert'],node['params'])
                    self.assertEqual(ports, {'inputs':{'value':source}, 'outputs':{'out':target}})
                    shader = c.compile_graph(graph([value_node(source),node],
                        [c.edge('source','cast','value')],source='cast',ty=target))['pixel']
                    self.assertIn('const '+target+' sg_n_cast = '+target+'(sg_n_source);',shader)
        for invalid in ('sampler2D','mat5',None):
            self.assertFalse(c.explicit_conversion_valid(invalid,'float'))
            self.assertFalse(c.explicit_conversion_valid('float',invalid))

    def test_rectangular_resize_extraction_diagonal_and_truncation_remain_native(self):
        for source,target in [('mat2x3','mat3x2'),('dmat4','mat2'),('mat2','dmat4'),
                              ('double','dmat3x2'),('bvec4','dmat2'),('ivec4','mat2'),
                              ('mat2x3','vec4'),('dmat4','bool'),('dvec4','ivec2'),('bvec3','double')]:
            for target_kind,stage in [('top','pixel'),('mat','pixel'),('mat','vertex')]:
                with self.subTest(source=source,target=target,target_kind=target_kind,stage=stage):
                    data=graph([value_node(source),c.node('convert','cast',fromType=source,toType=target)],
                        [c.edge('source','cast','value')],source='cast',ty=target,target=target_kind,stage=stage)
                    before=copy.deepcopy(data);compiled=c.compile_graph(data)
                    self.assertIn(target+'(sg_n_source)',compiled[stage])
                    self.assertEqual(data,before)
                    self.assertEqual(compiled,c.compile_graph(json.loads(json.dumps(data))))

    def test_explicit_capability_does_not_change_matrix_wires(self):
        for source in c.MATRIX_TYPES:
            for target in c.TYPES:
                self.assertEqual(c.conversion_kind(source,target),'identity' if source==target else None)
                self.assertEqual(c.conversion_kind(target,source),'identity' if source==target else None)
        for source,target in [('vec2','vec3'),('dvec3','mat2'),('vec4','mat2x3'),('dvec4','dmat3')]:
            self.assertFalse(c.explicit_conversion_valid(source,target))
        self.assertIsNone(c.conversion_kind('vec4','vec2'))
        self.assertIsNone(c.conversion_kind('float','bool'))


class MatrixAndDoubleIf(unittest.TestCase):
    def test_every_matrix_default_is_diagonal_true_and_zero_false(self):
        self.assertEqual(c.node_parameter_types(c.CATALOG['if']),c.TYPES)
        for ty in c.MATRIX_TYPES:
            d=c.TYPE_DESCRIPTORS[ty]
            identity=[int(column==row) for column in range(d['columns']) for row in range(d['rows'])]
            zero=[0]*d['components']
            self.assertEqual(c.input_default('if','true',ty),identity)
            self.assertEqual(c.input_default('if','false',ty),zero)
            for target,stage in [('top','pixel'),('mat','pixel'),('mat','vertex')]:
                data=graph([c.node('if','branch',type=ty)],source='branch',ty=ty,target=target,stage=stage)
                self.assertIn('const '+ty+' sg_n_branch = (false ? '+c.literal(identity,ty)+' : '+c.literal(zero,ty)+');',c.compile_graph(data)[stage])

    def test_runtime_condition_keeps_both_same_shape_branches(self):
        for ty in ('double','dvec3','mat2x3','dmat3x2'):
            branch=c.node('if','branch',type=ty)
            data=graph([value_node(ty,'yes'),value_node(ty,'no'),branch,
                        c.node('uniform','condition',declarationId='condition')],
                [c.edge('yes','branch','true'),c.edge('no','branch','false'),c.edge('condition','branch','condition')],
                source='branch',ty=ty)
            data['declarations']=[dict(id='condition',name='uCondition',kind='uniform',type='bool',value=False)]
            compiled=c.compile_graph(data)
            self.assertIn(ty+' sg_n_branch = (sg_n_condition ? sg_n_yes : sg_n_no);',compiled['pixel'])
            self.assertIn('yes',compiled['stages']['pixel']['live']);self.assertIn('no',compiled['stages']['pixel']['live'])
            branch['params']['requireConstant']=True
            with self.assertRaisesRegex(c.GraphError,'Require Constant'):c.compile_graph(data)

    def test_matrix_branches_do_not_resize_or_accept_numeric_condition(self):
        for source,target,port in [('mat2','mat3','true'),('mat2x3','mat3x2','false'),('float','dmat3','condition')]:
            data=graph([value_node(source),c.node('if','branch',type=target)],
                [c.edge('source','branch',port)],source='branch',ty=target)
            with self.assertRaisesRegex(c.GraphError,'cannot connect'):c.compile_graph(data)


class NativeDoubleMath(unittest.TestCase):
    KEYS=('sqrt','abs','sign','floor','round','ceil','trunc','fract','min','max','clamp',
          'mod','smoothstep','mix','length','dot','normalize','range_from','range_to')

    def test_double_overloads_keep_port_precision_and_native_glsl(self):
        self.assertEqual(c.DOUBLE_MATH_KEYS,frozenset(self.KEYS))
        for key in self.KEYS:
            for ty in c.DOUBLE_TYPES:
                with self.subTest(key=key,type=ty):
                    definition=c.CATALOG[key]
                    self.assertIn(ty,c.node_parameter_types(definition))
                    ports=c.resolved_ports(definition,{'type':ty})
                    output='double' if key in ('dot','length') else ty
                    self.assertEqual(ports['outputs'],{'out':output})
                    self.assertEqual(set(ports['inputs'].values()),{ty,'double'} if key=='mix' and ty!='double' else {ty})
                    for target,stage in [('top','pixel'),('mat','pixel'),('mat','vertex')]:
                        operation=c.node(key,'operation',type=ty,requireConstant=True)
                        operation['inputValues']={name:c.filled_value(porttype,1.0000000000000002) for name,porttype in ports['inputs'].items()}
                        data=graph([operation],source='operation',ty=output,target=target,stage=stage)
                        before=copy.deepcopy(data);compiled=c.compile_graph(data)
                        shader=compiled[stage]
                        self.assertIn('const '+output+' sg_n_operation = ',shader)
                        self.assertIn('1.0000000000000002LF',shader)
                        if key not in ('range_from','range_to'):self.assertIn(key+'(',shader)
                        self.assertEqual(data,before)
                        self.assertEqual(compiled,c.compile_graph(json.loads(json.dumps(data))))

    def test_double_range_formula_handles_scalars_without_fake_swizzles(self):
        for ty in c.DOUBLE_TYPES:
            operation=c.node('range_from','operation',type=ty)
            operation['inputValues']={name:c.filled_value(ty,value) for name,value in [('value',3),('min',2),('max',2)]}
            shader=c.compile_graph(graph([operation],source='operation',ty=ty))['pixel']
            self.assertIn(' != ',shader)
            self.assertIn(' ? ',shader)
            self.assertIn(' : ',shader)
            if ty=='double':
                self.assertIn('(2.0LF != 2.0LF ? (3.0LF - 2.0LF) / (2.0LF - 2.0LF) : 3.0LF)',shader)
                self.assertNotIn(').x',shader)
            else:
                for axis in 'xyzw'[:c.type_components(ty)]:self.assertIn(').'+axis,shader)

    def test_unrelated_signatures_are_not_broadened(self):
        for key in ('sin','cos','pow','rgb_to_hsv','hsv_to_rgb','remap','loop','zigzag','perlin_noise','simplex_noise'):
            for ty in c.DOUBLE_TYPES+c.MATRIX_TYPES:
                self.assertNotIn(ty,c.node_parameter_types(c.CATALOG[key]),(key,ty))
        for key in ('add','subtract','multiply','divide'):
            self.assertEqual(c.node_parameter_types(c.CATALOG[key]),c.LEGACY_NUMERIC_TYPES)
        self.assertEqual(c.node_parameter_types(c.CATALOG['compare']),('float','int','uint'))


if __name__=='__main__':unittest.main()
