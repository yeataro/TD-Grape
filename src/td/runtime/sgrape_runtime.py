"""Embedded TD runtime. All TD API calls run on TD's main thread.

The HTTP worker only handles bytes and a queue. LAN access and session-token
requirements are manager options; both network modes validate Host/Origin.
"""
import base64
import copy
import hashlib
import http.server
import ipaddress
import json
import queue
import re
import secrets
import socket
import struct
import threading
import time
import urllib.parse
import zlib
import uuid
from contextlib import contextmanager

PRODUCT_VERSION='0.8.84'

# Native TD operator colors. Keep the family identity while hinting at MAT/TOP.
# Graph port/category colors are independently configured in style.css.
OP_COLORS={
    'family':(.48,.33,.67),
    'mat':(.57,.46,.58),
    'top':(.47,.42,.71),
}


TEXTURE_SOURCE_CODE=r'''"""Embedded in each Shader; independent of the editor and its HTTP server."""
def _external_allowed(comp, source):
    if not source or source.family != 'TOP':
        return False
    if source == comp or source.path.startswith(comp.path + '/'):
        return False
    ancestor = source.parent()
    while ancestor:
        if ancestor.fetch('sgrapeManager', False):
            return False
        ancestor = ancestor.parent()
    return True

def describe(key):
    comp = me.parent()
    spec = comp.fetch('sgrapeTextureSources', {}).get(key)
    if spec is None:
        return {'valid': False, 'status': 'inactive', 'path': '', 'source': None}
    parameter = getattr(comp.par, spec.get('parameter') or '_missing', None)
    fallback = comp.op(spec['asset'])
    value = None
    blank = False
    try:
        if parameter is not None:
            value = parameter.eval()
            blank = parameter.mode == ParMode.CONSTANT and not str(parameter.val).strip()
        else:
            raw = spec['default']
            value = comp.op(raw[3:]) if raw.startswith('op:') else fallback
        if blank:
            raw = spec['default']
            value = comp.op(raw[3:]) if raw.startswith('op:') else fallback
        valid = value == fallback or _external_allowed(comp, value)
    except Exception:
        valid = False
    # Only an empty/missing source recovers. Wrong operator families, recursive
    # paths and invalid dimensionality remain errors rather than being hidden.
    referenced = value
    if not valid and referenced is None and parameter is not None and parameter.mode == ParMode.CONSTANT and not blank:
        # TOP parameters can evaluate to None for an existing non-TOP operator.
        # That is a wrong source type, not a missing path eligible for fallback.
        referenced = comp.parent().op(str(parameter.val).strip())
    recoverable = not valid and referenced is None and spec.get('fallback') == 'opaque-black'
    black = comp.op(spec.get('blackAsset', '')) if recoverable else None
    return {'valid': bool(valid), 'status': 'ready' if valid else 'missing' if recoverable else 'invalid',
            'recoverable': bool(recoverable),
            'path': (spec['default'] if value == fallback and spec['default'].startswith('builtin:') else value.path) if valid else '',
            'source': value if valid else black or fallback}

def resolve(key):
    # Invalid live TD expressions use the bundled fallback; status stays invalid.
    # Graph deployment and editor value writes reject invalid references first.
    return describe(key)['source']

def external_input():
    comp = me.parent()
    external = comp.fetch('sgrapeTextureExternal', '')
    return comp.op(external) if external else (comp.inputs[0] if comp.inputs else None)

def effective(key):
    comp=me.parent()
    slots=comp.fetch('grapeTopSlots',[])
    if key=='input:0' and slots:key='slot:'+comp.fetch('grapeTopLegacyId',slots[0]['id'])
    if key.startswith('slot:'):
        ident=key[5:];index=next((i for i,slot in enumerate(slots) if slot['id']==ident),None)
        path=comp.fetch('grapeTopExternal',{}).get(ident)
        external=comp.op(path) if path else (comp.inputConnectors[index].connections[0].owner if index is not None and index<len(comp.inputConnectors) and comp.inputConnectors[index].connections else None)
        if external:return {'valid':True,'status':'connected','path':external.path,'source':external}
    if key == 'input:0':
        external = external_input()
        if external:
            return {'valid': True, 'status': 'connected', 'path': external.path, 'source': external}
    return describe(key)

def status(key):
    row = effective(key)
    return (row['status'] + ': ' + row['path']) if row['valid'] else 'Invalid TOP source; using bundled fallback'

def match_input():
    comp = me.parent()
    slots=comp.fetch('grapeTopSlots',[])
    if comp.fetch('grapeTopSourceVersion',0)==1:return bool(slots)
    key='slot:'+slots[0]['id'] if slots else 'input:0'
    spec=comp.fetch('sgrapeTextureSources', {}).get(key, {})
    parameter=getattr(comp.par,spec.get('parameter') or '_missing',None)
    selected=parameter is not None and (parameter.mode!=ParMode.CONSTANT or bool(str(parameter.val).strip()))
    return effective(key)['status']=='connected' or spec.get('matchDefault',False) or selected

def input_dimension(dimension):
    comp=me.parent()
    slots=comp.fetch('grapeTopSlots',[])
    image=comp.op(slots[0]['node']) if slots else None
    return getattr(image,dimension) if image else getattr(comp.par,dimension.title()).eval()
'''

_server=None
_queue=queue.Queue(maxsize=16)
_owner=None
_token=None
_port=None
_last_tick=0
_worker=None
_assets={}
_remote_port=None
_lan_enabled=False
_require_token=False
_network_refresh=0.0
_shader=None
_shaders={}
_personal_cache=None
_family_pending=False
_family_next=0
_family_attempts=0
_family_force=False

def request_family_registration(force=True):
    global _family_pending,_family_next,_family_attempts,_family_force
    _family_pending=True;_family_next=0;_family_attempts=0;_family_force=force

def service_family_startup():
    global _family_pending,_family_next,_family_attempts
    if not _family_pending or time.monotonic()<_family_next:return
    _family_next=time.monotonic()+1;_family_attempts+=1
    family=_owner.op('tdfam')
    def status(message):
        par=getattr(_owner.par,'Tdfamstatus',None)
        if par is not None:par.val=message
    try:
        if not family or (not _family_force and not family.par.Installonstart.eval()):
            _family_pending=False;status('Not set to register on startup');return
        # Access starts TD's lazy extension; registry creation finishes at endFrame.
        extension=family.ext.OpFamExt;registry=extension.fam_registry
        if registry is None:
            if _family_attempts in (3,6):family.initializeExtensions()
            status('Waiting for TDFam initialization')
        else:
            family_name=family.par.Family.eval()
            owner=registry.GetFamilyOwner(family_name)
            if owner and owner!=family:
                _family_pending=False;status(family_name+' is registered by another component');return
            if owner==family:
                if not registry.IsFamilyInstalled(family_name):family.Install(True)
                if registry.IsFamilyInstalled(family_name):
                    # TDFam initially paints its source COMPs with the family color.
                    # Restore each Grape template's per-operator manifest color.
                    folder=_owner.op('masters')
                    if folder:
                        for master in folder.children:
                            if master.fetch('sgrapeGenerated',False):apply_op_color(master)
                    menu_colors=_owner.op('menu_colors')
                    installed=True
                    if menu_colors:
                        installed=False
                        try:
                            installed=menu_colors.module.install(_owner,OP_COLORS)
                            _owner.store('sgrapeMenuColors',bool(installed));_owner.store('sgrapeMenuColorWarning','' if installed else 'Unrecognized TDFam layout; using original colors')
                        except Exception as exc:
                            _owner.store('sgrapeMenuColors',False);_owner.store('sgrapeMenuColorWarning',str(exc))
                    status('Ready')
                    # Registration may precede the menu's lazy layout initialization.
                    # Retry only during this bounded startup sequence; unknown layouts
                    # retain TDFam styling and never disable Shader creation.
                    if not installed and _family_attempts<10:return
                    _family_pending=False;return
            status('Waiting for TDFam registration')
    except Exception as exc:status('TDFam: '+str(exc))
    if _family_attempts>=10:
        _family_pending=False;status('TDFam unavailable; use Register TDFam to retry')

def default_personal_folder():
    from pathlib import Path
    # Prefer the current folder, retaining a fallback for unmigrated libraries.
    current=Path(app.userPaletteFolder)/'TD-Grape'/'Functions'
    legacy=Path(app.userPaletteFolder)/'TD-Sgrape'/'Functions'
    return legacy if legacy.is_dir() and not current.is_dir() else current

def personal_folder():
    from pathlib import Path
    par=getattr(_owner.par,'Personalfolder',None)
    raw=str(par.eval()) if par is not None else str(default_personal_folder())
    if not raw.strip():raise RuntimeError('Choose Personal Folder on the TD-Grape main component')
    return Path(tdu.expandPath(raw)).resolve()

def personal_library(refresh=False):
    global _personal_cache
    try:folder=personal_folder()
    except Exception as exc:return {'items':[],'issues':[{'file':'','error':str(exc)}],'folder':''}
    if refresh or _personal_cache is None or _personal_cache['folder']!=str(folder):
        try:_personal_cache=_owner.op('personal_library').module.read(core(),folder)
        except Exception as exc:_personal_cache={'items':[],'issues':[{'file':'','error':str(exc)}],'folder':str(folder)}
    return copy.deepcopy(_personal_cache)

def save_personal(body):
    ensure_supported_shader(target())
    checked_state()
    result=_owner.op('personal_library').module.save(core(),personal_folder(),body['graph'],body['functionId'])
    return {**result,'library':personal_library(refresh=True)}

def core(): return _owner.op('core').module

def source_module():
    dat = _owner.op('sources')
    return dat.module if dat else None

def history_module():
    dat = _owner.op('history')
    return dat.module if dat else None


def history_result(result):
    module = history_module()
    return module.attach(_owner.op('runtime').module, result) if module else result


@contextmanager
def history_native_writes():
    capture = bool(ui.undo.globalState)
    if capture: ui.undo.startBlock('Grape editor Undo/Redo', enable=False)
    try: yield
    finally:
        if capture: ui.undo.endBlock()


def history_operation(operation, source_edit=None):
    module = history_module()
    if module is None: return operation()
    runtime = _owner.op('runtime').module
    if source_module(): source_module().sync(runtime)
    before = module.capture(runtime)['token']
    result = operation()
    if source_edit is not None: module.note_edit(runtime, source_edit, before)
    result = module.attach(runtime, result)
    result['history']['beforeToken'] = before
    return result


def saved_state_source():
    dat=(_shader or _owner).op('state')
    return dat.text if dat else None

def inspect_saved_state():
    raw=saved_state_source()
    checked=_owner.op('document').module.inspect_saved_state(raw,core(),shader_kind(target()) if target() else _owner.fetch('sgrapeTarget','mat'))
    return raw,checked

def checked_state():
    _,checked=inspect_saved_state()
    if checked['status']!='valid':
        raise RuntimeError('Saved Shader state is damaged or unsupported. Reload to review it; the original data and output were preserved.')
    return checked['state']

def state():
    return json.loads(saved_state_source())

def write_state(data):
    (_shader or _owner).op('state').text=json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False)

def target():
    if _shader is not None: return _shader
    name=_owner.fetch('targetName','sgrape_material')
    item=_owner.parent().op(name)
    if item and not item.fetch('sgrapeGenerated',False): raise RuntimeError('The output name is already used by another component')
    return item

@contextmanager
def shader_context(shader):
    global _shader
    previous=_shader
    _shader=shader
    try: yield
    finally: _shader=previous

def shaders():
    if not _owner.fetch('sgrapeManager',False): return []
    owner_id=_owner.fetch('sgrapeManagerId')
    found=op('/').findChildren(tags=['sgrapeShader'])
    for shader in found:
        if shader.fetch('sgrapeManagerId',None)==owner_id and not shader.fetch('sgrapeMaster',False):
            register_shader(shader)
    return sorted([s for s in _shaders.values() if s and s.valid],key=lambda s:s.path)

def shader_kind(shader):
    return shader.fetch('sgrapeTarget','mat')

def shader_choices():
    """Discover existing identities without registering or changing operators."""
    manager=_owner.fetch('sgrapeManager',False)
    candidates=op('/').findChildren(tags=['sgrapeShader']) if manager else [target()]
    owner_id=_owner.fetch('sgrapeManagerId',None)
    rows=[];seen=set()
    for shader in sorted((s for s in candidates if s and s.valid),key=lambda s:s.path):
        if shader.fetch('sgrapeMaster',False) or not shader.fetch('sgrapeGenerated',False):continue
        if manager and shader.fetch('sgrapeManagerId',None)!=owner_id:continue
        identity=shader.fetch('sgrapeShaderId','')
        if not isinstance(identity,str) or not re.fullmatch('[a-f0-9]{32}',identity) or identity in seen:continue
        registered=_shaders.get(identity)
        if registered and registered.valid and registered!=shader:continue
        if shader_kind(shader) not in ('mat','top'):continue
        reason=''
        try:ensure_supported_shader(shader)
        except RuntimeError as exc:reason=str(exc)
        except (ValueError,AttributeError):reason='Shader metadata could not be read; repair the component before editing.'
        rows.append({'id':identity,'path':shader.path,'kind':shader_kind(shader),'readOnlyReason':reason});seen.add(identity)
    return {'projectFile':str(project.name),'shaders':rows,'current':target().fetch('sgrapeShaderId','') if target() else ''}


def shader_operator(shader):
    return shader.op('shader' if shader_kind(shader)=='top' else 'material')

def apply_op_color(shader):
    color=OP_COLORS[shader_kind(shader)]
    shader.color=color
    info=shader.op('FamManifest/OpInfo')
    if info and info.text:
        try:data=json.loads(info.text)
        except (TypeError,ValueError):return
        if isinstance(data,dict) and data.get('op_color')!=list(color):
            data['op_color']=list(color)
            info.text=json.dumps(data)

def arrange_manager_parameters(owner):
    """Group product controls without replacing parameters or their values."""
    if not owner.fetch('sgrapeManager',False):return
    layouts=[('TD-Grape',[
        [('Createtop','Create Grape TOP'),('Createmat','Create Grape MAT')],
        [('Openeditor','Open Editor'),('Openinbrowser','Open in Browser')],
        [('Updateshaders','Update Shaders'),('Updatestatus','Last Update')],
        [('Version','Version')],
    ]),('Settings',[
        [('Allowlan','Allow LAN Connections'),('Requiretoken','Require Connection Token'),
         ('Lanurls','LAN URLs'),('Lanstatus','Connection Status')],
        [('Personalfolder','Personal Folder'),('Openpersonalfolder','Open Personal Folder')],
        [('Registertdfam','Register TDFam'),('Tdfamstatus','TDFam Status')],
    ])]
    legacy=next((p for p in owner.customPages if p.name=='TD-Sgrape'),None)
    if legacy and not any(p.name=='TD-Grape' for p in owner.customPages):legacy.name='TD-Grape'
    for page_name,groups in layouts:
        page=next((p for p in owner.customPages if p.name==page_name),None) or owner.appendCustomPage(page_name)
        order=0
        for group_index,group in enumerate(groups):
            for item_index,(name,label) in enumerate(group):
                parameter=getattr(owner.par,name,None)
                if parameter is None:continue
                if parameter.page!=page:parameter.page=page
                if parameter.order!=order:parameter.order=order
                if parameter.label!=label:parameter.label=label
                section=group_index>0 and item_index==0
                if parameter.startSection!=section:parameter.startSection=section
                order+=1
    pages=[p.name for p in owner.customPages]
    ordered=[name for name,groups in layouts]+[name for name in pages if name not in ('TD-Grape','Settings')]
    if pages!=ordered:owner.sortCustomPages(*ordered)


def arrange_shader_parameters(shader):
    page_name='Grape '+shader_kind(shader).upper()
    page=next((p for p in shader.customPages if p.name==page_name),None)
    if page is None:return
    names=['Openeditor','Openinbrowser','Glslparameters','Version',
           'Outputtop' if shader_kind(shader)=='top' else 'Material']
    for index,name in enumerate(names):
        p=getattr(shader.par,name,None)
        if p is not None:
            if p.page.name!=page_name:p.page=page
            if p.order!=index:p.order=index
            section=name in ('Glslparameters','Version')
            if p.startSection!=section:p.startSection=section
    # Existing custom pages (including adopted legacy controls) keep their order.
    pages=[p.name for p in shader.customPages]
    tail=[name for name in ('Output',page_name) if name in pages]
    ordered=[name for name in pages if name not in tail]+tail
    if ordered!=pages:shader.sortCustomPages(*ordered)


def register_shader(shader,fresh=False):
    if not shader.fetch('sgrapeGenerated',False): raise RuntimeError('Not a generated Grape Shader')
    supported=True
    try:ensure_supported_shader(shader)
    except RuntimeError:supported=False
    identity=shader.fetch('sgrapeShaderId',None)
    other=_shaders.get(identity)
    if fresh or not identity or (other and other.valid and other!=shader): identity=uuid.uuid4().hex
    shader.store('sgrapeShaderId',identity)
    shader.store('sgrapeManagerId',_owner.fetch('sgrapeManagerId'))
    # Opening a product template in its editor must not turn it into a user
    # Shader. Copies outside masters still register as ordinary new Shaders.
    is_master=not fresh and shader.parent()==_owner.op('masters') and shader==master_template(shader_kind(shader))
    shader.store('sgrapeMaster',is_master)
    if is_master:shader.tags.discard('sgrapeShader')
    else:shader.tags.add('sgrapeShader')
    for key,value in list(_shaders.items()):
        if not value or not value.valid or (value==shader and key!=identity): del _shaders[key]
    _shaders[identity]=shader
    if not supported:return identity
    state_dat=shader.op('state')
    # Only brand-new generated Shaders may initialize their state automatically.
    # An empty or missing DAT on an existing Shader is evidence, not a default.
    if fresh and (not state_dat or not state_dat.text):
        state_dat=state_dat or shader.create(textDAT,'state')
        graph=json.loads(shader.op('graph').text)
        state_dat.text=json.dumps({'revision':1,'graph':graph,'appliedHash':core().compile_graph(graph)['hash'],'lastError':''})
    page_name='Grape '+shader_kind(shader).upper()
    legacy_name='Sgrape '+shader_kind(shader).upper()
    for legacy in shader.customPages:
        if legacy.name==legacy_name and not any(p.name==page_name for p in shader.customPages):legacy.name=page_name
    if getattr(shader.par,'Openeditor',None) is None:
        page=next((p for p in shader.customPages if p.name==page_name),None) or shader.appendCustomPage(page_name)
        page.appendPulse('Openeditor',label='Open Editor')
        page.appendStr('Version',label='Version')
    if getattr(shader.par,'Openinbrowser',None) is None:
        shader.par.Openeditor.page.appendPulse('Openinbrowser',label='Open in Browser')
        shader.par.Openinbrowser.order=shader.par.Openeditor.order+1
    if getattr(shader.par,'Glslparameters',None) is None:
        shader.par.Openeditor.page.appendPulse('Glslparameters',label='GLSL Parameters')
    if shader_kind(shader)=='top':
        if getattr(shader.par,'Outputtop',None) is None:
            page=next(p for p in shader.customPages if p.name==page_name)
            page.appendTOP('Outputtop',label='Generated TOP')
            shader.par.Outputtop.expr="me.op('out1')";shader.par.Outputtop.readOnly=True
    elif getattr(shader.par,'Material',None) is None:
        page=next(p for p in shader.customPages if p.name==page_name)
        page.appendMAT('Material',label='Generated MAT')
        shader.par.Material.expr="me.op('material')";shader.par.Material.readOnly=True
    if getattr(shader.par,'opviewer',None) is not None:
        shader.par.opviewer.expr="me.op('material')" if shader_kind(shader)=='mat' else "me.op('preview')"
        shader.viewer=True
    shader.par.Version=json.loads(shader.op('manifest').text).get('compilerBuild',PRODUCT_VERSION); shader.par.Version.readOnly=True
    arrange_shader_parameters(shader)
    shader.showCustomOnly=True
    if fresh: shader.currentPage=page_name
    controls=shader.op('controls') or shader.create(parameterexecuteDAT,'controls')
    controls.par.op='..'; controls.par.pars='Openeditor Openinbrowser Glslparameters'; controls.par.onpulse=True
    if controls.text!=_owner.op('shader_controls').text:controls.text=_owner.op('shader_controls').text
    links=shader.op('parameter_links');source=_owner.op('parameter_links')
    if links and source and links.fetch('grapeControlHelper',False) and links.text!=source.text:
        links.text=source.text;links.module.prime(shader)
    apply_op_color(shader)
    return identity

def create_shader(parent_comp,name='Grape_MAT1',graph=None,kind='mat'):
    if parent_comp.op(name):
        stem=name.rstrip('0123456789'); index=1
        while parent_comp.op(stem+str(index)): index+=1
        name=stem+str(index)
    fresh=graph is None
    graph=copy.deepcopy(graph or core().demo_graph(target=kind))
    if fresh and kind=='top':graph=core().normalize_top_sources(graph)[0]
    review=_owner.op('document').module.inspect_upgrade(graph, core(), kind, require_baseline=False)
    if review['required'] or review['blocked']:
        raise RuntimeError('This graph needs a version review. Create a current Shader and import the graph in its editor.')
    graph=review['candidate']
    compiled=core().compile_graph(graph)
    shader=make_scene(parent_comp,name,core().graph_target(graph))
    try:
        configure(shader,compiled,graph)
        validate_material(shader)
        cleanup_top_sources(shader,graph)
        register_shader(shader,fresh=True)
        return shader
    except Exception:
        shader.destroy()
        raise

def resolve_shader(identity):
    shader=_shaders.get(identity)
    if shader and shader.valid: return shader
    shaders()
    shader=_shaders.get(identity)
    if not shader or not shader.valid: raise RuntimeError('Shader no longer exists. Open Editor from the intended Shader.')
    return shader

def master_template(kind):
    """Resolve current templates while accepting names from older projects."""
    if kind not in ('top','mat'):raise ValueError('Unknown Grape template: '+str(kind))
    return _owner.op('masters/grape_'+kind) or _owner.op('masters/sgrape_'+kind)

def prepare_masters():
    """Refresh product entry points without replacing any user Shader."""
    page=next((p for p in _owner.customPages if p.name in ('TD-Grape','TD-Sgrape')),None) or _owner.appendCustomPage('TD-Grape')
    page.name='TD-Grape'
    if getattr(_owner.par,'Createmat',None) is not None:_owner.par.Createmat.label='Create Grape MAT'
    if getattr(_owner.par,'Createtop',None) is None:page.appendPulse('Createtop',label='Create Grape TOP')
    _owner.par.Createtop.label='Create Grape TOP'
    if getattr(_owner.par,'Updateshaders',None) is None:page.appendPulse('Updateshaders',label='Update Shaders')
    if getattr(_owner.par,'Updatestatus',None) is None:
        page.appendStr('Updatestatus',label='Last Update');_owner.par.Updatestatus.readOnly=True
    if getattr(_owner.par,'Personalfolder',None) is None:
        page.appendFolder('Personalfolder',label='Personal Folder')
        _owner.par.Personalfolder.expr="str(me.op('runtime').module.default_personal_folder())"
    if getattr(_owner.par,'Openpersonalfolder',None) is None:page.appendPulse('Openpersonalfolder',label='Open Personal Folder')
    if getattr(_owner.par,'Tdfamstatus',None) is None:
        page.appendStr('Tdfamstatus',label='TDFam Status');_owner.par.Tdfamstatus.readOnly=True
    if getattr(_owner.par,'Openinbrowser',None) is None:
        page.appendPulse('Openinbrowser',label='Open in Browser')
        _owner.par.Openinbrowser.order=_owner.par.Openeditor.order+1
    _owner.op('controls').par.pars='Createmat Createtop Updateshaders Registertdfam Openeditor Openinbrowser Openpersonalfolder'
    _owner.color=OP_COLORS['family']
    family=_owner.op('tdfam')
    if family:
        for name,value in zip(('Colorr','Colorg','Colorb'),OP_COLORS['family']):
            parameter=getattr(family.par,name)
            if abs(parameter.eval()-value)>1e-6:parameter.val=value
    folder=_owner.op('masters') or _owner.create(baseCOMP,'masters')
    for kind in ('mat','top'):
        master=master_template(kind) or create_shader(folder,'grape_'+kind,kind=kind)
        try:
            register_shader(master)
            updated=update_shader(master)
        finally:
            master.store('sgrapeMaster',True);master.tags.discard('sgrapeShader')
            _shaders.pop(master.fetch('sgrapeShaderId'),None)
        if updated.get('reviewRequired'):
            raise RuntimeError('Grape '+kind.upper()+' template needs a graph upgrade review; its default graph was not updated.')
        manifest=master.op('FamManifest') or master.create(baseCOMP,'FamManifest')
        values={
            'OpInfo':{'op_type':'sgrape_'+kind,'op_name':'Grape_'+kind.upper()+'1','op_label':'Grape '+kind.upper(),'op_version':PRODUCT_VERSION,'op_group':'Shaders','summary':'Visual GLSL '+kind.upper()+' editor. Open Editor edits this Shader.','op_color':list(OP_COLORS[kind]),'isFilter':kind=='top','compatible_types':['TOP'] if kind=='top' else [],'search_words':['shader','glsl','grape','sgrape',kind]},
            'ParRetain':{'.':['<Uniforms>','<Output>','<Textures>','<Inactive Textures>']},
            'StateRetain':{'.':{'storage':['sgrapeShaderId','sgrapeManagerId','sgrapeTarget'],'dats':['state','graph','manifest']}},
            'Shortcuts':{},
        }
        for name,data in values.items():
            dat=manifest.op(name) or manifest.create(textDAT,name)
            if name=='OpInfo' or not dat.text:dat.text=json.dumps(data)
        master.currentPage='Grape '+kind.upper();master.showCustomOnly=True
    _owner.par.Version=PRODUCT_VERSION
    arrange_manager_parameters(_owner)
    return folder

def make_scene(parent,name,kind='mat'):
    comp=parent.create(baseCOMP,name)
    comp.store('sgrapeGenerated',True)
    comp.store('sgrapeTarget',kind)
    if kind=='top': return make_top_scene(comp)
    comp.nodeX=parent.nodeX+250 if hasattr(parent,'nodeX') else 300
    mat=comp.create(glslMAT,'material'); mat.par.glslversion='glsl450'
    mat.par.vdat.eval().name='vertex_shader'; mat.par.pdat.eval().name='pixel_shader'
    mat.par.vdat='vertex_shader'; mat.par.pdat='pixel_shader'
    mat.par.compilebehavior='stalluntildone'
    # Reuse the Info DAT created by GLSL MAT instead of retaining a duplicate.
    info=comp.op('material_info') or comp.create(infoDAT,'compile_info')
    info.name='compile_info';info.par.op='material'
    comp.create(textDAT,'graph'); comp.create(textDAT,'manifest')
    for i,o in enumerate(comp.children): o.nodeX=(i%4)*190; o.nodeY=-(i//4)*150
    return comp

def make_top_scene(comp):
    page=comp.appendCustomPage('Output')
    menu=page.appendMenu('Resolution',label='Resolution')[0]
    menu.menuNames=['input','custom'];menu.menuLabels=['Match Input','Custom']
    comp.par.Resolution.default='input';comp.par.Resolution='input'
    for name in ('Width','Height'):
        p=page.appendInt(name,label=name)[0];p.default=512;p.val=512;p.min=1;p.clampMin=True;p.max=8192;p.clampMax=True
        p.enableExpr="me.par.Resolution == 'custom' or not me.inputs"
    menu=page.appendMenu('Pixelformat',label='Pixel Format')[0]
    menu.menuNames=['rgba8fixed','rgba16float','rgba32float'];menu.menuLabels=['RGBA 8-bit','RGBA 16-bit float','RGBA 32-bit float']
    comp.par.Pixelformat.default='rgba16float';comp.par.Pixelformat='rgba16float'
    menu=page.appendMenu('Extenduv',label='Input Extend UV')[0]
    menu.menuNames=['hold','zero','repeat','mirror'];menu.menuLabels=['Hold','Zero','Repeat','Mirror']
    comp.par.Extenduv.default='hold';comp.par.Extenduv='hold'
    incoming=comp.create(inTOP,'in1')
    incoming.par.format='useinput'
    fallback=comp.create(moviefileinTOP,'input_fallback')
    fallback.par.file.expr="app.samplesFolder + '/Map/Banana.tif'"
    incoming.inputConnectors[0].connect(fallback)
    router=comp.create(nullTOP,'input_router');router.par.format='useinput'
    router.inputConnectors[0].connect(incoming)
    shader=comp.create(glslTOP,'shader');shader.par.glslversion='glsl450';shader.par.compilebehavior='stalluntildone'
    pixel=comp.create(textDAT,'pixel_shader');shader.par.pixeldat='pixel_shader'
    # Native creation provides example DATs; this shell supplies its own pixel
    # program and does not expose Compute mode. Remove only these fresh defaults.
    shader.par.computedat=''
    for name in ('shader_pixel','shader_compute','shader_info'):
        if comp.op(name):comp.op(name).destroy()
    output=comp.create(outTOP,'out1');output.inputConnectors[0].connect(shader)
    output.par.format='useinput'
    preview=comp.create(resolutionTOP,'preview');preview.inputConnectors[0].connect(shader)
    preview.par.format='useinput'
    preview.par.outputresolution='limit';preview.par.resolutionw=512;preview.par.resolutionh=512
    info=comp.create(infoDAT,'compile_info');info.par.op='shader'
    comp.create(textDAT,'graph');comp.create(textDAT,'manifest')
    for i,o in enumerate(comp.children):o.nodeX=(i%4)*190;o.nodeY=-(i//4)*150
    return comp


def texture_key(decl):
    return 'slot:'+decl['topInputId'] if decl.get('topInputId') else 'input:0' if decl['source']=='input:0' else decl['id']

def texture_specs(graph):
    if graph.get('topSourceVersion')==1:
        return {'slot:'+slot['id']:{'default':slot['defaultSource'],'expose':slot.get('expose',False),
            'label':slot.get('exposeName') or 'Input '+str(index+1)+' Default TOP','matchDefault':True,
            'fallback':'opaque-black'} for index,slot in enumerate(core().top_input_slots(graph))}
    specs={}
    for decl in graph['declarations']:
        if decl['kind']!='sampler':continue
        key=texture_key(decl)
        specs[key]={'default':decl.get('defaultSource','builtin:banana') if key=='input:0' or decl.get('topInputId') else decl['source'],
            'fallback':decl.get('fallback'), 'expose':decl.get('expose',False), 'label':decl.get('exposeName') or ('Input 1 Default TOP' if key=='input:0' else decl['name']),
            'matchDefault':specs.get(key,{}).get('matchDefault',False) or (key=='input:0' and 'defaultSource' in decl)}
    # Preserve the exposed legacy Input 0 parameter while adopting explicit slots.
    for index,slot in enumerate(core().top_input_slots(graph)):
        key='slot:'+slot['id']
        if slot['id']==graph.get('topInputLegacyId',graph['topInputs'][0]['id']) and 'input:0' in specs:
            specs[key].update({k:specs['input:0'][k] for k in ('expose','label')})
        specs[key]['matchDefault']=slot.get('matchDefault',True)
    return specs

def top_external_connections(comp):
    slots=comp.fetch('grapeTopSlots',[])
    ids=[slot['id'] for slot in slots] or ['input0']
    return {ident:(comp.inputConnectors[index].connections[0].owner if index<len(comp.inputConnectors) and comp.inputConnectors[index].connections else None) for index,ident in enumerate(ids)}

def prepare_top_slots(comp,graph,input_owner=None):
    if graph.get('topSourceVersion')==1:return prepare_managed_top_slots(comp,graph,input_owner)
    slots=core().top_input_slots(graph)
    old=comp.fetch('grapeTopSlots',[])
    if not slots and not old:return
    owner=input_owner or comp
    external=top_external_connections(owner)
    if not owner.fetch('grapeTopSlots',[]) and slots:
        external={slots[0]['id']:external.get('input0')}
    desired={slot['id'] for slot in slots} if slots else {'input0'}
    if any(source and ident not in desired for ident,source in external.items()):
        raise RuntimeError('Disconnect the COMP input before removing its TOP Input slot.')
    if not slots:
        slots=[{'id':'input0','name':'Input 0','defaultSource':'builtin:banana'}]
    old_nodes={slot['id']:slot['node'] for slot in old}
    records=[]
    # Create all destinations before changing connector order. Internal object
    # identities persist through rename/reorder; external wires follow slot IDs.
    for index,slot in enumerate(slots):
        name=old_nodes.get(slot['id']) or ('in1' if not old and index==0 else 'in_'+hashlib.sha256(slot['id'].encode()).hexdigest()[:12])
        incoming=comp.op(name) or comp.create(inTOP,name)
        records.append(dict(slot,node=incoming.name))
    for connector in comp.inputConnectors:connector.disconnect()
    for record in old:
        if record['node'] not in {r['node'] for r in records}:
            comp.op(record['node']).destroy()
    if not old and records[0]['node']!='in1' and comp.op('in1'):comp.op('in1').destroy()
    comp.store('grapeTopLegacyId',graph.get('topInputLegacyId',records[0]['id']))
    comp.store('grapeTopSlots',records if graph.get('topInputs') else [])
    comp.store('grapeTopExternal', {ident:source.path for ident,source in external.items() if source} if input_owner else {})
    for index,record in enumerate(records):
        incoming=comp.op(record['node']);incoming.par.connectorder=index;incoming.par.label=record['name'];incoming.par.format='useinput'
        key='slot:'+record['id'] if graph.get('topInputs') else 'input:0'
        default=comp.op('default_'+incoming.name) or comp.create(selectTOP,'default_'+incoming.name)
        default.par.format='useinput'
        source=external.get(record['id'])
        default.par.top=source.path if input_owner and source else ''
        if not (input_owner and source):default.par.top.expr="mod('texture_sources').resolve("+repr(key)+")"
        incoming.inputConnectors[0].connect(default)
    if not input_owner:
        for index,record in enumerate(records):
            source=external.get(record['id'])
            if source:comp.inputConnectors[index].connect(source)
    comp.op('input_router').inputConnectors[0].connect(comp.op(records[0]['node']))


def prepare_managed_top_slots(comp,graph,input_owner=None):
    """One row per source: default image -> In TOP -> shader TOPs list.

    Public/default-path overrides add a Select only when they need indirection.
    Graph references never reach this builder with their own resource entries.
    """
    slots=core().top_input_slots(graph);owner=input_owner or comp
    old=comp.fetch('grapeTopSlots',[]);external=top_external_connections(owner)
    if not owner.fetch('grapeTopSlots',[]) and slots:
        external={slots[0]['id']:external.get('input0')}
    desired={slot['id'] for slot in slots}
    if any(source and ident not in desired for ident,source in external.items()):
        raise RuntimeError('Disconnect the COMP input before removing its TOP Input source.')
    old_nodes={record['id']:comp.op(record['node']) for record in old}
    if not old and slots and comp.op('in1'):old_nodes[slots[0]['id']]=comp.op('in1')
    for connector in comp.inputConnectors:connector.disconnect()
    # Temporary names make swapping source order safe without replacing In OPs.
    for ident,incoming in old_nodes.items():
        if incoming:incoming.name='grape_input_'+hashlib.sha256(ident.encode()).hexdigest()[:12]
    records=[]
    for index,slot in enumerate(slots):
        incoming=old_nodes.get(slot['id']) or comp.create(inTOP,'grape_new_input')
        incoming.name='in'+str(index+1)
        incoming.par.connectorder=index;incoming.par.label='sTD2DInputs['+str(index)+']';incoming.par.format='useinput'
        if comp.fetch('grapeTopArrangeSources',False):
            incoming.nodeX=-360;incoming.nodeY=-(index*220);incoming.nodeWidth=150;incoming.nodeHeight=100
        incoming.comment='Input '+str(index+1)+' / sTD2DInputs['+str(index)+'] — external wire overrides the default image.'
        key='slot:'+slot['id'];spec=comp.fetch('sgrapeTextureSources',{})[key]
        source=external.get(slot['id']);default=comp.op(spec['asset'])
        if spec.get('parameter') or spec['default'].startswith('op:') or (input_owner and source):
            name='input_'+str(index+1)+'_source'
            selected=comp.op(name)
            if selected and not selected.fetch('grapeManagedTopSource',False):raise RuntimeError('An unrelated operator occupies '+selected.path)
            selected=selected or comp.create(selectTOP,name)
            selected.store('grapeManagedTopSource',True);selected.par.format='useinput'
            selected.par.top=source.path if input_owner and source else ''
            if not (input_owner and source):selected.par.top.expr="mod('texture_sources').resolve("+repr(key)+")"
            if comp.fetch('grapeTopArrangeSources',False) or not selected.fetch('grapeSourcePlaced',False):
                selected.nodeX=-590;selected.nodeY=-(index*220);selected.nodeWidth=150;selected.nodeHeight=100;selected.store('grapeSourcePlaced',True)
            default=selected
        incoming.inputConnectors[0].connect(default)
        records.append(dict(slot,node=incoming.name))
    for ident,incoming in old_nodes.items():
        if ident not in desired and incoming:incoming.destroy()
    if not slots and comp.op('in1'):comp.op('in1').destroy()
    comp.store('grapeTopSlots',records);comp.store('grapeTopSourceVersion',1)
    comp.store('grapeTopExternal',{ident:source.path for ident,source in external.items() if source} if input_owner else {})
    if not input_owner:
        for index,record in enumerate(records):
            source=external.get(record['id'])
            if source:comp.inputConnectors[index].connect(source)


def managed_top_asset(comp,index,source):
    name='input_'+str(index+1)+'_default'
    kind=constantTOP if source in ('builtin:white','builtin:black') or source.startswith('op:') else moviefileinTOP
    asset=comp.op(name)
    if asset and not asset.fetch('grapeManagedTopSource',False):raise RuntimeError('An unrelated operator occupies '+asset.path)
    if asset and asset.type!=('constant' if kind==constantTOP else 'moviefilein'):asset.destroy();asset=None
    asset=asset or comp.create(kind,name);asset.store('grapeManagedTopSource',True)
    if kind==constantTOP:
        value=1 if source=='builtin:white' else 0
        asset.par.colorr=value;asset.par.colorg=value;asset.par.colorb=value;asset.par.alpha=1
        asset.par.resolutionw=2;asset.par.resolutionh=2
    else:
        file='Jellybeans.1.jpg' if source=='builtin:jellybeans' else 'Banana.tif'
        asset.par.file.expr="app.samplesFolder + '/Map/"+file+"'"
    if comp.fetch('grapeTopArrangeSources',False) or not asset.fetch('grapeSourcePlaced',False):
        asset.nodeX=-820;asset.nodeY=-(index*220);asset.nodeWidth=150;asset.nodeHeight=100;asset.store('grapeSourcePlaced',True)
    asset.comment='Default image for Input '+str(index+1)+'. Used when the COMP input is disconnected.'
    return asset


def cleanup_top_sources(comp,graph):
    """After successful deployment only, retire known generated source plumbing."""
    if graph.get('topSourceVersion')!=1:return
    keep={s['node'] for s in comp.fetch('grapeTopSlots',[])}
    keep.update(spec['asset'] for spec in comp.fetch('sgrapeTextureSources',{}).values())
    keep.update(spec['blackAsset'] for spec in comp.fetch('sgrapeTextureSources',{}).values() if spec.get('blackAsset'))
    keep.update(c.owner.name for slot in comp.fetch('grapeTopSlots',[]) for c in comp.op(slot['node']).inputConnectors[0].connections)
    legacy=set(comp.fetch('grapeRetiredTopNodes',[]))
    obsolete=[n for n in comp.children if n.name not in keep and (n.id in legacy or n.fetch('grapeManagedTopSource',False))]
    for n in obsolete:
        if n.valid:n.destroy()
    comp.store('grapeRetiredTopNodes',[])
    if not comp.fetch('grapeTopLayoutV1',False):
        for name,(x,y) in {'shader':(0,0),'pixel_shader':(0,260),'out1':(280,0),'preview':(280,-220),'compile_info':(0,-220),'graph':(520,260),'manifest':(760,260),'state':(1000,260),'texture_sources':(-360,260),'controls':(520,-220),'parameter_links':(760,-220),'upgrade_backup':(1000,-220),'parameter_lifecycle':(520,-440),'FamManifest':(1000,-440)}.items():
            n=comp.op(name)
            if n:n.nodeX=x;n.nodeY=y
        comp.store('grapeTopLayoutV1',True)

def top_input_snapshot(comp):
    helper=comp.op('texture_sources')
    rows=[]
    for index,record in enumerate(comp.fetch('grapeTopSlots',[])):
        row=helper.module.effective('slot:'+record['id'])
        image=comp.op(record['node'])
        rows.append({'id':record['id'],'index':index,'connected':row['status']=='connected','status':row['status'],'path':row['path'],'width':image.width,'height':image.height})
    return rows

def texture_asset(comp,key,source):
    name='texture_default_'+hashlib.sha256(key.encode()).hexdigest()[:16]
    asset=comp.op(name)
    # Use a Select TOP as the stable public endpoint; assets of differing OP
    # types can coexist upstream when changing from image to constant.
    if not asset:asset=comp.create(selectTOP,name)
    asset.par.format='useinput'
    if source in ('builtin:white','builtin:black'):
        internal=comp.op(name+'_constant') or comp.create(constantTOP,name+'_constant')
        value=1 if source=='builtin:white' else 0
        internal.par.colorr=value;internal.par.colorg=value;internal.par.colorb=value;internal.par.alpha=1
        internal.par.resolutionw=2;internal.par.resolutionh=2
    else:
        internal=comp.op(name+'_image') or comp.create(moviefileinTOP,name+'_image')
        file='Jellybeans.1.jpg' if source=='builtin:jellybeans' else 'Banana.tif'
        internal.par.file.expr="app.samplesFolder + '/Map/"+file+"'"
    asset.par.top=internal.name
    return asset

def prepare_textures(comp,graph,input_owner=None,compiled=None):
    managed=graph.get('topSourceVersion')==1
    if managed and comp.fetch('grapeTopSourceVersion',0)!=1:
        # Identify old generated objects from the previous resource registry,
        # not a broad name-prefix sweep over potentially user-authored OPs.
        names={'input_default','input_fallback','input_router','input_external'}
        for key,spec in comp.fetch('sgrapeTextureSources',{}).items():
            names.update(spec[k] for k in ('asset','blackAsset') if spec.get(k))
            for value in (key,'black:'+key):
                suffix=hashlib.sha256(value.encode()).hexdigest()[:16]
                names.update('texture_default_'+suffix+tail for tail in ('','_image','_constant'))
                names.add('texture_source_'+suffix)
        names.update('default_'+s['node'] for s in comp.fetch('grapeTopSlots',[]))
        names.add('default_in1')
        comp.store('grapeRetiredTopNodes',[comp.op(name).id for name in names if comp.op(name)])
    if managed:comp.store('grapeTopArrangeSources',comp.fetch('grapeTopSourceVersion',0)!=1 or [s['id'] for s in comp.fetch('grapeTopSlots',[])]!=[s['id'] for s in graph['topInputs']])
    if shader_kind(comp)=='top' and not managed:
        comp.store('grapeTopSourceVersion',0)
        if not comp.op('in1'):comp.create(inTOP,'in1')
        if not comp.op('input_router'):comp.create(nullTOP,'input_router')
    projected=dict(graph,declarations=graph['declarations']+[b for b in (compiled or {}).get('bindings',[]) if b.get('internal')])
    bindings=copy.deepcopy(comp.fetch('sgrapePublicTextures',{}));specs=texture_specs(projected)
    if managed:
        previous=(input_owner or comp).fetch('sgrapePublicTextures',{})
        for slot in graph['topInputs']:
            key='slot:'+slot['id']
            old=next((previous[k] for k in [key]+slot.get('legacyKeys',[]) if k in previous),None)
            if old and getattr(comp.par,old['parameter'],None) is not None:bindings.setdefault(key,copy.deepcopy(old))
    if graph.get('topInputs') and 'input:0' in bindings:
        bindings.setdefault('slot:'+graph.get('topInputLegacyId',graph['topInputs'][0]['id']),bindings['input:0'])
    for key,spec in specs.items():
        if not spec['expose']:continue
        legacy_key='slot:'+graph.get('topInputLegacyId',graph['topInputs'][0]['id']) if graph.get('topInputs') else None
        if key==legacy_key and 'input:0' in bindings:bindings.setdefault(key,bindings['input:0'])
        if key not in bindings:
            name='T'+hashlib.sha256(key.encode()).hexdigest()[:16]
            if getattr(comp.par,name,None) is not None:raise RuntimeError('Public texture parameter name collision')
            page=next((p for p in comp.customPages if p.name=='Textures'),None) or comp.appendCustomPage('Textures')
            p=page.appendTOP(name,label=spec['label'])[0]
            p.val=spec['default'][3:] if spec['default'].startswith('op:') else ''
            bindings[key]={'parameter':name}
        p=getattr(comp.par,bindings[key]['parameter'])
        page=next((p for p in comp.customPages if p.name=='Textures'),None) or comp.appendCustomPage('Textures')
        p.page=page;p.label=spec['label'];p.enable=True
        p.default=spec['default'][3:] if spec['default'].startswith('op:') else ''
        if input_owner:
            old=input_owner.fetch('sgrapePublicTextures',{}).get(key) or (input_owner.fetch('sgrapePublicTextures',{}).get('input:0') if key==legacy_key else None)
            if managed and not old:
                slot=next(s for s in graph['topInputs'] if key=='slot:'+s['id'])
                old=next((input_owner.fetch('sgrapePublicTextures',{})[k] for k in slot.get('legacyKeys',[]) if k in input_owner.fetch('sgrapePublicTextures',{})),None)
            previous=getattr(input_owner.par,old['parameter'],None) if old else None
            if previous is not None:
                value=previous.eval()
                if value:p.val=value.path
                elif previous.mode==ParMode.CONSTANT and not str(previous.val).strip():p.val=''
                else:p.val='/__sgrape_invalid_texture_reference__'
        spec['parameter']=p.name
    for key,binding in bindings.items():
        if key not in specs or not specs[key]['expose']:
            if any(spec.get('parameter')==binding['parameter'] for spec in specs.values()):continue
            p=getattr(comp.par,binding['parameter'],None)
            if p is not None:
                page=next((p for p in comp.customPages if p.name=='Inactive Textures'),None) or comp.appendCustomPage('Inactive Textures')
                p.page=page;p.enable=False
    # Only TOP components have the default COMP input. MAT uses its samplers.
    if shader_kind(comp)=='top' and not managed:
        specs.setdefault('input:0',{'default':'builtin:banana','expose':False,'matchDefault':False})
    for index,(key,spec) in enumerate(specs.items()):
        spec['asset']=(managed_top_asset(comp,index,spec['default']) if managed else texture_asset(comp,key,spec['default'])).name
        if spec.get('fallback')=='opaque-black':
            if managed:
                spec['blackAsset']=spec['asset']
                if spec.get('expose') and not spec['default'].startswith('op:') and spec['default']!='builtin:black':
                    name='input_'+str(index+1)+'_missing'
                    black=comp.op(name) or comp.create(constantTOP,name);black.store('grapeManagedTopSource',True)
                    black.par.colorr=0;black.par.colorg=0;black.par.colorb=0;black.par.alpha=1
                    black.par.resolutionw=2;black.par.resolutionh=2;black.nodeX=-1060;black.nodeY=-index*220
                    black.comment='Opaque black fallback for a missing exposed TOP path.'
                    spec['blackAsset']=black.name
            else:spec['blackAsset']=texture_asset(comp,'black:'+key,'builtin:black').name
    comp.store('sgrapePublicTextures',bindings);comp.store('sgrapeTextureSources',specs)
    external=input_owner.inputs[0] if input_owner and shader_kind(comp)=='top' and input_owner.inputs else None
    comp.store('sgrapeTextureExternal',external.path if external else '')
    helper=comp.op('texture_sources') or comp.create(textDAT,'texture_sources')
    if helper.text!=TEXTURE_SOURCE_CODE:helper.text=TEXTURE_SOURCE_CODE
    if shader_kind(comp)=='top' and (managed or graph.get('topInputs') or comp.fetch('grapeTopSlots',[])):
        prepare_top_slots(comp,graph,input_owner)
    elif shader_kind(comp)=='top':
        default=comp.op('input_default') or comp.create(selectTOP,'input_default')
        default.par.format='useinput';default.par.top.expr="mod('texture_sources').resolve('input:0')"
        incoming=comp.op('in1')
        if external:
            selected=comp.op('input_external') or comp.create(selectTOP,'input_external')
            selected.par.format='useinput';selected.par.top=external.path
            incoming.inputConnectors[0].connect(selected)
        else:incoming.inputConnectors[0].connect(default)
        router=comp.op('input_router')
        # Keep existing 0.6.1 Switch OP objects alive during migration, as a
        # one-input passthrough. New components use a Null TOP.
        for connector in router.inputConnectors:connector.disconnect()
        router.inputConnectors[0].connect(incoming)
        if getattr(router.par,'index',None) is not None:router.par.index=0
    active=[key for key,spec in specs.items() if spec.get('expose')]
    status_par=getattr(comp.par,'Texturestatus',None)
    if status_par is None and active:
        page=next((p for p in comp.customPages if p.name=='Textures'),None) or comp.appendCustomPage('Textures')
        status_par=page.appendStr('Texturestatus',label='Texture Status')[0];status_par.readOnly=True
    if status_par is not None:
        status_par.expr="' | '.join(me.op('texture_sources').module.status(key) for key in "+repr(active)+")" if active else "''"
        status_par.enable=bool(active)
        page_name='Textures' if active else 'Inactive Textures'
        status_par.page=next((p for p in comp.customPages if p.name==page_name),None) or comp.appendCustomPage(page_name)
    return specs

def texture_snapshot(comp,graph):
    rows={};bindings=comp.fetch('sgrapePublicTextures',{});helper=comp.op('texture_sources')
    if not helper:return rows
    for decl in graph['declarations']:
        if decl['kind']!='sampler' or not decl.get('expose'):continue
        key=texture_key(decl);binding=bindings.get(key)
        p=getattr(comp.par,binding['parameter'],None) if binding else None
        if p is None:continue
        row=helper.module.effective(key);fallback=helper.module.describe(key)
        mode=str(p.mode).split('.')[-1].upper()
        rows[decl['id']]={'type':'sampler2D','key':key,'effectiveSource':row['path'],'sourceStatus':row['status'],
            'defaultValid':fallback['valid'],'components':[{'parameter':p.name,'value':str(p.val) if p.mode==ParMode.CONSTANT else fallback['path'],
            'mode':mode,'writable':p.mode==ParMode.CONSTANT and bool(p.enable) and not p.readOnly}]}
    return rows

def _set_parameter_without_native_capture(parameter, value):
    if not ui.undo.globalState:
        parameter.val = value
        return
    # TD's native parameter records resolve paths again and can hit replacement OPs.
    ui.undo.startBlock('Grape: ' + parameter.owner.name + ' / ' + parameter.label, enable=False)
    try:
        parameter.val = value
    finally:
        ui.undo.endBlock()


def _parameter_undo(is_undo, entry):
    """Restore only our still-current constant value on the original parameter."""
    if entry['blocked']:
        return
    try:
        parameter = entry['parameter']
        owner = entry['owner']
        if not owner.valid or owner.id != entry['ownerId'] or not parameter.valid:
            raise RuntimeError('the original parameter no longer exists')
        if owner.fetch('sgrapeShaderId', None) != entry['shaderId']:
            raise RuntimeError('the Shader identity changed')
        current = getattr(owner.par, entry['name'], None)
        if current is None or not parameter.isSamePar(current) or current.index != entry['index']:
            raise RuntimeError('the parameter was replaced')
        if parameter.mode != ParMode.CONSTANT or not parameter.enable or parameter.readOnly:
            raise RuntimeError('the parameter is now controlled or inactive')
        expected = entry['after'] if is_undo else entry['before']
        if entry['applied'] != bool(is_undo) or parameter.val != expected:
            raise RuntimeError('the value changed after this edit')
        value = entry['before'] if is_undo else entry['after']
        if entry['range'] is not None and (parameter.min, parameter.max, parameter.clampMin, parameter.clampMax) != entry['range']:
            raise RuntimeError('the parameter limits changed')
        if entry['validate'] is not None:
            entry['validate'](value)
        _set_parameter_without_native_capture(parameter, value)
        entry['applied'] = not bool(is_undo)
    except Exception as exc:
        # A skipped Undo must not become a later unexpected Redo write.
        entry['blocked'] = True
        ui.status = 'Grape: skipped parameter Undo/Redo; ' + str(exc)


def set_parameter_with_undo(parameter, value, validate=None):
    """Record an accepted editor commit; TD groups writes from one callback."""
    before = parameter.val
    if before == value:
        return
    if not ui.undo.globalState:
        _set_parameter_without_native_capture(parameter, value)
        return
    owner = parameter.owner
    entry = {'parameter': parameter, 'owner': owner, 'ownerId': owner.id,
             'name': parameter.name, 'index': parameter.index, 'before': before, 'applied': True, 'blocked': False,
             'shaderId': owner.fetch('sgrapeShaderId', None), 'validate': validate,
             'range': (parameter.min, parameter.max, parameter.clampMin, parameter.clampMax) if parameter.isNumber else None}
    ui.undo.startBlock('Grape: ' + owner.name + ' / ' + parameter.label)
    try:
        _set_parameter_without_native_capture(parameter, value)
        entry['after'] = parameter.val
        if before != entry['after']:
            ui.undo.addCallback(_parameter_undo, entry)
    finally:
        ui.undo.endBlock()


def _texture_undo_validator(comp, parameter, value, allowed):
    # Capture source OP identity as well as text; a stale path may be reused.
    sources = {}
    for path in (str(parameter.val), value):
        if path:
            source = comp.parent().op(path)
            sources[path] = (source, source.id if source is not None else None)
    def validate(path):
        if not path:
            return
        original, identity = sources.get(path, (None, None))
        current = comp.parent().op(path)
        if original is None or not original.valid or current is None or current.id != identity or not allowed(comp, current):
            raise RuntimeError('the TOP source was removed, replaced, or moved')
    return validate


def set_texture_value(body,snapshot):
    if body.get('revision')!=snapshot['revision']:raise RuntimeError('Texture graph changed. Reload before editing its source.')
    row=snapshot['textures'].get(body.get('declarationId'))
    if not row or type(body.get('component')) is not int or body['component']!=0:raise RuntimeError('Exposed texture no longer exists')
    item=row['components'][0];expected=body.get('expected',{})
    if not item['writable']:raise RuntimeError('This TOP source is controlled by TD. Its Expression or Bind was preserved.')
    if not isinstance(expected,dict) or any(expected.get(k)!=item[k] for k in ('parameter','value','mode')):
        raise RuntimeError('Texture source changed in TD or another editor. Review it and try again.')
    value=body.get('value')
    if not isinstance(value,str) or len(value)>2048 or any(ord(c)<32 for c in value):raise RuntimeError('Choose a TOP path or leave it empty for the default source')
    value=value.strip();comp=target();helper=comp.op('texture_sources').module
    if value and not helper._external_allowed(comp,comp.parent().op(value)):raise RuntimeError('Choose an existing TOP outside this Shader and the editor')
    parameter=getattr(comp.par,item['parameter'])
    validate=_texture_undo_validator(comp,parameter,value,helper._external_allowed)
    set_parameter_with_undo(parameter,value,validate=validate)
    return uniform_snapshot()


def public_uniforms(comp,graph,preserve=None):
    """Keep custom Par objects alive so external TD references remain valid."""
    bindings=copy.deepcopy(comp.fetch('sgrapePublicUniforms',{}))
    migrated=set(comp.fetch('grapeCustomMigratedV1',[]))
    exposed={d['id']:d for d in graph['declarations'] if d['kind']=='uniform' and d.get('expose',False) and d['id'] not in migrated}
    # Reject an incompatible in-place type change before mutating any parameters.
    for ident,decl in exposed.items():
        if ident in bindings and bindings[ident]['type']!=decl['type']:
            raise RuntimeError('Create a new Uniform when changing the type of an exposed parameter: '+decl['name'])
    for ident,decl in exposed.items():
        label=decl.get('exposeName') or decl['name']
        if ident not in bindings:
            name='U'+hashlib.sha256(ident.encode()).hexdigest()[:16]
            if getattr(comp.par,name,None) is not None: raise RuntimeError('Public Uniform parameter name collision')
            page=next((p for p in comp.customPages if p.name=='Uniforms'),None) or comp.appendCustomPage('Uniforms')
            count=core().type_components(decl['type'])
            group=page.appendFloat(name,label=label,size=count)
            value=(preserve or {}).get(ident,decl['value'])
            values=[value] if count==1 else value
            for p,value in zip(group,values): p.val=value
            bindings[ident]={'type':decl['type'],'parameters':[p.name for p in group]}
        defaults=[decl['value']] if core().type_components(decl['type'])==1 else decl['value']
        for name,default in zip(bindings[ident]['parameters'],defaults):
            p=getattr(comp.par,name)
            page=next((page for page in comp.customPages if page.name=='Uniforms'),None) or comp.appendCustomPage('Uniforms')
            p.page=page; p.label=label; p.enable=True; p.default=default
    for ident,binding in bindings.items():
        if ident not in exposed and ident not in migrated:
            for name in binding['parameters']:
                p=getattr(comp.par,name,None)
                if p is not None:
                    page=next((page for page in comp.customPages if page.name=='Inactive Uniforms'),None) or comp.appendCustomPage('Inactive Uniforms')
                    p.page=page; p.enable=False
    comp.store('sgrapePublicUniforms',bindings)
    return {ident:bindings[ident] for ident in exposed}

def compiled_fingerprint(compiled):
    return core().digest({key:compiled[key] for key in ('vertex','pixel','bindings')})

def ensure_supported_shader(comp):
    try:
        dat=comp.op('manifest')
        manifest=json.loads(dat.text) if dat else None
        if not isinstance(manifest,dict):raise ValueError('Invalid manifest')
    except (ValueError,TypeError,AttributeError):
        raise RuntimeError('Shader manifest could not be read; original Shader was preserved')
    version=manifest.get('compilerBuild',manifest.get('version','0.1.0'))
    try: parts=tuple(int(p) for p in version.split('.'))
    except (ValueError,AttributeError): raise RuntimeError('Unrecognized Shader version; original Shader was preserved')
    if len(parts)!=3 or parts>tuple(int(p) for p in PRODUCT_VERSION.split('.')):
        raise RuntimeError('This Shader needs a newer TD-Grape version; original Shader was preserved')

def compiled_is_current(comp,compiled,graph=None):
    if source_module() and comp.fetch('grapeNativeUniformsV1',None) is None: return False
    if source_module() and graph is not None:
        for decl in graph['declarations']:
            if decl['kind'] in ('uniform','spec_constant') and not decl.get('sourceMissing') and not source_module().locate(shader_operator(comp),comp.fetch('grapeNativeUniformsV1',{}).get(decl['id'])): return False
    manifest=json.loads(comp.op('manifest').text or '{}')
    actual_vertex=comp.op('vertex_shader').text if comp.op('vertex_shader') else ''
    return bool(comp.op('texture_sources')) and comp.op('texture_sources').text==TEXTURE_SOURCE_CODE and manifest.get('compilerBuild')==PRODUCT_VERSION and manifest.get('catalogContractHash')==core().catalog_contract()['hash'] and manifest.get('compiledFingerprint')==compiled_fingerprint(compiled) and comp.op('pixel_shader').text==compiled['pixel'] and actual_vertex==compiled['vertex']

def update_shader(shader):
    # Recompile the saved Graph in place; public OP and Par objects survive.
    ensure_supported_shader(shader)
    with shader_context(shader):
        review=upgrade_review()
        if review['required'] or review['blocked']:
            return {'shader':shader.path,'updated':False,'reviewRequired':True,'upgradeReview':upgrade_summary(review)}
        current=checked_state();graph=review['candidate'];compiled=core().compile_graph(graph)
        if current.get('appliedHash')==compiled['hash'] and compiled_is_current(shader,compiled,graph):
            return {'shader':shader.path,'updated':False,'revision':current['revision']}
        result=deploy(graph,current['revision'])
        register_shader(shader)
        return {'shader':shader.path,'updated':True,'revision':result['state']['revision']}

def update_shaders():
    results=[];errors=[]
    for shader in shaders():
        try:results.append(update_shader(shader))
        except Exception as exc:errors.append({'shader':shader.path,'error':str(exc)})
    updated=sum(int(row['updated']) for row in results)
    pending=sum(int(row.get('reviewRequired',False)) for row in results)
    _owner.par.Updatestatus=str(updated)+' updated; '+str(len(results)-updated-pending)+' current; '+str(pending)+' need review; '+str(len(errors))+' failed'
    if errors:_owner.par.Updatestatus+=' — '+errors[0]['shader']+': '+errors[0]['error']
    return {'ok':not errors,'results':results,'errors':errors,'reviewRequired':pending}

def configure(comp,compiled,graph,preserve=None,input_owner=None):
    kind=shader_kind(comp)
    if core().graph_target(graph)!=kind: raise RuntimeError('Shader target does not match this component')
    public=public_uniforms(comp,graph,preserve)
    textures=prepare_textures(comp,graph,input_owner,compiled)
    mat=shader_operator(comp)
    if kind=='mat':
        comp.op('vertex_shader').text=compiled['vertex']
    else:
        for name in ('Width','Height'):getattr(comp.par,name).enableExpr="me.par.Resolution == 'custom' or not me.op('texture_sources').module.match_input()"
        if input_owner:
            for name in ('Resolution','Width','Height','Pixelformat','Extenduv'):getattr(comp.par,name).val=getattr(input_owner.par,name).eval()
        mat.par.outputresolution='custom'
        context='parent()'
        for name,dimension in (('resolutionw','width'),('resolutionh','height')):
            source="mod('texture_sources').input_dimension("+repr(dimension)+")" if graph.get('topSourceVersion')==1 else context+".op('input_router')."+dimension
            getattr(mat.par,name).expr=source+" if "+context+".par.Resolution == 'input' and mod('texture_sources').match_input() else parent().par."+dimension.title()
        mat.par.format.expr='parent().par.Pixelformat.eval()'
        mat.par.inputextenduv.expr='parent().par.Extenduv.eval()'
        for connector in mat.inputConnectors:connector.disconnect()
    comp.op('pixel_shader').text=compiled['pixel']
    samplers=[b for b in compiled['bindings'] if b['kind']=='sampler']
    uniforms=[b for b in compiled['bindings'] if b['kind']=='uniform']
    if kind=='mat':
        mat.seq.sampler.numBlocks=max(1,len(samplers))
        for i in range(mat.seq.sampler.numBlocks):
            getattr(mat.par,'sampler'+str(i)+'name').val=''
            getattr(mat.par,'sampler'+str(i)+'top').val=''
    if not source_module():
        mat.seq.vec.numBlocks=max(1,len(uniforms))
        for i in range(mat.seq.vec.numBlocks): getattr(mat.par,'vec'+str(i)+'name').val=''
    top_paths=[]
    for i,b in enumerate(samplers):
        key=texture_key(b)
        row=comp.op('texture_sources').module.effective(key)
        if not row['valid'] and not row.get('recoverable'):raise RuntimeError('Invalid TOP source for '+b['name'])
        if b.get('topInputId'):
            texture=comp.op(next(slot['node'] for slot in comp.fetch('grapeTopSlots',[]) if slot['id']==b['topInputId']))
        elif key=='input:0':texture=comp.op('input_router')
        else:
            name='texture_source_'+hashlib.sha256(key.encode()).hexdigest()[:16]
            texture=comp.op(name) or comp.create(selectTOP,name)
            texture.par.format='useinput';texture.par.top.expr="mod('texture_sources').resolve("+repr(key)+")"
        reference=texture.name
        if kind=='top':
            if texture.parent()!=comp:
                selected=comp.op('source_'+b['id']) or comp.create(selectTOP,'source_'+b['id'])
                selected.par.top=texture.path;selected.par.format='useinput';texture=selected
            top_paths.append(texture.path)
            if not graph.get('topInputs') and graph.get('topSourceVersion')!=1:mat.inputConnectors[i].connect(texture)
        else:
            getattr(mat.par,'sampler'+str(i)+'name').val=b['name']
            getattr(mat.par,'sampler'+str(i)+'top').val=reference
    if kind=='top':mat.par.tops.val=' '.join(top_paths) if graph.get('topInputs') or graph.get('topSourceVersion')==1 else ''
    if source_module():
        source_module().configure(_owner.op('runtime').module,comp,graph,public,preserve,input_owner)
    else:
        for i,b in enumerate(uniforms):
            getattr(mat.par,'vec'+str(i)+'name').val=b['name']
            value=(preserve or {}).get(b['id'],b['value'])
            values=[value] if core().type_components(b['type'])==1 else value
            for j,channel in enumerate('xyzw'):
                parameter=getattr(mat.par,'vec'+str(i)+'value'+channel)
                if b['id'] in public and j<len(values):
                    name=public[b['id']]['parameters'][j]
                    parameter.expr="parent().par."+name
                else:
                    parameter.mode=ParMode.CONSTANT
                    parameter.val=values[j] if j<len(values) else 0
    comp.op('graph').text=json.dumps(graph,ensure_ascii=False,indent=2)
    comp.op('manifest').text=json.dumps({'version':PRODUCT_VERSION,'compilerBuild':PRODUCT_VERSION,'catalogContractHash':core().catalog_contract()['hash'],'catalogSnapshot':_owner.op('document').module.catalog_snapshot(core()),'compiledFingerprint':compiled_fingerprint(compiled),'hash':compiled['hash'],'bindings':compiled['bindings'],'publicUniforms':public},indent=2)
    arrange_shader_parameters(comp)

def internal_area(name, marker):
    area=_owner.op(name)
    if area and not area.fetch(marker,False):
        raise RuntimeError('An unrelated component occupies '+area.path)
    if not area:
        area=_owner.create(baseCOMP,name)
        area.store(marker,True)
        area.nodeX=-600;area.nodeY=-550 if name=='compiler_validation' else -750
    return area


@contextmanager
def validation_scene(comp):
    """One manager-owned render context; never used as the user's viewer."""
    area=internal_area('compiler_validation','grapeValidationV1')
    if not area.op('geometry'):
        geo=area.create(geometryCOMP,'geometry')
        rect=geo.create(rectangleSOP,'rectangle')
        for child in geo.children:
            if child.family in ('SOP','POP'):child.render=child==rect;child.display=child==rect
        camera=area.create(cameraCOMP,'camera');camera.par.tz=2
        camera.par.projection='ortho';camera.par.orthowidth=1.12
        render=area.create(renderTOP,'render');render.par.camera='camera';render.par.geometry='geometry'
        render.par.resolutionw=512;render.par.resolutionh=512;render.par.antialias='aaoff'
        geo.nodeX=0;camera.nodeX=220;render.nodeX=440
        for child in area.children:child.viewer=False
    geo=area.op('geometry')
    previous=geo.par.material.val
    try:
        geo.par.material=comp.op('material')
        yield area.op('render')
    finally:
        # Do not leave an idle validation renderer dependent on a live shader.
        geo.par.material=previous


def validate_material(comp,compiled=None):
    kind=shader_kind(comp)
    operator=shader_operator(comp)
    operator.cook(force=True)
    if kind=='mat':
        with validation_scene(comp) as render:
            render.cook(force=True)
            info=comp.op('compile_info').text
            error=operator.errors() or render.errors()
    else:
        comp.op('preview').cook(force=True)
        info=comp.op('compile_info').text
        error=operator.errors() or comp.op('preview').errors()
    succeeded=('Pixel Shader Compile Results:' in info and info.count('Compiled Successfully')>=2) if kind=='top' else 'Linked Successfully' in info
    if error or 'ERROR:' in info or not succeeded:
        exc=RuntimeError((error+'\n'+info).strip() or 'Shader has not compiled')
        if compiled:
            paths={stage:comp.op(stage+'_shader').path for stage in ('vertex','pixel') if comp.op(stage+'_shader') and comp.op(stage+'_shader').text==compiled.get(stage)}
            exc.diagnostics=core().native_compile_diagnostics(info,compiled,paths)
            location=next((item for item in exc.diagnostics if item.get('node')),None)
            if location:
                for key in ('node','functionId','stage','trail'):setattr(exc,key,location.get(key))
        raise exc
    return info


def existing_values(comp,new_graph):
    if not comp or not comp.op('manifest').text: return {}
    if source_module() and comp.fetch('grapeNativeUniformsV1',None) is not None:
        values={}; operator=shader_operator(comp)
        for decl in new_graph['declarations']:
            if decl['kind']!='uniform': continue
            row=source_module().locate(operator,comp.fetch('grapeNativeUniformsV1',{}).get(decl['id']))
            if row:
                current=[c['value'] for c in row['components'][:core().type_components(decl['type'])]]
                if all(value is not None for value in current):values[decl['id']]=current[0] if len(current)==1 else current
        return values
    old=json.loads(comp.op('manifest').text)
    old_graph=json.loads(comp.op('graph').text)
    old_decls={d['id']:d for d in old_graph['declarations']}
    new_decls={d['id']:d for d in new_graph['declarations']}
    values={}; mat=shader_operator(comp); i=0
    for b in old['bindings']:
        if b['kind']!='uniform': continue
        newer=new_decls.get(b['id'])
        if newer and newer.get('type')==b['type'] and newer.get('value')==old_decls[b['id']].get('value'):
            count=core().type_components(b['type'])
            value=[getattr(mat.par,'vec'+str(i)+'value'+c).eval() for c in 'xyzw'[:count]]
            values[b['id']]=value[0] if count==1 else value
        i+=1
    return values



# Review tickets are short-lived, bounded, and bound to an exact TD object/state.
# They are never persisted or treated as blanket consent for another upgrade.
_upgrade_tickets = {}


def upgrade_review(graph=None):
    document = _owner.op('document').module
    current = document.saved_envelope(saved_state_source())
    manifest = json.loads(target().op('manifest').text)
    baseline = manifest.get('catalogSnapshot', {'catalogHash': manifest.get('catalogContractHash')})
    saved = document.inspect_upgrade(current['graph'], core(), shader_kind(target()), baseline=baseline)
    requested = saved if graph is None else document.inspect_upgrade(graph, core(), shader_kind(target()))
    report = copy.deepcopy(requested)
    if graph is not None:
        # Replacing a graph is not permission to silently change the old runtime.
        report['required'] |= saved['required']
        report['blocked'] |= saved['blocked']
        seen = {core().digest(row) for row in report['changes']}
        for row in saved['changes']:
            if core().digest(row) not in seen:
                report['changes'].append(dict(row, savedGraph=True))
        report['issues'] += saved['issues']
    if report['blocked']:
        report['candidate'] = None
    report['revision'] = current['revision']
    report['target'] = target().path
    return report


def upgrade_summary(report):
    return {key: copy.deepcopy(value) for key, value in report.items() if key != 'candidate'}


def _upgrade_binding():
    shader = target()
    return {'opId': shader.id, 'shaderId': shader.fetch('sgrapeShaderId'), 'path': shader.path,
            'stateHash': hashlib.sha256(saved_state_source().encode('utf-8')).hexdigest(),
            'manifestHash': hashlib.sha256(shader.op('manifest').text.encode('utf-8')).hexdigest(),
            'sourcesHash': core().digest({name: shader.op(name).text if shader.op(name) else None for name in ('graph', 'pixel_shader', 'vertex_shader')}),
            'catalogHash': _owner.op('document').module.catalog_snapshot(core())['hash']}


def prepare_upgrade_review(graph=None):
    ensure_supported_shader(target())
    report = upgrade_review(graph)
    now = time.monotonic()
    for key, row in list(_upgrade_tickets.items()):
        if now >= row['expires']:
            del _upgrade_tickets[key]
    if report['candidate'] is not None:
        while len(_upgrade_tickets) >= 8:
            del _upgrade_tickets[next(iter(_upgrade_tickets))]
        token = secrets.token_urlsafe(32)
        _upgrade_tickets[token] = {'binding': _upgrade_binding(), 'candidateHash': core().digest(report['candidate']), 'expires': now + 600}
        report['token'] = token
    return report


def accept_upgrade_ticket(token, graph):
    record = _upgrade_tickets.pop(token, None) if isinstance(token, str) else None
    if (record is None or time.monotonic() >= record['expires'] or
            record['binding'] != _upgrade_binding() or
            record['candidateHash'] != core().digest(graph)):
        raise RuntimeError('Conflict: the upgrade review expired or its Shader, graph, or catalog changed. Review the differences again.')


def upgrade_backup(comp, current):
    # A single previous successful version in a separate native DAT. This is not
    # added to Graph/state JSON, browser responses, or executable archive data.
    return json.dumps({'state': current, 'graph': comp.op('graph').text,
                       'manifest': comp.op('manifest').text,
                       'pixel': comp.op('pixel_shader').text,
                       'vertex': comp.op('vertex_shader').text if comp.op('vertex_shader') else ''}, ensure_ascii=False, allow_nan=False)


def begin_material_preview_update(comp):
    # The native MAT viewer can block when it captures a material in the same
    # frame as its sampler layout changes. Let the companion retain its frame
    # across the full commit/rollback, without changing the WebRTC connection.
    if not comp or shader_kind(comp) != 'mat':
        return None, None
    panel = _owner.op('remote_panel')
    if not panel or not panel.fetch('tdRemotePanel', False):
        return None, None
    runtime = panel.op('runtime').module
    begin = getattr(runtime, 'begin_source_update', None)
    return (runtime, begin(shader_operator(comp))) if begin else (None, None)


def deploy(graph,expected_revision,inject_failure=False,upgrade_token=None):
    if source_module(): source_module().sync(_owner.op('runtime').module)
    current=checked_state()
    current_raw=saved_state_source()
    if expected_revision!=current['revision']: raise RuntimeError('Conflict: this graph changed in another window. Reload before applying.')
    if target():ensure_supported_shader(target())
    accepted = upgrade_token is not None
    if accepted:
        accept_upgrade_ticket(upgrade_token, graph)
    else:
        review = upgrade_review(graph)
        if review['required'] or review['blocked']:
            return {'ok': False, 'upgradeReview': upgrade_summary(review)}
    graph = _owner.op('document').module.stamp_catalog(graph, core())
    backup = upgrade_backup(target(), current) if accepted else None
    backup_dat_before=target().op('upgrade_backup') if accepted else None
    if backup_dat_before and not backup_dat_before.fetch('sgrapeUpgradeBackup',False):
        raise RuntimeError('The upgrade_backup name is already used by another operator. Rename it before upgrading.')
    backup_text_before=backup_dat_before.text if backup_dat_before else None
    compiled=core().compile_graph(graph)
    if any(b.get('sourceMissing') for b in compiled['bindings']):
        raise RuntimeError('A used Input source is missing. Restore or reassign its reference before applying.')
    if target() and core().graph_target(graph)!=shader_kind(target()): raise RuntimeError('Import a graph for the same Shader target')
    if not inject_failure and not accepted and current.get('appliedHash')==compiled['hash'] and target() and compiled_is_current(target(),compiled,graph):
        new=dict(current,graph=copy.deepcopy(graph),revision=current['revision']+1,lastError='',sourceChanged=False)
        write_state(new)
        target().op('graph').text=json.dumps(graph,ensure_ascii=False,indent=2)
        return {'ok':True,'state':new,'shaderUpdated':False,'compileInfo':'Graph layout saved','diagnostics':compiled['diagnostics'],'target':target().path}
    old_target=target(); preserve=existing_values(old_target,graph)
    preview_runtime,preview_token=begin_material_preview_update(old_target)
    candidate=None
    try:
        candidate=_owner.op('candidate')
        if candidate: candidate.destroy()
        candidate=make_scene(_owner,'candidate',core().graph_target(graph))
        configure(candidate,compiled,graph,preserve,input_owner=old_target)
        info=validate_material(candidate,compiled)
        # Candidate validation precedes mutation. Snapshot allows compensation;
        # an undo group alone is not a transaction.
        previous=None
        if old_target:
            previous_graph=json.loads(old_target.op('graph').text)
            previous_manifest=old_target.op('manifest').text
            saved_manifest=json.loads(previous_manifest)
            previous_compiled={'vertex':old_target.op('vertex_shader').text if old_target.op('vertex_shader') else '',
                'pixel':old_target.op('pixel_shader').text,'hash':saved_manifest['hash'],'bindings':saved_manifest['bindings']}
            previous=(previous_graph,previous_compiled,existing_values(old_target,previous_graph),previous_manifest,old_target.op('graph').text)
        destination=old_target or make_scene(_owner.parent(),_owner.fetch('targetName','sgrape_material'),core().graph_target(graph))
        destination.store('sgrapeOwnerName',_owner.name)
        source_before=source_module().capture_configuration(_owner.op('runtime').module,destination) if source_module() else None
        try:
            configure(destination,compiled,graph,preserve)
            if inject_failure: raise RuntimeError('Injected commit failure')
            validate_material(destination,compiled)
            new=dict(current,graph=copy.deepcopy(graph),revision=current['revision']+1,appliedHash=compiled['hash'],lastError='',sourceChanged=False)
            write_state(new)
            if backup is not None:
                backup_dat = destination.op('upgrade_backup') or destination.create(textDAT, 'upgrade_backup')
                backup_dat.store('sgrapeUpgradeBackup',True)
                backup_dat.text = backup
            destination.par.Version = PRODUCT_VERSION
        except Exception:
            if source_before is not None: source_module().restore_configuration(_owner.op('runtime').module,destination,source_before)
            if previous:
                configure(destination,previous[1],previous[0],previous[2]);validate_material(destination)
                destination.op('manifest').text=previous[3]
                destination.op('graph').text=previous[4]
            else: destination.destroy()
            (_shader or _owner).op('state').text=current_raw
            if backup is not None:
                backup_dat=destination.op('upgrade_backup') if destination and destination.valid else None
                if backup_dat and backup_text_before is None:backup_dat.destroy()
                elif backup_dat:backup_dat.text=backup_text_before
            raise
        cleanup_top_sources(destination,graph)
        return {'ok':True,'state':new,'shaderUpdated':True,'compileInfo':info,'diagnostics':compiled['diagnostics'],'target':destination.path}
    finally:
        try:
            if candidate and candidate.valid: candidate.destroy()
        finally:
            if preview_token is not None:
                preview_runtime.end_source_update(preview_token)

def material_preview(comp):
    """Legacy PNG clients get lazy manager-owned captures, outside shader copies."""
    area=internal_area('snapshot_previews','grapeSnapshotsV1')
    for child in area.children:
        if child.fetch('grapeMatViewerV1',False) and not child.par.opviewer.eval():child.destroy()
    name='mat_'+str(comp.id)
    top=area.op(name)
    if not top:
        top=area.create(opviewerTOP,name)
        top.store('grapeMatViewerV1',True)
        top.par.outputresolution='custom'
        top.par.resolutionw=512;top.par.resolutionh=512
        top.par.preservealpha=True;top.par.allowpanel=False
        top.par.format='rgba8fixed';top.viewer=False
    top.par.opviewer=comp.op('material')
    return top


def remote_preview(comp):
    panel=_owner.op('remote_panel')
    if not panel or not panel.fetch('tdRemotePanel',False):
        raise RuntimeError('The Remote Panel module is not installed in this Grape manager.')
    if not panel.par.Active.eval():
        raise RuntimeError('Enable Active on the Remote Panel component in TouchDesigner.')
    shader=shader_operator(comp)
    if not shader:raise RuntimeError('The shader output no longer exists.')
    ticket=panel.op('runtime').module.prepare_viewer(shader)
    return {'port':int(panel.par.Port.eval()),'ticket':ticket,'source':shader.path}


class _PreviewFramePending(Exception):
    def __init__(self,comp,top,frame):
        self.comp=comp;self.top=top;self.frame=frame


def png(comp):
    import numpy as np
    top=material_preview(comp) if shader_kind(comp)=='mat' else comp.op('preview')
    top.cook(force=True)
    if top.errors():raise RuntimeError(top.errors())
    pixels=top.numpyArray(delayed=False)
    data=np.flipud(np.clip(pixels*255,0,255).astype(np.uint8))
    h,w,_=data.shape
    def chunk(kind,payload): return struct.pack('!I',len(payload))+kind+payload+struct.pack('!I',zlib.crc32(kind+payload)&0xffffffff)
    raw=b''.join(b'\0'+row.tobytes() for row in data)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')

def process_request(method,path,body):
    if _owner.fetch('sgrapeManager',False):
        parts=path.strip('/').split('/')
        if len(parts)!=3 or parts[0]!='api': raise RuntimeError('Open Editor from a Grape Shader')
        with shader_context(resolve_shader(parts[1])):
            return process_shader_request(method,'/api/'+parts[2],body)
    return process_shader_request(method,path,body)

def uniform_snapshot():
    current=state(); comp=target(); bindings=comp.fetch('sgrapePublicUniforms',{})
    rows={}
    for decl in current['graph']['declarations']:
        if decl['kind']!='uniform' or not decl.get('expose'): continue
        binding=bindings.get(decl['id'])
        if not binding or binding['type']!=decl['type']: continue
        components=[]
        for name in binding['parameters']:
            p=getattr(comp.par,name,None)
            if p is None: continue
            mode=str(p.mode).split('.')[-1].upper()
            try:
                value=float(p.eval()); core().number(value)
                readable=True
            except Exception:
                value=None; readable=False
            components.append({'parameter':name,'value':value,'mode':mode,
                'writable':readable and p.mode==ParMode.CONSTANT and bool(p.enable) and not p.readOnly})
        rows[decl['id']]={'type':decl['type'],'default':decl['value'],'components':components}
    if source_module() and comp.fetch('grapeNativeUniformsV1',None) is not None:
        native=source_module().snapshot(_owner.op('runtime').module)
        current=state()
        for row in native['uniforms']:
            if not row['missing'] and row['id'] not in rows:
                rows[row['id']]={'type':row['type'],'default':row['default'],'components':row['components'][:core().type_components(row['type'])]}
    return {'revision':current['revision'],'uniforms':rows,'textures':texture_snapshot(comp,current['graph'])}

def set_uniform_value(body):
    # Only expose a numeric component of this Shader, never an arbitrary Par path.
    if source_module() and target().fetch('grapeNativeUniformsV1',None) is not None and body.get('declarationId') in {d['id'] for d in state()['graph']['declarations'] if d['kind']=='uniform' and not d.get('expose')}:
        native_body=dict(body,id=body.get('declarationId'))
        expected=native_body.get('expected',{})
        native_body['expected']={k:expected.get(k) for k in ('parameter','value','mode','writable')}
        # Earlier numeric editor snapshots only sent the comparison fields.
        native_body['expected']['writable']=True
        source_module().write_value(_owner.op('runtime').module,native_body)
        return uniform_snapshot()
    ensure_supported_shader(target())
    checked_state()
    snapshot=uniform_snapshot()
    if body.get('declarationId') in snapshot['textures']:return set_texture_value(body,snapshot)
    if body.get('revision')!=snapshot['revision']:
        raise RuntimeError('Uniform graph changed. Reload the applied graph before editing its values.')
    row=snapshot['uniforms'].get(body.get('declarationId'))
    index=body.get('component')
    if not row or type(index) is not int or not 0<=index<len(row['components']):
        raise RuntimeError('Exposed Uniform component no longer exists')
    item=row['components'][index]; expected=body.get('expected',{})
    if not item['writable']:
        raise RuntimeError('This value is controlled by TD. Its Expression, Export or Bind was preserved.')
    if not isinstance(expected,dict) or any(expected.get(key)!=item[key] for key in ('value','mode','parameter')):
        raise RuntimeError('Uniform value changed in TD or another editor. Review the latest value and try again.')
    value=body.get('value');core().number(value)
    p=getattr(target().par,item['parameter'])
    set_parameter_with_undo(p,value)
    return uniform_snapshot()

def process_shader_request(method,path,body):
    if method=='GET' and path=='/api/shaders':return shader_choices()
    if method=='GET' and path=='/api/share-links':return share_links()
    if method=='GET' and path=='/api/state-source':
        raw=saved_state_source()
        if raw is None:raise RuntimeError('The saved state DAT is missing')
        if len(raw.encode('utf-8'))>16*1024*1024:raise RuntimeError('Saved state exceeds the 16 MB download limit; save the DAT directly in TouchDesigner.')
        import hashlib
        return {'raw':raw,'sha256':hashlib.sha256(raw.encode('utf-8')).hexdigest()}
    if method=='GET' and path=='/api/state':
        if source_module(): source_module().sync(_owner.op('runtime').module)
        reason=''
        try:ensure_supported_shader(target())
        except RuntimeError as exc:reason=str(exc)
        raw,checked=inspect_saved_state();current=checked['state']
        saved_issue=None
        if checked['status']!='valid':
            import hashlib
            saved_issue={'issues':checked['issues'],'sha256':hashlib.sha256(raw.encode('utf-8')).hexdigest() if raw is not None else None,
                         'downloadable':raw is not None and len(raw.encode('utf-8'))<=16*1024*1024,'datPath':target().path+'/state'}
            reason=reason or 'Saved Shader data needs review; editing is paused and TD output is preserved.'
        try:review=core().inspect_graph_definitions(current['graph'])
        except (KeyError,TypeError,ValueError,AttributeError):review={'schemaVersion':1,'hasUnresolved':True,'entries':[],'error':'Invalid Graph structure'}
        upgrade=None
        if not reason:
            inspected=upgrade_review()
            if inspected['required'] or inspected['blocked']:
                upgrade=upgrade_summary(inspected)
            elif current is not None:
                # Supply version evidence to old editors without rewriting the DAT.
                current=copy.deepcopy(current)
                current['graph']=inspected['candidate']
        elif saved_issue:
            try:
                inspected=upgrade_review()
                if inspected['required']:upgrade=upgrade_summary(inspected)
            except (ValueError,TypeError,KeyError,AttributeError,RecursionError):pass
        result = {'upgradeReview':upgrade,'state':current,'savedStateIssue':saved_issue,'shaderKind':shader_kind(target()),'readOnlyReason':reason,'catalog':list(core().CATALOG.values()),'typeContract':core().type_contract(),'catalogContract':core().catalog_contract(),'definitionReview':review,'functionLibrary':core().function_library(),'personalLibrary':personal_library(refresh=True),'target':target().path if target() else '',
                'examples':{name:_owner.op('document').module.stamp_catalog(core().normalize_top_sources(core().demo_graph(name,target=shader_kind(target())))[0],core()) for name in ('banana','color','tint')}}
        return history_result(result) if not saved_issue and current is not None else result
    if method=='POST' and path=='/api/remote-preview':
        return remote_preview(target())
    if method=='GET' and path=='/api/preview':
        comp=target()
        if comp and shader_kind(comp)=='mat':
            top=material_preview(comp);top.cook(force=True)
            # MAT viewers finish drawing after this frame's callbacks. Keep the
            # existing HTTP request queued; never wait or run TD API off-thread.
            raise _PreviewFramePending(comp,top,int(absTime.frame))
        return png(comp) if comp else bytes()
    if method=='GET' and path=='/api/uniforms': return history_result(uniform_snapshot())
    if method=='GET' and path=='/api/custom-parameters':
        return _owner.op('parameters').module.snapshot(_owner.op('runtime').module)
    if method=='POST' and path=='/api/custom-parameters':
        return _owner.op('parameters').module.edit(_owner.op('runtime').module,body)
    if method=='GET' and path=='/api/sources':
        if not source_module(): raise RuntimeError('Update the Grape manager to edit native sources.')
        result=source_module().snapshot(_owner.op('runtime').module)
        result['topInputs']=top_input_snapshot(target())
        return history_result(result)
    if method=='POST' and path=='/api/source-value':
        ensure_supported_shader(target())
        return history_operation(lambda: source_module().write_value(_owner.op('runtime').module,body))
    if method=='POST' and path=='/api/source-edit':
        ensure_supported_shader(target())
        if history_module(): history_module().preflight_edit(_owner.op('runtime').module,body)
        return history_operation(lambda: source_module().edit(_owner.op('runtime').module,body), source_edit=body)
    if method=='POST' and path=='/api/history-restore':
        ensure_supported_shader(target())
        if not history_module(): raise RuntimeError('Update the Grape manager to use native source history.')
        with history_native_writes():
            return history_module().restore(_owner.op('runtime').module,body)
    if method=='POST' and path=='/api/native-viewer':
        comp=target()
        if comp is None: raise RuntimeError('The Grape component is no longer available.')
        comp.openViewer(unique=False, borders=True)
        return {'opened':True,'target':comp.path}
    if method=='POST' and path=='/api/native-parameters':
        shader_operator(target()).openParameters()
        return {'opened': True}

    if method=='GET' and path=='/api/personal':return personal_library(refresh=True)
    if method=='POST' and path=='/api/personal-save':return save_personal(body)
    if method=='POST' and path=='/api/uniform-value': return history_operation(lambda: set_uniform_value(body))
    if method=='POST' and path=='/api/inspect':
        if body.get('reviewUpgrade') is True:return prepare_upgrade_review(body.get('graph'))
        report=_owner.op('document').module.inspect_document(body.get('graph'),core(),shader_kind(target()))
        if report.get('candidate') is not None:
            report['upgradeReview']=upgrade_summary(_owner.op('document').module.inspect_upgrade(report['candidate'],core(),shader_kind(target())))
        return report
    if method=='POST' and path=='/api/apply': return history_operation(lambda: deploy(body['graph'],body['revision'],upgrade_token=body.get('upgradeToken')))
    if method=='POST' and path=='/api/validate': return core().compile_graph(body['graph'])
    if method=='POST' and path=='/api/export':
        from pathlib import Path
        import uuid
        graph=body['graph']
        if not isinstance(graph,dict): raise RuntimeError('Invalid graph document')
        text=json.dumps(graph,ensure_ascii=False,indent=2,allow_nan=False)
        if len(text.encode('utf-8'))>512000: raise RuntimeError('Graph exceeds 512 KB')
        folder=Path(project.folder)/'TD-Grape-graphs'; folder.mkdir(exist_ok=True)
        path=folder/('TD-Grape-'+time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6]+'.json')
        path.write_text(text,encoding='utf-8')
        return {'saved':True,'path':str(path)}
    if method=='POST' and path=='/api/save':
        # Native numbered save avoids a modal overwrite prompt during automation.
        return {'saved':project.save()}
    raise RuntimeError('Unknown request')

def ensure_network_controls(owner):
    """One manager-level choice. No firewall, VPN or routing changes."""
    if not owner.fetch('sgrapeManager',False): return
    page=next((p for p in owner.customPages if p.name in ('TD-Grape','TD-Sgrape')),None)
    if page is None: page=owner.appendCustomPage('TD-Grape')
    if getattr(owner.par,'Allowlan',None) is None:
        page.appendToggle('Allowlan',label='Allow LAN Connections')
        owner.par.Allowlan.default=False;owner.par.Allowlan.val=False
    if getattr(owner.par,'Requiretoken',None) is None:
        page.appendToggle('Requiretoken',label='Require Connection Token')
        owner.par.Requiretoken.default=False;owner.par.Requiretoken.val=False
        owner.par.Requiretoken.order=owner.par.Allowlan.order+0.5
    for name,label in (('Lanurls','LAN URLs'),('Lanstatus','Connection Status')):
        if getattr(owner.par,name,None) is None: page.appendStr(name,label=label)
        getattr(owner.par,name).readOnly=True
    owner.par.Lanurls.enableExpr='me.par.Allowlan'
    arrange_manager_parameters(owner)


def requested_lan(owner):
    parameter=getattr(owner.par,'Allowlan',None)
    return bool(parameter.eval()) if parameter is not None else False


def requested_token_requirement(owner):
    parameter=getattr(owner.par,'Requiretoken',None)
    return bool(parameter.eval()) if parameter is not None else False


def network_addresses():
    """Enumerate local IPv4 addresses, without changing network configuration."""
    try:
        values={row[4][0] for row in socket.getaddrinfo(socket.gethostname(),None,socket.AF_INET,socket.SOCK_STREAM)}
    except OSError: values=set()
    return sorted((value for value in values if not value.startswith(('127.','169.254.')) and value!='0.0.0.0'),key=lambda value:tuple(map(int,value.split('.'))))


def share_links():
    """Report listener origins, without disclosing tokens or testing reachability."""
    origins=[{'origin':'http://127.0.0.1:'+str(_port),'kind':'local'}]
    if _lan_enabled:
        origins.extend({'origin':'http://'+address+':'+str(_port),'kind':'lan'} for address in network_addresses())
    path='/shader/'+target().fetch('sgrapeShaderId')+'/' if _owner.fetch('sgrapeManager',False) else '/'
    return {'origins':origins,'lanEnabled':_lan_enabled,'tokenRequired':_require_token,'shaderPath':path}


def update_network_links():
    global _network_refresh
    _network_refresh=time.monotonic()
    if getattr(_owner.par,'Lanurls',None) is None: return
    rows=sorted((shader for shader in _shaders.values() if shader and shader.valid),key=lambda shader:shader.path)
    shader=rows[0] if rows else None
    addresses=network_addresses() if _lan_enabled else []
    links='\n'.join(url(shader,address=address) for address in addresses) if shader else ''
    if _owner.par.Lanurls.eval()!=links:_owner.par.Lanurls.val=links
    message=('LAN enabled' if addresses else 'LAN enabled; no network address found') if _lan_enabled else 'This computer only'
    if _lan_enabled and not shader:message='LAN enabled; create a Grape MAT or TOP first'
    _owner.par.Lanstatus.val=message


def set_lan_enabled(enabled):
    """Rebind only the HTTP service, preserving the port, token and TD state."""
    enabled=bool(enabled)
    if enabled==_lan_enabled and _server is not None:return
    previous=_lan_enabled
    session={'port':_port,'token':_token,'strictPort':True,'lan':enabled,'rebind':True}
    stop()
    if _worker and _worker.is_alive():
        raise RuntimeError('The editor listener is still stopping. Try again shortly.')
    try:
        start(_owner,session=session)
    except Exception:
        parameter=getattr(_owner.par,'Allowlan',None)
        if parameter is not None:parameter.val=previous
        start(_owner,session={**session,'lan':previous})
        raise
    parameter=getattr(_owner.par,'Allowlan',None)
    if parameter is not None and parameter.eval()!=enabled:parameter.val=enabled
    update_network_links()


def service_network():
    global _require_token
    # Read TD parameters on the main thread. The HTTP worker uses this snapshot.
    _require_token=requested_token_requirement(_owner)
    desired=requested_lan(_owner)
    if desired!=_lan_enabled:
        try:set_lan_enabled(desired)
        except Exception as exc:
            if getattr(_owner.par,'Allowlan',None) is not None:_owner.par.Allowlan.val=_lan_enabled
            if getattr(_owner.par,'Lanstatus',None) is not None:_owner.par.Lanstatus.val='Connection change failed: '+str(exc)
    elif _lan_enabled and time.monotonic()-_network_refresh>=10:
        update_network_links()


def tick():
    global _last_tick
    _last_tick=time.monotonic()
    service_network()
    service_family_startup()
    deferred=[]
    for _ in range(2):
        try: job=_queue.get_nowait()
        except queue.Empty: break
        with job['lock']:
            if job.get('canceled'): continue
            job['started']=True
        try:
            pending=job.get('previewFrame')
            if pending:
                if not pending.comp.valid or not pending.top.valid:
                    raise RuntimeError('The requested material preview no longer exists')
                # The first draw can still contain the native placeholder.
                # Read after two frame advances, including initial compilation.
                if int(absTime.frame)-pending.frame<2:raise pending
                if material_preview(pending.comp)!=pending.top:
                    raise RuntimeError('The material preview changed; refresh it again')
                job['result']=png(pending.comp)
            else:job['result']=process_request(*job['args'])
        except _PreviewFramePending as pending:
            job['previewFrame']=pending
            deferred.append(job)
            continue
        except Exception as exc:
            job['error']={'error':str(exc),**{key:getattr(exc,key,None) for key in ('node','functionId','stage','trail','diagnostics')}}
        job['done'].set()
    for job in deferred:
        with job['lock']:
            if job.get('canceled'):continue
            try:_queue.put_nowait(job)
            except queue.Full:
                job['error']={'error':'Preview queue is busy; refresh it again'}
                job['done'].set()

def stop():
    global _server,_worker
    if _server is not None:_server.accepting=False
    _server=None  # Worker closes its socket within its bounded receive loop.
    if _worker and _worker is not threading.current_thread(): _worker.join(1)

def refresh_assets(owner):
    global _assets,_remote_port
    _assets={'/':(owner.op('index_html').text.encode('utf-8'),'text/html; charset=utf-8'),
             '/app.js':(owner.op('app_js').text.encode('utf-8'),'text/javascript; charset=utf-8'),
             '/style.css':(owner.op('style_css').text.encode('utf-8'),'text/css; charset=utf-8'),
             '/locales.json':(owner.op('locales_json').text.encode('utf-8'),'application/json; charset=utf-8')}
    panel=owner.op('remote_panel')
    _remote_port=int(panel.par.Port.eval()) if panel else None
    if panel:
        for path,dat in [('/remote-panel.js','remote_panel_js'),('/touch-gestures.js','touch_gestures_js'),('/panel-size.js','panel_size_js')]:
            if panel.op(dat):_assets[path]=(panel.op(dat).text.encode('utf-8'),'text/javascript; charset=utf-8')
    if owner.op('web_icons_json'):
        for path, asset in json.loads(owner.op('web_icons_json').text).items():
            _assets[path]=(base64.b64decode(asset['base64']),asset['type'])
    if owner.op('favicon_svg'):
        _assets['/favicon.svg']=(owner.op('favicon_svg').text.encode('utf-8'),'image/svg+xml')
    if owner.op('inspector_js'):
        _assets['/inspector.js']=(owner.op('inspector_js').text.encode('utf-8'),'text/javascript; charset=utf-8')
    for name in ('functions_model','functions_ui','graph_ui','import_ui','qrcode','share_ui','select_ui','shortcuts_ui','selection_ui','frames_ui'):
        if owner.op(name+'_js'):
            _assets['/'+name+'.js']=(owner.op(name+'_js').text.encode('utf-8'),'text/javascript; charset=utf-8')

def local_viewer_request(peer, destination, host, headers, body):
    """Conservative environment boundary; a proxy cannot prove physical presence."""
    try:
        if not all(ipaddress.ip_address(address).is_loopback for address in (peer,destination)):
            return False
    except ValueError:
        return False
    if any(headers.get(name) is not None for name in ('Forwarded','X-Forwarded-For','X-Forwarded-Host','X-Forwarded-Proto')):
        return False
    # Keep the browser's actual origin in the body as well: the legacy proxy
    # rewrites Host/Origin, but does not turn a remote editor URL into a local one.
    origin='http://'+host
    return headers.get('Origin')==origin and body.get('editorOrigin')==origin


def start(owner,session=None):
    global _owner,_server,_token,_port,_last_tick,_worker,_lan_enabled,_require_token
    if _server: return url()
    ensure_network_controls(owner)
    _require_token=requested_token_requirement(owner)
    enabled=session.get('lan',requested_lan(owner)) if session else requested_lan(owner)
    _owner=owner; _token=session['token'] if session else secrets.token_urlsafe(32)
    if owner.fetch('sgrapeManager',False):
        if getattr(owner.par,'Version',None) is not None:owner.par.Version=PRODUCT_VERSION
        if not owner.fetch('sgrapeManagerId',None): owner.store('sgrapeManagerId',uuid.uuid4().hex)
        if not session or not session.get('rebind'):
            shaders()
            request_family_registration(force=False)
    else:
        desired=owner.fetch('targetName','sgrape_material')
        existing=owner.parent().op(desired)
        if existing and (not existing.fetch('sgrapeGenerated',False) or existing.fetch('sgrapeOwnerName',owner.name)!=owner.name):
            index=2
            while owner.parent().op('sgrape_material'+str(index)): index+=1
            owner.store('targetName','sgrape_material'+str(index))
        if not target():
            current=state()
            deploy(current['graph'],current['revision'])
    refresh_assets(owner)
    class Handler(http.server.BaseHTTPRequestHandler):
        def setup(self):
            self.request.settimeout(5)
            super().setup()
        def log_message(self,*args): pass
        def do_GET(self): self.handle_request()
        def do_POST(self): self.handle_request()
        def handle_request(self):
            if not self.server.accepting:return self.reply(503,{'error':'Editor connection is restarting'})
            # Match the actual local destination, not arbitrary client-supplied hosts.
            host=self.connection.getsockname()[0]+':'+str(self.server.server_port)
            if self.headers.get_all('Host',[])!=[host]:return self.reply(403,{'error':'Invalid host'})
            origins=self.headers.get_all('Origin',[])
            if origins and origins!=['http://'+host]:return self.reply(403,{'error':'Invalid origin'})
            if self.headers.get('Sec-Fetch-Site')=='cross-site':return self.reply(403,{'error':'Cross-site request rejected'})
            if self.headers.get('Transfer-Encoding'):return self.reply(400,{'error':'Unsupported transfer encoding'})
            if len(self.headers.get_all('Content-Length',[]))>1:return self.reply(400,{'error':'Invalid content length'})
            path=urllib.parse.urlsplit(self.path).path
            if self.command=='GET' and path.startswith('/shader/') and len(path.strip('/').split('/'))==2:
                path='/'
            if self.command=='GET' and path in _assets:
                value,mime=_assets[path]
                return self.reply(200,value,mime)
            supplied=self.headers.get('X-Sgrape-Token','')
            if _require_token and (not supplied or not supplied.isascii() or not secrets.compare_digest(supplied,_token)):
                return self.reply(401,{'error':'Open the editor from TouchDesigner to reconnect'})
            if self.command=='POST' and self.headers.get_content_type()!='application/json':
                return self.reply(415,{'error':'Write requests require application/json'})
            try:
                length=int(self.headers.get('Content-Length','0'))
                if length<0 or length>512000: return self.reply(413,{'error':'Request too large'})
                if self.command=='POST' and not length:return self.reply(400,{'error':'A JSON object is required'})
                body=json.loads(self.rfile.read(length)) if length else {}
                if not isinstance(body,dict):return self.reply(400,{'error':'A JSON object is required'})
            except Exception: return self.reply(400,{'error':'Invalid JSON'})
            if path.strip('/').split('/')[-1]=='native-viewer':
                if self.command!='POST' or not local_viewer_request(self.client_address[0],self.connection.getsockname()[0],host,self.headers,body):
                    return self.reply(403,{'error':'Open this Editor on the TouchDesigner computer to use its viewer.'})
            job={'args':(self.command,path,body),'lock':threading.Lock(),'done':threading.Event()}
            try: _queue.put_nowait(job)
            except queue.Full: return self.reply(503,{'error':'Editor busy'})
            if not job['done'].wait(15):
                with job['lock']: job['canceled']=True
                return self.reply(503,{'error':'TouchDesigner is paused or busy. Reload to check the result.'})
            if 'error' in job: return self.reply(422,job['error'])
            value=job['result']; return self.reply(200,value,'image/png' if isinstance(value,bytes) else None)
        def reply(self,status,value,mime=None):
            data=value if isinstance(value,bytes) else json.dumps(value,ensure_ascii=False,allow_nan=False).encode('utf-8')
            try:
                self.send_response(status); self.send_header('Content-Type',mime or 'application/json; charset=utf-8')
                self.send_header('Content-Length',str(len(data))); self.send_header('Cache-Control','no-store')
                self.send_header('X-Content-Type-Options','nosniff'); self.send_header('Referrer-Policy','no-referrer')
                # The socket destination was validated against Host above; no TD calls on this worker.
                remote=' ws://'+self.connection.getsockname()[0]+':'+str(_remote_port) if _remote_port else ''
                self.send_header('Content-Security-Policy',"default-src 'self'; connect-src 'self'"+remote+"; media-src 'self' blob:; img-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'")
                self.end_headers(); self.wfile.write(data)
            except (BrokenPipeError,ConnectionResetError): pass
    class LoopbackServer(http.server.ThreadingHTTPServer):
        # Windows SO_REUSEADDR can let two live instances bind the same port.
        allow_reuse_address=False
        def server_bind(self):
            if hasattr(socket,'SO_EXCLUSIVEADDRUSE'):
                self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
            super().server_bind()
    wanted=session['port'] if session else owner.fetch('serverPort',0)
    address='0.0.0.0' if enabled else '127.0.0.1'
    try: _server=LoopbackServer((address,wanted),Handler)
    except OSError:
        if session and session.get('strictPort'):raise
        _server=LoopbackServer((address,0),Handler)
    _server.accepting=True
    _lan_enabled=enabled
    _server.daemon_threads=True; _server.timeout=.5; _port=_server.server_port; _last_tick=time.monotonic()
    server=_server
    def serve():
        global _server
        try:
            while _server is server and time.monotonic()-_last_tick<30:
                server.handle_request()
        finally:
            server.server_close()
            if _server is server: _server=None
    _worker=threading.Thread(target=serve,daemon=True,name='TD-Sgrape HTTP'); _worker.start()
    owner.store('serverPort',_port)
    update_network_links()
    return url()

def url(shader=None,address='127.0.0.1'):
    route='shader/'+shader.fetch('sgrapeShaderId')+'/' if shader else ''
    return 'http://'+address+':'+str(_port)+'/'+route+'#'+str(_token)
