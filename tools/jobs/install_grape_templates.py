"""Install the Grape OP templates that the TD menu (TDFam, OP Create / Tab) copies.

Run inside TD through MCP with __file__ set. Builds /TD_Grape/masters/grape_top in the
new format: the default graph and its GLSL are put into the template now, so creating a
Grape OP needs neither the editor service nor the Manager (design-interview Q32 Q6). The
template has no ID; each copy takes one when it is created. Grape MAT is not offered until
the MAT round (human 2026-10-08). Re-running rebuilds the template's generated content.
在 TD 內經 MCP 執行。建出新格式的 /TD_Grape/masters/grape_top：準備範本時就放進預設圖與 GLSL，
建立 Grape OP 不需要編輯服務或 Manager。範本沒有 ID，每個複本建立時自己取號。Grape MAT 等 MAT
那一輪再提供。重跑會重建範本內產生的內容。
"""
import json
from hashlib import sha256
from pathlib import Path

root_dir = Path(__file__).resolve().parents[2]
host = op('/TD_Grape')
masters = host.op('masters')
tdfam = host.op('tdfam')
callbacks = host.op('family_callbacks')
version = json.loads((root_dir / 'src/version.json').read_text(encoding='utf-8'))['version']
bootstrap = json.loads((root_dir / 'src/generated/editor-bootstrap.json').read_text(encoding='utf-8'))
source = lambda name: (root_dir / 'src/td/runtime' / name).read_text(encoding='utf-8')
digest = lambda text: sha256(text.encode('utf-8')).hexdigest()

TEMPLATES_TAG = 'grapeTemplates'
GRAPE_OP_TAG = 'grapeOP'
for name in ('grape_mat', 'grape_top'):
    old = masters.op(name)
    assert old is None or old.op('GrapeControls/identity') is not None, \
        'Delete the old-format template ' + old.path + ' first (it predates the new format).'
masters.tags.add(TEMPLATES_TAG)


def node(container, kind, name, x, y):
    n = container.op(name)
    if n is None:
        n = container.create(kind, name)
        assert n.name == name
    n.nodeX, n.nodeY = x, y
    return n


def text(container, name, content, x, y, language):
    n = node(container, textDAT, name, x, y)
    n.par.language = language
    n.text = content
    return n


# The default document, exactly as the editor would store it (serializeDocument = JSON.stringify).
# 預設文件，與編輯器存入的形式相同。
graph_text = json.dumps(bootstrap['defaultDocument']['graph'], ensure_ascii=False, separators=(',', ':'))
compiled = bootstrap['defaultDocument']['compiled']
runtime_text = json.dumps(compiled, ensure_ascii=False, separators=(',', ':'))
envelope = {'format': 'grape-next-1', 'targetId': '',
            'document': {'revision': 0, 'text': graph_text, 'sha256': digest(graph_text)},
            'runtime': {'revision': 0, 'text': runtime_text, 'sha256': digest(runtime_text)},
            'lastKnownGood': {'revision': 0, 'document': graph_text, 'runtime': runtime_text}}

top = node(masters, baseCOMP, 'grape_top', 0, 0)
top.tags.add(GRAPE_OP_TAG)
top.par.parentshortcut = 'GrapeOP'
shader = node(top, glslTOP, 'shader', 240, 0)
for unused in ('shader_pixel', 'shader_compute', 'shader_info'):
    if top.op(unused):
        top.op(unused).destroy()
pixel = text(top, 'pixel_shader', compiled['pixel'], 240, -140, 'glsl')
shader.par.pixeldat = 'pixel_shader'
shader.par.computedat = ''
shader.par.glslversion = 'glsl450'
shader.par.outputresolution = 'custom'
shader.par.resolutionw = 512
shader.par.resolutionh = 512
shader.par.format = 'rgba16float'
info = node(top, infoDAT, 'compile_info', 240, 140)
info.par.op = 'shader'
output = node(top, outTOP, 'output', 460, 0)
output.inputConnectors[0].connect(shader)
# Relative to the COMP itself: a bare name would resolve next to the COMP, not inside it.
top.par.opviewer = './output'
top.viewer = True
text(top, 'graph', graph_text, 0, 140, 'json')

controls = node(top, baseCOMP, 'GrapeControls', 0, -160)
text(controls, 'document', json.dumps(envelope, ensure_ascii=False), 0, 0, 'json')
text(controls, 'status', '{}', 220, 0, 'json')
identity = node(controls, executeDAT, 'identity', 220, -160)
identity.par.language = 'python'
identity.text = source('grape_op_identity.py')
identity.par.create = True
identity.par.start = False
identity.par.framestart = False
identity.par.frameend = False
identity.par.active = True

page = next((p for p in top.customPages if p.name == 'Grape'), None) or top.appendCustomPage('Grape')
if getattr(top.par, 'Edit', None) is None:
    page.appendPulse('Edit', label='Edit Shader')
if getattr(top.par, 'Grapeid', None) is None:
    page.appendStr('Grapeid', label='Grape ID')
if getattr(top.par, 'Regenerateid', None) is None:
    page.appendPulse('Regenerateid', label='Regenerate ID')
top.par.Grapeid.val = ''
top.par.Grapeid.readOnly = True

edit = node(controls, parameterexecuteDAT, 'editor_control', 0, -160)
edit.par.language = 'python'
edit.text = source('grape_op_controls.py')
edit.par.op.expr = 'parent.GrapeOP'
edit.par.pars = 'Edit Regenerateid Grapeid'
edit.par.custom = True
edit.par.builtin = False
edit.par.valuechange = True
edit.par.onpulse = True

manifest = node(top, baseCOMP, 'FamManifest', 460, -160)
op_info = {'fam_version': tdfam.par.Version.eval(), 'op_version': version, 'op_fam': 'Grape',
           'op_type': 'grape_top', 'op_name': 'Grape_TOP', 'op_label': 'Grape TOP', 'op_group': 'TOP',
           'summary': 'Visual GLSL TOP editor. Edit Shader opens the editor.',
           'op_color': [0.47, 0.42, 0.71], 'isFilter': False, 'compatible_types': ['TOP'],
           'search_words': ['shader', 'glsl', 'grape', 'top']}
for i, (name, content) in enumerate((('OpInfo', op_info), ('ParRetain', {'.': []}), ('Shortcuts', {}),
                                     ('StateRetain', {'.': {'storage': [], 'dats': []}}))):
    text(manifest, name, json.dumps(content, indent=4), 220 * i, 0, 'json')

# Mechanisms that TD does not show by itself are written on the network (human 2026-10-08).
# TD 本身看不出來的機制，寫在網路上讓人看得到。
def annotation(container, name, title, body, x, y, w, h, rgb):
    n = container.op(name)
    if n is None:
        n = container.create(annotateCOMP)  # TD ignores a name given at creation for annotations
        n.name = name
    n.par.Mode = 'annotate'
    n.par.Titletext, n.par.Bodytext = title, body
    n.par.Backcolorr, n.par.Backcolorg, n.par.Backcolorb = rgb
    n.nodeX, n.nodeY, n.nodeWidth, n.nodeHeight = x, y, w, h


annotation(top, 'annotate_shader', 'Shader（執行中）',
    'pixel_shader 是編輯器產生的 GLSL，shader 執行它，output 是輸出。\n'
    '建立時就帶著預設圖的 GLSL，不需要編輯服務。', 215, -200, 420, 430, (0.2, 0.3, 0.45))
annotation(controls, 'annotate_identity', '身分與編輯（TD 看不出來的機制）',
    'identity：這個 Grape OP 被建立（開專案、載入 .tox、複製、貼上）時，下一幀檢查有沒有別的 Grape OP\n'
    '用同一個 Grape ID，有才換新號。剪下貼上保留原號，複製的那份換號。範本（masters）不取號。\n'
    'editor_control：Edit Shader 透過 Manager 開編輯器；Regenerate ID 換新號；\n'
    'Grape ID 介面上唯讀，程式寫入不合格或撞號的值會被改回。\n'
    'document：編輯器存的圖（不透明文字＋校驗值）。Grape ID 換了之後，Manager 下一次讀取時\n'
    '把 document 裡的 ID 改成新的（只改信封，圖與 Shader 不動）。', -25, -420, 620, 230, (0.45, 0.35, 0.15))

# The menu offers Grape TOP only; callbacks need neither the service nor the Manager.
tdfam.par.Compatibletypes = 'TOP'
callbacks.text = source('family_callbacks.py')
shader.cook(force=True)
info.cook(force=True)
print(json.dumps({'template': top.path, 'tags': sorted(top.tags), 'shaderErrors': shader.errors(),
                  'compiled': info.text.count('Compiled Successfully'), 'version': version,
                  'masters': [c.name for c in masters.children]}))
