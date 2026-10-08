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
if 'grapeNativeManager' in manager.tags:  # old tag name (Refactor.32)
    manager.tags.remove('grapeNativeManager')
manager.tags.add('grapeManager')
modules = {
    'GrapeManagerExt': 'src/td/runtime/grape_manager_ext.py',
    'host_api': 'src/td/runtime/host_api.py',
    'host_requests': 'src/td/runtime/host_requests.py',
    'next_family': 'src/td/runtime/next_family.py',
}
positions = {
    'GrapeManagerExt': (0, 0), 'host_api': (240, 0), 'host_requests': (485, 0),
    'next_family': (700, -160),
}
for name, source in modules.items():
    text(manager, name, source, *positions[name], 'json' if source.endswith('.json') else 'python')

node(manager, baseCOMP, 'validation', 1000, -260)
status = node(manager, textDAT, 'status', 1000, 20)
status.par.language = 'json'
page = next((p for p in manager.customPages if p.name == 'Services'), None) or manager.appendCustomPage('Services')
for name, target in [('Editorservice', 'GrapeEditor'), ('Remotepanel', 'remote_panel')]:
    if getattr(manager.par, name, None) is None:
        page.appendCOMP(name)
    getattr(manager.par, name).expr = "parent.GrapeHost.op('" + target + "')"
manager.par.ext0object = "me.op('GrapeManagerExt').module.GrapeManagerExt(me)"
manager.par.ext0promote = True
manager.par.initextonstart = True
drain = node(manager, executeDAT, 'request_pump', 1000, -500)
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

# The review Grape OP outside the Manager. Creating Grape OPs returns with the new
# creation path (design-interview Q6, Q16); this tool never builds one.
# 審查用 Grape OP；建立 Grape OP 等新的建立功能（Q6、Q16），這支工具不建立。
family = host.parent().op('Grape_TOP_test')
assert family is not None, 'The review Grape OP Grape_TOP_test is missing.'
manager.ext.GrapeManagerExt.Register(family)
family.op('GrapeControls/editor_control').text = (root / 'src/td/runtime/grape_op_controls.py').read_text(encoding='utf-8')
assert protected() == before_icon, 'Protected icon changed'
print(json.dumps({'url': 'http://127.0.0.1:' + str(service.http.port) + '/shader/' + family.par.Grapeid.eval() + '/',
                  'family': family.path, 'manager': manager.path, 'protectedIconUnchanged': True}))
