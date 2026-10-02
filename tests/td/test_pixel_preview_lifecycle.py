"""Disposable native Pixel Preview probes. Never saves or refreshes user TOE.

Run through the enabled development bridge using the checked source tree.
Actual project-save serialization remains a separate isolated-process test.
"""
import copy
import importlib.util
import json
import os
import sys
import traceback
import uuid
import numpy as np

NAMES = ('graph', 'state', 'manifest', 'pixel_shader', 'vertex_shader')
existing = [n for n in op('/').findChildren() if n.storage.get('sgrapeGenerated', False)]
before = {n.path: {name: n.op(name).text for name in NAMES if n.op(name)} for n in existing}
checks = []
area = op('/').create(baseCOMP, 'grape_preview_probe_' + uuid.uuid4().hex[:8])
old_path = list(sys.path)
report = {'passed': False, 'pid': os.getpid(), 'tdBuild': str(app.build), 'checks': checks,
          'projectSaveSerialization': 'NOT_RUN_USER_TOE_NOT_SAVED',
          'serverRestart': 'NOT_RUN_NO_TEST_HTTP_SERVER', 'userShadersPreserved': False}


def checkpoint(label, **data):
    checks.append({'case': label, **data})
    (GRAPE_TEST_OUTPUT / 'progress.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')


def preview_graph(kind, ty, value, mrt=False):
    graph = c.demo_graph('color', kind)
    if kind == 'top':
        graph = c.normalize_top_sources(graph)[0]
    graph['declarations'].append(dict(id='live', kind='uniform', name='uLiveProbe', type='float', value=.25))
    data = graph['stages']['pixel']
    output = next(n for n in data['nodes'] if n['id'] == 'pixel')
    if kind == 'mat':
        output['params'].update({key: False for key in c.PIXEL_FINISHING_DEFAULTS})
    if mrt:
        output['params']['bufferCount'] = 2
        data['edges'].append(c.edge('color', 'pixel', c.PIXEL_BUFFER_PORTS[1]))
    data['nodes'] += [c.node('glsl_code', 'sample', functionName='previewValue', inputs=[],
                             outputs=[{'id': 'out', 'name': 'value', 'type': ty}],
                             code='value = ' + c.literal(value, ty) + ';'), c.node('preview', 'preview')]
    data['edges'].append(c.edge('sample', 'preview', 'value'))
    return graph


def apply_preview(shader, graph, session):
    with r.shader_context(shader):
        graph = copy.deepcopy(graph)
        graph['catalogSnapshot'] = copy.deepcopy(r.state()['graph']['catalogSnapshot'])
        response = r.deploy(graph, r.state()['revision'], pixel_preview={'sessionId': session, 'sequence': 1})
        assert response.get('ok'), response
        assert response['pixelPreview']['active']
        assert c.without_preview(response['state']['graph']) == response['state']['graph']
        assert 'sg_preview_color' not in shader.fetch(r.PIXEL_PREVIEW_RECOVERY)['output']['pixel']
        assert 'sg_preview_color' in shader.op('pixel_shader').text
        formal = copy.deepcopy(shader.fetch(r.PIXEL_PREVIEW_RECOVERY)['output'])
        assert shader.op('manifest').text == formal['manifest']
        assert c.without_preview(json.loads(shader.op('graph').text)) == json.loads(shader.op('graph').text)
        return formal


def end(shader, session):
    with r.shader_context(shader):
        response = r.pixel_preview_session({'action': 'end', 'sessionId': session, 'sequence': 2})
        assert not response['active']


def pixels(shader, mrt=False):
    if r.shader_kind(shader) == 'top':
        native = r.shader_operator(shader)
        native.cook(force=True)
        assert not native.errors(), native.errors()
        return native.numpyArray(delayed=False)[0, 0].tolist(), None
    with r.validation_scene(shader) as render:
        render.par.format = 'rgba32float'
        render.par.dither = False
        render.par.numcolorbufs = 2 if mrt else 1
        render.cook(force=True)
        assert not shader.op('material').errors(), shader.op('material').errors()
        image = render.numpyArray(delayed=False)
        first = image[image.shape[0] // 2, image.shape[1] // 2].tolist()
        second = None
        if mrt:
            selected = area.create(renderselectTOP, 'second_buffer')
            try:
                selected.par.top = render.path
                selected.par.bufferindex = 1
                selected.cook(force=True)
                assert not selected.errors(), selected.errors()
                image = selected.numpyArray(delayed=False)
                second = image[image.shape[0] // 2, image.shape[1] // 2].tolist()
            finally:
                selected.destroy()
        return first, second


try:
    sys.path[:0] = [str(GRAPE_ROOT / 'src/core')]
    manager = area.create(baseCOMP, 'manager')
    manager.store('sgrapeManager', True)
    manager.store('sgrapeManagerId', uuid.uuid4().hex)
    page = manager.appendCustomPage('Test')
    page.appendStr('Updatestatus')
    page.appendFolder('Personalfolder')
    manager.par.Personalfolder = str(GRAPE_TEST_OUTPUT / 'empty')
    for dat, name in json.loads((GRAPE_ROOT / 'src/td/embedded_sources.json').read_text()).items():
        manager.create(textDAT, dat).text = source_path(name).read_text(encoding='utf-8')
    r = manager.op('runtime').module
    r._owner = manager
    c = r.core()
    spec = importlib.util.spec_from_file_location('pixel_preview_numeric_fixture', GRAPE_ROOT / 'tests/unit/pixel_preview_fixture.py')
    numeric = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(numeric)
    pending_tox = []
    for kind in ('top', 'mat'):
        shader = r.create_shader(area, 'preview_' + kind, c.without_preview(preview_graph(kind, 'float', .2)), kind)
        if kind == 'top':
            shader.par.Resolution = 'custom'
            shader.par.Width = 16
            shader.par.Height = 16
            shader.par.Pixelformat = 'rgba32float'
        for ty, value, expected in numeric.CASES:
            session = 'native_' + uuid.uuid4().hex
            formal = apply_preview(shader, preview_graph(kind, ty, value), session)
            actual, unused = pixels(shader)
            error = float(np.max(np.abs(np.array(actual) - np.array(expected))))
            assert np.isfinite(actual).all() and error < .0001, (kind, ty, expected, actual, error)
            end(shader, session)
            assert shader.op('pixel_shader').text == formal['pixel']
            assert shader.op('pixel_preview_recovery').module.capture(shader) == formal
            checkpoint(kind + ':' + ty, numeric=True, maxError=error, rgba=actual, restored=True)
        graph = preview_graph(kind, 'vec2', [.2, .8], mrt=kind == 'mat')
        session = 'lifecycle_' + uuid.uuid4().hex
        formal = apply_preview(shader, graph, session)
        if kind == 'mat':
            first, second = pixels(shader, mrt=True)
            assert np.max(np.abs(np.array(first) - [.2, .8, .5, 1])) < .0001, first
            assert np.max(np.abs(np.array(second) - [.55, .28, .9, 1])) < .0001, second
            checkpoint('MAT MRT preserves attachment 1', attachment0=first, attachment1=second)
        native = r.shader_operator(shader)
        live = next(getattr(native.par, 'vec' + str(i) + 'valuex') for i in range(native.seq.vec.numBlocks)
                    if getattr(native.par, 'vec' + str(i) + 'name').eval() == 'uLiveProbe')
        live.val = .73
        lifecycle = manager.op('pixel_preview_save')
        assert lifecycle.par.projectpresave.eval() and lifecycle.par.projectpostsave.eval()
        lifecycle.par.projectpresavepulse.pulse()
        assert shader.op('pixel_shader').text == formal['pixel']
        assert not shader.fetch(r.PIXEL_PREVIEW_RECOVERY, None)
        lifecycle.par.projectpostsavepulse.pulse()
        assert 'sg_preview_color' in shader.op('pixel_shader').text
        assert abs(live.eval() - .73) < 1e-6
        checkpoint(kind + ':native Execute save pulses suspend/resume', liveValue=live.eval(), actualProjectSave=False)
        # Export a shader with the live override, then remove its owning manager
        # before loading. The shader-local Create callback must recover by itself.
        tox = GRAPE_TEST_OUTPUT / ('preview-active-' + kind + '.tox')
        shader.save(str(tox))
        pending_tox.append((kind, tox, formal))
        r._pixel_previews[shader.id]['expires'] = r.time.monotonic() - 1
        r.service_pixel_previews()
        assert shader.op('pixel_shader').text == formal['pixel'] and shader.id not in r._pixel_previews
        assert abs(live.eval() - .73) < 1e-6
        checkpoint(kind + ':lease expiry restores formal without reverting live values')
        # Deleting Preview is an ordinary formal apply, closing the active lease.
        session = 'delete_' + uuid.uuid4().hex
        formal = apply_preview(shader, graph, session)
        with r.shader_context(shader):
            formal_graph = c.without_preview(graph)
            formal_graph['catalogSnapshot'] = copy.deepcopy(r.state()['graph']['catalogSnapshot'])
            response = r.deploy(formal_graph, r.state()['revision'])
        assert response.get('ok') and shader.id not in r._pixel_previews, response
        assert 'sg_preview_color' not in shader.op('pixel_shader').text
        checkpoint(kind + ':delete Preview restores formal')
    manager.destroy()
    for kind, tox, formal in pending_tox:
        loaded = area.loadTox(str(tox))
        assert loaded.op('pixel_shader').text == formal['pixel'], kind + ': loaded TOX retained Preview'
        assert not loaded.fetch('grapePixelPreviewRecoveryV1', None), kind + ': recovery marker remained'
        assert loaded.op('pixel_preview_recovery').module.capture(loaded) == formal
        checkpoint(kind + ':actual TOX load restores formal without owning manager')
        if kind == 'top':
            child = loaded.create(constantTOP, 'recovery_texture')
            loaded.op('shader').par.tops = child.path
            helper = loaded.op('pixel_preview_recovery').module
            routed = helper.capture(loaded)
            assert routed['tops']['val'] == 'recovery_texture'
            loaded.store('grapePixelPreviewRecoveryV1', {'output': routed})
            loaded.op('shader').par.tops = ''
            moved_tox = GRAPE_TEST_OUTPUT / 'preview-relative-top.tox'
            loaded.save(str(moved_tox))
            nested = area.create(baseCOMP, 'relocated')
            moved = nested.loadTox(str(moved_tox))
            assert moved.path != loaded.path
            assert moved.op('shader').par.tops.evalOPs() == [moved.op('recovery_texture')]
            assert helper.capture(moved) == routed
            assert not moved.fetch('grapePixelPreviewRecoveryV1', None)
            checkpoint('TOP recovery routes copied internal input to copied child',
                       original=loaded.path, relocated=moved.path,
                       source=moved.op('shader').par.tops.evalOPs()[0].path)
            nested.destroy()
        loaded.destroy()
    report['passed'] = True
except Exception:
    report['error'] = traceback.format_exc()
    raise
finally:
    sys.path[:] = old_path
    if area.valid:
        area.destroy()
    after = {path: {name: op(path).op(name).text for name in data} for path, data in before.items()}
    report['userShadersPreserved'] = before == after
    report['userShaderCount'] = len(before)
    if before != after:
        report['passed'] = False
        report['preservationError'] = 'Existing user Shader changed'
    (GRAPE_TEST_OUTPUT / 'results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    result = report
