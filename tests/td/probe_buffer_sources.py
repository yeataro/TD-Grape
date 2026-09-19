"""Isolated native Buffer discovery. No product graph or source changes.

Run through the development runner. Flush each native boundary so a stalled
cook can be distinguished from Python work without interacting with TD's UI.
"""
from pathlib import Path
import json
import time
import uuid

output = Path(GRAPE_TEST_OUTPUT)
output.mkdir(parents=True, exist_ok=True)
report = {'build': str(app.build), 'cases': []}


def note(event, **details):
    with (output / 'phase.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(dict(time=time.time(), event=event, **details), default=str) + '\n')
        stream.flush()


def cook(node):
    note('cook.before', op=node.path)
    node.cook(force=True)
    note('cook.after', op=node.path)


def state(node):
    result = {'errors': node.errors(), 'warnings': node.warnings()}
    for key in ('numSamples', 'numChans', 'numPoints', 'numVertices', 'numPrims'):
        try:
            value = getattr(node, key)
            # POP count methods may synchronize GPU work. This probe needs
            # only CHOP's cheap properties, not a host readback of POP data.
            if not callable(value):
                result[key] = value
        except AttributeError:
            pass
    return result


area = op('/').create(baseCOMP, 'grape_buffer_probe_' + uuid.uuid4().hex[:8])
note('setup', op=area.path)
try:
    empty_chop = area.create(inCHOP, 'empty_chop')
    empty_pop = area.create(inPOP, 'empty_pop')
    data_chop = area.create(constantCHOP, 'data_chop')
    data_pop = area.create(linePOP, 'data_pop')
    for node in (empty_chop, empty_pop, data_chop, data_pop):
        cook(node)
        report[node.name] = state(node)
    native = area.create(glslTOP, 'shader')
    native.par.outputresolution = 'custom'
    native.par.resolutionw = 8
    native.par.resolutionh = 8
    pixel = area.create(textDAT, 'pixel')
    native.par.pixeldat = pixel
    info = area.create(infoDAT, 'info')
    info.par.op = native
    report['parameters'] = [dict(name=p.name, value=str(p.eval()), menu=list(p.menuNames or []))
                            for p in native.pars() if p.name.startswith(('buffer', 'array'))]
    native.seq.buffer.numBlocks = 1
    native.par.buffer0name = 'Probe'
    native.par.buffer0attrclass = 'point'
    for label, pop_source, attribute in (
        ('pop_missing_input', empty_pop, 'P'),
        ('pop_valid_position', data_pop, 'P'),
        ('pop_missing_attribute', data_pop, 'DefinitelyMissing'),
    ):
        note('case.before', label=label)
        native.par.buffer0pop = pop_source
        native.par.buffer0attr = attribute
        pixel.text = ('layout(location=0) out vec4 fragColor;\n'
                      'void main(){ vec3 v = TDBuffer_Probe(0); '
                      'fragColor=TDOutputSwizzle(vec4(v,1.0)); }\n')
        cook(native)
        cook(info)
        report['cases'].append(dict(label=label, **state(native), compile=info.text))
        (output / 'result.json').write_text(json.dumps(report, indent=2, default=str), encoding='utf-8')
        note('case.after', label=label)
    # Native sequences keep at least one block. A fresh OP also prevents a
    # previous POP diagnostic or compiled program from affecting CHOP cases.
    native = area.create(glslTOP, 'chop_shader')
    native.par.outputresolution = 'custom'
    native.par.resolutionw = 8
    native.par.resolutionh = 8
    native.par.pixeldat = pixel
    info.par.op = native
    native.seq.array.numBlocks = 1
    native.par.array0name = 'uProbe'
    native.par.array0type = 'float'
    native.par.array0arraytype = 'texturebuffer'
    for label, chop_source in (('chop_missing_input', empty_chop), ('chop_valid', data_chop)):
        note('case.before', label=label)
        native.par.array0chop = chop_source
        pixel.text = ('uniform samplerBuffer uProbe;\nlayout(location=0) out vec4 fragColor;\n'
                      'void main(){ fragColor=TDOutputSwizzle(texelFetch(uProbe,0)); }\n')
        cook(native)
        cook(info)
        report['cases'].append(dict(label=label, **state(native), compile=info.text))
        (output / 'result.json').write_text(json.dumps(report, indent=2, default=str), encoding='utf-8')
        note('case.after', label=label)
finally:
    note('cleanup.before', op=area.path)
    area.destroy()
    note('cleanup.after')
    (output / 'result.json').write_text(json.dumps(report, indent=2, default=str), encoding='utf-8')

cases = {case['label']: case for case in report['cases']}
assert not cases['pop_valid_position']['errors'], cases['pop_valid_position']
for label in ('pop_missing_input', 'pop_missing_attribute'):
    assert 'not found' in cases[label]['errors'], cases[label]
    assert 'TDBuffer_Probe' in cases[label]['compile'], cases[label]
for label in ('chop_missing_input', 'chop_valid'):
    assert not cases[label]['errors'] and 'ERROR:' not in cases[label]['compile'], cases[label]
print(json.dumps(report, indent=2, default=str))
