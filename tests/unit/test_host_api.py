"""Compiler-free transport adapter regressions found during real editor integration."""
from contextlib import contextmanager
from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

import host_api
import host_artifact
import host_document
from native_family import NativeFamily

BOOTSTRAP = json.loads((Path(__file__).resolve().parents[2] / 'src/editor/editor-bootstrap.json').read_text(encoding='utf-8'))
TARGET = 'a' * 32


class HostAPITests(unittest.TestCase):
    def setUp(self):
        self.suppressed = False
        @contextmanager
        def native_writes():
            self.suppressed = True
            try:
                yield
            finally:
                self.suppressed = False
        self.family = SimpleNamespace(values=SimpleNamespace(history_native_writes=native_writes), sources=Mock())
        self.history = Mock()
        self.api = host_api.HostAPI(bootstrap=BOOTSTRAP, library={}, resolve=lambda ident:self.family if ident == TARGET else None,
            history=self.history, parameters=Mock(), validation_area=None, preview=Mock(),
            choices=lambda:{'shaders': [{'id': TARGET, 'path': '/nested/target'}], 'projectFile': 'test.toe'}, save_project=Mock())

    def route(self, method, action, body=None):
        return self.api.dispatch(method, '/api/' + TARGET + '/' + action, body)

    def test_scoped_and_unscoped_shader_picker_use_same_real_inventory(self):
        self.assertEqual(self.route('GET', 'shaders'), self.api.dispatch('GET', '/api/shaders'))
        self.assertEqual(self.route('GET', 'shaders')[1]['projectFile'], 'test.toe')

    def test_unavailable_capability_is_not_a_disconnected_editor(self):
        code, result = self.route('POST', 'pixel-preview-session', {})
        self.assertEqual((code, result['code']), (501, 'capability_not_migrated'))
        self.assertEqual(self.api.dispatch('GET', '/api/' + 'b' * 32 + '/state')[0], 404)

    def test_history_suppresses_only_td_global_capture_including_failure(self):
        def restore(family, body):
            self.assertTrue(self.suppressed)
            raise RuntimeError('Conflict: native value changed externally')
        self.history.restore.side_effect = restore
        self.assertEqual(self.route('POST', 'history-restore', {})[0], 409)
        self.assertFalse(self.suppressed)

    def test_native_failure_keeps_operation_context(self):
        self.family.sources.sync.side_effect = RuntimeError('Invalid native value')
        code, result = self.route('POST', 'source-value', {})
        self.assertEqual((code, result['operation'], result['layer']), (422, 'source-value', 'native-family'))
        self.assertIn('Invalid native value', result['error'])
        self.history.capture.assert_not_called()


class SourceTransactionTests(unittest.TestCase):
    def setUp(self):
        artifact = dict(deepcopy(BOOTSTRAP['defaultDocument']), catalogHash=BOOTSTRAP['catalogHash'],
            targetId=TARGET, protocol=host_artifact.PROTOCOL, baseRevision=0)
        self.state = host_document.create(artifact)
        self.sources = Mock()
        self.family = NativeFamily(None, artifact=host_artifact, document=host_document, sources=self.sources)
        self.family.state = lambda:self.state
        self.family.write_state = Mock()
        self.family.status = Mock()

    def test_restoring_one_missing_source_preserves_other_missing_sources(self):
        graph = deepcopy(self.state['graph'])
        graph['declarations'] = [dict(id='restored',kind='uniform',name='uRestored',type='float',value=0),
            dict(id='missing',kind='uniform',name='uMissing',type='float',value=0,sourceMissing=True)]
        self.family.configure_sources(graph, self.state['revision'])
        self.sources.configure.assert_called_once()
        self.assertTrue(self.family.write_state.call_args.args[0]['graph']['declarations'][1]['sourceMissing'])

    def test_save_and_rollback_errors_remain_independently_diagnosable(self):
        self.family.write_state.side_effect = RuntimeError('document save failed')
        self.sources.restore_configuration.side_effect = RuntimeError('native rollback failed')
        with self.assertRaisesRegex(RuntimeError, 'document save failed') as failure:
            self.family.configure_sources(self.state['graph'], self.state['revision'])
        self.assertEqual(failure.exception.rollback_errors, ['native parameters: native rollback failed'])
        self.assertEqual(self.family.status.call_args.args[0], 'rollback-failed')

    def test_successful_rollback_preserves_original_error(self):
        self.sources.configure.side_effect = RuntimeError('native write failed')
        with self.assertRaisesRegex(RuntimeError, 'native write failed'):
            self.family.configure_sources(self.state['graph'], self.state['revision'])
        self.sources.restore_configuration.assert_called_once()
        self.family.write_state.assert_not_called()


if __name__ == '__main__':
    unittest.main()
