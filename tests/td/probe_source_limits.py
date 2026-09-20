"""Native host evidence for floating specialization and Uniform Array capacity.

Only an isolated 8x8 GLSL TOP is cooked; user graphs and source parameters are
read, never changed. Results describe this host, not universal GPU limits.
"""
from pathlib import Path
import json
import uuid

output = Path(GRAPE_TEST_OUTPUT)
output.mkdir(parents=True, exist_ok=True)
report = {'build': str(app.build), 'cases': []}
try:
    report['legacyMaxUniforms'] = var('SYS_GFX_GLSL_MAX_UNIFORMS')
except Exception as exc:
    report['legacyMaxUniformsUnavailable'] = str(exc)

manager = op('/TD_Grape')
runtime = manager.op('runtime').module
report['nativeConstants'] = []
for comp in runtime._shaders.values():
    if not comp or not comp.valid:
        continue
    native = runtime.shader_operator(comp)
    with runtime.shader_context(comp):
        declarations = runtime.state()['graph']['declarations']
    for index in range(native.seq.const.numBlocks):
        name = getattr(native.par, 'const' + str(index) + 'name').eval()
        if not name:
            continue
        value = getattr(native.par, 'const' + str(index) + 'value')
        report['nativeConstants'].append({
            'shader': comp.path, 'name': name, 'style': value.style,
            'value': value.eval(), 'mode': str(value.mode),
            'graphTypes': [d['type'] for d in declarations if d['name'] == name],
            'hasTypeParameter': getattr(native.par, 'const' + str(index) + 'type', None) is not None,
        })

area = op('/').create(baseCOMP, 'grape_source_probe_' + uuid.uuid4().hex[:8])
try:
    native = area.create(glslTOP, 'shader')
    native.par.outputresolution = 'custom'
    native.par.resolutionw = 8
    native.par.resolutionh = 8
    native.par.format = 'rgba32float'
    pixel = area.create(textDAT, 'pixel')
    native.par.pixeldat = pixel
    info = area.create(infoDAT, 'compile_info')
    info.par.op = native

    def check(label):
        # Persist each boundary for diagnosing a stalled native compile.
        (output / 'phase.txt').write_text(label, encoding='utf-8')
        native.cook(force=True)
        info.cook(force=True)
        record = {'case': label, 'errors': native.errors(), 'warnings': native.warnings(), 'compile': info.text}
        if not record['errors'] and 'ERROR:' not in record['compile']:
            image = native.numpyArray(delayed=False)
            record['pixel'] = [float(v) for v in image[0, 0]]
        report['cases'].append(record)
        (output / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')

    for kind, value in [('float', .625), ('float', .375), ('int', .625)]:
        native.par.const0name = 'sProbe'
        native.par.const0value = value
        pixel.text = ('layout(constant_id=0) const ' + kind + ' sProbe = ' + ('0.0' if kind == 'float' else '0') + ';\n'
                      'layout(location=0) out vec4 fragColor;\n'
                      'void main(){fragColor=TDOutputSwizzle(vec4(float(sProbe),0.0,0.0,1.0));}\n')
        check('specialization_' + kind + '_' + str(value))

    native.par.const0name = ''
    callbacks = area.create(textDAT, 'samples_callbacks')
    callbacks.text = "import numpy as np\ndef onCook(chop):\n    chop.copyNumpyArray(np.full((1,chop.fetch('length')), .375, dtype=np.float32))\n"
    data = area.create(scriptCHOP, 'samples')
    data.par.callbacks = callbacks
    native.par.array0name = 'uProbe'
    native.par.array0type = 'float'
    native.par.array0arraytype = 'uniformarray'
    native.par.array0chop = data
    for length in (1024, 1025, 2048, 4096, 10000):
        data.store('length', length)
        data.cook(force=True)
        assert data.numSamples == length
        pixel.text = ('uniform float uProbe[' + str(length) + '];\n'
                      'layout(location=0) out vec4 fragColor;\n'
                      'void main(){int i=min(int(gl_FragCoord.x)*' + str(length) + '/8,' + str(length-1) + ');'
                      'fragColor=TDOutputSwizzle(vec4(uProbe[i],0.0,0.0,1.0));}\n')
        check('uniform_array_' + str(length))
finally:
    area.destroy()
    (output / 'phase.txt').write_text('cleaned up', encoding='utf-8')
    (output / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')

result = report
