import copy
import ast
import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import sgrape_core as c
import sgrape_document as document
import frontend_artifact as receiver


class FrontendArtifactTests(unittest.TestCase):
    def runtime(self, saved):
        live = {'raw': json.dumps(saved)}
        dats = {'document': SimpleNamespace(module=document), 'frontend_artifact': SimpleNamespace(module=receiver),
                'frontend_capabilities': SimpleNamespace(text=json.dumps(receiver.capabilities()))}
        scope = dict(json=json, _owner=SimpleNamespace(id=1, op=dats.get), _shader=SimpleNamespace(id=2),
                     _graph_checks=None, _graph_provider_state=None, _frontend_request=None,
                     core=lambda: c, saved_state_source=lambda: live['raw'])
        path = Path(__file__).resolve().parents[2] / 'src/td/runtime/sgrape_runtime.py'
        functions = [n for n in ast.parse(path.read_text(encoding='utf-8')).body if isinstance(n, ast.FunctionDef)
                     and n.name in ('frontend_receiver', 'compile_runtime_graph', 'graph_checks')]
        exec(compile(ast.Module(body=functions, type_ignores=[]), str(path), 'exec'), scope)
        return scope, live

    def setUp(self):
        self.graph = c.demo_graph('color', 'top')
        self.graph['topInputs'] = []; self.graph['functions'] = []
        self.graph['declarations'] = [dict(id='gain', name='uGain', kind='uniform', type='float', value=.25, expose=False)]
        self.graph['stages']['pixel'] = dict(nodes=[c.node('uniform', 'gain', declarationId='gain'), c.node('pixel_out', 'out')], edges=[c.edge('gain', 'out', 'color')])
        self.graph = document.stamp_catalog(self.graph, c)
        self.result = c.compile_graph(self.graph)
        self.payload = dict(protocol=receiver.PROTOCOL, targetId='target', baseRevision=7,
                            snapshot=json.dumps(self.graph), catalogHash=c.catalog_contract()['hash'], compiled=self.result)

    def test_receive_and_reopen_do_not_emit_or_alias_the_document(self):
        before = copy.deepcopy(self.graph)
        with patch.object(c, 'compile_graph', side_effect=AssertionError('Python emitter used')):
            artifact = receiver.receive(self.graph, self.payload, 'target', 7, c)
            compiled = receiver.checked_artifact(self.graph, artifact, c)
            state = receiver.remember(dict(graph=self.graph, revision=8), compiled)
            reopened = receiver.checked_artifact(state['graph'], state['frontendArtifact'], c)
            self.assertEqual(reopened['pixel'], self.result['pixel'])
            compiled['bindings'][0]['value'] = 123
            self.assertEqual(self.graph, before)
            checks = document.GraphChecks(c, lambda graph: receiver.checked_artifact(graph, artifact, c))
            self.assertEqual(checks.saved(json.dumps(state), 'top')['status'], 'valid')

    def test_wrong_target_revision_snapshot_protocol_catalog_are_rejected(self):
        for field, value in [('targetId', 'other'), ('baseRevision', 6), ('baseRevision', True),
                             ('snapshot', '{}'), ('protocol', 'future'), ('catalogHash', 'stale')]:
            with self.subTest(field=field, value=value):
                payload = copy.deepcopy(self.payload); payload[field] = value
                with self.assertRaises(ValueError): receiver.receive(self.graph, payload, 'target', 7, c)

    def test_binding_cannot_override_native_metadata_or_add_another_source(self):
        for field, value in [('name', 'different'), ('type', 'samplerBuffer'), ('value', True),
                             ('initialDriver', 'arbitrary'), ('nativeSequence', 'matrix')]:
            with self.subTest(field=field):
                payload = copy.deepcopy(self.payload); payload['compiled']['bindings'][0][field] = value
                with self.assertRaises(ValueError): receiver.receive(self.graph, payload, 'target', 7, c)

    def test_stored_artifact_is_tied_to_semantics_but_allows_layout(self):
        artifact = receiver.receive(self.graph, self.payload, 'target', 7, c)
        moved = copy.deepcopy(self.graph); moved['stages']['pixel']['nodes'][0]['ui']['x'] += 20
        self.assertEqual(receiver.checked_artifact(moved, artifact, c)['pixel'], self.result['pixel'])
        moved['declarations'][0]['value'] = .75
        with self.assertRaisesRegex(ValueError, 'snapshot'): receiver.checked_artifact(moved, artifact, c)

    def test_legacy_result_drops_old_proof_and_provider_invalidation_is_explicit(self):
        state = receiver.remember(dict(graph=self.graph, frontendArtifact={'old': True}), self.result)
        self.assertNotIn('frontendArtifact', state)
        calls = []
        def provider(graph): calls.append(True); return self.result
        checks = document.GraphChecks(c, provider)
        checks.compile(self.graph); checks.compile(self.graph)
        self.assertEqual(len(calls), 1)
        checks.invalidate(); checks.compile(self.graph)
        self.assertEqual(len(calls), 2)

    def test_semantic_hash_cannot_hide_unsupported_annotation_edits(self):
        artifact = receiver.receive(self.graph, self.payload, 'target', 7, c)
        changed = copy.deepcopy(self.graph)
        changed['stages']['pixel']['nodes'].append(c.node('generated_glsl', 'codeView'))
        self.assertEqual(receiver.graph_hash(changed, c), artifact['graphHash'])
        self.assertNotEqual(receiver.input_hash(changed, c), artifact['inputHash'])
        with self.assertRaisesRegex(ValueError, 'input snapshot'):
            receiver.checked_artifact(changed, artifact, c)

    def test_compiler_update_reopens_saved_work_without_relabeling_or_python_emission(self):
        artifact = receiver.receive(self.graph, self.payload, 'target', 7, c)
        artifact['catalogHash'] = '0' * 64
        saved = dict(graph=self.graph, revision=7, frontendArtifact=artifact)
        scope, live = self.runtime(saved)
        original = live['raw']
        with patch.object(c, 'compile_graph', side_effect=AssertionError('Python emitter used')):
            checked = scope['graph_checks']().saved(live['raw'], 'top')
            self.assertEqual(checked['status'], 'valid', checked['issues'])
            compiled = scope['graph_checks']().compile(self.graph)
            self.assertEqual(compiled['pixel'], self.result['pixel'])
            self.assertEqual(compiled['frontendCatalogHash'], artifact['catalogHash'])
            remembered = receiver.remember(saved, compiled)
            self.assertEqual(remembered['graph'], saved['graph'])
            self.assertEqual(remembered['frontendArtifact']['catalogHash'], artifact['catalogHash'])
            self.assertEqual(remembered['frontendArtifact']['compiled']['pixel'], artifact['compiled']['pixel'])
            self.assertEqual(live['raw'], original)
            # New transport and in-flight artifacts remain tied to this catalog.
            with self.assertRaisesRegex(ValueError, 'catalog changed'):
                receiver.receive(self.graph, {**self.payload, 'catalogHash': artifact['catalogHash']}, 'target', 7, c)
            scope['_frontend_request'] = artifact
            scope['graph_checks']().invalidate()
            with self.assertRaisesRegex(ValueError, 'catalog changed'):
                scope['graph_checks']().compile(self.graph)

    def test_saved_older_producer_does_not_bypass_document_binding_or_protocol_checks(self):
        artifact = receiver.receive(self.graph, self.payload, 'target', 7, c)
        artifact['catalogHash'] = '0' * 64
        scope, live = self.runtime(dict(graph=self.graph, revision=7, frontendArtifact=artifact))
        with patch.object(c, 'compile_graph', side_effect=AssertionError('Python emitter used')):
            for field, value in [('protocol', 'unknown'), ('graphHash', 'wrong'), ('catalogHash', None)]:
                damaged = copy.deepcopy(artifact); damaged[field] = value
                live['raw'] = json.dumps(dict(graph=self.graph, revision=7, frontendArtifact=damaged))
                with self.subTest(field=field):
                    self.assertEqual(scope['graph_checks']().saved(live['raw'], 'top')['status'], 'blocked')
            damaged = copy.deepcopy(artifact); damaged['compiled']['bindings'][0]['value'] = 123
            live['raw'] = json.dumps(dict(graph=self.graph, revision=7, frontendArtifact=damaged))
            self.assertEqual(scope['graph_checks']().saved(live['raw'], 'top')['status'], 'blocked')

    def test_runtime_cache_revalidates_external_dat_changes_and_target_switches(self):
        artifact = receiver.receive(self.graph, self.payload, 'target', 7, c)
        saved = dict(graph=self.graph, revision=7, frontendArtifact=artifact)
        live = {'raw': json.dumps(saved)}
        caps = SimpleNamespace(text=json.dumps(receiver.capabilities()))
        dats = {'document': SimpleNamespace(module=document), 'frontend_artifact': SimpleNamespace(module=receiver), 'frontend_capabilities': caps}
        scope = dict(json=json, _owner=SimpleNamespace(id=1, op=dats.get), _shader=SimpleNamespace(id=2),
                     _graph_checks=None, _graph_provider_state=None, _frontend_request=None,
                     core=lambda: c, saved_state_source=lambda: live['raw'])
        path = Path(__file__).resolve().parents[2] / 'src/td/runtime/sgrape_runtime.py'
        module = ast.parse(path.read_text(encoding='utf-8'))
        functions = [n for n in module.body if isinstance(n, ast.FunctionDef) and n.name in ('frontend_receiver', 'compile_runtime_graph', 'graph_checks')]
        exec(compile(ast.Module(body=functions, type_ignores=[]), str(path), 'exec'), scope)
        def read(): return scope['graph_checks']().saved(live['raw'], 'top')
        with patch.object(c, 'compile_graph', side_effect=AssertionError('Python emitter used')):
            self.assertEqual(read()['status'], 'valid')
            corrupted = copy.deepcopy(saved); corrupted['frontendArtifact']['protocol'] = 'corrupt'
            live['raw'] = json.dumps(corrupted)
            self.assertEqual(read()['status'], 'blocked')
            live['raw'] = json.dumps(saved)
            self.assertEqual(read()['status'], 'valid')
            scope['_shader'] = SimpleNamespace(id=3)
            other = copy.deepcopy(saved); other['frontendArtifact']['compiled']['pixel'] += '// other target\n'
            live['raw'] = json.dumps(other)
            self.assertEqual(read()['status'], 'valid')
            self.assertTrue(scope['graph_checks']().compile(self.graph)['pixel'].endswith('// other target\n'))


if __name__ == '__main__': unittest.main()
