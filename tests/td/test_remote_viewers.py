"""Authored MAT/TOP viewers: routing, Home and value-only parameter access."""
import json
import uuid

source = GRAPE_ROOT / 'src/remote_panel/build.py'
scope = dict(globals(), __file__=str(source))
exec(compile(source.read_text(encoding='utf-8'), str(source), 'exec'), scope, scope)
area = op('/').create(baseCOMP, 'viewer_test_' + uuid.uuid4().hex)
checks = []


def check(name, condition):
    assert condition, name
    checks.append(name)


try:
    comp = scope['build'](area)
    comp.op('controls').par.active = False
    runtime = comp.op('runtime').module
    parameters = comp.op('viewer_parameters').module
    mat = area.create(phongMAT, 'material')
    mat2 = area.create(phongMAT, 'other_material')
    top = area.create(constantTOP, 'image')
    top.par.colorr = .8
    top.par.colorg = .2
    real_home = runtime.home_viewer
    homes = []
    def home():
        homes.append(comp.par.Targetop.eval().id)
        real_home()
    runtime.home_viewer = home
    comp.par.Source = 'viewer'
    for target, name, source_par, selector_par in (
        (mat, 'mat_viewer', 'Selectmat', 'selectmat'),
        (top, 'top_viewer', 'Selecttop', 'top'),
        (mat2, 'mat_viewer', 'Selectmat', 'selectmat'),
    ):
        comp.par.Targetop = target
        runtime.refresh_source()
        viewer = comp.op(name)
        check(name + ' routes source, interaction and stream',
              not runtime._error and runtime.source_panel() == viewer
              and getattr(viewer.par, source_par).eval() == target
              and getattr(viewer.op('select1').par, selector_par).eval() == target
              and comp.op('opview1').par.opviewer.eval() == viewer
              and runtime.capture_image() == comp.op('opview1'))
        count = len(homes)
        runtime.refresh_source()
        comp.par.Width = 640
        comp.par.Height = 360
        runtime.refresh_source()
        check(name + ' resize and refresh do not Home again', len(homes) == count)
        runtime.capture_image().cook(force=True)
        check(name + ' stream matches requested size', (runtime.capture_image().width, runtime.capture_image().height) == (640, 360))
    check('every new target Homes exactly once', homes == [mat.id, top.id, mat2.id])
    viewer = comp.op('mat_viewer')
    native = viewer.op('cameraViewport/renderView/environment')
    data = parameters.snapshot(viewer, runtime._revision)
    row = next(r for r in data['controls'] if r['name'] == 'Dimmer')
    edit = dict(type='viewer-parameter-value', requestId=1, revision=runtime._revision,
                viewerId=viewer.id, name='Dimmer', component=0, expected=row['components'][0], value=.4)
    parameters.write(viewer, runtime._revision, edit)
    check('environment controls reach the authored native light', abs(native.par.dimmer.eval() - .4) < .00001)
    for changed in ({}, {'revision': -1}, {'viewerId': -1}, {'name': 'w'}, {'value': float('nan')}):
        try:
            parameters.write(viewer, runtime._revision, dict(edit, **changed))
        except ValueError:
            pass
        else:
            raise AssertionError('stale or invalid write accepted: ' + str(changed))
    check('stale values, revisions, identities and non-custom paths rejected', viewer.par.Dimmer.eval() == .4)
    source_row = next(r for r in data['controls'] if r['name'] == 'Selectmat')
    try:
        parameters.write(viewer, runtime._revision, dict(edit, name='Selectmat', expected=source_row['components'][0], value=mat.path))
    except ValueError:
        pass
    else:
        raise AssertionError('source expression overwritten')
    check('automatic source expression is preserved', viewer.par.Selectmat.eval() == mat2)
    rtc = comp.op('webrtc');rtc.par.active = True
    runtime._connection = rtc.openConnection();runtime._client = 'active-test-peer'
    replies = [];runtime.send = lambda message, client=None: replies.append(message)
    latest = next(r for r in parameters.snapshot(viewer, runtime._revision)['controls'] if r['name'] == 'Dimmer')
    edit.update(expected=latest['components'][0], value=.6)
    runtime.ws_receive('old-peer', json.dumps(edit))
    check('a replaced peer cannot change or read viewer settings', not replies and viewer.par.Dimmer.eval() == .4)
    runtime.ws_receive('active-test-peer', json.dumps(edit))
    check('active peer writes return the actual TD readback', replies[-1]['data']['viewerId'] == viewer.id and viewer.par.Dimmer.eval() == .6)
    check('parameter changes preserve the camera', len(homes) == 3)
    runtime.rtc_data(runtime._connection, 'control', json.dumps({'type': 'shortcut', 'action': 'reset-viewer', 'revision': runtime._revision}))
    check('H invokes the same Home action', homes == [mat.id, top.id, mat2.id, mat2.id])
    # Real camera methods, including the first sample, without any host mouse UV.
    def matrix(camera):
        return [camera.CameraTransform[row, col] for row in range(4) for col in range(4)]

    def distance(a, b):
        return max(abs(x-y) for x, y in zip(a, b))

    def mouse(u, v, buttons, revision=None, wheel=0):
        runtime.rtc_data(runtime._connection, 'control', json.dumps({
            'type': 'mouse', 'revision': runtime._revision if revision is None else revision,
            'u': u, 'v': v, 'buttons': buttons, 'wheel': wheel}))

    for target in (mat, top):
        comp.par.Targetop = target
        runtime.refresh_source()
        camera = runtime.custom_viewer().op('cameraViewport')
        for buttons in (2, 4):
            runtime.home_viewer()
            before = matrix(camera); width = camera.par.orthowidth.eval()
            mouse(.35, .6, buttons)
            mouse(.35, .6, buttons)
            check(target.family + ' stationary press does not pan or zoom ' + str(buttons),
                  distance(before, matrix(camera)) < .00001
                  and abs(width - camera.par.orthowidth.eval()) < .00001)
            mouse(.365, .61, buttons)
            moved = matrix(camera); moved_width = camera.par.orthowidth.eval()
            check(target.family + ' small remote motion stays bounded ' + str(buttons),
                  0 < max(distance(before, moved), abs(width - moved_width)) < 1)
            mouse(1.8, -0.5, buttons, -1)
            check('stale remote motion cannot move the camera', matrix(camera) == moved
                  and camera.par.orthowidth.eval() == moved_width)
            runtime.release_mouse()
            check('release ends native camera gesture', camera.GetAction() is None
                  and comp.op('viewer_navigation').module.controller.gesture is None)
        runtime.home_viewer()
        before = matrix(camera); width = camera.par.orthowidth.eval()
        mouse(.4, .55, 0, wheel=.01)
        check(target.family + ' wheel uses remote coordinates and ends its action',
              0 < max(distance(before, matrix(camera)), abs(width-camera.par.orthowidth.eval())) < 1
              and camera.GetAction() is None)
        mouse(.3, .6, 2)
        runtime.home_viewer()
        check('Home ends a held remote drag', camera.GetAction() is None
              and comp.op('viewer_navigation').module.controller.gesture is None)
    source_viewer = runtime.custom_viewer()
    separators = parameters.snapshot(source_viewer, runtime._revision)['controls']
    check('native parameter section boundaries are retained', any(row['section'] for row in separators)
          and all(row['section'] == bool(getattr(source_viewer.par, row['name']).startSection) for row in separators))
    runtime._client = None
    runtime.disconnect()
    check('portable scenes have no native errors', not comp.errors(recurse=True))
finally:
    if area.op('remote_panel/runtime'):
        area.op('remote_panel/runtime').module.stop()
    area.destroy()
result = {'passed': True, 'checks': checks}
