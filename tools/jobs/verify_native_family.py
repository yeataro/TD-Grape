"""Run through TDMCP in the authorized development shell; always removes fixture.

Supply ARTIFACT_PATH (a real frontend-produced request JSON) and RESULT_PATH.
This is a verification fixture, never a product master or a delivered graph.
"""
from copy import deepcopy
import importlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

root = Path(__file__).resolve().parents[2]
paths = [str(root / 'src/td/runtime'), str(root / 'src/core')]
previous_paths = list(sys.path)
module_names = ('host_artifact', 'host_document', 'native_family', 'sgrape_sources', 'sgrape_source_catalog',
                'sgrape_parameters', 'sgrape_history')
previous_modules = {name: sys.modules.get(name) for name in module_names}
area = None
results = []
try:
    sys.path[:0] = paths
    for name in module_names:
        sys.modules.pop(name, None)
    artifact = importlib.import_module('host_artifact')
    document = importlib.import_module('host_document')
    family = importlib.import_module('native_family')
    sources = importlib.import_module('sgrape_sources')
    parameters = importlib.import_module('sgrape_parameters')
    history = importlib.import_module('sgrape_history')
    history.ParMode = ParMode
    for name, op_type in {'baseCOMP':baseCOMP, 'textDAT':textDAT,
                          'glslTOP':glslTOP, 'infoDAT':infoDAT,
                          'parameterexecuteDAT':parameterexecuteDAT, 'executeDAT':executeDAT}.items():
        setattr(family, name, op_type)
    sources.ParMode = ParMode
    parent_comp = op('/TD_Grape/GrapeManager')
    assert parent_comp and not parent_comp.op('__native_verification'), 'Fixture path already occupied'
    area = parent_comp.create(baseCOMP, '__native_verification')
    area.comment = 'Disposable native application verification; not a product master.'
    validation = area.create(baseCOMP, 'validation')

    def make_target(name):
        comp = area.create(baseCOMP, name)
        comp.store('sgrapeShaderId', 'fixture')
        graph = comp.create(textDAT, 'graph')
        graph.par.language = 'json'
        pixel = comp.create(textDAT, 'pixel_shader')
        pixel.par.language = 'glsl'
        shader = comp.create(glslTOP, 'shader')
        shader.par.pixeldat = 'pixel_shader'
        shader.par.outputresolution = 'custom'
        shader.par.resolutionw = 16
        shader.par.resolutionh = 16
        shader.par.format = 'rgba32float'
        info = comp.create(infoDAT, 'compile_info')
        info.par.op = 'shader'
        controls = comp.create(baseCOMP, 'GrapeControls')
        for name in ('document', 'status'):
            dat = controls.create(textDAT, name)
            dat.par.language = 'json'
        return comp

    original = json.loads(Path(ARTIFACT_PATH).read_text(encoding='utf-8'))
    target = make_target('family')
    adapter = family.NativeFamily(target, artifact=artifact, document=document, sources=sources,
        controls_source=(root/'src/core/sgrape_parameter_links.py').read_text(encoding='utf-8'))
    def request(revision):
        body = deepcopy(original)
        body['revision'] = revision
        body['frontendArtifact']['baseRevision'] = revision
        return body
    def apply(body, initial=False):
        return adapter.apply(body, catalog_hash=original['frontendArtifact']['catalogHash'],
                             validation_area=validation, initial=initial)
    applied = apply(request(0), initial=True)
    assert applied['state']['revision'] == 1
    shader = target.op('shader')
    assert shader.par.vec0name.eval() == 'uGain'
    assert abs(float(shader.numpyArray(delayed=False)[0,0,0]) - .25) < 1e-5
    results.append({'test':'real frontend artifact → native GPU', 'passed':True})

    shader.par.vec0valuex.expr = '.375'
    saved_par = shader.par.vec0valuex
    apply(request(1))
    assert shader.par.vec0valuex.isSamePar(saved_par)
    assert saved_par.mode == ParMode.EXPRESSION and saved_par.expr == '.375'
    assert abs(saved_par.eval() - .375) < 1e-8
    results.append({'test':'reapply preserves Expression and Par identity', 'passed':True})

    keep = target.appendCustomPage('Controls').appendFloat('Keep')[0]
    keep.val = .625
    saved_par.bindExpr = 'parent().par.Keep'
    apply(request(2))
    assert saved_par.mode == ParMode.BIND and saved_par.bindMaster.isSamePar(keep)
    assert abs(saved_par.eval() - .625) < 1e-8
    results.append({'test':'reapply preserves native Bind/master', 'passed':True})

    before = target.op('GrapeControls/document').text, target.op('pixel_shader').text
    broken = request(3)
    broken['frontendArtifact']['compiled']['pixel'] = 'not valid GLSL;'
    try:
        apply(broken)
        raise AssertionError('Invalid shader was accepted')
    except RuntimeError:
        pass
    assert before == (target.op('GrapeControls/document').text, target.op('pixel_shader').text)
    assert saved_par.mode == ParMode.BIND and saved_par.bindMaster.isSamePar(keep)
    assert not validation.children
    results.append({'test':'GPU failure preserves previous artifact and native Bind', 'passed':True})

    saved_par.bindExpr = ''
    saved_par.mode = ParMode.CONSTANT
    saved_par.val = .45
    snapshot = parameters.snapshot(adapter)
    parameters.edit(adapter, {'action':'page-create', 'name':'Uniforms',
        'revision':3, 'expectedPages':snapshot['expectedPages']})
    snapshot = parameters.snapshot(adapter)
    source = sources.snapshot(adapter)['uniforms'][0]
    parameters.edit(adapter, {'action':'bind', 'id':'gain', 'page':'Uniforms', 'revision':3,
        'expectedPages':snapshot['expectedPages'], 'sourceExpected':source['expected']})
    knob = saved_par.bindMaster
    assert knob is not None and knob.owner == target
    knob.val = .6
    assert abs(saved_par.eval() - .6) < 1e-8
    assert target.op('parameter_links') is None
    assert target.op('GrapeControls/parameter_links') is not None
    assert not target.op('GrapeControls/parameter_lifecycle').par.framestart.eval()
    assert not target.op('GrapeControls/parameter_lifecycle').par.frameend.eval()
    results.append({'test':'real custom-parameter panel binds through grouped native helpers', 'passed':True})

    # Same checkpoints are deliberately valid for an editing-only default Undo.
    checkpoint = history.capture(adapter)['token']
    actual = adapter.state()
    changed = deepcopy(actual['graph'])
    changed['declarations'][0]['value'] = .9
    adapter.write_state(document.update(actual, changed))
    restored_default = history.restore(adapter, {'requestId':'native-default-undo', 'revision':4,
        'fromToken':checkpoint, 'toToken':checkpoint, 'sourceIds':['gain'],
        'graph':actual['graph'], 'currentGraph':changed})
    assert restored_default['graph']['declarations'][0]['value'] == .25
    assert saved_par.bindMaster.isSamePar(knob) and abs(knob.eval()-.6)<1e-8
    assert adapter.state()['applied']['revision'] == 3
    results.append({'test':'native History restores document default without compiler or overriding Bind', 'passed':True})

    rollback = make_target('rollback')
    real = document.serialize
    def fail_save(value):
        raise RuntimeError('Injected save failure')
    failing_document = SimpleNamespace(**{name:getattr(document,name) for name in
        ('create','accept','restore','validate_graph')}, serialize=fail_save)
    failing = family.NativeFamily(rollback, artifact=artifact, document=failing_document, sources=sources)
    blank = rollback.op('shader')
    defaults = [getattr(blank.par,'vec0value'+c).val for c in 'xyzw']
    try:
        failing.apply(request(0), catalog_hash=original['frontendArtifact']['catalogHash'],
                      validation_area=validation, initial=True)
        raise AssertionError('Injected save failure did not run')
    except RuntimeError as error:
        assert 'Injected save failure' in str(error), str(error)
    assert blank.par.vec0name.eval() == ''
    assert [getattr(blank.par,'vec0value'+c).val for c in 'xyzw'] == defaults
    assert rollback.fetch(sources.STORE, None) is None
    assert rollback.op('GrapeControls/document').text == ''
    results.append({'test':'failed persistence restores reused blank native row and registry', 'passed':True})

    # No runtime/Manager callback is necessary for the delivered native network.
    validation.destroy()
    knob.val = .8
    shader.cook(force=True)
    assert abs(float(shader.numpyArray(delayed=False)[0,0,0]) - .8) < 1e-5
    assert all(not item.par.framestart.eval() and not item.par.frameend.eval()
               for item in target.findChildren(type=executeDAT))
    results.append({'test':'native Bind/render works without an editing service or frame callbacks', 'passed':True})

    exported = Path(RESULT_PATH).parent / 'native-family-roundtrip.tox'
    target.save(str(exported))
    restored = area.loadTox(str(exported))
    restored.name = 'restored_family'
    getattr(restored.par, knob.name).val = .7
    restored.op('shader').cook(force=True)
    assert abs(float(restored.op('shader').numpyArray(delayed=False)[0,0,0]) - .7) < 1e-5
    reopened = document.restore(restored.op('GrapeControls/document').text, target_id='fixture')
    assert reopened['revision'] == 5
    assert restored.op('pixel_shader').text == original['frontendArtifact']['compiled']['pixel']
    assert restored.op('shader').par.vec0valuex.bindMaster.owner == restored
    results.append({'test':'TOX reload preserves artifact and self-contained native Bind', 'passed':True})
finally:
    if area is not None:
        area.destroy()
    sys.path[:] = previous_paths
    for name, previous in previous_modules.items():
        if previous is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = previous
    Path(RESULT_PATH).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False))
