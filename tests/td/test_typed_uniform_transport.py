"""Native TOP/MAT uniform transport capability regression; never saves TD.

Uses native GLSL operators directly, independent of the in-progress type compiler.
Equality happens on the GPU with typed literals. Readback is only pass/fail and
a four-bit component mask, never an integer value converted to float.
"""
import json
import struct
from pathlib import Path

owners = [n for n in op('/').findChildren() if n.storage.get('sgrapeManager', False)]
assert len(owners) == 1, 'Expected one TD-Grape manager'
runtime = owners[0].op('runtime').module
user_shaders = [s for s in runtime._shaders.values() if s and s.valid]


def user_snapshot():
    names = ('state', 'graph', 'manifest', 'pixel_shader', 'vertex_shader')
    return {shader.path: {name: shader.op(name).text for name in names if shader.op(name)}
            for shader in user_shaders}


before = user_snapshot()
registry_before = {key: value.path for key, value in runtime._shaders.items() if value and value.valid}
selected_before = runtime._shader
area_name = 'grape_typed_uniform_transport_test'
assert not op('/' + area_name), 'Existing probe must not be overwritten'
area = op('/').create(baseCOMP, area_name)
report = {'build': str(app.build), 'metadata': [], 'records': [], 'errors': []}
out = Path(GRAPE_TEST_OUTPUT)


def literal(value, base):
    if base == 'bool': return 'true' if bool(value) else 'false'
    if base == 'uint': return str(int(value) & 0xffffffff) + 'u'
    if base == 'int': return '(-2147483647 - 1)' if value == -2147483648 else str(int(value))
    return repr(float(value))


def result_expression(ty, base, values, index):
    checks = ['(uProbe_' + str(index) + ('.' + 'xyzw'[i] if len(values) > 1 else '')
              + ' == ' + literal(value, base) + ')' for i, value in enumerate(values)]
    mask = ' + '.join('(' + check + ' ? ' + str(1 << i) + 'u : 0u)' for i, check in enumerate(checks))
    return 'vec4((' + ' && '.join(checks) + ') ? 1.0 : 0.0, float(' + mask + ') / 15.0, 1.0, 1.0)'


def make_target(target):
    container = area.create(baseCOMP, target)
    pixel = container.create(textDAT, 'probe_pixel')
    info = container.create(infoDAT, 'probe_info')
    if target == 'top_pixel':
        native = container.create(glslTOP, 'probe')
        native.par.pixeldat = pixel
        native.par.outputresolution = 'custom'
        native.par.format = 'rgba32float'
        renderer = native
        vertex = None
    else:
        native = container.create(glslMAT, 'probe')
        pixel = native.par.pdat.eval()
        vertex = native.par.vdat.eval()
        geo = container.create(geometryCOMP, 'geometry')
        rectangle = geo.create(rectangleSOP, 'rectangle')
        for child in geo.children:
            if child.family in ('SOP', 'POP'):
                child.render = child == rectangle
                child.display = child == rectangle
        geo.par.material = native
        geo.par.sx = 2
        geo.par.sy = 2
        camera = container.create(cameraCOMP, 'camera')
        camera.par.tz = 2
        camera.par.projection = 'ortho'
        camera.par.orthowidth = 1.12
        renderer = container.create(renderTOP, 'render')
        renderer.par.camera = camera
        renderer.par.geometry = geo
        renderer.par.format = 'rgba32float'
        renderer.par.antialias = 'aaoff'
    native.par.glslversion = 'glsl450'
    native.par.compilebehavior = 'stalluntildone'
    info.par.op = native
    metadata = {'target': target, 'pages': [page.name for page in native.pages], 'parameters': []}
    for par in native.pars('vec*', 'integer*', 'int*'):
        row = {'name': par.name, 'style': str(par.style)}
        for key in ('min', 'max', 'clampMin', 'clampMax', 'menuNames', 'menuLabels'):
            try: row[key] = getattr(par, key)
            except Exception: pass
        metadata['parameters'].append(row)
    report['metadata'].append(metadata)
    return native, renderer, pixel, vertex, info


def run_batch(target, objects, ty, base, cases, mode='CONSTANT'):
    native, renderer, pixel, vertex, info = objects
    count = len(cases)
    width = max(32, count * 8)
    renderer.par.resolutionw = width
    renderer.par.resolutionh = 16
    native.seq.vec.numBlocks = count
    header = '\n'.join('uniform ' + ty + ' uProbe_' + str(i) + ';' for i in range(count)) + '\n'
    outputs = [result_expression(ty, base, case['expected'], i) for i, case in enumerate(cases)]
    index = 'min(' + str(count - 1) + ', int(gl_FragCoord.x * ' + str(float(count)) + ' / ' + str(float(width)) + '))'
    vertex_main = 'gl_Position = TDWorldToProj(TDDeform(TDPos()));'
    if target == 'mat_vertex':
        vertex.text = header + 'flat out vec4 probeResults[' + str(count) + '];\nvoid main(){\n' + '\n'.join(
            'probeResults[' + str(i) + '] = ' + expression + ';' for i, expression in enumerate(outputs)
        ) + '\n' + vertex_main + '\n}'
        pixel.text = 'flat in vec4 probeResults[' + str(count) + '];\nlayout(location=0) out vec4 fragColor;\nvoid main(){fragColor=probeResults[' + index + '];}'
    else:
        if vertex: vertex.text = 'void main(){' + vertex_main + '}'
        pixel.text = header + 'layout(location=0) out vec4 fragColor;\nvoid main(){\nint probeIndex=' + index + ';\n' + '\n'.join(
            ('if' if i == 0 else 'else if') + '(probeIndex == ' + str(i) + ') fragColor=' + expression + ';'
            for i, expression in enumerate(outputs)
        ) + '\n}'
    rows = []
    for i, case in enumerate(cases):
        getattr(native.par, 'vec' + str(i) + 'name').val = 'uProbe_' + str(i)
        values = []
        for component, suffix in enumerate('xyzw'):
            par = getattr(native.par, 'vec' + str(i) + 'value' + suffix)
            value = case['values'][component] if component < len(case['values']) else 0
            if mode == 'EXPRESSION': par.expr = repr(value)
            else:
                par.mode = ParMode.CONSTANT
                par.val = value
            values.append(par.eval())
        rows.append({'target': target, 'type': ty, 'mode': mode, 'values': case['values'],
                     'expected': case['expected'], 'domainValid': case.get('domainValid', True),
                     'nativeParameterValues': values[:len(case['values'])]})
    try:
        native.cook(force=True)
        renderer.cook(force=True)
        pixels = renderer.numpyArray(delayed=False)
        failure = str(native.errors() or renderer.errors() or '')
        compile_info = info.text
        if failure or 'ERROR:' in compile_info: raise RuntimeError((failure + '\n' + compile_info)[:5000])
        for i, row in enumerate(rows):
            x = min(pixels.shape[1] - 1, int((i + .5) * pixels.shape[1] / count))
            color = pixels[pixels.shape[0] // 2, x].tolist()
            assert color[2] > .99 and color[3] > .99, 'Readback missed covered test geometry'
            mask = round(color[1] * 15)
            row.update(compiled=True, passed=color[0] > .99, componentMatches=[bool(mask & (1 << j)) for j in range(len(row['values']))], pixel=color)
    except Exception as error:
        for row in rows: row.update(compiled=False, passed=False, error=str(error))
    report['records'].extend(rows)


def cases(rows):
    return [{'values': list(values), 'expected': list(values)} for values in rows]


scalar_int = [-2147483648, -16777218, -16777217, -16777216, -16777215, -1, 0, 1, 16777215, 16777216, 16777217, 16777218, 2147483520, 2147483646, 2147483647]
scalar_uint = [0, 1, 16777215, 16777216, 16777217, 16777218, 2147483647, 2147483648, 2147483904, 3221225472, 4294967040, 4294967294, 4294967295]
batches = [
    ('float', 'float', cases([[.25], [-1.5]])),
    ('int', 'int', cases([[value] for value in scalar_int])),
    ('uint', 'uint', cases([[value] for value in scalar_uint])),
    ('bool', 'bool', cases([[False], [True]])),
]
for size in (2, 3, 4):
    batches += [
        ('ivec' + str(size), 'int', cases([values[:size] for values in [
            [3, -7, 11, -13], [-2147483648, 2147483647, -1, 0],
            [16777215, 16777216, 16777217, -16777217], [16777217, -16777217, -16777215, 16777215]]])),
        ('uvec' + str(size), 'uint', cases([values[:size] for values in [
            [1, 7, 13, 19], [0, 4294967295, 1, 4294967294],
            [16777215, 16777216, 16777217, 2147483648], [16777217, 2147483647, 2147483648, 4294967294],
            [2147483520, 2147483648, 2147483904, 3221225472], [4294967040, 1, 16777218, 0]]])),
        ('bvec' + str(size), 'bool', cases([values[:size] for values in [[False, True, False, True], [True, False, True, False]]])),
    ]
try:
    for target in ('top_pixel', 'mat_pixel', 'mat_vertex'):
        objects = make_target(target)
        for ty, base, inputs in batches:
            run_batch(target, objects, ty, base, inputs)
        for ty, base, inputs in batches:
            if ty in ('int', 'uint', 'ivec4', 'uvec4', 'bool', 'bvec4'):
                run_batch(target, objects, ty, base, inputs, 'EXPRESSION')
except Exception as error:
    report['errors'].append(str(error))
    raise
finally:
    area.destroy()
    report['existingShadersPreserved'] = user_snapshot() == before
    report['registryPreserved'] = registry_before == {key: value.path for key, value in runtime._shaders.items() if value and value.valid} and runtime._shader == selected_before
    report['fixtureRemoved'] = op('/' + area_name) is None
    (out / 'results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    assert report['existingShadersPreserved'] and report['registryPreserved'] and report['fixtureRemoved']

# Native XYZW parameters store doubles but this TD build converts their values
# through float32 before uploading typed integer uniforms. MAT additionally
# transports uint values above 2^31 as 2^31 (both pixel and vertex stages).
# These assertions document this native build; a TD fix should update the test
# and the corresponding source-value guard together. Expected losses
# remain explicit regression evidence, not silent pass/fail omissions.
for row in report['records']:
    assert row['compiled'], row
    integer = row['type'] in ('int', 'uint') or row['type'].startswith(('ivec', 'uvec'))
    unsigned_mat = row['target'].startswith('mat_') and (row['type'] == 'uint' or row['type'].startswith('uvec'))
    predicted = [(struct.unpack('f', struct.pack('f', value))[0] == value and (not unsigned_mat or value <= 2147483648)) if integer else True for value in row['values']]
    assert row['componentMatches'] == predicted, row
    assert row['passed'] == all(predicted), row
    assert row['nativeParameterValues'] == row['values'], 'TD parameter value itself changed: ' + str(row)
result = {'records': len(report['records']), 'exactCases': sum(row['passed'] for row in report['records']),
          'knownTransportLossCases': sum(not row['passed'] for row in report['records']),
          'knownTransportPatternVerified': True,
          'existingShadersPreserved': True, 'registryPreserved': True, 'fixtureRemoved': True}
