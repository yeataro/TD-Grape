"""Isolated native Compare/If semantics for TOP and MAT.

Run through submit_job.py after the current sources are deployed. Pixel checks
and retained source branches verify behavior, not dead-code elimination or GPU
performance. The disposable manager never deploys to existing user shaders.
"""
from pathlib import Path
import copy
import json
import uuid

import numpy as np


original = op('/TD_Grape/runtime').module
AREA = '/grape_control_test'
DATA_NAMES = ('state', 'graph', 'manifest', 'pixel_shader', 'vertex_shader')
checks = []


def user_snapshot():
    return {shader.path: {name: shader.op(name).text for name in DATA_NAMES if shader.op(name)}
            for shader in original._shaders.values() if shader and shader.valid}


assert not op(AREA), 'The native control test area already exists'
before = user_snapshot()
area = op('/').create(baseCOMP, AREA.rsplit('/', 1)[-1])
output = Path(GRAPE_TEST_OUTPUT)


def api(method, name, body=None):
    with r.history_native_writes():
        return r.process_shader_request(method, '/api/' + name, body or {})


def graph_for(kind, nodes, edges=(), result='choice', ty='float', declarations=()):
    graph = c.demo_graph('color', kind)
    if kind == 'top':
        graph = c.normalize_top_sources(graph)[0]
        graph['topInputs'] = []
    nodes = copy.deepcopy(nodes)
    edges = copy.deepcopy(list(edges))
    # Keep alpha opaque so MAT blending cannot hide a wrong scalar selection.
    if ty != 'vec4':
        nodes.append(c.node('combine', 'rgba', type='vec4',
                            groups={} if ty == 'float' else {'x': ty},
                            components=[0, .1, .2, 1]))
        edges.append(c.edge(result, 'rgba', 'x'))
        result = 'rgba'
    nodes.append(c.node('pixel_out', 'result'))
    edges.append(c.edge(result, 'result', 'color'))
    graph['declarations'] = copy.deepcopy(list(declarations))
    graph['stages']['pixel'] = {'nodes': nodes, 'edges': edges}
    return graph


def apply_graph(graph):
    r.source_module().sync(r)
    state = r.state()
    graph['catalogSnapshot'] = copy.deepcopy(state['graph']['catalogSnapshot'])
    response = r.deploy(graph, state['revision'])
    assert response.get('ok'), response


def pixels(shader):
    if r.shader_kind(shader) == 'top':
        native = r.shader_operator(shader)
        native.cook(force=True)
        return native.numpyArray(delayed=False).copy()
    with r.validation_scene(shader) as render:
        render.cook(force=True)
        image = render.numpyArray(delayed=False).copy()
        y, x = image.shape[0] // 2, image.shape[1] // 2
        return image[y-6:y+6, x-6:x+6]


def expect_pixels(shader, expected, label):
    actual = pixels(shader)
    difference = float(np.max(abs(actual - np.array(expected))))
    assert difference < .006, (label, difference, actual[0, 0].tolist(), expected)
    checks.append(label)


def source_value(ident, value):
    sources = api('GET', 'sources')
    row = next(item for item in sources['uniforms'] + sources['specConstants'] if item['id'] == ident)
    return api('POST', 'source-value', {'revision': sources['revision'], 'id': ident,
               'component': 0, 'expected': row['components'][0], 'value': value})


def native_snapshot(shader):
    return {'data': {name: shader.op(name).text for name in DATA_NAMES if shader.op(name)},
            'operator': (r.shader_operator(shader).path, r.shader_operator(shader).id),
            'registry': copy.deepcopy(shader.fetch(r.source_module().STORE, None)),
            'rows': copy.deepcopy(r.source_module().native_rows(r.shader_operator(shader)))}


TRUE_COLOR = [.2, .4, .6, 1]
FALSE_COLOR = [.7, .5, .3, 1]


def branch_code(ident, color):
    node = c.node('glsl_code', ident)
    node['params'].update(functionName=ident, inputs=[],
                          outputs=[{'id': 'color', 'name': 'selectedColor', 'type': 'vec4'}],
                          code='selectedColor = ' + c.literal(color, 'vec4') + ';')
    return node


def source_graph(kind, source_kind, ty, default):
    declaration = dict(id='control', kind=source_kind, name='uControl' if source_kind == 'uniform' else 'sControl',
                       type=ty, value=default)
    if source_kind == 'spec_constant':
        declaration.update(constantId=7, nativeSequence='const')
    nodes = [c.node(source_kind, 'control', declarationId='control'),
             branch_code('true_branch', TRUE_COLOR), branch_code('false_branch', FALSE_COLOR),
             c.node('if', 'choice', type='vec4')]
    edges = [c.edge('true_branch', 'choice', 'true', 'color'),
             c.edge('false_branch', 'choice', 'false', 'color')]
    if ty == 'bool':
        edges.append(c.edge('control', 'choice', 'condition'))
    else:
        compare = c.node('compare', 'condition', type=ty, operator='>')
        compare['inputValues'] = {'b': .5 if ty == 'float' else 2}
        nodes.append(compare)
        edges.extend([c.edge('control', 'condition', 'a'), c.edge('condition', 'choice', 'condition')])
    return graph_for(kind, nodes, edges, ty='vec4', declarations=[declaration])


def assert_both_branches(shader):
    text = shader.op('pixel_shader').text
    assert '?' in text and 'sg_code_true_branch_' in text and 'sg_code_false_branch_' in text, text
    # Each connected GLSL Code helper has a definition and an invocation.
    for ident in ('true_branch', 'false_branch'):
        assert text.count('sg_code_' + ident + '_' + ident + '(') == 2, text
    return text


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

    comparisons = [('>', (.75, .25), (.25, .75)), ('>=', (.5, .5), (.25, .75)),
                   ('<', (.25, .75), (.75, .25)), ('<=', (.5, .5), (.75, .25)),
                   ('==', (.5, .5), (.25, .75)), ('!=', (.25, .75), (.5, .5))]
    for kind in ('top', 'mat'):
        initial = graph_for(kind, [c.node('if', 'choice', type='float')])
        shader = r.create_shader(area, 'Control_' + kind, initial, kind)
        with r.shader_context(shader):
            for operator, true_pair, false_pair in comparisons:
                for selected, pair in ((True, true_pair), (False, false_pair)):
                    compare = c.node('compare', 'condition', type='float', operator=operator)
                    compare['inputValues'] = dict(zip(('a', 'b'), pair))
                    choice = c.node('if', 'choice', type='float')
                    choice['inputValues'] = {'true': .75, 'false': .25}
                    graph = graph_for(kind, [compare, choice], [c.edge('condition', 'choice', 'condition')])
                    apply_graph(graph)
                    expect_pixels(shader, [.75 if selected else .25, .1, .2, 1],
                                  kind + ': Compare ' + operator + ' returns ' + str(selected))

            for ty in ('float', 'vec2', 'vec3', 'vec4'):
                size = c.type_components(ty)
                for selected in (False, True):
                    choice = c.node('if', 'choice', type=ty)
                    choice['inputValues'] = {'condition': selected,
                        'true': TRUE_COLOR[0] if size == 1 else TRUE_COLOR[:size],
                        'false': FALSE_COLOR[0] if size == 1 else FALSE_COLOR[:size]}
                    apply_graph(graph_for(kind, [choice], ty=ty))
                    expected = [0, .1, .2, 1]
                    expected[:size] = (TRUE_COLOR if selected else FALSE_COLOR)[:size]
                    expect_pixels(shader, expected, kind + ': If ' + ty + ' selects ' + str(selected))

            graph = source_graph(kind, 'uniform', 'float', .25)
            apply_graph(graph)
            source = assert_both_branches(shader)
            for value, expected in ((.25, FALSE_COLOR), (.75, TRUE_COLOR), (.25, FALSE_COLOR)):
                source_value('control', value)
                expect_pixels(shader, expected, kind + ': runtime Uniform ' + str(value) + ' selects its branch')
                assert shader.op('pixel_shader').text == source, 'Uniform edit rewrote generated GLSL'

            # A syntax error in a connected branch must not replace last-good
            # shader data, native sources, operator identity, or output pixels.
            r.source_module().sync(r)
            saved = native_snapshot(shader)
            bad = copy.deepcopy(r.state()['graph'])
            next(node for node in bad['stages']['pixel']['nodes'] if node['id'] == 'true_branch')['params']['code'] = 'selectedColor = unknownControlTestValue;'
            try:
                response = r.deploy(bad, r.state()['revision'])
            except RuntimeError as error:
                assert getattr(error, 'node', None) == 'true_branch', str(error)
                assert getattr(error, 'stage', None) == 'pixel', str(error)
            else:
                raise AssertionError('Invalid connected branch unexpectedly deployed: ' + str(response))
            assert native_snapshot(shader) == saved, 'Failed deploy changed the applied shader or native sources'
            expect_pixels(shader, FALSE_COLOR, kind + ': failed branch compile preserves last-good shader and pixels')

            if kind == 'mat':
                vertex = copy.deepcopy(r.state()['graph'])
                compare = c.node('compare', 'vertex_condition', type='float', operator='>')
                compare['inputValues'] = {'a': .75, 'b': .25}
                choice = c.node('if', 'vertex_choice', type='vec4')
                choice['inputValues'] = {'false': [0, 0, 0, 1]}
                stage = vertex['stages']['vertex']
                stage['nodes'].extend([compare, choice])
                stage['edges'] = [edge for edge in stage['edges'] if edge['to'] != ['vertex', 'position']]
                stage['edges'].extend([c.edge('projection', 'vertex_choice', 'true'),
                                       c.edge('vertex_condition', 'vertex_choice', 'condition'),
                                       c.edge('vertex_choice', 'vertex', 'position')])
                apply_graph(vertex)
                assert '?' in shader.op('vertex_shader').text
                expect_pixels(shader, FALSE_COLOR, 'mat: Vertex Compare/If compiles and preserves visible geometry')

        # Fresh components keep default specialization values independent of
        # previous native parameter overrides. A non-default override must pick
        # the other branch without Python pruning it from generated GLSL.
        for ty, default, alternate in (('int', 1, 3), ('uint', 1, 3), ('bool', False, True)):
            graph = source_graph(kind, 'spec_constant', ty, default)
            spec_shader = r.create_shader(area, 'Spec_' + kind + '_' + ty, graph, kind)
            with r.shader_context(spec_shader):
                source = assert_both_branches(spec_shader)
                assert 'layout(constant_id = 7) const ' + ty + ' sControl' in source
                expect_pixels(spec_shader, FALSE_COLOR, kind + ': ' + ty + ' Spec default selects false branch')
                for value, expected in ((alternate, TRUE_COLOR), (default, FALSE_COLOR)):
                    source_value('control', value)
                    expect_pixels(spec_shader, expected, kind + ': ' + ty + ' Spec override ' + str(value) + ' selects its branch')
                    assert spec_shader.op('pixel_shader').text == source, 'Spec override rewrote GLSL or pruned a branch'

    result = {'passed': True, 'checks': checks, 'existingShadersPreserved': True,
              'scope': 'Native compilation and pixel semantics only; no optimization or performance claim.'}
finally:
    area.destroy()
    assert user_snapshot() == before, 'Existing user shader data changed during the isolated test'

(output / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
