"""Native GLSL math wrappers retain shared typing, defaults and const rules."""
import copy
import json
from pathlib import Path
import subprocess
import unittest

import sgrape_core as c


KEYS = ('sign', 'sqrt', 'floor', 'round', 'ceil', 'trunc', 'mod')


def graph_for(key, ty='float', target='top', stage='pixel', **params):
    graph = c.demo_graph('color', target)
    graph['declarations'] = []
    operation = c.node(key, 'operation', type=ty, **params)
    # Length also keeps all vector components live in the compiled stage.
    graph['stages'][stage] = dict(
        nodes=[operation, c.node('length', 'measure', type=ty), c.node(stage+'_out', 'result')],
        edges=[c.edge('operation', 'measure', 'value'),
               c.edge('measure', 'result', 'color' if stage == 'pixel' else 'position')])
    return graph


class BasicMathNodes(unittest.TestCase):
    def test_every_type_and_stage_uses_native_glsl_without_graph_mutation(self):
        for key in KEYS:
            for ty in c.FLOAT_TYPES:
                for target, stage in [('top', 'pixel'), ('mat', 'pixel'), ('mat', 'vertex')]:
                    with self.subTest(key=key, type=ty, target=target, stage=stage):
                        graph = graph_for(key, ty, target, stage)
                        before = copy.deepcopy(graph)
                        compiled = c.compile_graph(graph)
                        args = [c.literal(c.input_default(key, port, ty), ty)
                                for port in c.CATALOG[key]['inputs']]
                        self.assertIn(ty+' sg_n_operation = '+key+'('+', '.join(args)+');', compiled[stage])
                        self.assertEqual(compiled['stages'][stage]['ports']['operation']['out'], {'out': ty})
                        self.assertEqual(graph, before)
                        self.assertEqual(compiled, c.compile_graph(json.loads(json.dumps(graph))))

    def test_const_qualification_accepts_literals_but_rejects_runtime_inputs(self):
        for key in KEYS:
            graph = graph_for(key, requireConstant=True)
            self.assertIn('const float sg_n_operation = '+key+'(', c.compile_graph(graph)['pixel'])
            graph['declarations'] = [dict(id='value', kind='uniform', name='uValue', type='float', value=.25)]
            graph['stages']['pixel']['nodes'].append(c.node('uniform', 'runtime', declarationId='value'))
            port = next(iter(c.CATALOG[key]['inputs']))
            graph['stages']['pixel']['edges'].append(c.edge('runtime', 'operation', port))
            with self.subTest(key=key), self.assertRaisesRegex(c.GraphError, 'Require Constant'):
                c.compile_graph(graph)
            graph['stages']['pixel']['nodes'][0]['params'].pop('requireConstant')
            source = c.compile_graph(graph)['pixel']
            self.assertIn('sg_n_runtime', source)
            self.assertNotIn('const float sg_n_operation', source)

    def test_modulo_negative_inputs_are_not_rewritten_as_remainder(self):
        graph = graph_for('mod')
        operation = graph['stages']['pixel']['nodes'][0]
        operation['inputValues'] = {'a': -.25, 'b': 1}
        self.assertIn('mod(-0.25, 1.0)', c.compile_graph(graph)['pixel'])
        # Do not invent a zero-divisor fallback or a positive sqrt clamp.
        operation['inputValues']['b'] = 0
        self.assertIn('mod(-0.25, 0.0)', c.compile_graph(graph)['pixel'])
        graph = graph_for('sqrt')
        graph['stages']['pixel']['nodes'][0]['inputValues'] = {'value': -1}
        self.assertIn('sqrt(-1.0)', c.compile_graph(graph)['pixel'])

    def test_type_errors_remain_the_shared_numeric_contract(self):
        for key in KEYS:
            for ty in ('int', 'uint', 'bool', 'sampler2D', 'mat4'):
                if ty not in c.node_parameter_types(c.CATALOG[key]):
                    with self.subTest(key=key, type=ty), self.assertRaises(c.GraphError):
                        c.compile_graph(graph_for(key, ty))

    def test_ui_defaults_type_plans_undo_and_export_compile(self):
        root = Path(__file__).resolve().parents[2]
        payload = dict(catalog=list(c.CATALOG.values()), contract=c.type_contract(), keys=KEYS)
        run = subprocess.run(['node', str(root/'tests/unit/test_basic_math_nodes.js')],
                             input=json.dumps(payload), text=True, capture_output=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        for graph in json.loads(run.stdout)['graphs']:
            c.compile_graph(graph)


if __name__ == '__main__':
    unittest.main()
