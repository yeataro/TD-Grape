"""Export a self-contained authoring TOX with no active connection or Grape target."""
import hashlib
import uuid

source = GRAPE_ROOT / 'src/remote_panel/build.py'
scope = dict(globals(), __file__=str(source))
exec(compile(source.read_text(encoding='utf-8'), str(source), 'exec'), scope, scope)
container = op('/').create(baseCOMP, 'remote_panel_export_' + uuid.uuid4().hex)
try:
    component = scope['build'](container, name='TD_Remote_Panel')
    component.op('test_panel/value_slider1').par.value0 = .5
    component.op('runtime').module.refresh_source()
    component.op('runtime').module.stop()
    destination = source.parent / 'TD-Remote-Panel.tox'
    component.save(str(destination))
    result = {'file': str(destination), 'bytes': destination.stat().st_size,
              'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
finally:
    container.destroy()
