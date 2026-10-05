"""Install the compiler-free TOP integration in the authorized development shell.

Run inside TD through MCP with __file__ and CHECKPOINT_DIR. Leaves IconGen/icon,
Legacy processes, existing masters and Remote Panel internals untouched.
Sources are embedded so the Family and saved project remain self-contained.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
host = op('/TD_Grape')
manager = host.op('GrapeManager')
editor = host.op('GrapeEditor')
checkpoint = Path(CHECKPOINT_DIR)
checkpoint.mkdir(parents=True, exist_ok=True)
if not (checkpoint / 'before-manager.tox').exists():
    host.save(str(checkpoint / 'before-manager.tox'))

def protected():
    result = {}
    for branch in (host.op('IconGen'), host.op('icon')):
        for n in [branch] + (branch.findChildren() if branch.family == 'COMP' else []):
            result[n.path] = (n.id, n.comment, str(n.storage),
                [(p.name, str(p.mode), str(p.val), p.expr, p.bindExpr) for p in n.pars()],
                getattr(n, 'text', '') if n.family == 'DAT' else '')
    return result
before_icon = protected()

def node(container, kind, name, x, y):
    n = container.op(name)
    if n is None:
        n = container.create(kind, name)
        assert n.name == name
    n.nodeX, n.nodeY = x, y
    n.viewer = True
    return n

def text(container, name, source, x, y, language='python'):
    n = node(container, textDAT, name, x, y)
    n.par.language = language
    n.text = (root / source).read_text(encoding='utf-8')
    return n

try:
    manager.ext.GrapeManagerExt.Disconnect()
except AttributeError:
    pass
host.par.parentshortcut = 'GrapeHost'
manager.par.parentshortcut = 'GrapeManager'
manager.tags.add('grapeNativeManager')
modules = {
    'GrapeManagerExt': 'src/td/runtime/grape_manager_ext.py',
    'host_api': 'src/td/runtime/host_api.py',
    'host_requests': 'src/td/runtime/host_requests.py',
    'native_family': 'src/td/runtime/native_family.py',
    'host_artifact': 'src/td/runtime/host_artifact.py',
    'host_document': 'src/td/runtime/host_document.py',
    'native_values': 'src/td/runtime/native_values.py',
    'sources': 'src/core/sgrape_sources.py',
    'sgrape_source_catalog': 'src/core/sgrape_source_catalog.py',
    'source_catalog': 'src/library/source_catalog.json',
    'parameters': 'src/core/sgrape_parameters.py',
    'history': 'src/core/sgrape_history.py',
    'parameter_links_source': 'src/core/sgrape_parameter_links.py',
}
for i, (name, source) in enumerate(modules.items()):
    text(manager, name, source, 240 * (i % 4), -160 * (i // 4), 'json' if source.endswith('.json') else 'python')
node(manager, baseCOMP, 'validation', 1000, -120)
status = node(manager, textDAT, 'status', 1000, 160)
status.par.language = 'json'
page = next((p for p in manager.customPages if p.name == 'Services'), None) or manager.appendCustomPage('Services')
for name, target in [('Editorservice', 'GrapeEditor'), ('Remotepanel', 'remote_panel')]:
    if getattr(manager.par, name, None) is None:
        page.appendCOMP(name)
    getattr(manager.par, name).expr = "parent.GrapeHost.op('" + target + "')"
manager.par.ext0object = "me.op('GrapeManagerExt').module.GrapeManagerExt(me)"
manager.par.ext0promote = True
manager.par.initextonstart = True
drain = node(manager, executeDAT, 'request_pump', 1000, -360)
drain.par.framestart = True
drain.par.frameend = False
drain.par.start = False
drain.par.create = False
drain.text = "def onFrameStart(frame):\n    parent().ext.GrapeManagerExt.Drain()\n"
drain.comment = 'Editing requests only. An empty queue does not inspect any Family or Parameter.'

# Stop only our Editor service before replacing its module; preserve its port.
editor.ext.EditorServiceExt.Stop()
text(editor, 'editor_service', 'src/td/runtime/editor_service.py', editor.op('editor_service').nodeX, editor.op('editor_service').nodeY)
ext_dat = editor.op('EditorServiceExt')
assert ext_dat is not None, 'Unexpected Editor Service extension layout'
ext_dat.text = (root / 'src/td/runtime/editor_service_ext.py').read_text(encoding='utf-8')
if getattr(editor.par, 'Manager', None) is None:
    editor.customPages[0].appendCOMP('Manager')
editor.par.Manager.expr = "parent.GrapeHost.op('GrapeManager')"
manager.initializeExtensions(0)
editor.initializeExtensions(0)
service = editor.ext.EditorServiceExt
assert service.UpdateEmbedded(), 'Editor asset packaging failed'
assert service.Reload(), 'Editor asset loading failed'
assert service.Start(), 'Editor HTTP startup failed'
service._connect_manager()
assert manager.ext.GrapeManagerExt.queue is not None, editor.par.Serviceerror.eval()

# A real editable TOP outside the Manager; existing master assets are retained.
family = host.parent().op('Grape_TOP_Refactor')
if family is None:
    family = node(host.parent(), baseCOMP, 'Grape_TOP_Refactor', host.nodeX + 350, host.nodeY)
    family.par.parentshortcut = 'GrapeFamily'
    shader = node(family, glslTOP, 'shader', 240, 0)
    pixel = node(family, textDAT, 'pixel_shader', 240, -140)
    pixel.par.language = 'glsl'
    shader.par.pixeldat = 'pixel_shader'
    # The pixel-only Family owns its explicit DATs; discard TD's unused templates.
    shader.par.computedat = ''
    for unused in ('shader_pixel', 'shader_compute', 'shader_info'):
        if family.op(unused):
            family.op(unused).destroy()
    shader.par.glslversion = 'glsl450'
    shader.par.outputresolution = 'custom'
    shader.par.resolutionw = 512
    shader.par.resolutionh = 512
    shader.par.format = 'rgba16float'
    info = node(family, infoDAT, 'compile_info', 240, 140)
    info.par.op = 'shader'
    output = node(family, outTOP, 'output', 460, 0)
    output.inputConnectors[0].connect(shader)
    family.par.opviewer = 'output'
    graph = node(family, textDAT, 'graph', 0, 140)
    graph.par.language = 'json'
    controls = node(family, baseCOMP, 'GrapeControls', 0, -160)
    for i, name in enumerate(('document', 'status')):
        dat = node(controls, textDAT, name, 220 * i, 0)
        dat.par.language = 'json'
    page = family.appendCustomPage('Grape')
    page.appendPulse('Edit', label='Edit Shader')
    edit = node(controls, parameterexecuteDAT, 'editor_control', 0, -160)
    edit.par.op.expr = 'parent.GrapeFamily'
    edit.par.pars = 'Edit'
    edit.par.custom = True
    edit.par.builtin = False
    edit.par.valuechange = False
    edit.par.onpulse = True
    edit.text = (root / 'src/td/runtime/native_family_controls.py').read_text(encoding='utf-8')
    manager.ext.GrapeManagerExt.InitializeFamily(family)
else:
    manager.ext.GrapeManagerExt.Register(family)
family.op('GrapeControls/editor_control').text = (root / 'src/td/runtime/native_family_controls.py').read_text(encoding='utf-8')
assert protected() == before_icon, 'Protected icon changed'
print(json.dumps({'url': 'http://127.0.0.1:' + str(service.http.port) + '/shader/' + family.fetch('sgrapeShaderId') + '/',
                  'family': family.path, 'manager': manager.path, 'protectedIconUnchanged': True}))
