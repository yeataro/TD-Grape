"""Real frontend artifacts and independently updated host editing documents."""
import copy
import json
import unittest

import host_artifact
import host_document
import test_host_artifact as fixture


class HostDocumentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixture.HostArtifactTests.setUpClass()

    def setUp(self):
        actual = copy.deepcopy(fixture.HostArtifactTests.actual)
        self.candidate = dict(actual, protocol=host_artifact.PROTOCOL, targetId='target',
                              baseRevision=0, catalogHash='a' * 64)
        self.state = host_document.create(self.candidate)

    def test_native_change_does_not_relabel_old_glsl(self):
        edited = copy.deepcopy(self.state['graph'])
        edited['declarations'][0]['name'] = 'uRenamedInTD'
        updated = host_document.update(self.state, edited)
        restored = host_document.restore(host_document.serialize(updated), target_id='target')
        self.assertEqual(restored['revision'], 2)
        self.assertEqual(restored['graph']['declarations'][0]['name'], 'uRenamedInTD')
        self.assertEqual(restored['applied'], self.state['applied'])
        self.assertEqual(restored['applied']['revision'], 1)
        self.assertEqual(self.state['graph']['declarations'][0]['name'], 'uGain')

    def test_drafts_are_preserved_without_being_applied(self):
        edited = copy.deepcopy(self.state['graph'])
        edited['stages']['pixel']['nodes'][0]['definitionUuid'] = 'unavailable.node'
        edited['stages']['pixel']['edges'][0]['to'] = ['missing', 'port']
        updated = host_document.update(self.state, edited)
        restored = host_document.restore(host_document.serialize(updated), target_id='target')
        self.assertEqual(restored['graph'], edited)
        self.assertEqual(restored['applied'], self.state['applied'])
        with self.assertRaisesRegex(ValueError, 'revision conflict'):
            host_document.accept(updated, self.candidate)

    def test_applied_artifact_remains_validated_even_with_resealed_outer_document(self):
        changed = copy.deepcopy(self.state)
        changed['applied']['graph']['declarations'][0]['value'] = .9
        with self.assertRaisesRegex(ValueError, 'saved graph/artifact changed'):
            host_document.serialize(changed)
        with self.assertRaisesRegex(ValueError, 'target mismatch'):
            host_document.restore(host_document.serialize(self.state), target_id='other')
        saved = json.loads(host_document.serialize(self.state))
        saved['graph']['declarations'][0]['value'] = .9
        with self.assertRaisesRegex(ValueError, 'saved editing document changed'):
            host_document.restore(json.dumps(saved), target_id='target')

    def test_invalid_envelopes_cannot_replace_retained_data(self):
        for change in [lambda g:g.update(schemaVersion=True), lambda g:g.update(declarations={}),
                       lambda g:g['declarations'].append(copy.deepcopy(g['declarations'][0])),
                       lambda g:g['stages']['pixel'].update(nodes=None)]:
            graph = copy.deepcopy(self.state['graph'])
            change(graph)
            with self.assertRaises(ValueError):
                host_document.update(self.state, graph)
        self.assertEqual(self.state, host_document.restore(host_document.serialize(self.state), target_id='target'))


if __name__ == '__main__':
    unittest.main()
