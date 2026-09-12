"""Save the development TOE without private helpers or session credentials."""
from pathlib import Path
import hashlib
import json
import shutil
import uuid

root_operator = op('/')
destination = (GRAPE_ROOT / 'src/td/TD-Grape-dev.toe').resolve()
destination.relative_to(GRAPE_ROOT.resolve())
assert destination.parent.is_dir()
backup = GRAPE_WORK / 'source-saves' / uuid.uuid4().hex
backup.mkdir(parents=True)
owners = [n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager', False)]
assert len(owners) == 1
owner = owners[0]
runtime = owner.op('runtime').module
before = {s.path: s.op('state').text for s in runtime._shaders.values() if s and s.valid}
helpers = []
for path, flag in (('/TD_RemoteDebug', 'independentRemoteDebug'),
                   ('/sgrape_devbridge', 'sgrapeOwned'), ('/grape_devbridge', 'grapeDevelopment')):
    component = op(path)
    if component:
        assert component.fetch(flag, False), 'Unrecognized helper: ' + path
        helpers.append({'component': component, 'path': path, 'file': backup / (component.name + '.tox')})
previous_urls = owner.par.Lanurls.eval()
previous_port = owner.fetch('serverPort', 0)
saved_previous = backup / 'previous-source.toe'
if destination.exists():
    shutil.copy2(destination, saved_previous)
temporary_toe = destination.with_name('TD-Grape-saving-' + backup.name + '.toe')
assert not temporary_toe.exists()
removed = []
try:
    for item in helpers:
        component = item['component']
        if item['path'] == '/TD_RemoteDebug':
            component.op('lifecycle').par.active = False
            component.op('gateway').module.stop()
        else:
            component.op('runner').par.active = False
        component.save(str(item['file']))
        component.destroy()
        removed.append(item)
    # Inactive upstream TDFam authoring paths are not file dependencies.
    for node in owner.findChildren():
        p = getattr(node.par, 'externaltox', None)
        if p is not None and 'Downloads/event_' in str(p.eval()).replace('\\', '/'):
            assert not node.par.enableexternaltox.eval()
            p.mode = ParMode.CONSTANT
            p.val = ''
    owner.par.Lanurls = ''
    owner.store('serverPort', 0)
    assert project.save(str(temporary_toe)), 'TouchDesigner did not save the source TOE'
    actual = (Path(project.folder) / project.name).resolve()
    actual.relative_to(destination.parent)
    pending = destination.with_suffix('.pending')
    shutil.copy2(actual, pending)
    pending.replace(destination)
    naming = root_operator.create(textDAT, 'grape_source_name_' + backup.name)
    try:
        naming.par.language = 'tscript'
        naming.text = 'toename "' + destination.as_posix().replace('"', '\\"') + '"'
        naming.run()
    finally:
        naming.destroy()
    for generated in (actual, temporary_toe):
        if generated.exists():
            assert generated.parent == destination.parent and generated.name.startswith('TD-Grape-saving-' + backup.name)
            shutil.move(str(generated), str(backup / generated.name))
    assert destination.is_file()
except Exception:
    if saved_previous.exists():
        shutil.copy2(saved_previous, destination)
    raise
finally:
    owner.store('serverPort', previous_port)
    owner.par.Lanurls = previous_urls
    for item in removed:
        restored = root_operator.loadTox(str(item['file']))
        restored.name = item['path'].rsplit('/', 1)[-1]
        if item['path'] == '/TD_RemoteDebug':
            restored.op('lifecycle').par.active = True
            restored.op('gateway').module.tick(restored, force=True)
        else:
            restored.op('runner').par.active = True
assert before == {path: root_operator.op(path).op('state').text for path in before}
result = {'saved': str(destination), 'bytes': destination.stat().st_size,
          'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
          'shadersPreserved': len(before), 'privateHelpersExcluded': len(helpers)}
(GRAPE_TEST_OUTPUT / 'source-save.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
