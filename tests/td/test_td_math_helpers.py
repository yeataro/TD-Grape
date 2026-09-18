"""Disposable TOP/MAT tests for TD math helpers; never applies to a user Shader.

Run through submit_job.py after deployment. Verifies emitted helper signatures,
pixels, vector component behavior and MAT vertex compilation. This is not an
optimizer or cross-platform equivalence test.
"""
from pathlib import Path
import copy
import json
import uuid

import numpy as np


original = op('/TD_Grape/runtime').module
AREA = '/grape_td_math_helper_test'
DATA_NAMES = ('state', 'graph', 'manifest', 'pixel_shader', 'vertex_shader')
checks = []
PASS = [.2, .7, .4, 1]


def user_snapshot():
    return {shader.path: {name: shader.op(name).text for name in DATA_NAMES if shader.op(name)}
            for shader in original._shaders.values() if shader and shader.valid}


assert not op(AREA), 'The native TD helper test area already exists'
before = user_snapshot()
area = op('/').create(baseCOMP, AREA.rsplit('/', 1)[-1])
output = Path(GRAPE_TEST_OUTPUT)


def graph_for(kind, operation, ty, expected, nodes=(), edges=()):
    graph = c.demo_graph('color', kind)
    if kind == 'top':
        graph = c.normalize_top_sources(graph)[0]
        graph['topInputs'] = []
    check = c.node('glsl_code', 'check')
    delta = 'abs(value - ' + c.literal(expected, ty) + ')'
    condition = delta + ' < 0.0002' if ty == 'float' else 'all(lessThan(' + delta + ', ' + ty + '(0.0002)))'
    check['params'].update(functionName='check_math', inputs=[dict(id='value', name='value', type=ty)],
        outputs=[dict(id='checked', name='checked', type='vec4')],
        code='checked = ' + condition + ' ? vec4(0.2, 0.7, 0.4, 1.0) : vec4(1.0, 0.0, 0.0, 1.0);')
    graph['declarations'] = []
    graph['stages']['pixel'] = {
        'nodes': [*copy.deepcopy(list(nodes)), copy.deepcopy(operation), check, c.node('pixel_out', 'result')],
        'edges': [*copy.deepcopy(list(edges)), c.edge(operation['id'], 'check', 'value'), c.edge('check', 'result', 'color', 'checked')],
    }
    return graph


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
            actual = render.numpyArray(delayed=False).copy()
        y, x = actual.shape[0] // 2, actual.shape[1] // 2
        actual = actual[y-6:y+6, x-6:x+6]
    difference = float(np.max(abs(actual - np.array(PASS))))
    assert difference < .006, (label, difference, actual[0, 0].tolist())
    checks.append(label)


def values(ty, components):
    return components[0] if ty == 'float' else components[:c.type_components(ty)]


def operation(key, ty, saved):
    node = c.node(key, 'operation', type=ty)
    if key in ('range_from', 'range_to'):
        node['params']['requireConstant'] = True
    node['inputValues'] = copy.deepcopy(saved)
    return node


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
        initial = graph_for(kind, operation('range_from', 'float', {'value': .25}), 'float', .25)
        shader = r.create_shader(area, 'TDMath_' + kind, initial, kind)
        with r.shader_context(shader):
            for key, port, supplied, expected in [
                ('rgb_to_hsv', 'rgb', [1, 0, 0], [0, 1, 1]),
                ('rgb_to_hsv', 'rgb', [0, 1, 0], [1/3, 1, 1]),
                ('hsv_to_rgb', 'hsv', [1/3, 1, .75], [0, .75, 0]),
            ]:
                apply_graph(graph_for(kind, operation(key, 'vec3', {port: supplied}), 'vec3', expected))
                expect_pixels(shader, kind + ': ' + key + ' ' + str(supplied))
            rgb = operation('rgb_to_hsv', 'vec3', {'rgb': [.2, .4, .6]})
            rgb['id'] = 'hsv'
            back = operation('hsv_to_rgb', 'vec3', {})
            apply_graph(graph_for(kind, back, 'vec3', [.2, .4, .6], [rgb], [c.edge('hsv', 'operation', 'hsv')]))
            expect_pixels(shader, kind + ': RGB to HSV to RGB roundtrip')

            for ty in c.FLOAT_TYPES:
                fill = lambda value: c.filled_value(ty, value)
                cases = [
                    ('remap', dict(value=fill(.375), fromMin=fill(.25), fromMax=fill(.75), toMin=fill(.2), toMax=fill(.8)), fill(.35), 'mapped value'),
                    ('remap', dict(value=fill(-.25), fromMin=fill(0), fromMax=fill(1), toMin=fill(.2), toMax=fill(.6)), fill(.1), 'negative extrapolation'),
                    ('range_from', dict(value=fill(.375), min=fill(.25), max=fill(.75)), fill(.25), 'mapped value'),
                    ('range_from', dict(value=fill(.8), min=fill(.5), max=fill(.5)), fill(.8), 'equal endpoints preserve input'),
                    ('range_from', dict(value=values(ty, [-.25, .5, 1.25, .8]), min=values(ty, [0, .5, 0, .5]), max=values(ty, [1, .5, 1, .5])), values(ty, [-.25, .5, 1.25, .8]), 'mixed equal endpoints and extrapolation'),
                    ('range_from', dict(value=fill(.375), min=fill(.75), max=fill(.25)), fill(.75), 'reversed endpoints'),
                    ('range_to', dict(value=values(ty, [-.25, .5, 1.25, .8]), min=fill(.2), max=fill(.6)), values(ty, [.1, .4, .7, .52]), 'negative and positive extrapolation'),
                    ('range_to', dict(value=fill(.25), min=fill(.8), max=fill(.4)), fill(.7), 'reversed endpoints'),
                    ('range_to', dict(value=fill(1.25), min=fill(.4), max=fill(.4)), fill(.4), 'equal endpoints'),
                    ('loop', dict(value=values(ty, [-.25, -1, 1.25, 2.5]), min=fill(0), max=fill(1)), values(ty, [.75, 0, .25, .5]), 'negative and positive components'),
                    ('zigzag', dict(value=values(ty, [-.25, -1, 1.25, 2.5]), min=fill(0), max=fill(1)), values(ty, [.25, 1, .75, .5]), 'negative and positive components'),
                ]
                for key, saved, expected, suffix in cases:
                    apply_graph(graph_for(kind, operation(key, ty, saved), ty, expected))
                    expect_pixels(shader, kind + ': ' + key + ' ' + ty + ' ' + suffix)

            if kind == 'mat':
                # Every helper/type must compile in vertex context and remain a
                # live input to the final position. Multiplication by zero keeps
                # the geometry stable while exercising all function signatures.
                graph = copy.deepcopy(r.state()['graph'])
                stage = graph['stages']['vertex']
                source = 'projection'
                for key in ('rgb_to_hsv', 'hsv_to_rgb', 'remap', 'range_from', 'range_to', 'loop', 'zigzag'):
                    for ty in (('vec3',) if key in ('rgb_to_hsv', 'hsv_to_rgb') else c.FLOAT_TYPES):
                        ident = key + '_' + ty
                        stage['nodes'].extend([c.node(key, ident, type=ty), c.node('length', ident + '_length', type=ty), c.node('multiply', ident + '_zero', type='float'), c.node('add', ident + '_position', type='vec4')])
                        stage['nodes'][-2]['inputValues'] = {'b': 0}
                        stage['edges'].extend([c.edge(ident, ident + '_length', 'value'), c.edge(ident + '_length', ident + '_zero', 'a'), c.edge(source, ident + '_position', 'a'), c.edge(ident + '_zero', ident + '_position', 'b')])
                        source = ident + '_position'
                stage['edges'] = [edge for edge in stage['edges'] if edge['to'] != ['vertex', 'position']]
                stage['edges'].append(c.edge(source, 'vertex', 'position'))
                apply_graph(graph)
                expect_pixels(shader, 'mat: every TD helper/type compiles in the vertex stage with unchanged geometry')

    result = {'passed': True, 'checks': checks, 'existingShadersPreserved': True,
              'scope': 'Current TD native signatures and numeric behavior; no optimization or cross-platform claim.'}
finally:
    area.destroy()
    assert user_snapshot() == before, 'Existing user shader data changed during the isolated test'

(output / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
