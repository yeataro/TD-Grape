"""Grape OP editing path (design-interview Q38, Q40, Q48; grape-op-structure #4): TD never reads the graph.

`graph` holds the graph text (the one copy); `graph_meta` proves and runs it; `status` is for people."""
import json
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

import host_api
from next_family import NextFamily, FORMAT, META_FORMAT, digest

TARGET = 'c' * 32
CATALOG = 'f' * 64


class Text:
    def __init__(self, text=''):
        self.text = text


class Par:
    def __init__(self, value):
        self.value = value

    def eval(self):
        return self.value


class Comp:
    def __init__(self, stored, grape_id=TARGET):
        self.tags = {'grapeOP'}
        self.name = 'next_test'
        self.par = SimpleNamespace(Grapeid=Par(grape_id))
        self.path = '/project1/next_test'
        self.ops = {'status': Text(), 'pixel_shader': Text('old glsl')}
        if isinstance(stored, tuple):
            self.ops['graph'], self.ops['graph_meta'] = Text(stored[0]), Text(stored[1])
        else:  # an older layout kept in GrapeControls/document
            self.ops['GrapeControls/document'] = Text(stored)

    def op(self, name):
        return self.ops.get(name)



def runtime(pixel='void main(){}', bindings=()):
    return json.dumps({'vertex': '', 'pixel': pixel, 'bindings': list(bindings), 'sourceMap': {}, 'diagnostics': []})


def envelope(revision=3, document='{"a":1}', run=None, target=TARGET):
    # The stored pair: (graph text, graph_meta text).
    run = run or runtime('old glsl')
    return document, json.dumps({'format': META_FORMAT, 'targetId': target,
        'document': {'revision': revision, 'sha256': digest(document)},
        'runtime': {'revision': revision, 'text': run, 'sha256': digest(run), 'document': None}})


def meta(comp):
    return json.loads(comp.ops['graph_meta'].text)


def family(stored=None, gpu_ok=True):
    comp = Comp(stored if stored is not None else envelope())
    fam = NextFamily(comp)
    fam._validate = Mock(side_effect=None if gpu_ok else RuntimeError('GPU says no'))
    fam._verify_gpu = Mock()
    return fam, comp


def request(revision=3, document='{ "odd" :  [1, 2] }', run=None, **extra):
    return {'format': FORMAT, 'revision': revision, 'targetId': TARGET, 'catalogHash': CATALOG,
            'document': document, 'runtime': run, 'editorVersion': '9.9.9 Test', **extra}


class NextFamilyTests(unittest.TestCase):
    def test_state_returns_the_document_text_verbatim(self):
        fam, _ = family(envelope(document='{ "kept" : "as is" }'))
        self.assertEqual(fam.state()['document'], '{ "kept" : "as is" }')

    def test_a_copy_adopts_its_own_grape_id_without_touching_graph_or_shader(self):
        fam, comp = family(envelope(document='{"copied":true}', target='d' * 32))
        self.assertEqual(fam.state()['targetId'], TARGET)
        self.assertEqual((meta(comp)['targetId'], comp.ops['graph'].text, comp.ops['pixel_shader'].text),
                         (TARGET, '{"copied":true}', 'old glsl'))
        self.assertEqual(json.loads(comp.ops['status'].text)['previousTargetId'], 'd' * 32)

    def test_a_grape_op_without_an_id_is_not_opened(self):
        comp = Comp(envelope(), grape_id='')
        with self.assertRaisesRegex(ValueError, 'no Grape ID'):
            NextFamily(comp).state()

    def test_a_hand_edited_graph_is_refused_and_never_overwritten(self):
        fam, comp = family(envelope())
        comp.ops['graph'].text = '{"a":2}'  # someone edits the graph DAT in TD
        with self.assertRaisesRegex(ValueError, 'changed by hand'):
            fam.state()
        with self.assertRaisesRegex(ValueError, 'changed by hand'):
            fam.apply(request(run=runtime('g')), catalog_hash=CATALOG)
        self.assertEqual((comp.ops['graph'].text, comp.ops['pixel_shader'].text), ('{"a":2}', 'old glsl'))
        self.assertEqual(json.loads(comp.ops['status'].text)['phase'], 'refused')

    def test_damaged_execution_part_is_refused(self):
        graph, stored = envelope()
        stored = json.loads(stored)
        stored['runtime']['text'] = 'tampered'
        fam, _ = family((graph, json.dumps(stored)))
        with self.assertRaisesRegex(ValueError, 'execution part'):
            fam.state()

    def test_the_previous_storage_asks_for_migration(self):
        fam, _ = family('{"format": "grape-next-1", "targetId": ""}')
        with self.assertRaisesRegex(ValueError, 'needs migration'):
            fam.state()
        graph, stored = envelope()
        fam, _ = family((graph, json.dumps(dict(json.loads(stored), format='grape-meta-1'))))
        with self.assertRaisesRegex(ValueError, 'needs migration'):
            fam.state()

    def test_apply_pairs_glsl_and_bindings_and_stores_the_document_as_received(self):
        fam, comp = family()
        result = fam.apply(request(run=runtime('new glsl')), catalog_hash=CATALOG)
        self.assertEqual(comp.op('pixel_shader').text, 'new glsl')
        stored = meta(comp)
        self.assertEqual(comp.op('graph').text, '{ "odd" :  [1, 2] }')  # the one copy, as received
        self.assertNotIn('{ "odd"', comp.op('graph_meta').text)  # graph_meta never repeats the graph text
        self.assertEqual((stored['document']['revision'], stored['runtime']['revision']), (4, 4))
        self.assertIsNone(stored['runtime']['document'])  # the graph is the running program's graph
        self.assertNotIn('lastKnownGood', stored)  # the running program is the last known good; no second GLSL copy
        self.assertEqual(stored['runtime']['editorVersion'], '9.9.9 Test')  # Grape Editor Version (Q45)
        self.assertEqual((result['state']['revision'], result['shaderError']), (4, None))

    def test_failed_code_generation_sends_document_only_and_keeps_the_last_known_good(self):
        fam, comp = family()
        fam.apply(request(run=None), catalog_hash=CATALOG)
        stored = meta(comp)
        self.assertEqual((stored['document']['revision'], stored['runtime']['revision']), (4, 3))
        # The graph moved past the running program, so that program's graph is kept once.
        self.assertEqual(stored['runtime']['document'], '{"a":1}')
        fam.apply(request(revision=4, run=None, document='{"b":2}'), catalog_hash=CATALOG)
        self.assertEqual(meta(comp)['runtime']['document'], '{"a":1}')  # still the last good one, not accumulated
        self.assertEqual(comp.op('pixel_shader').text, 'old glsl')
        fam._validate.assert_not_called()

    def test_glsl_that_fails_in_td_keeps_the_shader_but_saves_the_graph(self):
        fam, comp = family(gpu_ok=False)
        result = fam.apply(request(run=runtime('bad glsl')), catalog_hash=CATALOG)
        self.assertEqual(comp.op('pixel_shader').text, 'old glsl')  # last known good keeps running
        self.assertEqual(comp.op('graph').text, '{ "odd" :  [1, 2] }')  # the edit is not lost
        stored = meta(comp)
        self.assertEqual((stored['document']['revision'], stored['runtime']['revision']), (4, 3))
        self.assertEqual((stored['runtime']['text'], stored['runtime']['document']), (runtime('old glsl'), '{"a":1}'))
        self.assertNotIn('editorVersion', stored['runtime'])  # still the version of the GLSL that runs
        self.assertEqual((result['state']['revision'], result['shaderUpdated'], result['shaderError']), (4, False, 'GPU says no'))
        status = json.loads(comp.op('status').text)
        self.assertEqual((status['phase'], status['error']), ('glsl-compile-failed', 'GPU says no'))
        # A later success clears the kept graph: one copy again.
        fam._validate.side_effect = None
        fam.apply(request(revision=4, run=runtime('good glsl')), catalog_hash=CATALOG)
        self.assertEqual((meta(comp)['runtime']['revision'], meta(comp)['runtime']['document']), (5, None))

    def test_envelope_checks(self):
        fam, _ = family()
        with self.assertRaisesRegex(RuntimeError, 'Conflict'):
            fam.apply(request(revision=2, run=runtime()), catalog_hash=CATALOG)
        with self.assertRaisesRegex(ValueError, 'target'):
            fam.apply({**request(run=runtime()), 'targetId': 'd' * 32}, catalog_hash=CATALOG)
        with self.assertRaisesRegex(RuntimeError, 'catalog'):
            fam.apply(request(run=runtime()), catalog_hash='e' * 64)
        with self.assertRaisesRegex(ValueError, '512,000 bytes'):
            fam.apply(request(document='x' * 512001, run=runtime()), catalog_hash=CATALOG)
        with self.assertRaisesRegex(ValueError, 'GLSL is empty or over'):
            fam.apply(request(run=runtime('x' * 512001)), catalog_hash=CATALOG)
        with self.assertRaisesRegex(ValueError, 'editor version'):
            fam.apply(request(run=runtime(), editorVersion=None), catalog_hash=CATALOG)

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
        self.assertNotIn('graph', comp.ops)  # nothing new was written either

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
