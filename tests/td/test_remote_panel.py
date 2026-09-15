"""Build, rebuild and reload the panel bridge outside any Grape component."""
import hashlib
import json
import uuid

root_operator = op('/')
before = {n.path: n.op('state').text for n in root_operator.findChildren()
          if n.storage.get('sgrapeShaderId') and n.op('state')}
source = GRAPE_ROOT / 'src/remote_panel/build.py'
scope = dict(globals(), __file__=str(source))
exec(compile(source.read_text(encoding='utf-8'), str(source), 'exec'), scope, scope)
container = root_operator.create(baseCOMP, 'remote_panel_check_' + uuid.uuid4().hex)
checks = []


def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})
    assert condition, name


try:
    component = scope['build'](container)
    check('standalone defaults are inactive and local',
          not component.par.Active.eval() and not component.par.Allowlan.eval())
    identities = {n.path: n.id for n in component.findChildren()}
    component.op('test_panel/value_slider1').par.value0 = .37
    scope['build'](container)
    check('rebuild preserves nodes and control values',
          identities == {n.path: n.id for n in component.findChildren()}
          and abs(component.op('test_panel/value_slider1').par.value0.eval() - .37) < .001)
    check('fixture contains exactly two controls', len(component.op('test_panel').children) == 2)
    runtime = component.op('runtime').module
    runtime.refresh_source()
    check('capture resolves inside the independent component',
          component.op('panel_image').par.opviewer.eval() == component.op('test_panel'))
    check('loopback boundary includes IPv4 and IPv6',
          runtime.allowed('127.0.0.1:49152') and runtime.allowed('[::1]:49152')
          and not runtime.allowed('192.168.1.50:49152'))
    response = runtime.http({'method': 'GET', 'uri': '/', 'clientAddress': '192.168.1.50'}, {})
    check('LAN disabled refuses HTTP', response['statusCode'] == 403)
    response = runtime.http({'method': 'GET', 'uri': '/runtime.py', 'clientAddress': '127.0.0.1'}, {})
    check('server only serves browser assets', response['statusCode'] == 404)
    response = runtime.http({'method': 'GET', 'uri': '/touch-gestures.js', 'clientAddress': '127.0.0.1'}, {})
    check('touch translator is available from the embedded standalone server',
          response['statusCode'] == 200 and 'export class TouchGestures' in response['data'])
    component.par.Source = 'viewer'
    runtime.refresh_source()
    check('missing target stops the stream and reports the source problem',
          runtime.metadata()['error'] and not component.op('video_out').par.active.eval())
    component.par.Targetop = component.op('test_panel')
    runtime.refresh_source()
    check('OP Viewer accepts a configured operator',
          runtime.source_panel() == component.op('op_viewer') and not runtime.metadata()['error'])
    check('OP capture bypasses the controller COMP and deprecated TOP interaction',
          component.op('panel_image').par.opviewer.eval() == component.par.Targetop.eval()
          and not component.op('panel_image').par.allowpanel.eval()
          and component.op('op_viewer').par.interactive.eval())
    check('both viewers follow the one Target OP parameter',
          component.op('panel_image').par.opviewer.mode==ParMode.EXPRESSION
          and component.op('op_viewer').par.opviewer.eval()==component.par.Targetop.eval())
    check('only OP Viewer advertises the explicit reset shortcut',
          runtime.metadata()['shortcuts'] == ['reset-viewer'])
    check('a panel viewed through OP Viewer keeps single-touch control', runtime.metadata()['touchNavigation'] == '')
    material = container.create(phongMAT, 'touch_material')
    component.par.Targetop = material
    runtime.refresh_source()
    check('3D OP Viewer advertises touch navigation', runtime.metadata()['touchNavigation'] == '3d')
    component.par.Targetop = component.op('test_panel')
    runtime.refresh_source()
    # Exercise messages against the independent fixture, never the user's viewer.
    runtime._connection = 'keyboard-test'
    count = runtime.event_count()
    shortcut = {'type': 'shortcut', 'action': 'reset-viewer', 'revision': runtime._revision}
    try:
        runtime.rtc_data('keyboard-test', 'control', json.dumps(shortcut))
        check('reset shortcut reaches the configured target', runtime.event_count() == count + 1)
        runtime.rtc_data('old-client', 'control', json.dumps(shortcut))
        runtime.rtc_data('keyboard-test', 'control', json.dumps(dict(shortcut, revision=runtime._revision - 1)))
        runtime.rtc_data('keyboard-test', 'control', json.dumps(dict(shortcut, action='arbitrary-key')))
        runtime.rtc_data('keyboard-test', 'control', '[]')
        check('old clients, stale sources and unknown shortcuts are ignored', runtime.event_count() == count + 1)
    finally:
        runtime._connection = None
    component.par.Source = 'panel'
    component.par.Panel = component.op('test_panel')
    runtime.refresh_source()
    check('Panel mode targets the original Panel COMP', runtime.source_panel() == component.op('test_panel'))
    check('Panel mode does not advertise viewer reset', runtime.metadata()['shortcuts'] == [])
    check('Panel mode does not translate two fingers into a right click', runtime.metadata()['touchNavigation'] == '')
    component.par.Source = 'test'
    component.par.Targetop = ''
    component.par.Panel = ''
    runtime.stop()
    saved = GRAPE_TEST_OUTPUT / 'TD-Remote-Panel.tox'
    component.save(str(saved))
    receiver = container.create(baseCOMP, 'reloaded')
    loaded = receiver.loadTox(str(saved))
    loaded.op('runtime').module.refresh_source()
    check('saved TOX reloads with its own target and without Grape',
          loaded.op('panel_image').par.opviewer.eval() == loaded.op('test_panel'))
    check('all runtime assets survive TOX export', all(
        loaded.op(dat).text == (source.parent / filename).read_text(encoding='utf-8')
        for dat, filename in scope['ASSETS'].items()))
    check('no external file dependencies', all(
        not str(n.par.file.eval()) for n in loaded.findChildren()
        if hasattr(n.par, 'file') and n.OPType.endswith('DAT')))
    check('no native errors', not component.errors(recurse=True) and not loaded.errors(recurse=True))
    loaded.op('runtime').module.stop()
finally:
    for candidate in container.findChildren():
        if candidate.storage.get('tdRemotePanel') and candidate.op('runtime'):
            candidate.op('runtime').module.stop()
    container.destroy()

check('existing shader states preserved', before == {path: op(path).op('state').text for path in before})
result = {'passed': True, 'checks': checks,
          'stateHashes': {path: hashlib.sha256(text.encode()).hexdigest() for path, text in before.items()}}
(GRAPE_TEST_OUTPUT / 'native-result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
