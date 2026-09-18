"""Isolated TD helper parity in TOP Pixel and MAT Pixel/Vertex.

Run with submit_job.py after deployment. The node result is checked against the
same TD helper called directly in a GLSL Code node. No absolute noise range or
cross-device numeric identity is assumed. Tests own a disposable manager only.
"""
from pathlib import Path
import copy
import json
import uuid

import numpy as np


original = op('/TD_Grape/runtime').module
AREA = '/grape_noise_test'
DATA_NAMES = ('state', 'graph', 'manifest', 'pixel_shader', 'vertex_shader')
checks = []
mode_reports = {}
HELPERS = {'perlin_noise': 'TDPerlinNoise', 'simplex_noise': 'TDSimplexNoise'}
COORDINATES = [.173, -2.41, 3.19, 1.57]
EXPECTED = [0, .25, .5, 1]


def user_snapshot():
    return {shader.path: {name: shader.op(name).text for name in DATA_NAMES if shader.op(name)}
            for shader in original._shaders.values() if shader and shader.valid}


assert not op(AREA), 'The native noise test area already exists'
before = user_snapshot()
area = op('/').create(baseCOMP, AREA.rsplit('/', 1)[-1])
output = Path(GRAPE_TEST_OUTPUT)


def apply_graph(graph):
    r.source_module().sync(r)
    state = r.state()
    graph['catalogSnapshot'] = copy.deepcopy(state['graph']['catalogSnapshot'])
    response = r.deploy(graph, state['revision'])
    assert response.get('ok'), response


def expect_pixels(shader, label):
    if r.shader_kind(shader) == 'top':
        native = r.shader_operator(shader)
        native.cook(force=True)
        actual = native.numpyArray(delayed=False).copy()
    else:
        with r.validation_scene(shader) as render:
            render.cook(force=True)
            image = render.numpyArray(delayed=False).copy()
            y, x = image.shape[0] // 2, image.shape[1] // 2
            actual = image[y-6:y+6, x-6:x+6]
    assert np.all(np.isfinite(actual)), (label, 'Non-finite rendered pixels')
    difference = float(np.max(abs(actual - np.array(EXPECTED))))
    assert difference < .006, (label, difference, actual[0, 0].tolist())
    checks.append(label)


def graph_for(kind, key, ty, stage='pixel', zero=False):
    graph = c.demo_graph('color', kind)
    if kind == 'top':
        graph = c.normalize_top_sources(graph)[0]
        graph['topInputs'] = []
    graph['declarations'] = []
    helper = HELPERS[key]
    coordinates = [0] * c.type_components(ty) if zero else COORDINATES[:c.type_components(ty)]
    source = c.node(ty, 'coordinates', value=coordinates)
    noise = c.node(key, 'noise', type=ty)
    check = c.node('glsl_code', 'verify')
    inputs = [{'id': 'actual', 'name': 'actualNoise', 'type': 'float'},
              {'id': 'point', 'name': 'point', 'type': ty}]
    code = 'float referenceNoise = ' + helper + '(point);\n'
    code += 'bool validNoise = !isnan(actualNoise) && !isinf(actualNoise) && !isnan(referenceNoise) && !isinf(referenceNoise) && abs(actualNoise - referenceNoise) < 0.00001;\n'
    edges = [c.edge('coordinates', 'noise', 'position'),
             c.edge('coordinates', 'verify', 'point'), c.edge('noise', 'verify', 'actual')]
    if stage == 'pixel':
        code += 'checkedColor = validNoise ? vec4(0.0, 0.25, 0.5, 1.0) : vec4(1.0, 0.0, 0.0, 1.0);'
        check['params'].update(functionName='verifyNoise', inputs=inputs,
                               outputs=[{'id': 'color', 'name': 'checkedColor', 'type': 'vec4'}], code=code)
        graph['stages']['pixel'] = {'nodes': [source, noise, check, c.node('pixel_out', 'result')],
                                    'edges': [*edges, c.edge('verify', 'result', 'color', 'color')]}
    else:
        # Invalid vertex helper results move the validation geometry out of
        # view, so the expected center pixels cannot pass on a bad result.
        inputs.append({'id': 'clip', 'name': 'clipPosition', 'type': 'vec4'})
        code += 'checkedPosition = validNoise ? clipPosition : vec4(10.0, 10.0, 10.0, 1.0);'
        check['params'].update(functionName='verifyNoise', inputs=inputs,
                               outputs=[{'id': 'resultClip', 'name': 'checkedPosition', 'type': 'vec4'}], code=code)
        vertex = graph['stages']['vertex']
        vertex['nodes'].extend([source, noise, check])
        vertex['edges'] = [edge for edge in vertex['edges'] if edge['to'] != ['vertex', 'position']]
        vertex['edges'].extend([*edges, c.edge('projection', 'verify', 'clip'), c.edge('verify', 'vertex', 'position', 'resultClip')])
        graph['stages']['pixel'] = {'nodes': [c.node('color', 'color', value=EXPECTED), c.node('pixel_out', 'result')],
                                    'edges': [c.edge('color', 'result', 'color')]}
    return graph


try:
    manager = area.create(baseCOMP, 'manager')
    manager.store('sgrapeManager', True)
    manager.store('sgrapeManagerId', uuid.uuid4().hex)
    page = manager.appendCustomPage('Test')
    page.appendStr('Updatestatus')
    page.appendFolder('Personalfolder')
    manager.par.Personalfolder = str(output / 'empty_personal')
    mapping = json.loads((GRAPE_ROOT / 'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat, filename in mapping.items():
        manager.create(textDAT, dat).text = source_path(filename).read_text(encoding='utf-8')
    r = manager.op('runtime').module
    r._owner = manager
    c = r.core()

    for kind in ('top', 'mat'):
        shader = r.create_shader(area, 'Noise_' + kind, graph_for(kind, 'perlin_noise', 'vec2'), kind)
        with r.shader_context(shader):
            native = r.shader_operator(shader)
            simplex_mode = getattr(native.par, 'simplexnoise', None)
            modes = list(simplex_mode.menuNames) if simplex_mode is not None else []
            mode_reports[kind] = modes
            assert modes, kind + ': host Simplex Noise mode was not found'
            for key, helper in HELPERS.items():
                for mode in modes if key == 'simplex_noise' else [None]:
                    if mode is not None:
                        simplex_mode.val = mode
                    for stage in ('pixel', 'vertex') if kind == 'mat' else ('pixel',):
                        for ty in ('vec2', 'vec3', 'vec4'):
                            for zero in (False, True):
                                apply_graph(graph_for(kind, key, ty, stage, zero))
                                source = shader.op(stage + '_shader').text
                                assert 'float sg_n_noise = ' + helper + '(' in source, source
                                assert 'const float sg_n_noise' not in source, source
                                label = ': '.join([kind, stage, key, ty, mode or 'default', 'zero' if zero else 'fractional coordinates'])
                                expect_pixels(shader, label)
    result = {'passed': True, 'checks': checks, 'hostSimplexModes': mode_reports,
              'existingShadersPreserved': True,
              'scope': 'Native helper parity and finite results; no fixed range, performance, or cross-device numeric claim.'}
finally:
    area.destroy()
    assert user_snapshot() == before, 'Existing user shader data changed during the isolated test'

(output / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
