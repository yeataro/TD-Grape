"""Grape OP editing path (design-interview Q38, Q40, Q48): TD never reads the graph."""
import json
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

import host_api
from next_family import NextFamily, FORMAT, digest

TARGET = 'c' * 32
CATALOG = 'f' * 64


class Text:
    def __init__(self, text=''):
        self.text = text


class Comp:
    def __init__(self, stored):
        self.tags = {'grapeNativeFamily'}
        self.path = '/project1/next_test'
        self.ops = {'GrapeControls/document': Text(stored), 'GrapeControls/status': Text(),
                    'pixel_shader': Text('old glsl'), 'graph': Text()}

    def op(self, name):
        return self.ops.get(name)

    def fetch(self, key, default=None):
        return TARGET if key == 'sgrapeShaderId' else default


def runtime(pixel='void main(){}', bindings=()):
    return json.dumps({'vertex': '', 'pixel': pixel, 'bindings': list(bindings), 'sourceMap': {}, 'diagnostics': []})


def envelope(revision=3, document='{"a":1}', run=None):
    run = run or runtime('old glsl')
    return json.dumps({'format': FORMAT, 'targetId': TARGET,
        'document': {'revision': revision, 'text': document, 'sha256': digest(document)},
        'runtime': {'revision': revision, 'text': run, 'sha256': digest(run)},
        'lastKnownGood': {'revision': revision, 'document': document, 'runtime': run}})


def family(stored=None, gpu_ok=True):
    comp = Comp(stored if stored is not None else envelope())
    fam = NextFamily(comp)
    fam._validate = Mock(side_effect=None if gpu_ok else RuntimeError('GPU says no'))
    fam._verify_gpu = Mock()
    return fam, comp


def request(revision=3, document='{ "odd" :  [1, 2] }', run=None, **extra):
    return {'format': FORMAT, 'revision': revision, 'targetId': TARGET, 'catalogHash': CATALOG,
            'document': document, 'runtime': run, **extra}


class NextFamilyTests(unittest.TestCase):
    def test_state_returns_the_document_text_verbatim(self):
        fam, _ = family(envelope(document='{ "kept" : "as is" }'))
        self.assertEqual(fam.state()['document'], '{ "kept" : "as is" }')

    def test_damaged_document_is_refused(self):
        stored = json.loads(envelope()); stored['document']['text'] = '{"a":2}'
        fam, _ = family(json.dumps(stored))
        with self.assertRaisesRegex(ValueError, 'changed or damaged'):
            fam.state()

    def test_apply_pairs_glsl_and_bindings_and_stores_the_document_as_received(self):
        fam, comp = family()
        result = fam.apply(request(run=runtime('new glsl')), catalog_hash=CATALOG)
        self.assertEqual(comp.op('pixel_shader').text, 'new glsl')
        stored = json.loads(comp.op('GrapeControls/document').text)
        self.assertEqual(stored['document']['text'], '{ "odd" :  [1, 2] }')
        self.assertEqual((stored['document']['revision'], stored['runtime']['revision']), (4, 4))
        self.assertEqual(stored['lastKnownGood']['document'], '{ "odd" :  [1, 2] }')
        self.assertEqual(result['state']['revision'], 4)
        self.assertEqual(comp.op('graph').text, '{ "odd" :  [1, 2] }')

    def test_failed_code_generation_sends_document_only_and_keeps_the_last_known_good(self):
        fam, comp = family()
        fam.apply(request(run=None), catalog_hash=CATALOG)
        stored = json.loads(comp.op('GrapeControls/document').text)
        self.assertEqual((stored['document']['revision'], stored['runtime']['revision']), (4, 3))
        self.assertEqual(stored['lastKnownGood']['document'], '{"a":1}')
        self.assertEqual(comp.op('pixel_shader').text, 'old glsl')
        fam._validate.assert_not_called()

    def test_gpu_failure_restores_the_shader_and_changes_nothing(self):
        fam, comp = family(gpu_ok=False)
        before = comp.op('GrapeControls/document').text
        with self.assertRaisesRegex(RuntimeError, 'last known good'):
            fam.apply(request(run=runtime('bad glsl')), catalog_hash=CATALOG)
        self.assertEqual(comp.op('pixel_shader').text, 'old glsl')
        self.assertEqual(comp.op('GrapeControls/document').text, before)

    def test_envelope_checks(self):
        fam, _ = family()
        with self.assertRaisesRegex(RuntimeError, 'Conflict'):
            fam.apply(request(revision=2, run=runtime()), catalog_hash=CATALOG)
        with self.assertRaisesRegex(ValueError, 'target'):
            fam.apply({**request(run=runtime()), 'targetId': 'd' * 32}, catalog_hash=CATALOG)
        with self.assertRaisesRegex(RuntimeError, 'catalog'):
            fam.apply(request(run=runtime()), catalog_hash='e' * 64)
        with self.assertRaisesRegex(ValueError, '512 KB'):
            fam.apply(request(document='x' * 512001, run=runtime()), catalog_hash=CATALOG)

    def test_uniform_bindings_are_refused_until_migrated(self):
        fam, _ = family()
        with self.assertRaisesRegex(ValueError, 'not migrated'):
            fam.apply(request(run=runtime(bindings=[{'id': 'u'}])), catalog_hash=CATALOG)


class HostRoutingTests(unittest.TestCase):
    def api(self, fam):
        return host_api.HostAPI(bootstrap={'version': 1, 'producer': 'frontend-modules', 'catalogHash': CATALOG},
            resolve=lambda ident: fam if ident == TARGET else None,
            choices=lambda: {'shaders': [{'id': TARGET, 'path': '/nested/target'}], 'projectFile': 'test.toe'},
            save_project=Mock(return_value='x.toe'))

    def test_scoped_and_unscoped_grape_op_list_are_the_same(self):
        api = self.api(family()[0])
        self.assertEqual(api.dispatch('GET', '/api/' + TARGET + '/shaders'), api.dispatch('GET', '/api/shaders'))
        self.assertEqual(api.dispatch('GET', '/api/shaders')[1]['projectFile'], 'test.toe')

    def test_unknown_target_and_operation_are_explicit(self):
        api = self.api(family()[0])
        self.assertEqual(api.dispatch('GET', '/api/' + 'b' * 32 + '/state')[0], 404)
        code, result = api.dispatch('POST', '/api/' + TARGET + '/pixel-preview-session', {})
        self.assertEqual((code, result['code']), (501, 'capability_not_migrated'))

    def test_old_format_graph_is_refused_and_never_written(self):
        old = '{"schemaVersion": 1, "graph": {}}'
        fam, comp = family(stored=old)
        code, result = self.api(fam).dispatch('GET', '/api/' + TARGET + '/state')
        self.assertEqual((code, result['code']), (422, 'host_rejected'))
        self.assertIn('old-format graph', result['error'])
        code, _ = self.api(fam).dispatch('POST', '/api/' + TARGET + '/apply', request(run=runtime('g')))
        self.assertEqual(code, 422)
        self.assertEqual((comp.ops['GrapeControls/document'].text, comp.ops['pixel_shader'].text), (old, 'old glsl'))

    def test_state_and_apply(self):
        fam, _ = family()
        api = self.api(fam)
        code, result = api.dispatch('GET', '/api/' + TARGET + '/state')
        self.assertEqual((code, result['format'], result['state']['revision']), (200, FORMAT, 3))
        code, result = api.dispatch('POST', '/api/' + TARGET + '/apply', request(run=runtime('g')))
        self.assertEqual((code, result['state']['revision']), (200, 4))
        code, result = api.dispatch('POST', '/api/' + TARGET + '/apply', request(run=runtime('g')))
        self.assertEqual((code, result['code']), (409, 'revision_conflict'))


if __name__ == '__main__':
    unittest.main()
