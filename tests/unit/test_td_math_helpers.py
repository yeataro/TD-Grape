"""TD helper wrappers keep types, defaults and constant-expression rules explicit."""
import copy
import json
from pathlib import Path
import subprocess
import unittest

import sgrape_core as c


KEYS = ('rgb_to_hsv', 'hsv_to_rgb', 'remap', 'range_from', 'range_to', 'loop', 'zigzag')
HELPERS = ('rgb_to_hsv', 'hsv_to_rgb', 'remap', 'loop', 'zigzag')


def graph_for(key, ty='float', target='top', stage='pixel'):
    graph = c.demo_graph('color', target)
    graph['declarations'] = []
    operation = c.node(key, 'operation', **({'type': ty} if key not in KEYS[:2] else {}))
    # Length gives all result types a common scalar consumer.
    output_type = 'vec3' if key in KEYS[:2] else ty
    graph['stages'][stage] = {
        'nodes': [operation, c.node('length', 'reduce', type=output_type), c.node(stage + '_out', 'result')],
        'edges': [c.edge('operation', 'reduce', 'value'), c.edge('reduce', 'result', 'color' if stage == 'pixel' else 'position')],
    }
    return graph


class TDMathHelpers(unittest.TestCase):
    def test_types_targets_stages_and_json_roundtrip(self):
        for key in KEYS:
            for ty in (('vec3',) if key in KEYS[:2] else c.FLOAT_TYPES):
                for target, stage in [('top', 'pixel'), ('mat', 'pixel'), ('mat', 'vertex')]:
                    with self.subTest(key=key, type=ty, target=target, stage=stage):
                        graph = graph_for(key, ty, target, stage)
                        before = copy.deepcopy(graph)
                        compiled = c.compile_graph(graph)
                        self.assertEqual(graph, before)
                        self.assertEqual(compiled, c.compile_graph(json.loads(json.dumps(graph))))
                        self.assertEqual(compiled['stages'][stage]['ports']['operation']['out'], {'out': ty})
                        self.assertIn('sg_n_operation', compiled[stage])

    def test_fixed_color_ports_reject_other_vector_widths(self):
        contract = c.type_contract()['definitions']
        for key, port in [('rgb_to_hsv', 'rgb'), ('hsv_to_rgb', 'hsv')]:
            self.assertEqual(contract[c.CATALOG[key]['definitionUuid']]['selector'], 'fixed')
            graph = graph_for(key, 'vec3')
            graph['stages']['pixel']['nodes'].append(c.node('vec4', 'rgba'))
            graph['stages']['pixel']['edges'].append(c.edge('rgba', 'operation', port))
            with self.assertRaisesRegex(c.GraphError, 'vec4 cannot connect to vec3'):
                c.compile_graph(graph)

    def test_scalar_td_calls_vector_component_calls_and_guarded_range(self):
        for key, function in [('loop', 'TDLoop'), ('zigzag', 'TDZigZag')]:
            for ty in c.FLOAT_TYPES:
                code = c.compile_graph(graph_for(key, ty))['pixel']
                self.assertEqual(code.count(function + '('), c.type_components(ty))
                if ty != 'float':
                    for component in 'xyzw'[:c.type_components(ty)]:
                        self.assertIn(').' + component, code)
        for ty in c.FLOAT_TYPES:
            graph = graph_for('range_from', ty)
            graph['stages']['pixel']['nodes'][0]['inputValues'] = {
                'value': c.filled_value(ty, .8), 'min': c.filled_value(ty, .5), 'max': c.filled_value(ty, .5)}
            code = c.compile_graph(graph)['pixel']
            self.assertEqual(code.count(' != '), c.type_components(ty))
            self.assertNotIn('TDRemap', code)
            self.assertNotIn('clamp(', code)
            self.assertEqual(c.compile_graph(graph_for('remap', ty))['pixel'].count('TDRemap('), 1)

    def test_range_formulas_are_constants_but_td_calls_never_are(self):
        for key in KEYS:
            for ty in (('vec3',) if key in KEYS[:2] else c.FLOAT_TYPES):
                graph = graph_for(key, ty)
                graph['stages']['pixel']['nodes'][0]['params']['requireConstant'] = True
                with self.subTest(key=key, type=ty):
                    if key in HELPERS:
                        self.assertNotIn(key, c.CONSTANT_EXPRESSIONS)
                        with self.assertRaisesRegex(c.GraphError, 'Require Constant'):
                            c.compile_graph(graph)
                    else:
                        self.assertIn('const ' + ty + ' sg_n_operation', c.compile_graph(graph)['pixel'])
                        graph['declarations'] = [{'id': 'value', 'kind': 'uniform', 'name': 'uValue', 'type': ty, 'value': c.filled_value(ty, .5)}]
                        graph['stages']['pixel']['nodes'].append(c.node('uniform', 'source', declarationId='value'))
                        graph['stages']['pixel']['edges'].append(c.edge('source', 'operation', 'value'))
                        with self.assertRaisesRegex(c.GraphError, 'Require Constant'):
                            c.compile_graph(graph)

if __name__ == '__main__':
    unittest.main()
