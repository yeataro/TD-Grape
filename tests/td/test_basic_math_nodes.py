"""Isolated native math compilation and numerical checks, never user shaders.

Run through submit_job.py after deployment. No undefined sqrt/mod inputs or
round-at-half cases are asserted; their limitations are documented in help.
"""
from pathlib import Path
import copy
import json
import uuid

import numpy as np


original = op('/TD_Grape/runtime').module
AREA = '/grape_basic_math_test'
DATA_NAMES = ('state', 'graph', 'manifest', 'pixel_shader', 'vertex_shader')
checks = []
CASES = {
    'sign': ([-2, 0, 3, -.125], [-1, 0, 1, -1]),
    'sqrt': ([0, .0625, .25, 1], [0, .25, .5, 1]),
    'floor': ([-1.75, -.25, .25, 1.75], [-2, -1, 0, 1]),
    'round': ([-1.75, -1.25, 1.25, 1.75], [-2, -1, 1, 2]),
    'ceil': ([-1.75, -.25, .25, 1.75], [-1, 0, 1, 2]),
    'trunc': ([-1.75, -.25, .25, 1.75], [-1, 0, 0, 1]),
    'mod': ([-1.25, -.25, .25, 1.25], [.75, .75, -.75, -.75]),
}
GOOD = [.2, .7, .3, 1]


def user_snapshot():
    return {shader.path: {name: shader.op(name).text for name in DATA_NAMES if shader.op(name)}
            for shader in original._shaders.values() if shader and shader.valid}


assert not op(AREA), 'The native basic math test area already exists'
before = user_snapshot()
area = op('/').create(baseCOMP, AREA.rsplit('/', 1)[-1])
output = Path(GRAPE_TEST_OUTPUT)


def shaped(values, ty):
    return values[0] if ty == 'float' else values[:c.type_components(ty)]


def operation(key, ty, ident='operation'):
    node = c.node(key, ident, type=ty)
    node['inputValues'] = {('a' if key == 'mod' else 'value'): shaped(CASES[key][0], ty)}
    if key == 'mod':
        node['inputValues']['b'] = shaped([1, 1, -1, -1], ty)
    return node


def graph_for(kind, key, ty, runtime=False):
    graph = c.demo_graph('color', kind)
    if kind == 'top':
        graph = c.normalize_top_sources(graph)[0]
        graph['topInputs'] = []
    graph['declarations'] = []
    expected = c.literal(shaped(CASES[key][1], ty), ty)
    check = 'abs(value - '+expected+') < 0.0001' if ty == 'float' else 'all(lessThan(abs(value - '+expected+'), '+ty+'(0.0001)))'
    verify = c.node('glsl_code', 'verify')
    verify['params'].update(functionName='verifyBasicMath',
        inputs=[dict(id='value', name='value', type=ty)],
        outputs=[dict(id='color', name='color', type='vec4')],
        code='color = ('+check+') ? vec4(0.2, 0.7, 0.3, 1.0) : vec4(1.0, 0.0, 0.0, 1.0);')
    graph['stages']['pixel'] = dict(nodes=[operation(key, ty), verify, c.node('pixel_out', 'result')],
        edges=[c.edge('operation', 'verify', 'value'), c.edge('verify', 'result', 'color', 'color')])
    if not runtime:
        graph['stages']['pixel']['nodes'][0]['params']['requireConstant'] = True
    if runtime:
        graph['declarations'].append(dict(id='value_'+key, kind='uniform', name='uMathValue_'+key, type=ty,
                                          value=shaped(CASES[key][0], ty)))
        graph['stages']['pixel']['nodes'].append(c.node('uniform', 'source', declarationId='value_'+key))
        graph['stages']['pixel']['edges'].append(c.edge('source', 'operation', 'a' if key == 'mod' else 'value'))
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
            image = render.numpyArray(delayed=False).copy()
            y, x = image.shape[0] // 2, image.shape[1] // 2
            actual = image[y-6:y+6, x-6:x+6]
    difference = float(np.max(abs(actual - np.array(GOOD))))
    assert difference < .006, (label, difference, actual[0, 0].tolist())
    checks.append(label)


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
        shader = r.create_shader(area, 'BasicMath_' + kind, graph_for(kind, 'sign', 'float'), kind)
        with r.shader_context(shader):
            for key in CASES:
                for ty in c.FLOAT_TYPES:
                    apply_graph(graph_for(kind, key, ty))
                    assert key+'(' in shader.op('pixel_shader').text
                    expect_pixels(shader, kind+': '+key+' '+ty+' native component values')
                apply_graph(graph_for(kind, key, 'vec4', runtime=True))
                assert 'uniform vec4 uMathValue_'+key+';' in shader.op('pixel_shader').text
                expect_pixels(shader, kind+': '+key+' runtime vec4 values')
                if kind == 'mat':
                    graph = graph_for(kind, key, 'vec4')
                    vertex = graph['stages']['vertex']
                    delta = c.node('multiply', 'delta', type='vec4')
                    delta['inputValues'] = {'b': [.01, .01, 0, 0]}
                    vertex['nodes'].extend([operation(key, 'vec4', 'vertex_math'), delta,
                                            c.node('add', 'offset', type='vec4')])
                    vertex['edges'] = [edge for edge in vertex['edges'] if edge['to'] != ['vertex', 'position']]
                    vertex['edges'].extend([c.edge('vertex_math', 'delta', 'a'),
                        c.edge('delta', 'offset', 'b'), c.edge('projection', 'offset', 'a'),
                        c.edge('offset', 'vertex', 'position')])
                    apply_graph(graph)
                    assert key+'(' in shader.op('vertex_shader').text
                    expect_pixels(shader, 'mat: '+key+' live vertex expression compiles')
    result = dict(passed=True, count=len(checks), checks=checks, existingShadersPreserved=True,
                  scope='Native compilation and defined numerical behavior; no optimization or cross-GPU claim.')
finally:
    area.destroy()
    assert user_snapshot() == before, 'Existing user shader data changed during the isolated test'

(output / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
