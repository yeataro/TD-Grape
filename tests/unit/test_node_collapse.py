"""Node collapse is persisted layout metadata, independent of shader semantics."""
import copy
import json
from pathlib import Path
import subprocess
import unittest
import sgrape_core as c
import sgrape_document as document


def fixture():
    graph = c.normalize_top_sources(c.demo_graph('color', 'top'))[0]
    graph['topInputs'] = []; graph['declarations'] = []; graph['functions'] = []
    graph['stages']['pixel'] = {
        'nodes': [c.node('vec4', 'value', value=[.1, .2, .3, 1]), c.node('pixel_out', 'result')],
        'edges': [c.edge('value', 'result', 'color')],
    }
    graph['stages']['pixel']['nodes'][0]['ui'] = dict(x=24, y=48, width=460, componentsExpanded=True)
    return graph


class NodeCollapse(unittest.TestCase):
    def test_editor_history_copy_and_source_localization(self):
        root = Path(__file__).resolve().parents[2]
        payload = dict(catalog=list(c.CATALOG.values()), contract=c.type_contract(), graph=fixture(), function=c.function_library()[0])
        result = subprocess.run(['node', str(root / 'tests/unit/test_node_collapse.js')], input=json.dumps(payload), text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertTrue(output['passed']); self.assertEqual(len(output['checks']), 5)
        for pair in output['pairs']:
            self.assertEqual(c.clean_semantic(pair['before']), c.clean_semantic(pair['after']))
            self.assertEqual(c.compile_graph(pair['before'])['pixel'], c.compile_graph(pair['after'])['pixel'])

    def test_import_export_retains_layout_metadata(self):
        graph = fixture()
        for node in graph['stages']['pixel']['nodes']: node.setdefault('ui', {})['collapsed'] = True
        before = copy.deepcopy(graph)
        report = document.inspect_document(json.loads(json.dumps(graph)), c, 'top')
        self.assertEqual(report['status'], 'valid', report)
        value = next(n for n in report['candidate']['stages']['pixel']['nodes'] if n['id'] == 'value')
        self.assertEqual(value['ui'], before['stages']['pixel']['nodes'][0]['ui'])
        self.assertEqual(graph, before)
        self.assertEqual(c.compile_graph(report['candidate'])['pixel'], c.compile_graph(graph)['pixel'])


if __name__ == '__main__': unittest.main()
