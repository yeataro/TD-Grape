"""TD noise wrappers preserve dimensions and runtime/constant boundaries."""
import copy
import json
from pathlib import Path
import re
import subprocess
import unittest

import sgrape_core as c


ROOT = Path(__file__).resolve().parents[2]
HELPERS = {'perlin_noise': 'TDPerlinNoise', 'simplex_noise': 'TDSimplexNoise'}


def noise_graph(key, ty='vec2', target='top', stage='pixel', connected=False):
    graph = c.demo_graph('color', target)
    graph['declarations'] = []
    noise = c.node(key, 'noise', type=ty)
    nodes = [noise, c.node(stage + '_out', 'result')]
    edges = [c.edge('noise', 'result', 'color' if stage == 'pixel' else 'position')]
    if connected:
        nodes.append(c.node(ty, 'coordinates', value=[.173, -2.41, 3.19, 1.57][:c.type_components(ty)]))
        edges.append(c.edge('coordinates', 'noise', 'position'))
    graph['stages'][stage] = {'nodes': nodes, 'edges': edges}
    return graph


class NoiseNodes(unittest.TestCase):
    def test_dimensions_default_and_connected_coordinates_across_stages(self):
        for key, helper in HELPERS.items():
            for target, stage in [('top', 'pixel'), ('mat', 'pixel'), ('mat', 'vertex')]:
                for ty in ('vec2', 'vec3', 'vec4'):
                    for connected in (False, True):
                        with self.subTest(key=key, target=target, stage=stage, type=ty, connected=connected):
                            graph = noise_graph(key, ty, target, stage, connected)
                            before = copy.deepcopy(graph)
                            result = c.compile_graph(graph)
                            self.assertEqual(graph, before)
                            self.assertEqual(result, c.compile_graph(json.loads(json.dumps(graph))))
                            argument = 'sg_n_coordinates' if connected else c.literal(c.filled_value(ty), ty)
                            self.assertIn('float sg_n_noise = ' + helper + '(' + argument + ');', result[stage])
                            self.assertNotIn('const float sg_n_noise', result[stage])
                            self.assertEqual(result['stages'][stage]['ports']['noise'], {'in': {'position': ty}, 'out': {'out': 'float'}})

    def test_no_scalar_overload_and_no_silent_vector_resize(self):
        for key in HELPERS:
            for ty in ['float', 'int', 'uint', 'bool', 'sampler2D', 'vec5']:
                with self.subTest(key=key, type=ty), self.assertRaises(c.GraphError):
                    c.compile_graph(noise_graph(key, ty))
            graph = noise_graph(key, 'vec2', connected=True)
            source = graph['stages']['pixel']['nodes'][-1]
            source.update(c.node('vec3', 'coordinates', value=[.1, .2, .3]))
            with self.assertRaisesRegex(c.GraphError, 'vec3 cannot connect to vec2'):
                c.compile_graph(graph)
            # Shared scalar-to-vector conversion is explicit, never a float helper overload.
            source.update(c.node('float', 'coordinates', value=.173))
            self.assertIn(HELPERS[key] + '(vec2(sg_n_coordinates))', c.compile_graph(graph)['pixel'])

    def test_saved_coordinates_and_wire_precedence(self):
        for key, helper in HELPERS.items():
            graph = noise_graph(key, 'vec3', connected=True)
            noise = graph['stages']['pixel']['nodes'][0]
            noise['inputValues'] = {'position': [.5, .7, .9]}
            self.assertIn(helper + '(sg_n_coordinates)', c.compile_graph(graph)['pixel'])
            graph['stages']['pixel']['edges'].pop()
            self.assertIn(helper + '(vec3(0.5, 0.7, 0.9))', c.compile_graph(graph)['pixel'])

    def test_noise_and_dependent_math_cannot_be_required_constant(self):
        for key in HELPERS:
            graph = noise_graph(key)
            noise = graph['stages']['pixel']['nodes'][0]
            noise['params']['requireConstant'] = True
            with self.assertRaisesRegex(c.GraphError, 'Require Constant'):
                c.compile_graph(graph)
            del noise['params']['requireConstant']
            graph['stages']['pixel']['nodes'].append(c.node('add', 'plus', requireConstant=True))
            graph['stages']['pixel']['edges'] = [c.edge('noise', 'plus', 'a'), c.edge('plus', 'result', 'color')]
            with self.assertRaisesRegex(c.GraphError, 'Require Constant'):
                c.compile_graph(graph)
            self.assertNotIn(key, c.type_contract()['constantExpressions'])

    def test_catalog_and_shipped_browser_projection(self):
        catalog = json.loads((ROOT / 'src/library/node_catalog.json').read_text('utf-8'))
        html = (ROOT / 'src/editor/index.html').read_text('utf-8')
        metadata = json.loads(re.search(r'<script id="node-browser-data" type="application/json">(.*?)</script>', html, re.S)[1])
        locale = json.loads((ROOT / 'src/editor/locales.json').read_text('utf-8'))
        for key in HELPERS:
            row = next(row for row in catalog['definitions'] if row['definition']['key'] == key)
            definition = row['definition']
            self.assertEqual(definition['revisionHash'], c.digest({k: v for k, v in definition.items() if k != 'revisionHash'}))
            self.assertEqual(metadata['nodes'][definition['definitionUuid']], row['browser'])
            self.assertEqual(row['browser']['source'], 'td')
            self.assertIn(HELPERS[key], row['browser']['aliases'])
            variants = c.type_contract()['definitions'][definition['definitionUuid']]['variants']
            self.assertEqual([v['type'] for v in variants], ['vec2', 'vec3', 'vec4'])
            for language in locale['languages']:
                self.assertTrue(locale['messages']['help.' + key][language])
                self.assertTrue(locale['messages']['noise.position'][language])

    def test_javascript_auto_type_transactions(self):
        payload = {'catalog': list(c.CATALOG.values()), 'contract': c.type_contract()}
        result = subprocess.run(['node', str(ROOT / 'tests/unit/test_noise_nodes.js')], input=json.dumps(payload), text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        for graph in json.loads(result.stdout)['graphs']:
            c.compile_graph(graph)


if __name__ == '__main__':
    unittest.main(verbosity=2)
