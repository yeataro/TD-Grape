"""Disposable GPU checks for the additive matrix nodes, from current core GLSL.

Run with the coordinated TD runner (GRAPE_ROOT, source_path, GRAPE_TEST_OUTPUT).
The fixture loads its own core/catalog and never deploys to an existing shader.
Pixel probes read every component and bypass only MAT output dithering; vertex
probes compare every component on the GPU and route only the output sink through
a flat diagnostic varying. Double
values originate in graph literals, independently of native dmat transport.
"""
from pathlib import Path
from fractions import Fraction
import copy
import json
import re
import uuid

def build_cases(c):
    """Pure graph fixtures, also compile-checkable outside TouchDesigner."""
    cases = []

    def add(label, nodes, edges, outputs, tolerance=0., updates=None, declarations=()):
        cases.append(dict(label=label, nodes=nodes, edges=edges, outputs=outputs,
                          tolerance=tolerance, updates=updates or [{}], declarations=list(declarations)))

    def result(ty, values, node='operation', port='out'):
        return dict(node=node, port=port, type=ty, expected=list(values))

    def source(ident, ty, values):
        if ty in c.MATRIX_TYPES:
            return c.node('matrix', ident, type=ty, values=values)
        if c.type_components(ty) == 1:
            return c.node('scalar', ident, type=ty, value=values[0])
        return c.node('vector', ident, type=ty, components=values + [0.] * (4-len(values)))

    for ty in c.MATRIX_TYPES:
        d = c.TYPE_DESCRIPTORS[ty]
        # Dyadic values are exact in float32; the extra double bit must survive
        # c.literal and the GPU comparison even though readback is float32.
        values = [(i + .25) * (-1 if i % 2 else 1) for i in range(d['components'])]
        if d['family'] == 'double': values[0] += 2 ** -40
        add('literal/' + ty, [source('operation', ty, values)], [], [result(ty, values)])
        add('identity/' + ty, [c.node('matrix', 'operation', type=ty)], [],
            [result(ty, [float(col == row) for col in range(d['columns']) for row in range(d['rows'])])])

    for ty in ('mat2', 'mat3x2', 'dmat3', 'dmat2x4'):
        d = c.TYPE_DESCRIPTORS[ty]
        columns, rows, family = d['columns'], d['rows'], d['family']
        vector = c.shaped_type(family, rows)
        values = [float(i + 1) for i in range(columns * rows)]
        column = [float(20 + i) for i in range(rows)]
        scalar = [-7.25]
        expected = list(values); expected[:rows] = column; expected[1] = scalar[0]
        nodes = [c.node('matrix_combine', 'operation', type=ty, values=values),
                 source('column', vector, column), source('element', family, scalar)]
        edges = [c.edge('column', 'operation', 'c0'), c.edge('element', 'operation', 'c0y')]
        add('combine/column-and-scalar/' + ty, nodes, edges, [result(ty, expected)])

        baseline = [float(30 + i) for i in range(columns * rows)]
        replaced = list(baseline); replaced[:rows] = column; replaced[1] = scalar[0]
        nodes = [c.node('matrix_replace', 'operation', type=ty, values=values),
                 source('baseline', ty, baseline), source('column', vector, column),
                 source('element', family, scalar)]
        replace_edges = edges + [c.edge('baseline', 'operation', 'value')]
        add('replace/scalar-column-baseline/' + ty, nodes, replace_edges, [result(ty, replaced)])
        add('replace/disconnected-baseline-restores-local/' + ty, copy.deepcopy(nodes), edges,
            [result(ty, expected)])

        # Keep the complete column output connected together with every scalar
        # output. This catches hidden parent ports and swapped C/R coordinates.
        split_outputs = []
        for col in range(columns):
            split_outputs.append(result(vector, values[col*rows:(col+1)*rows], port='c' + str(col)))
            for row, axis in enumerate('xyzw'[:rows]):
                split_outputs.append(result(family, [values[col*rows+row]], port='c' + str(col) + axis))
        add('split/all-parent-and-child-outputs/' + ty,
            [source('baseline', ty, values), c.node('matrix_split', 'operation', type=ty)],
            [c.edge('baseline', 'operation', 'value')], split_outputs)

        for key in ('transpose', 'matrix_comp_mult', 'outer_product'):
            operation = c.node(key, 'operation', type=ty)
            if key == 'transpose':
                operation['inputValues'] = {'value': values}
                expected_type = c.matrix_type(family, rows, columns)
                expected_values = [values[row*rows+col] for col in range(rows) for row in range(columns)]
            elif key == 'matrix_comp_mult':
                b = [float(i % 3 - 1) for i in range(columns * rows)]
                operation['inputValues'] = {'a': values, 'b': b}
                expected_type, expected_values = ty, [a*v for a, v in zip(values, b)]
            else:
                a = [float(row + 2) for row in range(rows)]
                b = [float(1 - 2*col) for col in range(columns)]
                operation['inputValues'] = {'a': a, 'b': b}
                expected_type, expected_values = ty, [b[col]*a[row] for col in range(columns) for row in range(rows)]
            add(key + '/' + ty, [operation], [], [result(expected_type, expected_values)])

        for mode in ('column', 'element'):
            selected_type = vector if mode == 'column' else family
            replacement = [-11.5 - row for row in range(rows)] if mode == 'column' else [-11.5]
            for index_type in ('int', 'uint'):
                declarations = [dict(id=axis, kind='uniform', name='uMatrix' + axis.title(),
                                     type=index_type, value=0) for axis in ('column', 'row')]
                for key in ('matrix_get', 'matrix_set'):
                    operation = c.node(key, 'operation', type=ty, mode=mode, indexType=index_type)
                    operation['inputValues'] = {'value': values}
                    if key == 'matrix_set':
                        operation['inputValues']['replacement'] = replacement if mode == 'column' else replacement[0]
                    nodes = [operation] + [c.node('uniform', axis, declarationId=axis) for axis in ('column', 'row')]
                    edges = [c.edge('column', 'operation', 'column')]
                    if mode == 'element': edges.append(c.edge('row', 'operation', 'row'))
                    output_type = selected_type if key == 'matrix_get' else ty
                    updates = []
                    for col, row in ((0, 0), (columns-1, rows-1)):
                        if key == 'matrix_get':
                            selected = values[col*rows:(col+1)*rows] if mode == 'column' else [values[col*rows+row]]
                        else:
                            selected = list(values)
                            if mode == 'column': selected[col*rows:(col+1)*rows] = replacement
                            else: selected[col*rows+row] = replacement[0]
                        updates.append(dict(column=col, row=row, expected=[selected]))
                    # Both index changes must run against exactly the same GLSL.
                    # Expected values are separate uniforms, not rewritten code.
                    add(key + '/' + mode + '/' + index_type + '/' + ty, nodes, edges,
                        [result(output_type, updates[0]['expected'][0])], updates=updates,
                        declarations=declarations)

    for ty in ('mat2', 'mat4', 'dmat2', 'dmat3'):
        d = c.TYPE_DESCRIPTORS[ty]; size = d['columns']
        # A nonsymmetric, diagonally dominant fixture avoids undefined singular
        # inverse behavior and accidental equality with transpose or identity.
        matrix = [[6+row if row == col else (col+2*row) % 3 - 1
                   for col in range(size)] for row in range(size)]
        values = [float(matrix[row][col]) for col in range(size) for row in range(size)]
        # Independent rational Gaussian elimination: expected values do not
        # duplicate GLSL inverse/determinant or depend on a NumPy installation.
        augmented = [[Fraction(v) for v in matrix[row]] + [Fraction(row == col) for col in range(size)] for row in range(size)]
        determinant = Fraction(1)
        for pivot in range(size):
            divisor = augmented[pivot][pivot]
            assert divisor, 'The deliberately diagonally dominant fixture needs no pivot exchange'
            determinant *= divisor
            augmented[pivot] = [v/divisor for v in augmented[pivot]]
            for row in range(size):
                if row == pivot: continue
                factor = augmented[row][pivot]
                augmented[row] = [a-factor*b for a,b in zip(augmented[row], augmented[pivot])]
        for key in ('inverse', 'determinant'):
            operation = c.node(key, 'operation', type=ty)
            operation['inputValues'] = {'value': values}
            expected_type = ty if key == 'inverse' else d['family']
            expected = [float(augmented[row][size+col]) for col in range(size) for row in range(size)] if key == 'inverse' else [float(determinant)]
            add(key + '/' + ty, [operation], [], [result(expected_type, expected)],
                tolerance=2e-5 if d['family'] == 'float' else 2e-12)
    return cases


def scalar_text(value, family):
    text = format(float(value), '.17g')
    if '.' not in text and 'e' not in text.lower(): text += '.0'
    return text + ('LF' if family == 'double' else '')


def probe_graph(c, case, kind, stage, width):
    graph = c.demo_graph('color', kind)
    if kind == 'top': graph = c.normalize_top_sources(graph)[0]; graph['topInputs'] = []
    graph['declarations'] = copy.deepcopy(case['declarations'])
    inputs, edges, refs, families = [], copy.deepcopy(case['edges']), [], []
    for i, output in enumerate(case['outputs']):
        name, ty = 'value' + str(i), output['type']
        d = c.TYPE_DESCRIPTORS[ty]
        inputs.append(dict(id=name, name=name, type=ty))
        edges.append(c.edge(output['node'], 'observe', name, output['port']))
        if ty in c.MATRIX_TYPES:
            refs.extend(name+'['+str(col)+']['+str(row)+']' for col in range(d['columns']) for row in range(d['rows']))
        elif d['components'] > 1: refs.extend(name+'['+str(n)+']' for n in range(d['components']))
        else: refs.append(name)
        families.extend([d['family']] * d['components'])
    expected = [v for output in case['outputs'] for v in output['expected']]
    checks = []
    dynamic = bool(case['declarations'])
    # Exact double expectations stay GLSL literals. Dynamic indices use integer
    # literal matrix data whose expected values are exactly float-representable.
    for i, (ref, value, family) in enumerate(zip(refs, expected, families)):
        wanted = ('double' if family == 'double' else 'float') + '(uExpected'+str(i)+')' if dynamic else scalar_text(value, family)
        if case['tolerance']:
            check = 'abs('+ref+' - '+wanted+') <= '+scalar_text(case['tolerance'] * max(1., abs(value)), family)
        else: check = ref + ' == ' + wanted
        checks.append(check)
    if stage == 'vertex':
        body = 'color = vec4(0.0, (' + ' && '.join('('+v+')' for v in checks) + ') ? 1.0 : 0.0, 0.5, 1.0);'
    else:
        body = 'int index = min('+str(len(refs)-1)+', int(gl_FragCoord.x * '+str(float(len(refs)))+' / '+str(float(width))+'));\n'
        body += '\n'.join(('if' if i == 0 else 'else if')+' (index == '+str(i)+') color = vec4(float('+ref+'), ('+checks[i]+') ? 1.0 : 0.0, 0.5, 1.0);' for i, ref in enumerate(refs))
    observer = c.node('glsl_code', 'observe', functionName='observeMatrix', inputs=inputs,
                      outputs=[dict(id='color', name='color', type='vec4')], code=body)
    graph['stages'][stage] = dict(nodes=copy.deepcopy(case['nodes']) + [observer, c.node(stage+'_out', 'result')],
                                  edges=edges + [c.edge('observe', 'result', 'color' if stage == 'pixel' else 'position', 'color')])
    return graph, expected


def run_native():
    output = Path(GRAPE_TEST_OUTPUT); output.mkdir(parents=True, exist_ok=True)
    owners = [n for n in op('/').findChildren() if n.storage.get('sgrapeManager', False)]
    assert len(owners) == 1, 'Expected exactly one existing TD-Grape manager'
    runtime = owners[0].op('runtime').module
    def saved():
        return {s.path: {n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
                for s in runtime._shaders.values() if s and s.valid}
    before, selected = saved(), runtime._shader
    registry = {k:s.path for k,s in runtime._shaders.items() if s and s.valid}
    name = 'grape_matrix_nodes_' + uuid.uuid4().hex[:8]
    area = op('/').create(baseCOMP, name)
    report = dict(build=str(app.build), records=[])
    width = 128
    try:
        area.create(textDAT, 'node_catalog').text = source_path('node_catalog.json').read_text(encoding='utf-8')
        area.create(textDAT, 'core').text = source_path('sgrape_core.py').read_text(encoding='utf-8')
        c = area.op('core').module
        top = area.create(glslTOP, 'top_probe'); top_pixel = area.create(textDAT, 'top_pixel')
        top.par.pixeldat = top_pixel; top.par.outputresolution = 'custom'
        top.par.resolutionw = width; top.par.resolutionh = 16; top.par.format = 'rgba32float'
        mat = area.create(glslMAT, 'mat_probe')
        mat_pixel, mat_vertex = mat.par.pdat.eval(), mat.par.vdat.eval()
        geometry = area.create(geometryCOMP, 'geometry'); rectangle = geometry.create(rectangleSOP, 'rectangle')
        for child in geometry.children:
            if child.family in ('SOP', 'POP'): child.render = child == rectangle; child.display = child == rectangle
        geometry.par.material = mat; geometry.par.sx = 2; geometry.par.sy = 2
        camera = area.create(cameraCOMP, 'camera')
        camera.par.tz = 2; camera.par.projection = 'ortho'; camera.par.orthowidth = 1.12
        render = area.create(renderTOP, 'render'); render.par.camera = camera; render.par.geometry = geometry
        render.par.resolutionw = width; render.par.resolutionh = 16
        render.par.format = 'rgba32float'; render.par.antialias = 'aaoff'
        infos = {}
        for native in (top, mat):
            native.par.glslversion = 'glsl450'; native.par.compilebehavior = 'stalluntildone'
            info = area.create(infoDAT, native.name+'_info'); info.par.op = native; infos[native.path] = info
        for case in build_cases(c):
            for kind, stage in (('top', 'pixel'), ('mat', 'pixel'), ('mat', 'vertex')):
                native, target = (top, top) if kind == 'top' else (mat, render)
                graph, expected = probe_graph(c, case, kind, stage, width)
                dynamic = bool(case['declarations'])
                compiled = c.compile_graph(graph)
                extra = '\n'.join('uniform float uExpected'+str(i)+';' for i in range(len(expected))) + '\n' if dynamic else ''
                pixel, vertex = compiled['pixel'], compiled['vertex']
                if stage == 'vertex':
                    # Redirect only the graph output sink for GPU readback.
                    # All matrix node statements remain exactly core-generated.
                    vertex, changes = re.subn(r'gl_Position = ([^;]+);',
                        r'vMatrixProbe = \1; gl_Position = TDWorldToProj(TDDeform(TDPos()));', vertex)
                    assert changes == 1
                    vertex = extra + 'flat out vec4 vMatrixProbe;\n' + vertex
                    pixel = 'flat in vec4 vMatrixProbe;\nlayout(location=0) out vec4 fragColor;\nvoid main(){fragColor=vMatrixProbe;}'
                else:
                    if kind == 'mat':
                        # MAT's normal color sink adds approximately 8-bit
                        # dithering even to rgba32float. Diagnostic channels
                        # must retain exact values; matrix statements stay
                        # byte-for-byte core output, only the sink is adapted.
                        assert pixel.count('TDOutputSwizzle(TDDither(sg_color))') == 1
                        pixel = pixel.replace('TDOutputSwizzle(TDDither(sg_color))', 'TDOutputSwizzle(sg_color)')
                    pixel = extra + pixel
                if kind == 'top': top_pixel.text = pixel
                else: mat_pixel.text = pixel; mat_vertex.text = vertex
                # Configure only this disposable native operator. Small int/uint
                # indices do not depend on matrix/double uniform transport.
                count = len(expected) + 2 if dynamic else 1
                native.seq.vec.numBlocks = count
                for index in range(count): getattr(native.par, 'vec'+str(index)+'name').val = ''
                if dynamic:
                    for index, axis in enumerate(('column', 'row')):
                        getattr(native.par, 'vec'+str(index)+'name').val = 'uMatrix'+axis.title()
                    for index in range(len(expected)):
                        getattr(native.par, 'vec'+str(index+2)+'name').val = 'uExpected'+str(index)
                program = (pixel, vertex)
                for update in case['updates']:
                    row = dict(label=case['label'], target=kind, stage=stage, index=update, expected=expected)
                    try:
                        if dynamic:
                            expected = [v for values in update['expected'] for v in values]
                            row['expected'] = expected
                            for index, axis in enumerate(('column', 'row')):
                                getattr(native.par, 'vec'+str(index)+'valuex').val = update[axis]
                            for index, value in enumerate(expected): getattr(native.par, 'vec'+str(index+2)+'valuex').val = value
                        native.cook(force=True); target.cook(force=True)
                        pixels = target.numpyArray(delayed=False)
                        row['errors'] = str(native.errors() or '') + str(target.errors() or '')
                        row['compileInfo'] = infos[native.path].text
                        row['compiled'] = not row['errors'] and 'ERROR:' not in row['compileInfo']
                        assert pixels is not None, 'GPU readback is unavailable'
                        samples = 1 if stage == 'vertex' else len(expected)
                        colors = [pixels[pixels.shape[0]//2, int((i+.5)*pixels.shape[1]/samples)].tolist() for i in range(samples)]
                        row['actual'] = [color[0] for color in colors] if stage == 'pixel' else None
                        row['componentMatches'] = [abs(color[1]-1.) < 1e-5 for color in colors]
                        row['covered'] = all(abs(color[2]-.5)<1e-5 and abs(color[3]-1.)<1e-5 for color in colors)
                        current = (top_pixel.text, vertex) if kind == 'top' else (mat_pixel.text, mat_vertex.text)
                        row['programUnchanged'] = current == program
                        row['passed'] = bool(row['compiled'] and row['covered'] and row['programUnchanged'] and all(row['componentMatches']))
                    except Exception as exc: row.update(passed=False, error=str(exc))
                    if not row['passed']:
                        artifact = output / ('failure_'+str(len(report['records'])))
                        artifact.with_suffix('.pixel.glsl').write_text(pixel, encoding='utf-8')
                        if vertex: artifact.with_suffix('.vertex.glsl').write_text(vertex, encoding='utf-8')
                        artifact.with_suffix('.graph.json').write_text(json.dumps(graph, indent=2), encoding='utf-8')
                    report['records'].append(row)
        report['completed'] = True
    finally:
        area.destroy()
        report['existingShadersPreserved'] = saved() == before
        report['registryPreserved'] = registry == {k:s.path for k,s in runtime._shaders.items() if s and s.valid} and runtime._shader == selected
        report['fixtureRemoved'] = op('/'+name) is None
        report['passed'] = bool(report.get('completed') and report['records']) and all(row['passed'] for row in report['records']) and all(report[k] for k in ('existingShadersPreserved','registryPreserved','fixtureRemoved'))
        (output/'matrix-nodes-result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    assert report['passed'], {k:v for k,v in report.items() if k != 'records'}
    return dict(passed=True, records=len(report['records']), existingShadersPreserved=True,
                registryPreserved=True, fixtureRemoved=True)


if 'op' in globals():
    result = run_native()
