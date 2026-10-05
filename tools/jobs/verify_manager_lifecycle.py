"""TD-only lifecycle check of the disposable browser-review Family.

Run after browser tests created uReview and wired it to Output. Manager is
saved before removal and restored in finally. Does not touch IconGen, Legacy
or TDFAM. OUTPUT_DIR is a private workspace evidence directory.
"""
import json
from pathlib import Path

output = Path(OUTPUT_DIR)
output.mkdir(parents=True, exist_ok=True)
family = op('/Grape_TOP_Refactor')
host = op('/TD_Grape')
manager = host.op('GrapeManager')
editor = host.op('GrapeEditor').ext.EditorServiceExt
assert family and manager and not op('/__grape_reload_verification')
manager_file = output / 'manager-before-lifecycle.tox'
manager.save(str(manager_file))
identity = family.fetch('sgrapeShaderId')
adapter = manager.ext.GrapeManagerExt.Adapter(family)
sources = manager.op('sources').module
parameters = manager.op('parameters').module
row = next(row for row in sources.snapshot(adapter)['uniforms'] if row['name'] == 'uReview')
state = adapter.state()
control_snapshot = parameters.snapshot(adapter)
if not any(page.name == 'Uniforms' for page in family.customPages):
    parameters.edit(adapter, {'action':'page-create', 'name':'Uniforms',
        'revision':state['revision'], 'expectedPages':control_snapshot['expectedPages']})
control_snapshot = parameters.snapshot(adapter)
row = next(row for row in sources.snapshot(adapter)['uniforms'] if row['name'] == 'uReview')
parameters.edit(adapter, {'action':'bind', 'id':row['id'], 'page':'Uniforms',
    'revision':adapter.state()['revision'], 'expectedPages':control_snapshot['expectedPages'], 'sourceExpected':row['expected']})
shader = family.op('shader')
knob = shader.par.vec0valuex.bindMaster
assert knob and knob.owner == family
original_value = knob.eval()
results = []
area = None
try:
    manager.ext.GrapeManagerExt.Disconnect()
    manager.destroy()
    assert host.op('GrapeManager') is None
    knob.val = .625
    shader.cook(force=True)
    assert abs(float(shader.numpyArray(delayed=False)[0,0,0]) - .625) < .001
    # Exercise the exact callback body synchronously. TD queues actual Pulse
    # delivery until the next frame; the browser/Edit pulse is checked separately.
    family.op('GrapeControls/editor_control').module.onPulse(family.par.Edit)
    message = json.loads(family.op('GrapeControls/status').text)
    assert message['message'] == 'No active Manager.', message
    assert all(not n.par.framestart.eval() and not n.par.frameend.eval() for n in family.findChildren(type=executeDAT))
    assert not family.errors(), family.errors()
    results.append({'test':'Manager physically removed; native Bind and GPU continue; Edit reports absence without retry', 'passed':True})
finally:
    if host.op('GrapeManager') is None:
        restored = host.loadTox(str(manager_file))
        restored.name = 'GrapeManager'
    manager = host.op('GrapeManager')
    # Loading an OP may rebuild dependent extensions. Reacquire the live peer.
    editor = host.op('GrapeEditor').ext.EditorServiceExt
    assert editor.Start(), 'Editor service could not restart after Manager restoration'
    manager.ext.GrapeManagerExt.Connect(editor)
    knob.val = original_value

assert manager.ext.GrapeManagerExt.Resolve(identity).target() == family
assert family.fetch('sgrapeShaderId') == identity
assert shader.par.vec0valuex.bindMaster.isSamePar(knob)
results.append({'test':'Restored Manager resolves the unchanged Family identity and preserves native control binding', 'passed':True})
try:
    native_file = output / 'review-family.tox'
    family.save(str(native_file))
    area = op('/').create(baseCOMP, '__grape_reload_verification')
    restored = area.loadTox(str(native_file))
    restored_shader = restored.op('shader')
    restored_control = restored_shader.par.vec0valuex.bindMaster
    assert restored_control.owner == restored
    restored_control.val = .375
    restored_shader.cook(force=True)
    assert abs(float(restored_shader.numpyArray(delayed=False)[0,0,0]) - .375) < .001
    assert restored.op('pixel_shader').text == family.op('pixel_shader').text
    assert manager.ext.GrapeManagerExt.Adapter(restored).state()['targetId'] == identity
    assert not restored.errors(), restored.errors()
    results.append({'test':'Real browser-built Family TOX reload retains graph, GLSL and independently functional native Bind', 'passed':True})
finally:
    if area is not None:
        area.destroy()
    (output / 'results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results))
