"""Pure shader-local recovery checks; native callback/save ordering is separate."""
import copy
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import unittest

SOURCE = Path(__file__).resolve().parents[2] / 'src/td/runtime/pixel_preview_recovery.py'
spec = importlib.util.spec_from_file_location('preview_recovery_test_subject', SOURCE)
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class Parameter:
    def __init__(self, value='', mode='CONSTANT', expr='', bind=''):
        self.val, self.mode, self.expr, self.bindExpr = value, mode, expr, bind

    def eval(self):
        raise AssertionError('Recovery must not sample/evaluate a parameter')


class Dat:
    def __init__(self, text):
        self._text = text
        self.fail_once = False

    @property
    def text(self):
        return self._text

    @text.setter
    def text(self, value):
        if self.fail_once:
            self.fail_once = False
            raise RuntimeError('Injected DAT write failure')
        self._text = value


class Connector:
    def __init__(self, owner):
        self.owner = owner
        self.connections = []

    def disconnect(self):
        self.connections = []

    def connect(self, output):
        self.connections = [output]


class Samplers:
    def __init__(self, native, count=1):
        self.native = native
        self.numBlocks = count

    @property
    def numBlocks(self):
        return self._count

    @numBlocks.setter
    def numBlocks(self, count):
        old = getattr(self, '_count', 0)
        self._count = count
        for index in range(count, old):
            for suffix in ('name', 'top'):
                delattr(self.native.par, 'sampler' + str(index) + suffix)
        for index in range(old, count):
            for suffix in ('name', 'top'):
                setattr(self.native.par, 'sampler' + str(index) + suffix, Parameter())


class Native:
    def __init__(self, name, path, family='TOP'):
        self.name, self.path, self.family, self.valid = name, path, family, True
        self.par = SimpleNamespace(tops=Parameter(), liveUniform=Parameter(.25))
        self.seq = SimpleNamespace(sampler=Samplers(self))
        self.inputConnectors = [Connector(self) for _ in range(4)]
        self.outputConnectors = [Connector(self)]


class Comp:
    def __init__(self, kind='mat', path='/project1/shader1'):
        self.path, self.storage = path, {}
        name = 'material' if kind == 'mat' else 'shader'
        self.children = {name: Native(name, path + '/' + name, 'MAT' if kind == 'mat' else 'TOP'),
                         'pixel_shader': Dat('FORMAL_PIXEL'), 'manifest': Dat('FORMAL_MANIFEST')}
        if kind == 'mat':
            self.children['vertex_shader'] = Dat('FORMAL_VERTEX')
        self.native = self.children[name]

    def op(self, name):
        if name.startswith(self.path + '/'):
            name = name[len(self.path) + 1:]
        return self.children.get(name)

    def fetch(self, key, default=None, search=True):
        if search:
            raise AssertionError('Recovery marker must be shader-local')
        return self.storage.get(key, default)

    def unstore(self, key):
        self.storage.pop(key, None)

    def arm(self):
        output = recovery.capture(self)
        self.storage[recovery.STORE] = {'output': copy.deepcopy(output)}
        return output

    def source(self, name):
        source = Native(name, self.path + '/' + name)
        self.children[name] = source
        return source


class PixelPreviewRecovery(unittest.TestCase):
    def test_mat_restores_formal_code_manifest_sampler_modes_and_preserves_live_values(self):
        comp = Comp()
        comp.native.seq.sampler.numBlocks = 2
        comp.native.par.sampler0name.val = 'uMain'
        comp.native.par.sampler0top = Parameter('texture_source_main')
        comp.native.par.sampler1name = Parameter('uOther', mode='EXPRESSION', expr="'uOther'")
        comp.native.par.sampler1top = Parameter('', mode='BIND', bind='parent().par.Map')
        formal = comp.arm()
        comp.op('pixel_shader').text = 'PREVIEW_PIXEL'
        comp.op('vertex_shader').text = 'PREVIEW_VERTEX'
        comp.op('manifest').text = 'PREVIEW_MANIFEST'
        comp.native.seq.sampler.numBlocks = 3
        comp.native.par.sampler0name.val = 'uPreview'
        comp.native.par.liveUniform.val = .93
        self.assertTrue(recovery.restore(comp))
        self.assertEqual(recovery.capture(comp), formal)
        self.assertEqual(comp.native.par.liveUniform.val, .93)
        self.assertNotIn(recovery.STORE, comp.storage)
        self.assertFalse(recovery.restore(comp))

    def test_top_restores_tops_and_legacy_connections(self):
        comp = Comp('top')
        source = comp.source('input_router')
        extra = comp.source('preview_source')
        comp.native.inputConnectors[0].connect(source.outputConnectors[0])
        comp.native.par.tops = Parameter('', 'EXPRESSION', "parent().op('input_router').path")
        formal = comp.arm()
        comp.native.par.tops = Parameter('preview_source')
        comp.native.inputConnectors[0].disconnect()
        comp.native.inputConnectors[2].connect(extra.outputConnectors[0])
        comp.op('pixel_shader').text = 'PREVIEW_PIXEL'
        recovery.restore(comp)
        self.assertEqual(recovery.capture(comp), formal)
        self.assertEqual(comp.native.inputConnectors[0].connections, source.outputConnectors)
        self.assertFalse(comp.native.inputConnectors[2].connections)

    def test_json_roundtrip_and_relative_connection_survive_shader_copy(self):
        original = Comp('top')
        source = original.source('input_router')
        original.native.inputConnectors[0].connect(source.outputConnectors[0])
        formal = original.arm()
        self.assertEqual(formal['inputs'][0]['source'], 'input_router')
        copied = Comp('top', '/elsewhere/copiedShader')
        copied_source = copied.source('input_router')
        copied.storage = json.loads(json.dumps(original.storage))
        copied.op('pixel_shader').text = 'PREVIEW_PIXEL'
        recovery.restore(copied)
        self.assertEqual(copied.native.inputConnectors[0].connections, copied_source.outputConnectors)
        self.assertEqual(copied.op('pixel_shader').text, 'FORMAL_PIXEL')

    def test_constant_tops_internal_paths_are_relocated_but_external_paths_survive(self):
        original = Comp('top', '/original/shader')
        original.native.par.tops.val = '/original/shader/source_a /external/texture /original/shader/nested/source_b /original/shader2/source_c'
        formal = original.arm()
        self.assertEqual(formal['tops']['val'], 'source_a /external/texture nested/source_b /original/shader2/source_c')
        copied = Comp('top', '/another/copiedShader')
        copied.storage = json.loads(json.dumps(original.storage))
        copied.native.par.tops.val = 'preview_source'
        recovery.restore(copied)
        self.assertEqual(copied.native.par.tops.val, formal['tops']['val'])
        copied.native.par.tops.mode = 'EXPRESSION'
        copied.native.par.tops.expr = "'/original/shader/source_a'"
        captured = recovery.capture(copied)
        self.assertEqual(captured['tops']['expr'], "'/original/shader/source_a'")

    def test_missing_top_source_rejects_before_mutation_and_retains_marker(self):
        comp = Comp('top')
        source = comp.source('input_router')
        comp.native.inputConnectors[0].connect(source.outputConnectors[0])
        comp.arm()
        comp.op('pixel_shader').text = 'PREVIEW_PIXEL'
        del comp.children['input_router']
        before = recovery.capture(comp)
        with self.assertRaisesRegex(RuntimeError, 'source is unavailable'):
            recovery.restore(comp)
        self.assertEqual(recovery.capture(comp), before)
        self.assertIn(recovery.STORE, comp.storage)

    def test_invalid_parameter_state_rejects_before_mutation(self):
        comp = Comp()
        comp.arm()
        comp.storage[recovery.STORE]['output']['samplers']['rows'][0]['top']['mode'] = 'EXPORT'
        before = recovery.capture(comp)
        with self.assertRaisesRegex(RuntimeError, 'exported'):
            recovery.restore(comp)
        self.assertEqual(recovery.capture(comp), before)
        self.assertIn(recovery.STORE, comp.storage)

    def test_dat_write_failure_rolls_back_current_output_and_retains_marker(self):
        comp = Comp()
        comp.arm()
        comp.native.seq.sampler.numBlocks = 3
        comp.op('pixel_shader').text = 'PREVIEW_PIXEL'
        before = recovery.capture(comp)
        comp.op('pixel_shader').fail_once = True
        with self.assertRaisesRegex(RuntimeError, 'Injected DAT write failure'):
            recovery.restore(comp)
        self.assertEqual(recovery.capture(comp), before)
        self.assertIn(recovery.STORE, comp.storage)
        self.assertTrue(recovery.restore(comp))

    def test_capture_refuses_non_json_values_and_export_without_sampling(self):
        comp = Comp()
        comp.native.par.sampler0top.val = object()
        with self.assertRaisesRegex(RuntimeError, 'JSON scalar'):
            recovery.capture(comp)
        comp.native.par.sampler0top.val = 'texture_source'
        comp.native.par.sampler0top.mode = 'EXPORT'
        with self.assertRaisesRegex(RuntimeError, 'exported'):
            recovery.capture(comp)

    def test_version_kind_or_missing_dat_rejects_without_mutation(self):
        for alteration in ('version', 'operator', 'dat'):
            comp = Comp()
            comp.arm()
            if alteration == 'dat':
                del comp.children['vertex_shader']
            else:
                comp.storage[recovery.STORE]['output'][alteration] = 'unknown'
            with self.assertRaises(RuntimeError):
                recovery.restore(comp)
            self.assertEqual(comp.op('pixel_shader').text, 'FORMAL_PIXEL')
            self.assertIn(recovery.STORE, comp.storage)

    def test_callbacks_are_self_contained_and_noop_without_marker(self):
        comp = Comp()
        namespace = {'parent': lambda: comp}
        exec(compile(SOURCE.read_text(), str(SOURCE), 'exec'), namespace)
        comp.arm()
        comp.op('pixel_shader').text = 'PREVIEW_PIXEL'
        namespace['onStart']()
        self.assertEqual(comp.op('pixel_shader').text, 'FORMAL_PIXEL')
        comp.arm()
        comp.op('pixel_shader').text = 'PREVIEW_PIXEL'
        namespace['onCreate']()
        self.assertEqual(comp.op('pixel_shader').text, 'FORMAL_PIXEL')
        namespace['onStart']()

    def test_recovery_snapshot_contains_only_formal_output_not_user_graph(self):
        comp = Comp()
        comp.arm()
        marker = json.dumps(comp.storage)
        self.assertNotIn('PREVIEW_PIXEL', marker)
        self.assertNotIn('graph', comp.storage[recovery.STORE]['output'])
        self.assertNotIn('liveUniform', marker)


if __name__ == '__main__':
    unittest.main()
