import copy
import json
import unittest
from unittest.mock import patch
import sgrape_core as c
import sgrape_document as d


class GraphChecksTests(unittest.TestCase):
    def graph(self, kind='top'):
        return d.stamp_catalog(c.normalize_top_sources(c.demo_graph('tint', target=kind))[0], c)

    def test_layout_outputs_match_uncached_for_top_mat_and_function_bodies(self):
        for kind in ('top', 'mat'):
            graph = self.graph(kind)
            with patch.object(c, 'compile_graph', wraps=c.compile_graph) as compile:
                checks = d.GraphChecks(c)
                before = checks.compile(graph)
                moved = copy.deepcopy(graph)
                for data in [*moved['stages'].values(), *(f['graph'] for f in moved.get('functions', []))]:
                    for n in data['nodes']:
                        n.setdefault('ui', {}).update(x=124, y=-318, width=500, height=400, collapsed=True,
                            componentsExpanded=False, matrixColumnsExpanded=[None, True, False])
                self.assertEqual(checks.compile(moved), before)
                self.assertEqual(compile.call_count, 1)
                self.assertEqual(before, compile.__wrapped__(moved) if hasattr(compile, '__wrapped__') else compile._mock_wraps(moved))
                # Callers can mutate results without modifying cache entries.
                before['pixel'] = 'damaged'
                self.assertNotEqual(checks.compile(graph)['pixel'], 'damaged')

    def test_only_geometry_is_ignored_and_comments_refresh_code(self):
        graph = self.graph()
        with patch.object(c, 'compile_graph', wraps=c.compile_graph) as compile:
            checks = d.GraphChecks(c); checks.compile(graph)
            for key, value in [('label', 'Display label'), ('comment', 'New shader comment'), ('typeMode', 'fixed'), ('future', {'x': 1})]:
                changed = copy.deepcopy(graph)
                changed['stages']['pixel']['nodes'][0]['ui'][key] = value
                result = checks.compile(changed)
                self.assertEqual(result, compile._mock_wraps(changed))
            self.assertEqual(compile.call_count, 5)
            changed = copy.deepcopy(graph)
            changed['stages']['pixel']['nodes'][0]['params']['value'] = [0.2, 0.3, 0.4, 1]
            checks.compile(changed)
            self.assertEqual(compile.call_count, 6)

    def test_saved_cache_rechecks_external_text_target_and_damage(self):
        graph = self.graph()
        raw = json.dumps(dict(revision=7, graph=graph, appliedHash='preserved'))
        with patch.object(c, 'compile_graph', wraps=c.compile_graph) as compile:
            checks = d.GraphChecks(c)
            first = checks.saved(raw, 'top')
            first['state']['graph']['stages'] = {}
            self.assertEqual(checks.saved(raw, 'top')['state']['graph'], graph)
            self.assertEqual(compile.call_count, 1)
            changed = json.loads(raw); changed['graph']['stages']['pixel']['nodes'][0]['ui']['x'] += 3
            self.assertEqual(checks.saved(json.dumps(changed), 'top')['state'], changed)
            self.assertEqual(compile.call_count, 1)
            for bad in [raw.replace('"revision": 7', '"revision": true'), raw.replace('"revision": 7', '"revision": 7, "revision": 9'), '{broken', None, raw[:-1]+', "extra": NaN}']:
                self.assertEqual(checks.saved(bad, 'top')['status'], 'blocked')
            self.assertEqual(checks.saved(raw, 'mat')['status'], 'blocked')
            changed['graph']['stages']['pixel']['nodes'][0]['ui']['x'] = 'bad'
            self.assertEqual(checks.saved(json.dumps(changed), 'top')['status'], 'blocked')

    def test_contract_and_compiler_invalidation_and_one_check_per_session(self):
        graph = self.graph()
        with patch.object(c, 'compile_graph', wraps=c.compile_graph) as compile, patch.object(c, 'catalog_contract', wraps=c.catalog_contract) as contract:
            checks = d.GraphChecks(c)
            with checks.session():
                checks.compile(graph); checks.compile(graph)
            self.assertEqual(compile.call_count, 1); self.assertEqual(contract.call_count, 1)
            original = c._CATALOG_DOCUMENT['targetShellVersion']
            try:
                c._CATALOG_DOCUMENT['targetShellVersion'] += 1
                checks.compile(graph)
                self.assertEqual(compile.call_count, 2)
            finally:
                c._CATALOG_DOCUMENT['targetShellVersion'] = original
        # Swapping the compiler implementation also invalidates cached evidence.
        with patch.object(c, 'compile_graph', wraps=c.compile_graph) as replacement:
            checks.compile(graph)
            self.assertEqual(replacement.call_count, 1)

    def test_errors_never_cached_and_input_limits_are_preserved(self):
        graph = self.graph(); checks = d.GraphChecks(c); checks.compile(graph)
        for kind in ('cycle', 'nonfinite', 'size'):
            bad = copy.deepcopy(graph)
            if kind == 'cycle': bad['stages']['pixel']['edges'].append(c.edge('missing', 'pixel', 'color'))
            if kind == 'nonfinite': bad['stages']['pixel']['nodes'][0]['ui']['x'] = float('nan')
            if kind == 'size': bad['stages']['pixel']['nodes'][0]['ui']['matrixColumnsExpanded'] = [False] * 100000
            for _ in range(2):
                with self.assertRaises((ValueError, TypeError)): checks.compile(bad)
        self.assertEqual(len(checks._compiled), 1)

    def test_cache_bounds_and_no_cache_changes_no_output(self):
        checks = d.GraphChecks(c); checks.MAX_ENTRIES = 2
        graph = self.graph()
        for i in range(4):
            graph['stages']['pixel']['nodes'][0]['ui']['comment'] = str(i)
            self.assertEqual(checks.compile(graph), c.compile_graph(graph))
        self.assertEqual(len(checks._compiled), 2)
        checks.MAX_BYTES = 1
        graph['stages']['pixel']['nodes'][0]['ui']['comment'] = 'larger'
        self.assertEqual(checks.compile(graph), c.compile_graph(graph))


if __name__ == '__main__': unittest.main()
