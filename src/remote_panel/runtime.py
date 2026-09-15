"""A single-receiver TD panel bridge, independent of the Grape runtime.

Uses native Web Server / WebRTC DATs and the same Panel.interactMouse
mechanism as Derivative's webRTCPanel example. Runtime assets live in DATs.
"""
import ipaddress
import json
import math
import socket
import secrets
import time
from urllib.parse import urlsplit, parse_qs

VERSION = '0.1.3'
TRACK = 'TDPanel'
CHANNEL = 'control'
_client = None
_connection = None
_answered = False
_candidates = []
_last_seen = 0.0
_last_tick = 0.0
_last_frame = 0.0
_last_mouse = (0.5, 0.5)
_mouse_down = False
_panel = None
_viewer_target = None
_revision = 0
_events = 0
_started = False
_status = 'Stopped'
_error = ''
_launches = {}


def owner():
    return me.parent()


def local_url():
    return 'http://127.0.0.1:' + str(int(owner().par.Port.eval())) + '/'


def lan_urls():
    if not owner().par.Allowlan.eval():
        return ''
    try:
        addresses = sorted({r[4][0] for r in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)})
        return '  '.join('http://' + address + ':' + str(int(owner().par.Port.eval())) + '/'
                         for address in addresses if not ipaddress.ip_address(address).is_loopback)
    except OSError:
        return ''


def status():
    return _status


def event_count():
    return _events


def source_panel():
    comp = owner()
    mode = comp.par.Source.eval()
    if mode == 'viewer':
        target = comp.par.Targetop.eval()
        if target is None or not target.valid:
            raise ValueError('Choose a valid Target OP in TouchDesigner.')
        return comp.op('op_viewer')
    if mode == 'test':
        return comp.op('test_panel')
    panel = comp.par.Panel.eval()
    if panel is None or not panel.valid or not hasattr(panel, 'interactMouse'):
        raise ValueError('Choose a Panel COMP in TouchDesigner.')
    return panel


def capture_target():
    comp=owner()
    return comp.par.Targetop.eval() if comp.par.Source.eval()=='viewer' else source_panel()


def prepare_viewer(target):
    """Reserve a source without changing the active viewer. Consumed at connection."""
    if not target or not target.valid:raise ValueError('The requested viewer no longer exists.')
    now=time.monotonic()
    for token,(expires,op_ref) in list(_launches.items()):
        if expires<=now or not op_ref.valid:del _launches[token]
    while len(_launches)>=32:del _launches[next(iter(_launches))]
    token=secrets.token_urlsafe(24)
    _launches[token]=(now+30,target)
    return token


def metadata():
    comp = owner()
    target = comp.par.Targetop.eval() if comp.par.Source.eval() == 'viewer' else _panel
    geometry_viewer = bool(_viewer_target and _viewer_target.valid and (
        _viewer_target.family in ('MAT', 'SOP', 'POP') or getattr(_viewer_target, 'isObject', False)))
    return {'type': 'source', 'version': VERSION, 'source': target.path if target else '',
            'panel': _panel.path if _panel else '', 'revision': _revision,
            'width': int(comp.par.Width.eval()), 'height': int(comp.par.Height.eval()),
            # Matches TD 2025 and the official remote-panel browser example.
            'fps': int(comp.par.Framerate.eval()), 'mirrorX': True, 'status': _status, 'error': _error,
            'shortcuts': ['reset-viewer'] if _viewer_target and _viewer_target.valid else [],
            'touchNavigation': '3d' if geometry_viewer else ''}


def send(message, client=None):
    destination = client or _client
    if destination:
        owner().op('web_server').webSocketSendText(destination, json.dumps(message))


def release_mouse():
    global _mouse_down
    if _mouse_down and _panel and _panel.valid:
        _panel.interactMouse(*_last_mouse, left=False, middle=False, right=False)
    _mouse_down = False


def refresh_source():
    global _panel, _viewer_target, _revision, _error, _status
    release_mouse()
    _viewer_target = None
    _revision += 1
    comp = owner()
    try:
        _panel = source_panel()
        # Capture the target's native viewer directly. In TD 2025, capturing
        # a 3D viewer through OP Viewer COMP can lose depth ordering. The COMP
        # remains the mouse receiver and operates that same native viewer state.
        capture = capture_target()
        if comp.par.Source.eval() == 'viewer':
            _viewer_target = capture
        _error = ''
        _status = 'Connected' if _connection and comp.op('webrtc').getConnectionState(_connection) == 'connected' else 'Ready'
        comp.op('video_out').par.active = bool(_connection)
    except Exception as exc:
        _panel = None
        _error = str(exc)
        _status = 'Invalid source'
        comp.op('video_out').par.active = False
    send(metadata())


def disconnect(close_socket=True):
    global _client, _connection, _answered, _candidates, _status
    release_mouse()
    client, connection = _client, _connection
    _client = _connection = None
    _answered = False
    _candidates = []
    comp = owner()
    comp.op('video_out').par.active = False
    comp.op('video_out').par.webrtcconnection = ''
    if connection:
        comp.op('webrtc').closeConnection(connection)
    if client and close_socket:
        comp.op('web_server').webSocketClose(client)
    _status = 'Ready' if _started and not _error else ('Invalid source' if _error else 'Stopped')


def start():
    global _started, _status
    comp = owner()
    if not comp.par.Active.eval():
        stop()
        return
    if _started:
        return
    # Saved copies never resume another component's live peer connection.
    comp.op('video_out').par.active = False
    comp.op('video_out').par.webrtcconnection = ''
    comp.op('webrtc').par.active = True
    comp.op('webrtc').par.reset.pulse()
    _started = True
    refresh_source()
    comp.op('web_server').par.active = True
    _status = 'Ready' if not _error else 'Invalid source'


def stop():
    global _started, _status
    _started = False
    _launches.clear()
    disconnect()
    owner().op('web_server').par.active = False
    owner().op('webrtc').par.active = False
    _status = 'Stopped'


def restart():
    stop()
    start()


def tick():
    global _last_tick, _last_frame
    now = time.monotonic()
    comp = owner()
    if _connection and _panel and comp.op('video_out').par.active.eval():
        if now - _last_frame >= 1 / max(1, int(comp.par.Framerate.eval())):
            # Static panels otherwise stop cooking, starving WebRTC of frames
            # and causing its bandwidth estimator to reduce image quality.
            _last_frame = now
            comp.op('panel_image').cook(force=True)
            comp.op('video_out').cook(force=True)
    if now - _last_tick < 0.5:
        return
    _last_tick = now
    if not _started and owner().par.Active.eval():
        start()
    if _client and now - _last_seen > 20:
        disconnect()


def allowed(client):
    if owner().par.Allowlan.eval():
        return True
    address = str(client)
    try:
        return ipaddress.ip_address(address).is_loopback
    except ValueError:
        try:
            return ipaddress.ip_address(address.rsplit(':', 1)[0].strip('[]')).is_loopback
        except ValueError:
            return False


def http(request, response):
    response.update({'statusCode': 200, 'statusReason': 'OK', 'cache-control': 'no-store',
                     'x-content-type-options': 'nosniff'})
    if not allowed(request.get('clientAddress', '')):
        response.update(statusCode=403, statusReason='Forbidden', data='LAN connections are disabled.')
        return response
    path = urlsplit(request.get('uri', '/')).path
    assets = {'/': ('index_html', 'text/html; charset=utf-8'),
              '/remote-panel.js': ('remote_panel_js', 'text/javascript; charset=utf-8'),
              '/touch-gestures.js': ('touch_gestures_js', 'text/javascript; charset=utf-8'),
              '/demo.js': ('demo_js', 'text/javascript; charset=utf-8'),
              '/style.css': ('style_css', 'text/css; charset=utf-8')}
    if request.get('method') != 'GET':
        response.update(statusCode=405, statusReason='Method Not Allowed', data='GET only')
    elif path == '/status':
        response.update({'content-type': 'application/json', 'data': json.dumps({**metadata(), 'receivers': int(bool(_connection)), 'events': _events})})
    elif path in assets:
        name, mime = assets[path]
        response.update({'content-type': mime, 'data': owner().op(name).text})
    else:
        response.update(statusCode=404, statusReason='Not Found', data='Not found')
    return response


def ws_open(client, uri):
    global _client, _connection, _last_seen, _status
    server = owner().op('web_server')
    if urlsplit(uri).path != '/signal' or not allowed(client):
        server.webSocketClose(client)
        return
    query=parse_qs(urlsplit(uri).query,keep_blank_values=True)
    target=None
    if 'ticket' in query:
        ticket=query['ticket']
        launch=_launches.pop(ticket[0],None) if len(ticket)==1 else None
        if not launch or launch[0]<=time.monotonic() or not launch[1].valid:
            send({'type':'error','message':'This preview request expired. Connect again.'},client)
            server.webSocketClose(client)
            return
        target=launch[1]
    if _client:
        send({'type': 'replaced', 'message': 'Another browser has taken control. Connect again to take control here.'})
        # Clear the old identity before closing it. Its late callbacks/messages
        # must not close the new peer or release the new receiver's mouse input.
        disconnect()
    if target is not None:
        # Suppress duplicate parameter callbacks; refresh atomically below.
        controls=owner().op('controls');active=controls.par.active.eval()
        controls.par.active=False
        try:
            owner().par.Source='viewer'
            owner().par.Targetop=target
        finally:controls.par.active=active
    _client = client
    _last_seen = time.monotonic()
    refresh_source()
    if _error:
        disconnect()
        return
    rtc = owner().op('webrtc')
    _connection = rtc.openConnection()
    rtc.addTrack(_connection, TRACK, 'video')
    rtc.createDataChannel(_connection, CHANNEL)
    output = owner().op('video_out')
    output.par.webrtcconnection = _connection
    output.par.active = True
    _status = 'Connecting'
    rtc.createOffer(_connection)


def ws_close(client):
    if client == _client:
        disconnect(close_socket=False)


def ws_receive(client, text):
    global _answered, _candidates, _last_seen
    if client != _client or len(text) > 100000:
        return
    try:
        message = json.loads(text)
        kind = message.get('type')
        _last_seen = time.monotonic()
        rtc = owner().op('webrtc')
        if kind == 'answer' and not _answered:
            rtc.setRemoteDescription(_connection, 'answer', message['sdp'])
            _answered = True
            for ice in _candidates:
                rtc.addIceCandidate(_connection, ice['candidate'], ice['sdpMLineIndex'], ice['sdpMid'])
            _candidates = []
        elif kind == 'ice':
            ice = message['candidate']
            if ice and ice.get('candidate'):
                if _answered:
                    rtc.addIceCandidate(_connection, ice['candidate'], ice['sdpMLineIndex'], ice['sdpMid'])
                elif len(_candidates) < 100:
                    _candidates.append(ice)
        elif kind == 'ping':
            send({'type': 'pong', 'status': _status})
        elif kind == 'disconnect':
            disconnect()
    except (ValueError, KeyError, TypeError) as exc:
        send({'type': 'error', 'message': 'Invalid connection message.'})


def rtc_offer(rtc, connection, sdp):
    if connection == _connection:
        rtc.setLocalDescription(connection, 'offer', sdp)
        send({'type': 'offer', 'sdp': sdp})


def rtc_ice(connection, candidate, index, mid):
    if connection == _connection:
        send({'type': 'ice', 'candidate': {'candidate': candidate, 'sdpMLineIndex': index, 'sdpMid': mid}})


def rtc_state(connection, state):
    global _status
    if connection != _connection:
        return
    _status = state.capitalize()
    send({'type': 'state', 'state': state})
    if state in ('failed', 'closed'):
        disconnect()


def rtc_data(connection, channel, data):
    global _events, _last_mouse, _mouse_down, _last_seen
    if not _connection or connection != _connection or channel != CHANNEL or len(data) > 4096 or not _panel:
        return
    try:
        message = json.loads(data)
        if not isinstance(message, dict) or message.get('revision') != _revision:
            return
        if message.get('type') == 'shortcut':
            # TD 2025.32820 has no PanelCOMP.interactKeyboard. H is an explicit
            # viewer reset, not an emulated native key or an application shortcut.
            if message.get('action') != 'reset-viewer' or not _viewer_target or not _viewer_target.valid:
                return
            comp = owner()
            if comp.par.Source.eval() != 'viewer' or comp.par.Targetop.eval() != _viewer_target:
                return
            _viewer_target.resetViewer()
            _last_seen = time.monotonic()
            _events += 1
            return
        if message.get('type') != 'mouse':
            return
        u, v = float(message['u']), float(message['v'])
        wheel = float(message.get('wheel', 0))
        buttons = int(message.get('buttons', 0))
        if not all(math.isfinite(x) for x in (u, v, wheel)) or not 0 <= buttons <= 7:
            return
        if not (-1 <= u <= 2 and -1 <= v <= 2):
            return
        _panel.interactMouse(u, v, left=bool(buttons & 1), middle=bool(buttons & 4),
                             right=bool(buttons & 2), wheel=max(-10, min(10, wheel)))
        _last_mouse = (u, v)
        _mouse_down = bool(buttons)
        _last_seen = time.monotonic()
        _events += 1
    except (ValueError, KeyError, TypeError):
        return


def changed(name):
    if name in ('Active', 'Port', 'Allowlan'):
        restart()
    elif name in ('Source', 'Targetop', 'Panel', 'Width', 'Height', 'Framerate', 'Bitrate'):
        refresh_source()


def pulse(name):
    if name == 'Openbrowser':
        ui.viewFile(local_url())
    elif name == 'Reset':
        restart()
