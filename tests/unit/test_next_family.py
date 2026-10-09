"""Grape OP editing path (design-interview Q38, Q40, Q48; grape-op-structure #4): TD never reads the graph.

`graph` holds the graph text (the one copy); `graph_meta` proves and runs it; `status` is for people."""
import json
import zlib
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

import host_api
import next_family
from next_family import NextFamily, FORMAT, META_FORMAT, digest
from test_uniform_writer import FakeShader

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
        self.ops = {'status': Text(), 'pixel_shader': Text('old glsl'), 'shader': FakeShader()}
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


def family(stored=None, gpu_ok=True, write=False):
    comp = Comp(stored if stored is not None else envelope())
    fam = NextFamily(comp, presets={'absTime': 'absTime.seconds'})
    fam._validate = Mock(side_effect=None if gpu_ok else RuntimeError('GPU says no'))
    fam._verify_gpu = Mock()
    fam.placed = (Mock(name='commit'), Mock(name='rollback'))
    fam._place_inputs = Mock(return_value=fam.placed)
    fam._input_ids = Mock(return_value=[])
    if not write:
        fam._write_uniforms = Mock(return_value=[])
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
        # A conflict is its own kind, not told by the words (Refactor.62). 衝突是自己的種類，不看字詞。
        with self.assertRaisesRegex(next_family.RevisionConflict, 'Conflict'):
            fam.apply(request(revision=2, run=runtime()), catalog_hash=CATALOG)
        with self.assertRaisesRegex(ValueError, 'target'):
            fam.apply({**request(run=runtime()), 'targetId': 'd' * 32}, catalog_hash=CATALOG)
        with self.assertRaisesRegex(next_family.BuildChanged, 'different builds'):
            fam.apply(request(run=runtime()), catalog_hash='e' * 64)
        with self.assertRaisesRegex(ValueError, '512,000 bytes'):
            fam.apply(request(document='x' * 512001, run=runtime()), catalog_hash=CATALOG)
        with self.assertRaisesRegex(ValueError, 'GLSL is empty or over'):
            fam.apply(request(run=runtime('x' * 512001)), catalog_hash=CATALOG)
        with self.assertRaisesRegex(ValueError, 'editor version'):
            fam.apply(request(run=runtime(), editorVersion=None), catalog_hash=CATALOG)

    def test_kinds_not_taken_over_yet_are_refused(self):
        fam, _ = family()
        with self.assertRaisesRegex(ValueError, 'not supported by this TD-Grape yet'):
            fam.apply(request(run=runtime(bindings=[{'id': 'u', 'kind': 'specConstant'}])), catalog_hash=CATALOG)

    def test_uniforms_are_checked_and_written_after_the_glsl_compiles(self):
        # Refactor.44 (Q51). 檢查後、GLSL 編譯成功才寫綁定表。
        tint = {'id': 'u1', 'kind': 'uniform', 'name': 'uTint', 'type': 'vec4', 'value': [1, 0.5, 0, 1], 'color': True}
        gain = {'id': 'u2', 'kind': 'uniform', 'name': 'uGain', 'type': 'float', 'value': 2}
        fam, _ = family()
        fam.apply(request(run=runtime('reads two', bindings=[tint, gain])), catalog_hash=CATALOG)
        fam._write_uniforms.assert_called_once_with([tint, gain], [])
        fam, _ = family(gpu_ok=False)
        fam.apply(request(run=runtime('bad', bindings=[tint])), catalog_hash=CATALOG)
        fam._write_uniforms.assert_not_called()  # the last good values stay
        for bad in ({**gain, 'value': [1, 2]}, {**gain, 'type': 'mat3'}, {**gain, 'color': True}, {**tint, 'color': 'yes'},
                    {**gain, 'name': '1x'}, {**gain, 'value': float('inf')}, {**gain, 'value': True}):
            fam, _ = family()
            with self.assertRaisesRegex(ValueError, 'invalid Uniform'):
                fam.apply(request(run=runtime(bindings=[bad])), catalog_hash=CATALOG)

    def test_only_a_value_change_does_not_compile(self):
        fam, comp = family()
        fam._input_ids.return_value = ['input1']
        inputs = [{'id': 'input1', 'kind': 'topInput', 'name': 'input1', 'type': 'sampler2D', 'defaultTexture': 'grape'}]
        gain = {'id': 'u2', 'kind': 'uniform', 'name': 'uGain', 'type': 'float', 'value': 3}
        fam.apply(request(run=runtime('old glsl', bindings=inputs + [gain])), catalog_hash=CATALOG)
        fam._validate.assert_not_called()
        fam._verify_gpu.assert_not_called()
        fam._write_uniforms.assert_called_once_with([gain], [])
        self.assertEqual(meta(comp)['runtime']['revision'], 4)

    def test_preset_uniforms_take_their_expression_from_the_manager_table(self):
        # Uniform D1 (Q61): the editor sends the entry only; an unknown entry is refused, and the old
        # built-in kind is gone. 編輯器只送代號；未知的代號拒絕；舊的 builtin 種類已移除。
        clock = {'id': 'b1', 'kind': 'uniform', 'name': 'uAbsTime', 'type': 'float', 'value': 0, 'entry': 'absTime'}
        fam, comp = family(write=True)
        result = fam.apply(request(run=runtime('reads time', bindings=[clock])), catalog_hash=CATALOG)
        par = comp.ops['shader'].row('vec', 'uAbsTime')['valuex']
        self.assertEqual((par.mode, par.expr), ('EXPRESSION', 'absTime.seconds'))
        self.assertEqual(result['uniforms'], {'b1': [{'mode': 'expression', 'text': 'absTime.seconds'}]})
        fam, _ = family()
        with self.assertRaisesRegex(ValueError, 'invalid Uniform'):
            fam.apply(request(run=runtime(bindings=[{**clock, 'entry': '__import__("os")'}])), catalog_hash=CATALOG)
        with self.assertRaisesRegex(ValueError, 'not supported'):
            fam.apply(request(run=runtime(bindings=[{**clock, 'kind': 'builtin'}])), catalog_hash=CATALOG)

    def test_apply_writes_the_glsl_op_and_reports_states_and_notices(self):
        # Uniform D1 (Q57, Q58, Q60): rows of Uniforms no longer used go; values change only when they
        # changed in the editor; the reply carries what TD has. 不再用的列拿掉；只寫編輯器改過的值；回覆帶現況。
        gain = {'id': 'u2', 'kind': 'uniform', 'name': 'uGain', 'type': 'float', 'value': 2}
        old_clock = {'id': 'b1', 'kind': 'builtin', 'name': 'uTime', 'type': 'float', 'entry': 'time'}  # Refactor.45
        fam, comp = family(envelope(run=runtime('old glsl', bindings=[old_clock, gain])), write=True)
        shader = comp.ops['shader']
        shader.seq.vec.numBlocks = 2
        shader.rows['vec'][0]['name'].val, shader.rows['vec'][1]['name'].val = 'uTime', 'uGain'
        shader.rows['vec'][1]['valuex'].val = 7.0  # changed in TD 在 TD 改過
        result = fam.apply(request(run=runtime('old glsl', bindings=[gain])), catalog_hash=CATALOG)
        self.assertEqual(shader.names('vec'), ['uGain'])
        self.assertEqual(result['uniforms'], {'u2': [{'mode': 'constant', 'value': 7.0}]})  # not overwritten
        self.assertEqual(result['notices'], [])
        result = fam.apply(request(revision=4, run=runtime('old glsl', bindings=[{**gain, 'value': 3}])), catalog_hash=CATALOG)
        self.assertEqual(result['uniforms']['u2'][0]['value'], 3)
        shader.rows['vec'][0]['name'].set_expr("'uGain'", 'uGain')
        with self.assertRaisesRegex(ValueError, 'driven in TD'):
            fam.apply(request(revision=5, run=runtime('old glsl', bindings=[{**gain, 'name': 'uLevel'}])), catalog_hash=CATALOG)

    def test_live_values_are_written_onto_the_glsl_op(self):
        # Refactor.46–47 (Q53, Q56): no compile, no save; old numbers and unknown Uniforms are skipped.
        # 不編譯、不存圖；舊序號與還沒在跑的 Uniform 略過。
        gain = {'id': 'u2', 'kind': 'uniform', 'name': 'uGain', 'type': 'vec2', 'value': [1, 2]}
        fam, comp = family(envelope(run=runtime('old glsl', bindings=[gain])))
        shader = comp.ops['shader']
        shader.rows['vec'][0]['name'].val = 'uGain'
        before = comp.op('graph_meta').text
        live = lambda **extra: fam.live({'format': FORMAT, 'id': 'u2', 'value': [3, 4], 'session': 's', 'seq': 1, **extra})
        self.assertEqual(live()['applied'], True)
        self.assertEqual((shader.rows['vec'][0]['valuex'].val, shader.rows['vec'][0]['valuey'].val), (3, 4))
        self.assertEqual(live(seq=1, value=[9, 9])['reason'], 'stale')
        self.assertEqual(live(id='nope', seq=2)['reason'], 'not-running')
        with self.assertRaisesRegex(ValueError, 'invalid live value'):
            live(seq=4, value=[1, 2, 3])
        self.assertEqual(comp.op('graph_meta').text, before)  # nothing saved
        fam._validate.assert_not_called()
        next_family.LIVE.clear()

    def test_texture_inputs_are_placed_with_their_glsl_and_undone_with_it(self):
        # Refactor.43: the In TOPs change with the GLSL that reads them. 輸入接口與讀它的 GLSL 一起換。
        inputs = [{'id': 'input1', 'kind': 'topInput', 'name': 'input1', 'type': 'sampler2D', 'defaultTexture': 'grape'},
                  {'id': 'dPhoto', 'kind': 'topInput', 'name': 'photo', 'type': 'sampler2D', 'defaultTexture': 'black'}]
        fam, comp = family()
        fam.apply(request(run=runtime('reads two', bindings=inputs)), catalog_hash=CATALOG)
        fam._validate.assert_called_once_with('reads two', 2)
        fam._place_inputs.assert_called_once_with(inputs)
        fam.placed[0].assert_called_once_with()
        fam.placed[1].assert_not_called()
        fam, comp = family()
        fam._verify_gpu.side_effect = RuntimeError('GPU says no')
        fam.apply(request(run=runtime('reads two', bindings=inputs)), catalog_hash=CATALOG)
        fam.placed[1].assert_called_once_with()  # back to the last known good inputs
        fam.placed[0].assert_not_called()
        self.assertEqual(comp.op('pixel_shader').text, 'old glsl')

    def test_texture_inputs_are_checked(self):
        good = {'id': 'input1', 'kind': 'topInput', 'name': 'input1', 'type': 'sampler2D', 'defaultTexture': 'grape'}
        for bad in ({**good, 'defaultTexture': 'moon'}, {**good, 'id': '1x'}, {**good, 'name': ''}):
            fam, _ = family()
            with self.assertRaisesRegex(ValueError, 'invalid (texture input|binding ID)'):
                fam.apply(request(run=runtime(bindings=[bad])), catalog_hash=CATALOG)
        fam, _ = family()
        with self.assertRaisesRegex(ValueError, 'invalid binding ID'):
            fam.apply(request(run=runtime(bindings=[good, good])), catalog_hash=CATALOG)


class HostRoutingTests(unittest.TestCase):
    def api(self, fam):
        return host_api.HostAPI(bootstrap={'version': 1, 'producer': 'frontend-modules', 'catalogHash': CATALOG},
            resolve=lambda ident: fam if ident == TARGET else None,
            choices=lambda: {'shaders': [{'id': TARGET, 'path': '/nested/target'}]},
            save_project=Mock(return_value='x.toe'), identity=lambda: {'file': 'test.12.toe', 'build': '2025.33230'})

    def test_scoped_and_unscoped_grape_op_list_are_the_same(self):
        api = self.api(family()[0])
        self.assertEqual(api.dispatch('GET', '/api/' + TARGET + '/shaders'), api.dispatch('GET', '/api/shaders'))
        # Every reply says which TD answered (Refactor.52, Q63): success, refusal and unknown target alike.
        td = {'file': 'test.12.toe', 'build': '2025.33230'}
        self.assertEqual(api.dispatch('GET', '/api/shaders')[1]['td'], td)
        self.assertEqual(api.dispatch('GET', '/api/' + 'b' * 32 + '/state')[1]['td'], td)
        self.assertEqual(api.dispatch('GET', '/api/nothing')[1]['td'], td)

    def test_new_grape_id_on_request(self):
        # Refactor.52 (Q63): the person chose "also give this Grape OP a new Grape ID". Same as Regenerate ID;
        # graph_meta follows, the graph stays; a damaged Grape OP is refused before anything changes.
        fam, comp = family()
        assign = Mock(side_effect=lambda c: setattr(c.par, 'Grapeid', Par('d' * 32)) or 'd' * 32)
        comp.ops['GrapeControls/identity'] = SimpleNamespace(module=SimpleNamespace(assign=assign))
        code, result = self.api(fam).dispatch('POST', '/api/' + TARGET + '/identity', {})
        self.assertEqual((code, result['targetId']), (200, 'd' * 32))
        self.assertEqual((meta(comp)['targetId'], comp.ops['graph'].text), ('d' * 32, '{"a":1}'))
        old, other = family(stored='{"schemaVersion": 1, "graph": {}}')
        other.ops['GrapeControls/identity'] = SimpleNamespace(module=SimpleNamespace(assign=assign))
        self.assertEqual(self.api(old).dispatch('POST', '/api/' + TARGET + '/identity', {})[0], 422)
        self.assertEqual(assign.call_count, 1)

    def test_default_image_previews(self):
        # Refactor.58: a shared default image by name (kept by the browser); the TOP chosen on this Grape OP's
        # Samples as a snapshot (not kept); none chosen or an unknown name is a 404, not a failure.
        # 公用預設圖照名字給（瀏覽器可留）；Samples 上選的 TOP 給快照（不留）；沒選或沒有這張是 404。
        fam, comp = family()
        textures = Mock(side_effect=lambda name: (2, 1, bytes(range(8))) if name == 'banana' else None)
        capture = Mock(return_value=(1, 1, b'\x01\x02\x03\x04'))
        api = host_api.HostAPI(bootstrap={'version': 1, 'producer': 'frontend-modules', 'catalogHash': CATALOG},
            resolve=lambda ident: fam if ident == TARGET else None, choices=lambda: {}, save_project=Mock(),
            textures=textures, capture=capture)
        code, image = api.dispatch('GET', '/api/textures/banana.png')
        self.assertEqual((code, image.mime, image.keep, image.data[:8]), (200, 'image/png', True, b'\x89PNG\r\n\x1a\n'))
        # The rows inside are the pixels as given, each after a filter byte. 裡面每一列是給的像素，前面一個過濾位元。
        start = image.data.index(b'IDAT') + 4
        self.assertEqual(zlib.decompress(image.data[start:])[:9], b'\x00' + bytes(range(8)))
        self.assertIs(api.dispatch('GET', '/api/textures/banana.png')[1], image)  # read once a connection 每次連線讀一次
        self.assertEqual(textures.call_count, 1)
        self.assertEqual(api.dispatch('GET', '/api/textures/white.png')[0], 404)
        # Refactor.60: what each input has wired in, and one input's In TOP as a snapshot (not kept).
        # 每個輸入接了什麼；某個輸入的 In TOP 快照（不留）。
        # in1 passes its default from Samples (behind an out TOP); in2 has a TOP wired in. in1 送 Samples 的預設圖；in2 外面接了 TOP。
        grape = SimpleNamespace(OPType='moviefileinTOP', path='/project1/fam/Samples/grape', inputs=[])
        sample_out = SimpleNamespace(OPType='outTOP', path='/project1/fam/Samples/out1', inputs=[grape],
                                     par=SimpleNamespace(label=Par('grape')))
        # Storage is read from the In TOP itself only (search=False, Refactor.61.6). 只讀 In TOP 自己的 storage。
        tops = [SimpleNamespace(OPType='inTOP', name='in' + str(n), width=640, height=360, pixelFormat='8-bit fixed (RGBA)',
                                inputs=feeds, fetch=lambda key, default=None, search=True, i=i: i if search is False else 'from a parent')
                for n, i, feeds in ((1, 'input1', [sample_out]), (2, 'dPhoto', []))]
        wired = SimpleNamespace(owner=SimpleNamespace(path='/project1/moviefilein1'))
        comp.inputConnectors = [SimpleNamespace(inOP=tops[0], connections=[]), SimpleNamespace(inOP=tops[1], connections=[wired])]
        code, result = api.dispatch('GET', '/api/' + TARGET + '/inputs')
        info = {'width': 640, 'height': 360, 'format': '8-bit fixed (RGBA)'}
        self.assertEqual((code, result['inputs']), (200, [
            {'id': 'input1', 'node': 'in1', 'source': None, 'info': {'path': '/project1/fam/Samples/grape', 'default': 'grape', **info}},
            {'id': 'dPhoto', 'node': 'in2', 'source': '/project1/moviefilein1', 'info': {'path': '/project1/moviefilein1', 'default': None, **info}}]))
        def input_top(ident):
            if ident not in ('input1', 'dPhoto'):
                raise next_family.TextureUnavailable('This Grape OP has no texture input with this ID.')
            return tops[('input1', 'dPhoto').index(ident)]
        fam.input_top = input_top
        code, image = api.dispatch('GET', '/api/' + TARGET + '/input/dPhoto')
        self.assertEqual((code, image.keep, image.data[:4]), (200, False, b'\x89PNG'))
        capture.assert_called_once_with(tops[1])
        self.assertEqual(api.dispatch('GET', '/api/' + TARGET + '/input/nope')[1]['code'], 'texture_unavailable')
        # Any other failure is what it is (Refactor.61.6): a KeyError from a bug is never a missing picture; it reaches the
        # request queue, which reports it as a failure with its type. 其他失敗照實回報：程式錯誤的 KeyError 不會被說成找不到圖。
        fam.input_sources = Mock(side_effect=KeyError('defaultTexture'))
        with self.assertRaises(KeyError):
            api.dispatch('GET', '/api/' + TARGET + '/inputs')

    def test_sample_output_by_label(self):
        # Exactly one out with the label, wherever it sits; none or two is a LookupError (Refactor.58.9).
        # 剛好一個 out 有這個 label，不管排在哪；沒有或兩個都是 LookupError。
        out = lambda name: SimpleNamespace(outOP=SimpleNamespace(par=SimpleNamespace(label=Par(name))))
        samples = SimpleNamespace(path='/x/Samples', outputConnectors=[out('banana'), out('grape'), out('grape'), SimpleNamespace(outOP=None)])
        self.assertEqual(next_family.sample_output(samples, 'banana'), 0)
        with self.assertRaisesRegex(LookupError, '2 outputs labelled "grape"'):
            next_family.sample_output(samples, 'grape')
        with self.assertRaisesRegex(LookupError, '0 outputs labelled "white"'):
            next_family.sample_output(samples, 'white')

    def test_build_changed_is_not_a_conflict(self):
        code, result = self.api(family()[0]).dispatch('POST', '/api/' + TARGET + '/apply', {**request(run=runtime()), 'catalogHash': 'e' * 64})
        self.assertEqual((code, result['code']), (409, 'build_changed'))
        self.assertNotIn('Conflict', result['error'])

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
        self.assertEqual((code, result['format'], result['state']['revision'], result['uniforms']), (200, FORMAT, 3, {}))
        code, result = api.dispatch('POST', '/api/' + TARGET + '/apply', request(run=runtime('g')))
        self.assertEqual((code, result['state']['revision']), (200, 4))
        code, result = api.dispatch('POST', '/api/' + TARGET + '/apply', request(run=runtime('g')))
        self.assertEqual((code, result['code']), (409, 'revision_conflict'))


class RefusalTests(unittest.TestCase):
    # Refactor.62: only errors with a refusal code are answered as refusals; the code decides the reply, never the words.
    # 只有帶拒絕代碼的錯誤才回成拒絕；由代碼決定回覆，不看字詞。
    def api(self, error):
        fam = Mock()
        fam.state.side_effect = error
        return host_api.HostAPI(bootstrap={'version': 1, 'producer': 'frontend-modules', 'catalogHash': CATALOG},
            resolve=lambda ident: fam, choices=lambda: {}, save_project=Mock())

    def test_a_plain_refusal_naming_conflict_is_not_a_conflict(self):
        refusal = next_family.Refused('The name of Uniform uConflict is driven in TD, so TD-Grape cannot rename it.')
        code, result = self.api(refusal).dispatch('GET', '/api/' + TARGET + '/state')
        self.assertEqual((code, result['code']), (422, 'host_rejected'))
        self.assertFalse(result['error'].startswith('Conflict: '))

    def test_a_failure_is_not_a_refusal(self):
        # A bug's ValueError leaves dispatch; the request queue reports it with its type. 程式錯誤離開 dispatch，由佇列照實回報。
        with self.assertRaises(ValueError):
            self.api(ValueError('Expecting value: line 1 column 1')).dispatch('GET', '/api/' + TARGET + '/state')


if __name__ == '__main__':
    unittest.main()
