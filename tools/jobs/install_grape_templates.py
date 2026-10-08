"""Install the Grape OP templates that the TD menu (TDFam, OP Create / Tab) copies.

Run inside TD through MCP with __file__ set. Builds `masters/grape_top` inside the main component
(found by its global OP shortcut `TDGrape`, design-interview Q49) following the human's layout
(`Grape_TOP_REF`, 2026-10-09; work/in-place-refactor-design/grape-op-structure.md):
  top left     GrapeControls (program), FamManifest (TDFam metadata)
  top right    content made by the editor, docked on `shader`: pixel_shader, graph (the graph,
               the one copy), graph_meta (proof and execution part), uniforms (binding table), status
  bottom left  input1 (In TOP, listed in the GLSL TOP's TOPs list, not wired) and Samples (defaults)
  bottom right shader (GLSL TOP), output
The default graph and its GLSL go into the template now, so creating a Grape OP needs neither the
editor service nor the Manager (Q32 Q6). The template has no ID; each copy takes one when created.
Grape MAT is not offered until the MAT round. Re-running rebuilds the template from scratch.
在 TD 內經 MCP 執行。照人類的樣板建出主組件裡的 masters/grape_top（透過全域捷徑 TDGrape 找主組件）。
預設圖與 GLSL 在準備範本時就放進去；範本沒有 ID；重跑會整個重建範本。
"""
import json
from hashlib import sha256
from pathlib import Path

root_dir = Path(__file__).resolve().parents[2]
assert hasattr(op, 'TDGrape'), 'The TD-Grape main component (global OP shortcut TDGrape) is not in this project.'
host = op.TDGrape
masters = host.op('masters')
tdfam = host.op('tdfam')
callbacks = host.op('family_callbacks')
version = json.loads((root_dir / 'src/version.json').read_text(encoding='utf-8'))['version']
bootstrap = json.loads((root_dir / 'src/generated/editor-bootstrap.json').read_text(encoding='utf-8'))
source = lambda name: (root_dir / 'src/td/runtime' / name).read_text(encoding='utf-8')
digest = lambda text: sha256(text.encode('utf-8')).hexdigest()

TEMPLATES_TAG = 'grapeTemplates'
GRAPE_OP_TAG = 'grapeOP'
masters.tags.add(TEMPLATES_TAG)
for name in ('grape_mat',):
    assert masters.op(name) is None, 'Grape MAT is not offered until the MAT round: remove ' + masters.op(name).path
if masters.op('grape_top') is not None:
    masters.op('grape_top').destroy()  # generated content only; rebuilt below


def node(container, kind, name, x, y, w=None, h=None):
    n = container.create(kind, name)
    assert n.name == name
    n.nodeX, n.nodeY = x, y
    if w:
        n.nodeWidth = w
    if h:
        n.nodeHeight = h
    return n


def text(container, name, content, x, y, language, dock=None):
    n = node(container, textDAT, name, x, y)
    n.par.language = language
    n.text = content
    if dock is not None:
        n.dock = dock
    return n


# Mechanisms TD does not show by itself are written on the network (human 2026-10-08), in English.
def annotation(container, name, title, body, x, y, w, h):
    n = container.create(annotateCOMP)  # TD ignores a name given at creation for annotations
    n.name = name
    n.par.Mode = 'annotate'
    n.par.Titletext, n.par.Bodytext = title, body
    n.nodeX, n.nodeY, n.nodeWidth, n.nodeHeight = x, y, w, h
    return n


# The stored work, exactly as the editor would store it (serializeDocument = JSON.stringify).
graph_text = json.dumps(bootstrap['defaultDocument']['graph'], ensure_ascii=False, separators=(',', ':'))
compiled = bootstrap['defaultDocument']['compiled']
runtime_text = json.dumps(compiled, ensure_ascii=False, separators=(',', ':'))
meta = {'format': 'grape-meta-2', 'targetId': '',
        'document': {'revision': 0, 'sha256': digest(graph_text)},
        'runtime': {'revision': 0, 'text': runtime_text, 'sha256': digest(runtime_text), 'document': None,
                    'editorVersion': version}}  # the default GLSL comes from this build

top = node(masters, baseCOMP, 'grape_top', 0, 0)
top.tags.add(GRAPE_OP_TAG)
top.par.parentshortcut = 'GrapeOP'

# Bottom right: the Shader and its output.
shader = node(top, glslTOP, 'shader', 50, -150, 149, 124)
for unused in ('shader_pixel', 'shader_compute', 'shader_info'):
    if top.op(unused):
        top.op(unused).destroy()
shader.par.glslversion = 'glsl450'
shader.par.computedat = ''
shader.par.outputresolution = 'custom'
shader.par.resolutionw = 512
shader.par.resolutionh = 512
shader.par.format = 'rgba16float'
output = node(top, outTOP, 'output', 300, -150)
output.inputConnectors[0].connect(shader)
top.par.opviewer = './output'  # relative to the COMP itself, not next to it
top.viewer = True

# Top right: content made by the editor, docked on the Shader.
pixel = text(top, 'pixel_shader', compiled['pixel'], 75, 75, 'glsl', dock=shader)
shader.par.pixeldat = 'pixel_shader'
text(top, 'graph', graph_text, 225, 75, 'json', dock=shader)
text(top, 'graph_meta', json.dumps(meta, ensure_ascii=False), 375, 75, 'json', dock=shader)
uniforms = node(top, tableDAT, 'uniforms', 525, 75)
uniforms.clear()
uniforms.dock = shader
text(top, 'status', '{}', 675, 75, 'json', dock=shader)
info = node(top, infoDAT, 'compile_info', 50, -336, 148, 105)
info.par.op = 'shader'
info.dock = shader
annotation(top, 'annotate_content', 'Made by the Editor: graph, shader, uniforms, status',
    'Content generated by the Editor. It does not depend on the main component, even if the main component is missing.',
    50, 50, 780, 190)

# Bottom left: inputs. input1 is listed in the TOPs list (never wired); Samples gives its default.
samples = node(top, baseCOMP, 'Samples', -500, -150, 160, 130)
select_page = samples.appendCustomPage('Select')
select_page.appendTOP('Top', label='TOP')
grape_image = node(samples, moviefileinTOP, 'sample_Grape', -178, -117, 130, 72)
grape_image.par.file.expr = ("op.TDGrape.op('VFS').vfs['Greap800.png'] if hasattr(op, 'TDGrape') "
                             "else app.samplesFolder+'/Map/Banana.tif'")
banana = node(samples, moviefileinTOP, 'sample_Banana', -178, -242, 130, 72)
banana.par.file.expr = "app.samplesFolder+'/Map/Banana.tif'"
jelly = node(samples, moviefileinTOP, 'sample_Jellybeans', -178, -367, 130, 72)
jelly.par.file.expr = "app.samplesFolder + '/Map/Jellybeans.1.jpg'"
white = node(samples, constantTOP, 'sample_white', -178, -492, 130, 90)
black = node(samples, constantTOP, 'sample_black', -178, -617, 130, 105)
black.par.colorr, black.par.colorg, black.par.colorb = 0.0, 0.0, 0.0
flat = node(samples, constantTOP, 'sample_flatNormal', -178, -742, 130, 105)
flat.par.colorr, flat.par.colorg, flat.par.colorb = 0.5, 0.5, 1.0  # flat normal (0, 0, 1) encoded
chosen = node(samples, selectTOP, 'select_top', -178, -867)
chosen.par.top.expr = 'parent().par.Top'
for i, (source_op, y) in enumerate([(grape_image, -125), (banana, -250), (jelly, -375), (white, -492),
                                    (black, -609), (flat, -734), (chosen, -867)], start=1):
    out = node(samples, outTOP, 'out' + str(i), 50, y)
    out.inputConnectors[0].connect(source_op)
annotation(samples, 'annotate_samples', 'Default inputs',
    'Default images for an input when nothing is connected from outside.\n'
    "out1-out6 are fixed samples: Grape (from the main component's VFS; Banana when the main component is missing), "
    'Banana, Jellybeans, white, black, flat normal. out7 is the TOP chosen in the TOP parameter.\n'
    'Which one an input uses comes from the graph (defaultTexture); it is wired when the editor applies.',
    -205, -895, 410, 880)
# The default graph's texture input (human 2026-10-09): input1, default image Grape. The editor
# manages the In TOPs from then on (next_family.py _place_inputs). 預設圖的貼圖輸入；之後由編輯器管理。
default_input = bootstrap['defaultDocument']['graph']['declarations'][0]
assert default_input['kind'] == 'topInput' and default_input['defaultTexture'] == 'grape'
input1 = node(top, inTOP, 'input1', -200, -125, 130, 72)
input1.store('grapeInput', default_input['id'])
input1.par.label = default_input['name']
input1.inputConnectors[0].connect(samples.outputConnectors[0])
shader.par.tops = 'input1'
annotation(top, 'annotate_inputs', 'Inputs: managed by the TOPs list',
    'Inputs are made and removed by the editor (TOP texture inputs in Sources) and listed in the TOPs list on the GLSL TOP; '
    'the list order is the input order. They line up under input1, top to bottom.\n'
    'Do not also wire a TOP into the GLSL TOP: it would be counted as two inputs.\n'
    'When nothing is connected from outside, the default image comes from Samples.',
    -275, -170, 255, 410)

# Top left: program and TDFam metadata.
controls = node(top, baseCOMP, 'GrapeControls', -750, 75, 160, 130)
identity = node(controls, executeDAT, 'identity', 220, -160)
identity.par.language = 'python'
identity.text = source('grape_op_identity.py')
identity.par.create = True
identity.par.start = False
identity.par.framestart = False
identity.par.frameend = False
identity.par.active = True
# The Grape page (design-interview Q45; work/in-place-refactor-design/grape-page.md). Order and
# sections are tidied by the human at the end. Grape 頁；排列與分段最後由人類整理。
page = top.appendCustomPage('Grape')
page.appendPulse('Openeditor', label='Open Editor')
page.appendPulse('Openinbrowser', label='Open in Browser')
page.appendPulse('Glslparameters', label='GLSL Parameters')
page.appendStr('Grapeeditorversion', label='Grape Editor Version')
# Read from graph_meta: the editor build that produced the GLSL that runs. 由 graph_meta 讀出。
top.par.Grapeeditorversion.expr = ("(mod.json.loads(me.op('graph_meta').text).get('runtime') or {})"
                                   ".get('editorVersion', 'unknown')")
top.par.Grapeeditorversion.readOnly = True
page.appendTOP('Generatedtop', label='Generated TOP')
top.par.Generatedtop.expr = "me.op('output')"
top.par.Generatedtop.readOnly = True
page.appendStr('Grapeid', label='Grape ID')
page.appendPulse('Regenerateid', label='Regenerate ID')
top.par.Grapeid.val = ''
top.par.Grapeid.readOnly = True
edit = node(controls, parameterexecuteDAT, 'editor_control', 0, -160)
edit.par.language = 'python'
edit.text = source('grape_op_controls.py')
edit.par.op.expr = 'parent.GrapeOP'
edit.par.pars = 'Openeditor Openinbrowser Glslparameters Regenerateid Grapeid'
edit.par.custom = True
edit.par.builtin = False
edit.par.valuechange = True
edit.par.onpulse = True
annotation(controls, 'annotate_identity', 'Identity & editing (not visible in TD)',
    'identity: when this Grape OP is created (project start, .tox load, copy, paste), it checks one frame later whether '
    'another Grape OP uses the same Grape ID, and takes a new one only then. Cut and paste keeps the ID; a copy gets a new one. '
    'Templates (masters) never take an ID.\n'
    'editor_control: Open Editor (an app window when the browser supports it) and Open in Browser open the editor through the main '
    'component (global shortcut TDGrape), asking first when the editor service is off; GLSL Parameters opens the inner GLSL TOP; '
    'Regenerate ID takes a new ID; '
    'Grape ID is read-only in the UI, and an invalid or already used ID written by a script is reverted.\n'
    'graph_meta: when the Grape ID changes, the main component rewrites the ID stored there on its next read '
    '(only that record; the graph and the Shader are untouched).',
    -25, -420, 620, 230)
manifest = node(top, baseCOMP, 'FamManifest', -500, 75, 160, 130)
op_info = {'fam_version': tdfam.par.Version.eval(), 'op_version': version, 'op_fam': 'Grape',
           'op_type': 'grape_top', 'op_name': 'Grape_TOP', 'op_label': 'Grape TOP', 'op_group': 'TOP',
           'summary': 'Visual GLSL TOP editor. Open Editor opens the editor.',
           'op_color': [0.47, 0.42, 0.71], 'isFilter': False, 'compatible_types': ['TOP'],
           'search_words': ['shader', 'glsl', 'grape', 'top']}
for i, (name, content) in enumerate((('OpInfo', op_info), ('ParRetain', {'.': []}), ('Shortcuts', {}),
                                     ('StateRetain', {'.': {'storage': [], 'dats': []}}))):
    text(manifest, name, json.dumps(content, indent=4), 220 * i, 0, 'json')

# The menu offers Grape TOP only; callbacks need neither the service nor the Manager.
tdfam.par.Compatibletypes = 'TOP'
callbacks.text = source('family_callbacks.py')
shader.cook(force=True)
info.cook(force=True)
print(json.dumps({'template': top.path, 'tags': sorted(top.tags), 'shaderErrors': shader.errors(),
                  'compiled': info.text.count('Compiled Successfully'), 'version': version,
                  'children': sorted(c.name for c in top.children)}))
