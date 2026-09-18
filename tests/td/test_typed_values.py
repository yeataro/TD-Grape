"""Native typed values, constructors, conversions and Uniform history.

Root submits after type sources are complete. The disposable manager loads the
current checked source tree; existing user shaders and their registry are never
used as fixtures. Integer checks remain integer comparisons on the GPU.
"""
from pathlib import Path
import copy
import json
import uuid

import numpy as np

original = op('/TD_Grape/runtime').module
AREA = '/grape_typed_values_test'
NAMES = ('state', 'graph', 'manifest', 'pixel_shader', 'vertex_shader')
checks = []
output = Path(GRAPE_TEST_OUTPUT)


def snapshot():
    return {s.path: {name: s.op(name).text for name in NAMES if s.op(name)}
            for s in original._shaders.values() if s and s.valid}


before = snapshot()
assert not op(AREA)
area = op('/').create(baseCOMP, AREA.rsplit('/', 1)[-1])


def api(method, name, body=None):
    with r.history_native_writes():
        return r.process_shader_request(method, '/api/' + name, body or {})


def blank(kind):
    graph = c.demo_graph('color', kind)
    if kind == 'top':
        graph = c.normalize_top_sources(graph)[0]
        graph['topInputs'] = []
    graph['declarations'] = []
    graph['stages']['pixel'] = {'nodes': [], 'edges': []}
    return graph


def shape(ty, values):
    size = c.type_components(ty)
    return values[0] if size == 1 else list(values[:size])


def value_node(ident, ty, value):
    if c.type_components(ty) == 1:
        return c.node('scalar', ident, type=ty, value=value)
    family = c.TYPE_DESCRIPTORS[ty]['family']
    return c.node('vector', ident, type=ty, components=list(value) + [False if family == 'bool' else 0] * (4 - len(value)))


def equals(name, ty, value):
    literal = c.literal(value, ty)
    return '(' + name + ' == ' + literal + ')' if c.type_components(ty) == 1 else 'all(equal(' + name + ', ' + literal + '))'


def case(label, ty, expected, nodes, edges=(), output_id=None, output_port='out', declarations=()):
    return dict(label=label, type=ty, expected=expected, nodes=nodes, edges=list(edges),
                output=output_id or nodes[-1]['id'], port=output_port, declarations=list(declarations))


def graph_for(kind, batch):
    graph = blank(kind)
    nodes = graph['stages']['pixel']['nodes']
    edges = graph['stages']['pixel']['edges']
    ports = []
    predicates = []
    for index, item in enumerate(batch):
        nodes.extend(copy.deepcopy(item['nodes']))
        edges.extend(copy.deepcopy(item['edges']))
        graph['declarations'].extend(copy.deepcopy(item['declarations']))
        name = 'value' + str(index)
        ports.append(dict(id=name, name=name, type=item['type']))
        predicates.append(equals(name, item['type'], item['expected']))
        edges.append(c.edge(item['output'], 'check', name, item['port']))
    check = c.node('glsl_code', 'check')
    check['params'].update(functionName='check_typed_values', inputs=ports,
                          outputs=[dict(id='result', name='result', type='vec4')],
                          code='int failure = 0;\n' + '\n'.join('if(!' + p + ') failure = ' + str(i + 1) + ';' for i, p in enumerate(predicates))
                          + '\nresult = vec4(failure == 0 ? 1.0 : 0.0, float(failure) / 255.0, 1.0, 1.0);')
    nodes.extend([check, c.node('pixel_out', 'output')])
    edges.append(c.edge('check', 'output', 'color', 'result'))
    return graph


def apply_graph(graph):
    r.source_module().sync(r)
    state = r.state()
    graph['catalogSnapshot'] = copy.deepcopy(state['graph']['catalogSnapshot'])
    response = r.deploy(graph, state['revision'])
    assert response.get('ok'), response


def pixel(shader):
    if r.shader_kind(shader) == 'top':
        renderer = r.shader_operator(shader)
        renderer.cook(force=True)
        image = renderer.numpyArray(delayed=False)
    else:
        with r.validation_scene(shader) as renderer:
            renderer.par.format = 'rgba32float'
            renderer.par.resolutionw = 32
            renderer.par.resolutionh = 32
            renderer.cook(force=True)
            image = renderer.numpyArray(delayed=False).copy()
    return image[image.shape[0] // 2, image.shape[1] // 2].tolist()


def assert_pixel(shader, expected, label):
    actual = pixel(shader)
    assert float(np.max(abs(np.asarray(actual) - np.asarray(expected)))) < .006, (label, actual, expected)


def test_cases(shader, kind, cases):
    for offset in range(0, len(cases), 16):
        batch = cases[offset:offset + 16]
        apply_graph(graph_for(kind, batch))
        actual = pixel(shader)
        failed = round(actual[1] * 255)
        assert actual[0] > .99 and actual[2] > .99, (kind, batch[failed - 1]['label'] if failed else 'coverage', actual)
        checks.extend(kind + ': ' + item['label'] for item in batch)


def typed_cases():
    rows = []
    values = {'float': [.25, -.5, .75, 1.0], 'int': [-2147483648, -16777217, 16777217, 2147483647],
              'uint': [4294967295, 16777217, 0, 2147483648], 'bool': [False, True, False, True]}
    for index, ty in enumerate(c.TYPES):
        value = shape(ty, values[c.TYPE_DESCRIPTORS[ty]['family']])
        ident = 'literal' + str(index)
        rows.append(case('typed constructor ' + ty, ty, value, [value_node(ident, ty, value)]))
        ident = 'constant' + str(index)
        declaration = dict(id=ident, kind='constant', name='cValue' + str(index), type=ty, value=value)
        rows.append(case('full-range constant ' + ty, ty, value, [c.node('constant', ident, declarationId=ident)], declarations=[declaration]))
        for selected in (False, True):
            ident = 'if' + str(index) + str(int(selected))
            choice = c.node('if', ident, type=ty)
            choice['inputValues'] = {'condition': selected, 'true': value, 'false': c.filled_value(ty)}
            rows.append(case('If ' + ty + ' ' + str(selected), ty, value if selected else c.filled_value(ty), [choice]))
        if c.type_components(ty) > 1:
            prefix = 'vector' + str(index)
            source = value_node(prefix + 'source', ty, value)
            split = c.node('vector_split', prefix + 'split', type=ty)
            combine = c.node('combine', prefix + 'combine', type=ty)
            swizzle = c.node('swizzle', prefix + 'swizzle', type=ty, mask='xyzw'[:len(value)][::-1])
            edges = [c.edge(source['id'], split['id'], 'value'), c.edge(combine['id'], swizzle['id'], 'value')]
            edges.extend(c.edge(split['id'], combine['id'], channel, channel) for channel in 'xyzw'[:len(value)])
            rows.append(case('split/combine/swizzle ' + ty, ty, value[::-1], [source, split, combine, swizzle], edges))
    for family in ('int', 'uint'):
        left = [-7, 5, -9, 11] if family == 'int' else [7, 10, 19, 23]
        right = [3, 2, 4, 5]
        for size in range(1, 5):
            ty = c.shaped_type(family, size)
            for key in ('add', 'subtract', 'multiply', 'divide', 'mod', 'min', 'max'):
                # GLSL leaves integer % with negative operands undefined.
                # Exercise native int % only in its specified domain.
                operands = [abs(v) for v in left] if key == 'mod' else left
                expected = []
                for a, b in zip(operands, right):
                    v = {'add': a + b, 'subtract': a - b, 'multiply': a * b, 'divide': int(a / b),
                         'mod': a - int(a / b) * b, 'min': min(a, b), 'max': max(a, b)}[key]
                    expected.append(v)
                ident = family + str(size) + key
                node = c.node(key, ident, type=ty)
                node['inputValues'] = {'a': shape(ty, operands), 'b': shape(ty, right)}
                rows.append(case('integer arithmetic ' + key + ' ' + ty, ty, shape(ty, expected), [node]))
    for index, (source, target, value, expected) in enumerate([
        ('float', 'int', 3.75, 3), ('vec2', 'ivec2', [3.75, -2.25], [3, -2]),
        ('int', 'float', -3, -3.0), ('uint', 'float', 3, 3.0),
        ('int', 'uint', -1, 4294967295), ('uint', 'int', 4294967295, -1),
        ('float', 'bool', 0.0, False), ('float', 'bool', -.25, True),
        ('bvec4', 'ivec4', [True, False, False, True], [1, 0, 0, 1]),
        ('ivec4', 'bvec4', [0, -2, 3, 0], [False, True, True, False]),
        ('uvec3', 'bvec3', [0, 1, 4294967295], [False, True, True]),
        ('bool', 'vec4', True, [1.0] * 4), ('int', 'ivec3', -2, [-2] * 3),
        ('float', 'vec2', .25, [.25, .25]), ('bvec2', 'uvec2', [True, False], [1, 0]),
    ]):
        ident = 'convert' + str(index)
        node = c.node('convert', ident, fromType=source, toType=target)
        node['inputValues'] = {'value': value}
        rows.append(case('Convert ' + source + ' to ' + target, target, expected, [node]))
    node = c.node('add', 'unsignedWrap', type='uint')
    node['inputValues'] = {'a': 4294967295, 'b': 1}
    rows.append(case('unsigned addition wraps at 32 bits', 'uint', 0, [node]))
    return rows


def uniform_graph(kind):
    graph = blank(kind)
    graph['declarations'] = []
    nodes = graph['stages']['pixel']['nodes']
    edges = graph['stages']['pixel']['edges']
    inputs, initial, allowed, pairs = [], [], [], []
    base = {'float': [.25, .5, .75, 1.0], 'int': [-2147483648, -16777216, -1, 16777216],
            'uint': [0, 16777216, 2147483648, 4294967040], 'bool': [False, True, False, True]}
    alternate = {'float': [-.25, 1.5, -.75, 2.0], 'int': [-2147483520, -16777218, 16777218, 2147483520],
                 'uint': [1, 16777218, 2147483904, 4294966784], 'bool': [True, False, True, False]}
    if kind == 'mat':
        # Native MAT converts uint > 2^31 to 2^31; retain honest GPU checks.
        base['uint'] = [0, 16777216, 1073741824, 2147483648]
        alternate['uint'] = [1, 16777218, 1073741952, 2147483520]
    for index, ty in enumerate(c.TYPES):
        family = c.TYPE_DESCRIPTORS[ty]['family']
        count = c.type_components(ty)
        ident, name = 'source' + str(index), 'uSource' + str(index)
        graph['declarations'].append(dict(id=ident, kind='uniform', name=name, type=ty, value=shape(ty, base[family])))
        nodes.append(c.node('uniform', ident, declarationId=ident))
        inputs.append(dict(id=name, name=name, type=ty))
        edges.append(c.edge(ident, 'check', name))
        initial.append(equals(name, ty, shape(ty, base[family])))
        for component in range(count):
            expr = name if count == 1 else name + '.' + 'xyzw'[component]
            allowed.append('(' + equals(expr, family, base[family][component]) + ' || ' + equals(expr, family, alternate[family][component]) + ')')
            pairs.append((ident, ty, component, base[family][component], alternate[family][component]))
    check = c.node('glsl_code', 'check')
    check['params'].update(functionName='check_uniform_values', inputs=inputs,
                          outputs=[dict(id='result', name='result', type='vec4')],
                          code='result = vec4((' + ' && '.join(initial) + ') ? 1.0 : 0.0, (' + ' && '.join(allowed) + ') ? 1.0 : 0.0, 1.0, 1.0);')
    nodes.extend([check, c.node('pixel_out', 'output')])
    edges.append(c.edge('check', 'output', 'color', 'result'))
    return graph, pairs


def source_row(data, ident):
    return next(row for row in data['uniforms'] if row['id'] == ident)


def write_source(ident, component, value):
    seen = api('GET', 'sources')
    return api('POST', 'source-value', dict(revision=seen['revision'], id=ident, component=component,
               expected=source_row(seen, ident)['components'][component], value=value))


def restore(current, target, ident, delta=None):
    body = dict(requestId=uuid.uuid4().hex, revision=r.state()['revision'], fromToken=current['history']['token'],
                toToken=target['history']['token'], sourceIds=[ident], graph=copy.deepcopy(target['graph']),
                currentGraph=copy.deepcopy(current.get('workingGraph', current['graph'])))
    if delta: body.update(deltaFromToken=delta[0]['history']['token'], deltaToToken=delta[1]['history']['token'])
    return api('POST', 'history-restore', body)


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
    assert len(c.TYPES) == 16
    for kind in ('top', 'mat'):
        initial = graph_for(kind, [case('bootstrap', 'float', .25, [value_node('bootstrap', 'float', .25)])])
        shader = r.create_shader(area, 'Values_' + kind, initial, kind)
        with r.shader_context(shader):
            test_cases(shader, kind, typed_cases())
        graph, pairs = uniform_graph(kind)
        shader = r.create_shader(area, 'Uniforms_' + kind, graph, kind)
        with r.shader_context(shader):
            code = shader.op('pixel_shader').text
            assert_pixel(shader, [1, 1, 1, 1], 'all native Uniform defaults')
            for ident, ty, component, default, alternate in pairs:
                initial = api('GET', 'sources')
                parameter = getattr(r.shader_operator(shader).par, source_row(initial, ident)['components'][component]['parameter'])
                changed = write_source(ident, component, alternate)
                assert parameter.eval() == alternate
                assert_pixel(shader, [0, 1, 1, 1], ty + ' changed component ' + str(component))
                undone = restore(changed, initial, ident)
                assert parameter.eval() == default
                assert_pixel(shader, [1, 1, 1, 1], ty + ' Undo')
                redone = restore(undone, changed, ident, (initial, changed))
                assert parameter.eval() == alternate
                assert_pixel(shader, [0, 1, 1, 1], ty + ' Redo')
                restore(redone, initial, ident)
                current_par = getattr(r.shader_operator(shader).par, source_row(api('GET', 'sources'), ident)['components'][component]['parameter'])
                assert current_par.isSamePar(parameter)
                assert shader.op('pixel_shader').text == code, 'Runtime Uniform write rewrote GLSL'
                checks.append(kind + ': live ' + ty + ' component ' + str(component) + ' GPU value and exact native Undo/Redo')
            # Legal 32-bit values remain editable even when this native TD
            # build loses precision during GPU upload. Verify raw storage and
            # replay here; exact GPU transport is a separate capability test.
            accepted = [('int', 16777217), ('int', 2147483647), ('uint', 4294967295),
                        ('ivec4', -16777217), ('uvec4', 4294967294),
                        ('uint', 2147483904), ('uvec4', 4294967040)]
            for ty, raw in accepted:
                initial = api('GET', 'sources')
                row = next(row for row in initial['uniforms'] if row['type'] == ty)
                ident = row['id']
                parameter = getattr(r.shader_operator(shader).par, row['components'][0]['parameter'])
                default = parameter.eval()
                changed = write_source(ident, 0, raw)
                assert parameter.eval() == raw
                assert source_row(changed, ident)['components'][0]['value'] == raw
                undone = restore(changed, initial, ident)
                assert parameter.eval() == default
                redone = restore(undone, changed, ident, (initial, changed))
                assert parameter.eval() == raw
                assert source_row(redone, ident)['components'][0]['value'] == raw
                restore(redone, initial, ident)
                assert parameter.eval() == default
                current_par = getattr(r.shader_operator(shader).par, source_row(api('GET', 'sources'), ident)['components'][0]['parameter'])
                assert current_par.isSamePar(parameter)
                assert shader.op('pixel_shader').text == code, 'Raw Uniform value replay rewrote GLSL'
                checks.append(kind + ': native ' + ty + ' accepts raw ' + str(raw) + ' with exact storage and Undo/Redo regardless of GPU precision')
            assert_pixel(shader, [1, 1, 1, 1], 'raw-value replay restored all exact defaults')
            invalid = [('int', .5), ('int', -2147483649), ('int', 2147483648),
                       ('uint', -1), ('uint', 4294967296), ('bool', .5),
                       ('ivec4', -.5), ('uvec4', -1), ('bvec4', -1),
                       ('float', float('inf')), ('vec4', float('nan'))]
            for ty, bad in invalid:
                seen = api('GET', 'sources')
                row = next(row for row in seen['uniforms'] if row['type'] == ty)
                old = (shader.op('state').text, copy.deepcopy(r.source_module().native_rows(r.shader_operator(shader))))
                rejected = False
                try: write_source(row['id'], 0, bad)
                except (RuntimeError, ValueError): rejected = True
                assert rejected, 'Out-of-domain native value accepted: ' + ty + ' ' + str(bad)
                assert old == (shader.op('state').text, r.source_module().native_rows(r.shader_operator(shader)))
                assert shader.op('pixel_shader').text == code
                checks.append(kind + ': native ' + ty + ' rejects ' + str(bad) + ' without changing state or shader')
            assert_pixel(shader, [1, 1, 1, 1], 'invalid writes preserved all defaults')
    result = {'passed': True, 'checks': checks, 'existingShadersPreserved': True}
finally:
    area.destroy()
    assert snapshot() == before, 'Existing user shader data changed'

(output / 'results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
