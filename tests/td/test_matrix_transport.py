"""Disposable TD native transport audit; run through the coordinated TD runner.

An unsupported native transport is a recorded result, not a graph type ban.
Every cell is checked on the GPU, including nonsquare column/row ordering.
No product source needs deploying to run this probe.
"""
import json
import uuid
from pathlib import Path

owners = [n for n in op('/').findChildren() if n.storage.get('sgrapeManager', False)]
assert len(owners) == 1, 'Expected one TD-Grape manager'
runtime = owners[0].op('runtime').module

def saved():
    return {s.path: {n: s.op(n).text for n in ('state', 'graph', 'manifest', 'pixel_shader', 'vertex_shader') if s.op(n)}
            for s in runtime._shaders.values() if s and s.valid}

before = saved()
registry = {k: s.path for k, s in runtime._shaders.items() if s and s.valid}
selected = runtime._shader
name = 'grape_matrix_transport_' + uuid.uuid4().hex[:8]
area = op('/').create(baseCOMP, name)
report = {'build': str(app.build), 'records': []}
conversions_only = bool(globals().get('GRAPE_MATRIX_CONVERSIONS_ONLY', False))

def glsl(value, double=False):
    return repr(float(value)) + ('lf' if double else '')

try:
    patterns = [[[float(100 * source + 10 * (r + 1) + c + 1) * (-1 if (r+c) % 2 else 1) + .25
                  for c in range(4)] for r in range(4)] for source in range(3)]
    matrix = tdu.Matrix()
    for r in range(4):
        for c in range(4): matrix[r, c] = patterns[0][r][c]
    area.store('probeMatrix', matrix)
    table = area.create(tableDAT, 'matrix_table')
    table.clear()
    for row in patterns[1]: table.appendRow(row)
    chop = area.create(constantCHOP, 'matrix_chop')
    chop.seq.const.numBlocks = 16
    for c in range(4):
        for r in range(4):
            i = c * 4 + r
            getattr(chop.par, 'const'+str(i)+'name').val = 'm'+str(i)
            getattr(chop.par, 'const'+str(i)+'value').val = patterns[2][r][c]
    top = area.create(glslTOP, 'top_probe')
    top_pixel = area.create(textDAT, 'top_pixel')
    top.par.pixeldat = top_pixel
    top.par.outputresolution = 'custom'
    top.par.resolutionw = 128; top.par.resolutionh = 16
    top.par.format = 'rgba32float'
    mat = area.create(glslMAT, 'mat_probe')
    mat_pixel = mat.par.pdat.eval(); mat_vertex = mat.par.vdat.eval()
    geo = area.create(geometryCOMP, 'geometry')
    rectangle = geo.create(rectangleSOP, 'rectangle')
    for child in geo.children:
        if child.family in ('SOP', 'POP'):
            child.render = child == rectangle; child.display = child == rectangle
    geo.par.material = mat; geo.par.sx = 2; geo.par.sy = 2
    camera = area.create(cameraCOMP, 'camera')
    camera.par.tz = 2; camera.par.projection = 'ortho'; camera.par.orthowidth = 1.12
    renderer = area.create(renderTOP, 'render')
    renderer.par.camera = camera; renderer.par.geometry = geo
    renderer.par.format = 'rgba32float'; renderer.par.antialias = 'aaoff'
    renderer.par.resolutionw = 128; renderer.par.resolutionh = 16
    infos = {}
    for native in (top, mat):
        native.par.glslversion = 'glsl450'; native.par.compilebehavior = 'stalluntildone'
        native.seq.matrix.numBlocks = 1; native.par.matrix0name = 'uProbe'
        info = area.create(infoDAT, native.name+'_info'); info.par.op = native
        infos[native.path] = info
    position = 'gl_Position = TDWorldToProj(TDDeform(TDPos()));'

    def run(native, stage, ty, references, expected, source, declaration_type=None):
        count = len(expected); double = ty.startswith('d')
        outputs = ['vec4(float('+ref+'), ('+ref+' == '+glsl(value, double)+') ? 1.0 : 0.0, 0.5, 1.0)'
                   for ref, value in zip(references, expected)]
        header = '' if declaration_type == '' else 'uniform '+(declaration_type or ty)+' uProbe;\n'
        index = 'min('+str(count-1)+', int(gl_FragCoord.x * '+str(float(count))+' / 128.0))'
        row = {'target': 'TOP' if native == top else 'MAT', 'stage': stage, 'type': ty,
               'source': source, 'expected': expected}
        try:
            if stage == 'vertex':
                mat_vertex.text = header+'flat out vec4 probeResults['+str(count)+'];\nvoid main(){\n'+'\n'.join(
                    'probeResults['+str(i)+'] = '+out+';' for i, out in enumerate(outputs))+'\n'+position+'\n}'
                mat_pixel.text = 'flat in vec4 probeResults['+str(count)+'];\nlayout(location=0) out vec4 fragColor;\nvoid main(){fragColor=probeResults['+index+'];}'
            else:
                if native == mat: mat_vertex.text = 'void main(){'+position+'}'
                pixel = top_pixel if native == top else mat_pixel
                pixel.text = header+'layout(location=0) out vec4 fragColor;\nvoid main(){int i='+index+';\n'+'\n'.join(
                    ('if' if i == 0 else 'else if')+'(i=='+str(i)+') fragColor='+out+';' for i, out in enumerate(outputs))+'\n}'
            native.cook(force=True)
            target = top if native == top else renderer
            target.cook(force=True)
            pixels = target.numpyArray(delayed=False)
            row['errors'] = str(native.errors() or '') + str(target.errors() or '')
            row['compileInfo'] = infos[native.path].text
            row['compiled'] = not row['errors'] and 'ERROR:' not in row['compileInfo']
            if pixels is not None:
                colors = [pixels[pixels.shape[0]//2, int((i+.5)*pixels.shape[1]/count)].tolist() for i in range(count)]
                row['actual'] = [c[0] for c in colors]
                row['componentMatches'] = [c[1] == 1 for c in colors]
                row['covered'] = all(c[2:] == [.5, 1.0] for c in colors)
            row['passed'] = bool(row['compiled'] and row.get('covered') and all(row.get('componentMatches', [])))
        except Exception as exc: row.update(passed=False, error=str(exc))
        report['records'].append(row)

    sources = [('tdu.Matrix', "parent().fetch('probeMatrix')"), ('DAT', "op('matrix_table')"), ('CHOP', "op('matrix_chop')")]
    for source_index, (source, expression) in enumerate([] if conversions_only else sources):
        for native in (top, mat):
            native.par.matrix0value.expr = expression
            for prefix in ('mat', 'dmat'):
                for columns in (2, 3, 4):
                    for rows in (2, 3, 4):
                        ty = prefix+str(columns)+(('x'+str(rows)) if rows != columns else '')
                        refs = ['uProbe['+str(c)+']['+str(r)+']' for c in range(columns) for r in range(rows)]
                        expected = [patterns[source_index][r][c] for c in range(columns) for r in range(rows)]
                        for stage in (('pixel',) if native == top else ('pixel','vertex')):
                            run(native, stage, ty, refs, expected, source)
    # Separate double transport from GLSL double arithmetic support. The second
    # pattern detects native float32 rounding without turning it into a guard.
    for native in (() if conversions_only else (top, mat)):
        native.par.matrix0name = ''; native.seq.vec.numBlocks = 1; native.par.vec0name = 'uProbe'
        for precise, values in ((False, [1.25,-2.5,3.75,4.0]), (True, [1.0+2**-40, -2.0-2**-39, 3.0+2**-38, 4.0+2**-37])):
            for channel, value in zip('xyzw', values): getattr(native.par, 'vec0value'+channel).val = value
            for count in (1,2,3,4):
                ty = 'double' if count == 1 else 'dvec'+str(count)
                refs = ['uProbe'] if count == 1 else ['uProbe['+str(i)+']' for i in range(count)]
                for stage in (('pixel',) if native == top else ('pixel','vertex')):
                    run(native, stage, ty, refs, values[:count], 'Vectors precise' if precise else 'Vectors')
    if conversions_only:
        for native in (top, mat):
            native.par.matrix0name = 'uProbe'; native.par.matrix0value.expr = sources[0][1]
            for columns in (2,3,4):
                for rows in (2,3,4):
                    base = 'mat'+str(columns)+(('x'+str(rows)) if rows != columns else '')
                    ty = 'd'+base
                    values = [patterns[0][r][c] for c in range(columns) for r in range(rows)]
                    literal = ty+'('+', '.join(glsl(v,True) for v in values)+')'
                    for source, expression, declaration_type in (
                            ('double literal', literal, ''), ('float Matrix -> double constructor', ty+'(uProbe)', base)):
                        refs = ['('+expression+')['+str(c)+']['+str(r)+']' for c in range(columns) for r in range(rows)]
                        for stage in (('pixel',) if native == top else ('pixel','vertex')):
                            run(native,stage,ty,refs,values,source,declaration_type)
            native.par.matrix0name = ''; native.seq.vec.numBlocks = 1; native.par.vec0name = 'uProbe'
            for channel,value in zip('xyzw',(1.25,-2.5,3.75,4.0)):getattr(native.par,'vec0value'+channel).val=value
            for count in (1,2,3,4):
                ty = 'double' if count == 1 else 'dvec'+str(count)
                values = [1.25,-2.5,3.75,4.0][:count]
                expression = ty+'(uProbe)'
                refs = [expression] if count == 1 else ['('+expression+')['+str(i)+']' for i in range(count)]
                base = 'float' if count == 1 else 'vec'+str(count)
                for stage in (('pixel',) if native == top else ('pixel','vertex')):
                    run(native,stage,ty,refs,values,'float Vector -> double constructor',base)
                    precise = [1.0+2**-40,-2.0-2**-39,3.0+2**-38,4.0+2**-37][:count]
                    expressions = ['('+glsl(float(i+1),True)+' + '+glsl(v-float(i+1),True)+')' for i,v in enumerate(precise)]
                    run(native,stage,ty,expressions,precise,'double literal arithmetic','')
finally:
    area.destroy()
    report['existingShadersPreserved'] = saved() == before
    report['registryPreserved'] = registry == {k:s.path for k,s in runtime._shaders.items() if s and s.valid} and runtime._shader == selected
    report['fixtureRemoved'] = op('/'+name) is None
    Path(GRAPE_TEST_OUTPUT, 'results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    assert report['existingShadersPreserved'] and report['registryPreserved'] and report['fixtureRemoved']
result = {'build': report['build'], 'records': len(report['records']), 'passed': sum(r['passed'] for r in report['records']),
          'cases': [{k:r[k] for k in ('target','stage','type','source','passed')} for r in report['records']],
          'existingShadersPreserved': report['existingShadersPreserved'], 'registryPreserved': report['registryPreserved'], 'fixtureRemoved': report['fixtureRemoved']}
