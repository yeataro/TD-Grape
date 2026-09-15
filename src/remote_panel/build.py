"""Build/update a reusable TD component from this directory, inside TouchDesigner."""
from pathlib import Path

ASSETS = {
    'runtime': 'runtime.py', 'web_callbacks': 'web_callbacks.py',
    'rtc_callbacks': 'rtc_callbacks.py', 'controls': 'controls.py',
    'lifecycle': 'lifecycle.py', 'index_html': 'index.html',
    'remote_panel_js': 'remote-panel.js', 'demo_js': 'demo.js', 'style_css': 'style.css',
    'touch_gestures_js': 'touch-gestures.js',
}


def build(parent_comp, name='remote_panel', *, source_dir=None):
    directory = Path(source_dir or Path(__file__).parent)
    comp = parent_comp.op(name)
    if comp:
        assert comp.fetch('tdRemotePanel', False), 'An unrelated component occupies this name.'
        if comp.op('lifecycle'): comp.op('lifecycle').par.active = False
        if comp.op('controls'): comp.op('controls').par.active = False
        if comp.op('runtime'): comp.op('runtime').module.stop()
    else:
        comp = parent_comp.create(baseCOMP, name)
        comp.store('tdRemotePanel', True)
    first = not comp.fetch('tdRemotePanelBuilt', False)

    def node(kind, name, x, y):
        n = comp.op(name)
        if n is None:
            n = comp.create(kind, name)
            n.nodeX, n.nodeY = x, y
        elif first:
            n.nodeX, n.nodeY = x, y
        return n

    page = next((p for p in comp.customPages if p.name == 'Remote Panel'), None) or comp.appendCustomPage('Remote Panel')

    def par(style, name, label, value=None, low=None, high=None):
        p = getattr(comp.par, name, None)
        if p is None:
            p = getattr(page, 'append' + style)(name, label=label)[0]
            if value is not None: p.default = value; p.val = value
        if low is not None: p.min = low; p.clampMin = True
        if high is not None: p.max = high; p.clampMax = True
        return p

    par('Toggle', 'Active', 'Active', False)
    par('Pulse', 'Openbrowser', 'Open in Browser')
    par('Pulse', 'Reset', 'Reset Connection')
    mode = par('Menu', 'Source', 'Source')
    mode.menuNames = ['viewer', 'panel', 'test']
    mode.menuLabels = ['OP Viewer', 'Panel', 'Test Panel']
    if first: mode.default = mode.val = 'test'
    mode.startSection = True
    target = par('OP', 'Targetop', 'Target OP')
    panel = par('COMP', 'Panel', 'Panel')
    target.enableExpr = "me.par.Source == 'viewer'"
    panel.enableExpr = "me.par.Source == 'panel'"
    par('Int', 'Width', 'Width', 960, 160, 1920).startSection = True
    par('Int', 'Height', 'Height', 540, 120, 1080)
    par('Int', 'Framerate', 'Frame Rate', 30, 1, 60)
    par('Int', 'Bitrate', 'Max Bitrate (kbps)', 4000, 128, 20000)
    par('Int', 'Port', 'Web Port', 8920, 1024, 65535).startSection = True
    par('Toggle', 'Allowlan', 'Allow LAN Connections', False)
    for name, label, function in [('Url', 'Local URL', 'local_url'), ('Lanurls', 'LAN URLs', 'lan_urls'),
                                   ('Status', 'Status', 'status')]:
        p = par('Str', name, label)
        p.expr = "me.op('runtime').module." + function + '()'
        p.readOnly = True
    p = par('Int', 'Events', 'Input Events Received')
    p.label = 'Input Events Received'
    p.expr = "me.op('runtime').module.event_count()"
    p.readOnly = True
    version = par('Str', 'Version', 'Module Version', '0.1.2')
    version.default = version.val = '0.1.2'
    version.readOnly = True

    rtc = node(webrtcDAT, 'webrtc', 0, 0)
    server = node(webserverDAT, 'web_server', -240, 0)
    stream = node(videostreamoutTOP, 'video_out', 640, 240)
    image = node(opviewerTOP, 'panel_image', 400, 240)
    viewer = node(opviewerCOMP, 'op_viewer', 120, 240)
    test = node(containerCOMP, 'test_panel', -200, 240)
    stream.par.active = rtc.par.active = server.par.active = False

    for index, (dat_name, filename) in enumerate(ASSETS.items()):
        kind = parameterexecuteDAT if dat_name == 'controls' else executeDAT if dat_name == 'lifecycle' else textDAT
        dat = node(kind, dat_name, -240 + (index % 4) * 250, -250 - (index // 4) * 160)
        if hasattr(dat.par, 'active'): dat.par.active = False
        dat.text = (directory / filename).read_text(encoding='utf-8')

    server.par.port.expr = 'parent().par.Port'
    server.par.callbacks = 'web_callbacks'
    rtc.par.callbacks = 'rtc_callbacks'
    rtc.par.stun = ''
    rtc.par.turn0server = ''
    rtc.par.bitratelimits = True
    rtc.par.minbitrate = 128
    rtc.par.maxbitrate.expr = 'parent().par.Bitrate'
    stream.par.mode = 'webrtc'
    stream.par.webrtc = 'webrtc'
    stream.par.webrtcconnection = ''
    stream.par.webrtcvideotrack = 'TDPanel'
    stream.par.fps.expr = 'parent().par.Framerate'
    stream.inputConnectors[0].connect(image)
    image.par.outputresolution = 'custom'
    image.par.resolutionw.expr = 'parent().par.Width'
    image.par.resolutionh.expr = 'parent().par.Height'
    # Interaction is delivered to the Panel COMP, never through the capture TOP.
    image.par.allowpanel = False
    image.par.preservealpha = False
    viewer.par.opviewer.expr = 'parent().par.Targetop'
    viewer.par.interactive = True
    viewer.par.topdirect = False
    viewer.par.mousewheel = True
    for n in (viewer, test):
        n.par.w.expr = 'parent().par.Width'
        n.par.h.expr = 'parent().par.Height'
    test.par.bgcolorr, test.par.bgcolorg, test.par.bgcolorb = .075, .075, .095
    test.par.bgalpha = 1
    button = test.op('toggle_button1') or test.create(buttonCOMP, 'toggle_button1')
    button.par.label = 'Click to toggle'
    button.par.buttontype = 'toggledown'
    button.par.fontsize = 20
    slider = test.op('value_slider1') or test.create(sliderCOMP, 'value_slider1')
    slider.par.label = 'Drag to change value'
    for n, fraction in [(button, .57), (slider, .25)]:
        n.par.x.expr = 'parent().width * .125'
        n.par.y.expr = 'parent().height * ' + str(fraction)
        n.par.w.expr = 'parent().width * .75'
        n.par.h.expr = 'parent().height * .18'
    button.nodeX, button.nodeY = 0, 0
    slider.nodeX, slider.nodeY = 220, 0
    controls = comp.op('controls')
    controls.par.op = '..'
    controls.par.pars = 'Active Openbrowser Reset Source Targetop Panel Width Height Framerate Bitrate Port Allowlan'
    controls.par.valuechange = controls.par.onpulse = True
    lifecycle = comp.op('lifecycle')
    lifecycle.par.framestart = True
    lifecycle.par.start = True
    lifecycle.par.create = True
    lifecycle.par.exit = True
    comp.store('tdRemotePanelBuilt', True)
    comp.par.opviewer = 'panel_image'
    controls.par.active = lifecycle.par.active = True
    comp.op('runtime').module.start()
    return comp
