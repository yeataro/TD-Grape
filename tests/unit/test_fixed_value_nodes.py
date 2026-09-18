"""Fixed insertion identities share typed value behavior without losing their type."""
import copy
import json
import unittest

import sgrape_core as c
from test_value_type_foundation import typed_graph, typed_value


class FixedValueNodes(unittest.TestCase):
    def test_all_fixed_types_keep_exact_values_and_shader_semantics(self):
        for ty in c.TYPES:
            for target, stage in [('top', 'pixel'), ('mat', 'pixel'), ('mat', 'vertex')]:
                with self.subTest(type=ty, target=target, stage=stage):
                    source = typed_value(ty)
                    generic = typed_graph([source], [], 'source', ty, target, stage)
                    fixed = copy.deepcopy(generic)
                    fixed['stages'][stage]['nodes'][0]['params']['fixedType'] = ty
                    before = copy.deepcopy(fixed)
                    actual = c.compile_graph(fixed)
                    self.assertEqual(actual[stage], c.compile_graph(generic)[stage])
                    self.assertEqual(fixed, before)
                    self.assertEqual(actual, c.compile_graph(json.loads(json.dumps(fixed))))

    def test_fixed_identity_rejects_type_changes_and_wrong_node_kind(self):
        for ty in c.TYPES:
            source = typed_value(ty)
            source['params']['fixedType'] = ty
            generic_type = 'bool' if c.type_components(ty) == 1 and ty != 'bool' else 'float' if c.type_components(ty) == 1 else 'vec3' if ty != 'vec3' else 'vec2'
            if ty in c.MATRIX_TYPES:generic_type='mat3' if ty!='mat3' else 'mat2'
            source['params']['type'] = generic_type
            with self.subTest(type=ty), self.assertRaisesRegex(c.GraphError, 'Fixed value type cannot change'):
                c.resolved_ports(c.BY_UUID[source['definitionUuid']], source['params'])
        for key, params in [('scalar', {'type':'int', 'fixedType':'ivec2'}),
                            ('vector', {'type':'ivec2', 'fixedType':'int'}),
                            ('add', {'type':'float', 'fixedType':'float'}),
                            ('scalar', {'type':'float', 'fixedType':None})]:
            with self.subTest(key=key), self.assertRaisesRegex(c.GraphError, 'Fixed value type cannot change'):
                c.resolved_ports(c.CATALOG[key], params)

    def test_disconnected_fixed_values_are_validated_too(self):
        source = typed_value('vec3')
        source['params']['fixedType'] = 'vec2'
        graph = c.demo_graph('color', 'top')
        graph['stages']['pixel']['nodes'].append(source)
        with self.assertRaisesRegex(c.GraphError, 'Fixed value type cannot change'):
            c.compile_graph(graph)

    def test_fixed_vector_split_preserves_component_family(self):
        for ty in c.VECTOR_TYPES:
            source = typed_value(ty)
            source['params']['fixedType'] = ty
            family = c.TYPE_DESCRIPTORS[ty]['family']
            split = c.node('vector_split', 'split', type=ty)
            graph = typed_graph([source, split], [c.edge('source', 'split', 'value')], 'split', family)
            graph['stages']['pixel']['edges'][1]['from'][1] = 'x'
            self.assertIn(c.literal(source['params']['components'][:c.type_components(ty)], ty), c.compile_graph(graph)['pixel'])


if __name__ == '__main__':
    unittest.main()
