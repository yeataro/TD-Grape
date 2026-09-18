import copy
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import sgrape_core as core
import sgrape_sources as sources
import sgrape_parameters as parameters


class TypedSources(unittest.TestCase):
    def test_integer_native_transport_checks_precision_not_a_small_range(self):
        for ty in ('int', 'ivec3', 'uint', 'uvec4'):
            declaration = {'name': 'uValue', 'type': ty}
            for value in (0, 16777215, 16777216, 16777218, 1073741824):
                sources.validate_uniform_component(declaration, value)
            for value in (16777217, 2147483647):
                with self.assertRaisesRegex(RuntimeError, 'float32'):
                    sources.validate_uniform_component(declaration, value)
            with self.assertRaises(RuntimeError):sources.validate_uniform_component(declaration, 1.5)
        sources.validate_uniform_component({'type': 'int'}, -2147483648)
        sources.validate_uniform_component({'type': 'uint'}, 2147483648)
        sources.validate_uniform_component({'type': 'uint'}, 4294967040, kind='top')
        with self.assertRaisesRegex(RuntimeError, 'GLSL MAT'):
            sources.validate_uniform_component({'type': 'uint'}, 4294967040, kind='mat')
        with self.assertRaises(RuntimeError):sources.validate_uniform_component({'type': 'uint'}, -1)
        for value in (False, True, 0.0, 1.0):sources.validate_uniform_component({'type': 'bvec4'}, value)
        for value in (-.5, .5, 2):
            with self.assertRaises(RuntimeError):sources.validate_uniform_component({'type': 'bool'}, value)

    def test_native_shapes_match_shared_value_types(self):
        self.assertEqual(set(sources.TYPES), set(core.TYPES))
        for ty in core.TYPES:
            self.assertEqual(sources.source_components({'type': ty}), core.type_components(ty))

    def test_created_defaults_are_valid_for_every_family(self):
        for ty in core.TYPES:
            with self.subTest(ty=ty):
                graph = {'declarations': []}
                comp = SimpleNamespace()
                native = SimpleNamespace()
                deployed = []
                runtime = SimpleNamespace(target=lambda: comp, shader_operator=lambda _: native,
                    core=lambda: core, state=lambda: {'graph': graph},
                    deploy=lambda candidate, revision: deployed.append(copy.deepcopy(candidate)) or {'ok': True})
                seen = {'enabled': True, 'revision': 5}
                with patch.object(sources, 'snapshot', return_value=seen), patch.object(sources, 'native_rows', return_value=[]):
                    sources.edit(runtime, {'action': 'create', 'revision': 5, 'name': 'uValue', 'type': ty})
                declaration = deployed[0]['declarations'][0]
                core.literal(declaration['value'], ty)
                values = declaration['value'] if isinstance(declaration['value'], list) else [declaration['value']]
                if core.TYPE_DESCRIPTORS[ty]['family'] == 'bool':
                    self.assertTrue(all(type(v) is bool for v in values))
                elif core.TYPE_DESCRIPTORS[ty]['family'] in ('int', 'uint'):
                    self.assertTrue(all(type(v) is int for v in values))

    def test_custom_controls_keep_integer_ranges(self):
        class Page:
            def appendInt(self, name, **kwargs):
                return [SimpleNamespace() for _ in range(kwargs.get('size', 1))]
        comp = SimpleNamespace(parGroup=SimpleNamespace(), pars=lambda _: [])
        for ty, low, high, count in [('int', -2147483648, 2147483647, 1), ('uvec4', 0, 4294967295, 4), ('bvec3', 0, 1, 3)]:
            group = parameters.create_group(comp, Page(), 'Value', ty)
            self.assertEqual(len(group), count)
            for p in group:
                self.assertEqual((p.min, p.max, p.clampMin, p.clampMax), (low, high, True, True))


if __name__ == '__main__':
    unittest.main()
