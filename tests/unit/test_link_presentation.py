"""Link styles are saved presentation, never Shader semantics."""
import copy
import json
import unittest

import sgrape_core as core
import sgrape_document as document
import sgrape_library as library


class LinkPresentation(unittest.TestCase):
    def test_stage_style_roundtrip_and_shader_stability(self):
        for target in ('top', 'mat'):
            graph = core.demo_graph('color', target=target)
            before = core.compile_graph(graph)
            for data in graph['stages'].values():
                for edge in data['edges']:
                    edge['ui'] = {'style': 'link'}
            saved = copy.deepcopy(graph)
            self.assertEqual(core.compile_graph(graph), before)
            report = document.inspect_document(json.loads(json.dumps(graph)), core, target)
            self.assertEqual(report['status'], 'valid')
            self.assertEqual(report['candidate'], saved)
            self.assertEqual(graph, saved)

    def test_function_and_library_styles_survive_without_hash_change(self):
        graph = core.demo_graph('color')
        graph['functions'] = core.function_library()
        before = core.compile_graph(graph)
        for fn in graph['functions']:
            for edge in fn['graph']['edges']:
                edge['ui'] = {'style': 'link'}
        self.assertEqual(core.compile_graph(graph), before)
        packet = library.build(core, graph, graph['functions'][0]['id'])
        imported = library.entry(core, json.loads(json.dumps(packet)))
        self.assertEqual(imported['graph']['edges'], graph['functions'][0]['graph']['edges'])


if __name__ == '__main__':
    unittest.main()
