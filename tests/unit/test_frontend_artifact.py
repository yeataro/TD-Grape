import copy
import json
import unittest
from unittest.mock import patch
import sgrape_core as c
import sgrape_document as document
import frontend_artifact as receiver


class FrontendArtifactTests(unittest.TestCase):
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


if __name__ == '__main__': unittest.main()
