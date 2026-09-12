import copy
import unittest
import sgrape_core as c
import sgrape_document as d


class DocumentTests(unittest.TestCase):
    def inspect(self, graph, kind='mat'):
        before = copy.deepcopy(graph)
        report = d.inspect_document(graph, c, kind)
        self.assertEqual(graph, before)
        return report

    def test_valid_roundtrip_and_target(self):
        for kind in ('mat', 'top'):
            graph = c.demo_graph('tint', target=kind)
            result = self.inspect(graph, kind)
            self.assertEqual(result['status'], 'valid')
            self.assertEqual(result['candidate'], graph)
            self.assertIsNot(result['candidate'], graph)
        self.assertEqual(self.inspect(c.demo_graph(), 'top')['status'], 'blocked')

    def test_dangling_edge_proposed_without_overwriting_source(self):
        graph = c.demo_graph('color')
        graph['stages']['pixel']['edges'].append(c.edge('missing', 'pixel', 'color'))
        result = self.inspect(graph)
        self.assertEqual(result['status'], 'repairable')
        self.assertEqual(result['repairs'][0]['code'], 'edge')
        self.assertEqual(result['candidate']['stages']['pixel']['edges'], c.demo_graph('color')['stages']['pixel']['edges'])

    def test_known_missing_port_and_bad_position(self):
        graph = c.demo_graph('color')
        graph['stages']['pixel']['nodes'][0]['ui'] = {'x': 'broken', 'y': 1}
        graph['stages']['pixel']['edges'][0]['from'][1] = 'gone'
        result = self.inspect(graph)
        self.assertEqual(result['status'], 'repairable')
        self.assertEqual({r['code'] for r in result['repairs']}, {'position', 'edge'})

    def test_duplicates_and_unknown_definitions_retain_edges(self):
        for change in ('duplicate', 'unknown'):
            graph = c.demo_graph('color')
            if change == 'duplicate': graph['stages']['pixel']['nodes'].append(copy.deepcopy(graph['stages']['pixel']['nodes'][0]))
            else: graph['stages']['pixel']['nodes'][0]['definitionUuid'] = 'missing.catalog.entry'
            result = self.inspect(graph)
            self.assertEqual(result['status'], 'blocked')
            self.assertIsNone(result['candidate'])
            self.assertFalse(any(r['code'] == 'edge' for r in result['repairs']))

    def test_cycle_and_type_mismatch_are_not_repaired(self):
        graph = c.demo_graph('color')
        graph['stages']['pixel']['nodes'] += [c.node('add', 'a'), c.node('add', 'b')]
        graph['stages']['pixel']['edges'] += [c.edge('a', 'b', 'a'), c.edge('b', 'a', 'a')]
        self.assertEqual(self.inspect(graph)['status'], 'blocked')
        graph = c.demo_graph('color'); graph['stages']['pixel']['nodes'][0] = c.node('vec3', 'color')
        self.assertEqual(self.inspect(graph)['status'], 'blocked')

    def test_local_function_repair_but_source_snapshot_is_readonly(self):
        graph = c.demo_graph('color'); function = c.function_library()[1]
        function['graph']['edges'].append(c.edge('missing', 'output', 'color'))
        graph['functions'] = [function]
        self.assertEqual(self.inspect(graph)['status'], 'blocked')
        function['scope'] = 'local'; function.pop('source')
        result = self.inspect(graph)
        self.assertEqual(result['status'], 'repairable')
        self.assertTrue(result['repairs'][0]['path'].startswith('Function/'))

    def test_newer_malformed_and_absent_declarations(self):
        graph = c.demo_graph('color'); graph['schemaVersion'] = 99
        self.assertEqual(self.inspect(graph)['status'], 'newer')
        for malformed in (None, [], {'schemaVersion': True}, {'schemaVersion': 1, 'stages': None}):
            self.assertEqual(self.inspect(malformed)['status'], 'blocked')
        graph = c.demo_graph('color'); graph.pop('declarations')
        self.assertEqual(self.inspect(graph)['status'], 'repairable')

    def test_malformed_details_never_return_a_candidate(self):
        for mutate in (lambda g: g.update(declarations=None), lambda g: g.update(functions=[None]), lambda g: g['stages']['pixel'].update(nodes=[None]), lambda g: g['stages']['pixel']['nodes'][0].update(params=None)):
            graph = c.demo_graph('color'); mutate(graph)
            result = self.inspect(graph)
            self.assertEqual(result['status'], 'blocked'); self.assertIsNone(result['candidate'])

    def test_archive_is_retained_and_not_executed(self):
        graph = c.demo_graph('color'); graph['archive'] = {'untrusted': {'global': '#error do not execute'}}
        result = self.inspect(graph)
        self.assertEqual(result['status'], 'valid')
        self.assertEqual(result['candidate']['archive'], graph['archive'])
        self.assertEqual(result['issues'][0]['code'], 'archive')


if __name__ == '__main__': unittest.main(verbosity=2)
