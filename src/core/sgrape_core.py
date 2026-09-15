"""TD-Sgrape 0.4 graph schema and deterministic GLSL compiler. Python 3.11+."""
import copy
import hashlib
import json
import math
import re

VERSION = 1
TYPE_DESCRIPTORS = {
    'float': {'family': 'float', 'components': 1},
    'vec2': {'family': 'float', 'components': 2},
    'vec3': {'family': 'float', 'components': 3},
    'vec4': {'family': 'float', 'components': 4},
}
TYPES = tuple(TYPE_DESCRIPTORS)
RESOURCE_TYPES = ('sampler2D',)
PORT_TYPES = TYPES + RESOURCE_TYPES
CONVERSIONS = {(ty, ty): 'identity' for ty in TYPES}
CONVERSIONS.update({('float', ty): 'splat' for ty in TYPES if ty != 'float'})
CONVERSIONS[('sampler2D', 'sampler2D')] = 'identity'
ID = re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,63}$')
NAME = re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,47}$')

class GraphError(ValueError):
    def __init__(self, message, node=None):
        super().__init__(message)
        self.node = node

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()

def definition(key, label, inputs, outputs, stages=('vertex', 'pixel'), defaults=None, input_defaults=None):
    d = dict(key=key, label=label, inputs=inputs, outputs=outputs, stages=list(stages), defaults=defaults or {})
    if input_defaults is not None: d['inputDefaults']=input_defaults
    d['descriptionKey']='help.'+key
    d['definitionUuid'] = 'sgrape.builtin.' + key
    d['revisionHash'] = digest(d)
    return d

# Emitter IDs are an allowlist for Python implementations below, never eval'd GLSL.
EMITTER_IDS = frozenset(('float','vec2','vec3','color','add','multiply','mix','sin',
    'subtract','divide','min','max','clamp','smoothstep','abs','fract','pow','cos',
    'dot','length','normalize','rgba','split','uniform','uv','texture','position',
    'deform','to_clip','vertex_out','pixel_out','sampler','texture_sample','constant','top_input','glsl_code'))

def _definition_signature(d):
    # Presentation changes do not change port/default behavior.
    return {k:d.get(k) for k in ('key','definitionUuid','inputs','outputs','stages','defaults','inputDefaults')}

def validate_catalog(document):
    """Validate shipped data; no graph-provided archive or emitter is executed."""
    if not isinstance(document,dict) or type(document.get('schemaVersion')) is not int or document['schemaVersion']!=1:
        raise GraphError('Unsupported node catalog schema')
    for key,version in (('emitterAbiVersion',1),('targetShellVersion',2)):
        if type(document.get(key)) is not int or document[key]!=version:
            raise GraphError('Unsupported '+key)
    if not isinstance(document.get('catalogVersion'),str) or not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+',document['catalogVersion']):
        raise GraphError('Invalid catalog version')
    active=document.get('definitions');history=document.get('history')
    if not isinstance(active,list) or not active or not isinstance(history,list):raise GraphError('Invalid catalog entries')
    keys=set();identities=set();revisions=set();live={}
    for entries,is_active in ((active,True),(history,False)):
        for entry in entries:
            if not isinstance(entry,dict) or not isinstance(entry.get('definition'),dict):raise GraphError('Invalid catalog definition')
            d=entry['definition'];key=d.get('key');uid=d.get('definitionUuid');revision=d.get('revisionHash')
            if not isinstance(key,str) or key not in EMITTER_IDS or uid!='sgrape.builtin.'+key:
                raise GraphError('Unknown catalog identity')
            if revision!=digest({k:v for k,v in d.items() if k!='revisionHash'}):raise GraphError('Catalog definition fingerprint mismatch')
            if (uid,revision) in revisions:raise GraphError('Duplicate catalog revision')
            revisions.add((uid,revision))
            if not isinstance(d.get('stages'),list) or not d['stages'] or set(d['stages'])-{'vertex','pixel'}:raise GraphError('Invalid catalog stages')
            if not isinstance(d.get('defaults'),dict) or not isinstance(d.get('inputDefaults',{}),dict):raise GraphError('Invalid catalog defaults')
            for direction in ('inputs','outputs'):
                ports=d.get(direction)
                if not isinstance(ports,dict) or any(not ID.fullmatch(port) or ty not in (*PORT_TYPES,'T','D') for port,ty in ports.items()):raise GraphError('Invalid catalog ports')
            emitter=entry.get('emitter')
            if not isinstance(emitter,dict) or emitter.get('id')!=key or type(emitter.get('version')) is not int or emitter['version']!=1:
                raise GraphError('Unsupported catalog emitter')
            if is_active:
                if key in keys or uid in identities:raise GraphError('Duplicate active catalog identity')
                keys.add(key);identities.add(uid);live[uid]=entry
            else:
                current=live.get(uid)
                if current is None or _definition_signature(d)!=_definition_signature(current['definition']) or emitter!=current['emitter']:
                    raise GraphError('Historical behavior needs a separate supported emitter')
                if not isinstance(entry.get('observedIn'),list) or not entry['observedIn'] or any(not isinstance(tag,str) for tag in entry['observedIn']):
                    raise GraphError('Historical revision needs provenance')
    return copy.deepcopy(document)

def _load_catalog():
    if 'me' in globals():
        dat=me.parent().op('node_catalog')
        if dat is None:raise GraphError('Bundled node catalog is missing')
        raw=dat.text
    else:
        from pathlib import Path
        raw=(Path(__file__).resolve().parents[1]/'library'/'node_catalog.json').read_text(encoding='utf-8')
    return validate_catalog(json.loads(raw))

_CATALOG_DOCUMENT = _load_catalog()
CATALOG = {entry['definition']['key']:entry['definition'] for entry in _CATALOG_DOCUMENT['definitions']}
_EMITTERS = {entry['definition']['definitionUuid']:entry['emitter'] for entry in _CATALOG_DOCUMENT['definitions']}
_HISTORY = {(entry['definition']['definitionUuid'],entry['definition']['revisionHash']):entry for entry in _CATALOG_DOCUMENT['history']}

def catalog_contract():
    """Definition/content and emitter versions are separate from product version."""
    result={'schemaVersion':1,'catalogVersion':_CATALOG_DOCUMENT['catalogVersion'],
            'emitterAbiVersion':_CATALOG_DOCUMENT['emitterAbiVersion'],
            'targetShellVersion':_CATALOG_DOCUMENT['targetShellVersion'],
            'definitions':[{'definitionUuid':d['definitionUuid'],'revisionHash':d['revisionHash'],
                            'emitter':copy.deepcopy(_EMITTERS[d['definitionUuid']])}
                           for d in sorted(CATALOG.values(),key=lambda d:d['definitionUuid'])],
            'history':[{'definitionUuid':uid,'revisionHash':revision,'currentRevision':BY_UUID[uid]['revisionHash'],
                        'emitter':copy.deepcopy(row['emitter']),'observedIn':list(row['observedIn'])}
                       for (uid,revision),row in sorted(_HISTORY.items())]}
    result['hash']=digest(result)
    return result

def inspect_definition_reference(node):
    uid=node.get('definitionUuid');revision=node.get('revisionHash')
    result={'definitionUuid':uid,'requestedRevision':revision}
    if uid in (CALL,FUNCTION_INPUT,FUNCTION_OUTPUT):return dict(result,status='function')
    definition=BY_UUID.get(uid) if isinstance(uid,str) else None
    if definition is None or uid=='sgrape.internal.relay':return dict(result,status='unresolved_definition')
    result.update(currentRevision=definition['revisionHash'],emitter=copy.deepcopy(_EMITTERS[uid]))
    if 'revisionHash' not in node:return dict(result,status='unversioned')
    if not isinstance(revision,str):return dict(result,status='unresolved_revision')
    if revision==definition['revisionHash']:return dict(result,status='exact')
    if (uid,revision) in _HISTORY:return dict(result,status='compatible_history')
    return dict(result,status='unresolved_revision')

def inspect_graph_definitions(graph):
    """Read-only provenance audit; this does not choose an upgrade policy."""
    if not isinstance(graph,dict):raise GraphError('Invalid Graph structure')
    graphs=[(stage,None,data) for stage,data in graph.get('stages',{}).items()]
    graphs.extend((None,f['id'],f['graph']) for f in graph.get('functions',[]))
    entries=[]
    for stage,function_id,data in graphs:
        for n in data['nodes']:
            entries.append(dict(inspect_definition_reference(n),node=n['id'],stage=stage,functionId=function_id))
    entries.sort(key=lambda row:(row['stage'] or '',row['functionId'] or '',row['node']))
    return {'schemaVersion':1,'catalogHash':catalog_contract()['hash'],'entries':entries,
            'hasUnresolved':any(row['status'].startswith('unresolved_') for row in entries)}

def emitter_id(definition):
    if definition['key']=='relay':return 'relay'
    return _EMITTERS[definition['definitionUuid']]['id']

BY_UUID = {d['definitionUuid']:d for d in CATALOG.values()}
BY_UUID['sgrape.internal.relay'] = definition('relay','Function value',{'value':'T'},{'out':'T'})
CALL='sgrape.function.call'
FUNCTION_INPUT='sgrape.function.input'
FUNCTION_OUTPUT='sgrape.function.output'

def conversion_kind(source, target):
    """The same finite conversion table is consumed by the compiler and UI."""
    return CONVERSIONS.get((source, target))

def convert_expression(value, source, target):
    kind = conversion_kind(source, target)
    if kind == 'identity': return value
    if kind == 'splat': return target + '(' + value + ')'
    raise GraphError(source + ' cannot connect to ' + target)

GLSL_CODE_MAX_PORTS = 16
GLSL_CODE_MAX_LENGTH = 16384
GLSL_CODE_RESERVED = frozenset("""attribute const uniform varying buffer shared coherent
volatile restrict readonly writeonly atomic_uint layout centroid flat smooth noperspective
patch sample break continue do for while switch case default if else subroutine in out
inout float double int void bool true false invariant precise discard return mat2 mat3
mat4 dmat2 dmat3 dmat4 vec2 vec3 vec4 ivec2 ivec3 ivec4 bvec2 bvec3 bvec4 dvec2 dvec3
dvec4 uint uvec2 uvec3 uvec4 lowp mediump highp precision struct common partition active
asm class union enum typedef template this resource goto inline noinline public static
extern external interface long short half fixed unsigned superp input output hvec2 hvec3
hvec4 fvec2 fvec3 fvec4 sampler3DRect filter sizeof cast namespace using row_major main""".split())

def glsl_code_name(value):
    return (isinstance(value,str) and bool(NAME.fullmatch(value)) and '__' not in value
            and not value.startswith(('gl_','TD','sTD','uTD','sg_'))
            and not re.match(r'(?:[iu]?sampler|[iu]?image|[d]?mat[234])',value)
            and value not in GLSL_CODE_RESERVED)

def glsl_code_interface(params):
    if not isinstance(params,dict):raise GraphError('GLSL Code: invalid parameters')
    if not glsl_code_name(params.get('functionName')):
        raise GraphError('GLSL Code: use a non-reserved GLSL function name (up to 48 characters)')
    names={params['functionName']}; ids=set(); result={}
    for direction in ('inputs','outputs'):
        ports=params.get(direction)
        if not isinstance(ports,list) or not (0 if direction=='inputs' else 1)<=len(ports)<=GLSL_CODE_MAX_PORTS:
            raise GraphError('GLSL Code: up to 16 inputs and 1–16 outputs are supported')
        result[direction]={}
        for port in ports:
            if not isinstance(port,dict):raise GraphError('GLSL Code: invalid port')
            ident=port.get('id'); name=port.get('name'); ty=port.get('type')
            if not isinstance(ident,str) or not ID.fullmatch(ident) or ident in ids:
                raise GraphError('GLSL Code: invalid or duplicate port ID')
            if not glsl_code_name(name) or name in names:
                raise GraphError('GLSL Code: port names must be unique, non-reserved GLSL identifiers')
            if ty not in (PORT_TYPES if direction=='inputs' else TYPES):
                raise GraphError('GLSL Code: unsupported port type; samplers can only be inputs')
            ids.add(ident); names.add(name); result[direction][ident]=ty
    return result

def glsl_code_body(params):
    """Keep handwritten statements inside their generated function boundary.

    This is a boundary check, not a GLSL parser or GPU sandbox. TD still checks
    expressions, overloads and stage-specific operations with its native compiler.
    """
    body=params.get('code')
    if not isinstance(body,str) or len(body)>GLSL_CODE_MAX_LENGTH:
        raise GraphError('GLSL Code: function body must be text of at most 16384 characters')
    body=body.replace('\r\n','\n').replace('\r','\n')
    if any(ord(ch)<32 and ch not in '\t\n' for ch in body) or '\\' in body:
        raise GraphError('GLSL Code: control characters and line continuations are not supported')
    depth=0; comment=None; index=0
    while index<len(body):
        pair=body[index:index+2]; ch=body[index]
        if comment=='line':
            if ch=='\n':comment=None
        elif comment=='block':
            if pair=='*/':comment=None;index+=1
        elif pair=='//':comment='line';index+=1
        elif pair=='/*':comment='block';index+=1
        elif ch=='#':raise GraphError('GLSL Code: edit function statements only; preprocessor directives are not supported')
        elif ch=='{':depth+=1
        elif ch=='}':
            depth-=1
            if depth<0:raise GraphError('GLSL Code: the function boundary is generated; remove the extra closing brace')
        index+=1
    if depth or comment=='block':raise GraphError('GLSL Code: close the block or comment inside the function body')
    return body

# Pixel output slots are graph interfaces; Render TOP owns their allocation.
PIXEL_BUFFER_PORTS = ('color',) + tuple('buffer'+str(i) for i in range(1,8))

def pixel_buffer_count(params):
    if not isinstance(params,dict):raise GraphError('Invalid node parameters')
    count=params.get('bufferCount',1)
    if type(count) is not int or not 1<=count<=len(PIXEL_BUFFER_PORTS):
        raise GraphError('Color buffer count must be an integer from 1 to 8')
    return count

def definition_ports(definition, params):
    if definition['key']=='glsl_code':return glsl_code_interface(params)
    if definition['key']=='pixel_out':
        return {'inputs':dict.fromkeys(PIXEL_BUFFER_PORTS[:pixel_buffer_count(params)],'vec4'),'outputs':{}}
    return {kind:definition[kind] for kind in ('inputs','outputs')}

def resolved_ports(definition, params, declaration=None):
    selected = params.get('type', 'float')
    if selected not in (PORT_TYPES if definition['key']=='relay' else TYPES): raise GraphError('Unsupported numeric type')
    def resolve(token):
        if token == 'T': return selected
        if token == 'D':
            ty = declaration.get('type') if declaration else None
            if ty not in TYPES: raise GraphError('Select a matching declaration')
            return ty
        return token
    return {kind: {port: resolve(ty) for port, ty in definition_ports(definition, params)[kind].items()}
            for kind in ('inputs', 'outputs')}

def type_contract():
    """Versioned data for local, network-free UI connection and Create decisions.

    Definitions keep their existing revision hashes. This contract is derived
    from them; it contains no executable emitter or foreign archive content.
    """
    variants = {}
    for definition in CATALOG.values():
        tokens = set(definition['inputs'].values()) | set(definition['outputs'].values())
        selector = 'parameter' if 'T' in tokens else 'declaration' if 'D' in tokens else 'fixed'
        default = definition['defaults'].get('type', 'float')
        choices = [default] + [ty for ty in TYPES if ty != default] if selector != 'fixed' else [None]
        variants[definition['definitionUuid']] = {'selector': selector, 'variants': [
            dict(type=ty, **resolved_ports(definition, dict(definition['defaults'],type=ty or 'float'), {'type': ty})) for ty in choices]}
    result = {'version': 1, 'numericTypes': list(TYPES), 'resourceTypes': list(RESOURCE_TYPES),
              'types': dict(copy.deepcopy(TYPE_DESCRIPTORS), sampler2D={'family':'sampler','components':0}),
              'glslCode':{'maxPorts':GLSL_CODE_MAX_PORTS,'maxLength':GLSL_CODE_MAX_LENGTH,'reservedNames':sorted(GLSL_CODE_RESERVED)},
              'pixelBufferOutputs': {'parameter':'bufferCount','ports':list(PIXEL_BUFFER_PORTS),'type':'vec4'},
              'conversions': [{'from': a, 'to': b, 'kind': kind} for (a,b),kind in CONVERSIONS.items()],
              'definitions': variants}
    result['hash'] = digest(result)
    return result

def node(key, ident, x=0, y=0, **params):
    d=CATALOG[key]
    return dict(id=ident, definitionUuid=d['definitionUuid'], revisionHash=d['revisionHash'],
                params=copy.deepcopy(dict(d['defaults'], **params)), ui={'x':x,'y':y})

def edge(source, target, port, output='out'):
    return {'from':[source,output], 'to':[target,port]}

def graph_target(graph):
    kind=graph.get('target','mat')
    if kind not in ('mat','top'): raise GraphError('Unknown Shader target')
    return kind

def graph_stages(graph):
    return ('pixel',) if graph_target(graph)=='top' else ('vertex','pixel')

def demo_graph(preset='banana',target='mat'):
    v={'nodes':[node('position','position',60,120),node('deform','deform',300,120),
                node('to_clip','projection',540,120),node('vertex_out','vertex',780,120)],
       'edges':[edge('position','deform','position'),edge('deform','projection','world'),edge('projection','vertex','position')]}
    p={'nodes':[node('uv','uv',60,160),node('texture','texture',310,110),node('pixel_out','pixel',840,150)],
       'edges':[edge('uv','texture','uv'),edge('texture','pixel','color')]}
    if preset=='color':
        p={'nodes':[node('color','color',180,140),node('pixel_out','pixel',600,140)],'edges':[edge('color','pixel','color')]}
    elif preset=='tint':
        p['nodes'] += [node('color','tint',310,350,value=[0.7,0.3,1,1]),node('multiply','multiply',580,150)]
        p['edges']=[edge('uv','texture','uv'),edge('texture','multiply','a'),edge('tint','multiply','b'),edge('multiply','pixel','color')]
    elif preset!='banana': raise GraphError('Unknown example')
    result={'schemaVersion':VERSION,'declarations':[
        {'id':'texture_main','kind':'sampler','name':'uTexture','type':'sampler2D','source':'builtin:banana'}],
        'stages':{'vertex':v,'pixel':p}}
    if target=='top':
        result['target']='top';result['stages'].pop('vertex')
        result['declarations'][0]['source']='input:0'
    elif target!='mat': raise GraphError('Unknown Shader target')
    return result

def clean_semantic(graph):
    g=copy.deepcopy(graph)
    g.pop('catalogSnapshot',None)
    for s in g['stages'].values():
        s['nodes']=sorted([{k:v for k,v in n.items() if k not in ('ui','revisionHash')} for n in s['nodes']],key=lambda n:n['id'])
        s['edges']=sorted(s['edges'],key=lambda e:tuple(e['to']+e['from']))
    g['declarations']=sorted(g['declarations'],key=lambda d:d['id'])
    for f in g.get('functions',[]):
        f['graph']['nodes']=sorted([{k:v for k,v in n.items() if k not in ('ui','revisionHash')} for n in f['graph']['nodes']],key=lambda n:n['id'])
        f['graph']['edges']=sorted(f['graph']['edges'],key=lambda e:tuple(e['to']+e['from']))
    if 'functions' in g: g['functions'].sort(key=lambda f:f['id'])
    return g

def number(value):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
        raise GraphError('Expected a finite number')
    value=float(value)
    if abs(value)>1e20: raise GraphError('Number exceeds supported range')
    s=format(value,'.9g')
    return s if '.' in s or 'e' in s.lower() else s+'.0'

def type_components(ty):
    descriptor = TYPE_DESCRIPTORS.get(ty)
    if descriptor is None: raise GraphError('Unsupported numeric type: ' + str(ty))
    return descriptor['components']

def filled_value(ty, value=0):
    count = type_components(ty)
    return value if count == 1 else [value] * count

def literal(value, ty):
    if ty in RESOURCE_TYPES:
        if value is not None: raise GraphError('A sampler has no editable numeric default; connect a Sampler source')
        return None
    count = type_components(ty)
    if count == 1: return number(value)
    if not isinstance(value,list) or len(value)!=count: raise GraphError('Expected '+str(count)+' components')
    return ty+'('+', '.join(number(v) for v in value)+')'

def input_default(key,port,ty):
    if key in ('texture','texture_sample') and port=='uv': return None  # Implicit interpolated UV.
    if key=='vertex_out': return [0,0,0,1]
    if key=='pixel_out': return [0,0,0,1]
    value=CATALOG.get(key,{}).get('inputDefaults',{}).get(port,{'factor':.5,'alpha':1}.get(port,0))
    return filled_value(ty, value)

def texture_source_valid(source):
    return isinstance(source,str) and len(source)<=2048 and not any(ord(c)<32 for c in source) and (source in ('builtin:banana','builtin:white','builtin:black','builtin:jellybeans') or (source.startswith('op:/') and len(source)>4))


def _comment_lines(text, kind):
    """Line comments cannot close a block or introduce a preprocessor line.

    GLSL joins backslash-newline before removing comments, so a trailing
    backslash needs a visible terminating marker. Unicode line boundaries and
    control bytes from imported notes are normalized independently of names.
    """
    if not isinstance(text,str) or not text.strip(): return []
    result=[]
    for index,line in enumerate(text.splitlines()):
        line=''.join(c if ord(c)>=32 or c=='\t' else ' ' for c in line).replace('\x7f',' ')
        if line.rstrip().endswith('\\'):line+=' //'
        result.append('    // '+(kind+': ' if kind and index==0 else '')+line)
    return result


def _scope_comments(lines, owners, nodes, scopes, stage):
    ranges={}
    for index,ident in enumerate(owners):
        for scope in nodes[ident].get('_annotationScopes',[]):
            if scope not in ranges:ranges[scope]=[index,index]
            ranges[scope][1]=index
    before={};after={}
    for key,(first,last) in ranges.items():
        scope=scopes[key];before.setdefault(first,[]).append(scope);after.setdefault(last,[]).append(scope)
    result=[];locations=[]
    def notes(scope,field,kind):
        text=_comment_lines(scope.get(field),kind)
        result.extend(text)
        locations.extend([dict(scope['origin'],stage=stage,_originResolved=True)]*len(text))
    for index,(line,ident) in enumerate(zip(lines,owners)):
        for scope in sorted(before.get(index,[]),key=lambda s:s['depth']):notes(scope,'label',None)
        result.append(line);locations.append({'node':ident,'stage':stage,'trail':[]})
        for scope in sorted(after.get(index,[]),key=lambda s:-s['depth']):notes(scope,'comment','Comment')
    return result,locations


def normalize_top_sources(graph):
    """Migrate TOP sampler declarations to one ordered inventory, without TD writes.

    Slot IDs survive reordering. legacyKeys only reconnect existing public TOP
    parameters during migration; they are not additional image resources.
    """
    result=copy.deepcopy(graph)
    if graph_target(result)=='top' and result.get('topSourceVersion') not in (None,1):raise GraphError('Unsupported TOP source model version')
    if graph_target(result)!='top' or result.get('topSourceVersion')==1:return result,[]
    slots=result.setdefault('topInputs',[{'id':'input0','name':'Input 1','defaultSource':'builtin:banana','legacyKeys':['input:0']}]);changed_functions=[];mapping={}
    samplers=[d for d in result.get('declarations',[]) if d.get('kind')=='sampler']
    occupied={s['id'] for s in slots}
    legacy=result.get('topInputLegacyId') or (slots[0]['id'] if slots else None)
    for decl in samplers:
        key='input:0' if decl.get('source')=='input:0' else decl['id']
        slot=next((s for s in slots if s['id']==legacy),None) if key=='input:0' else None
        if slot is None:
            ident='input0' if key=='input:0' else 'input_'+digest(['topSource',decl['id']])[:20]
            while ident in occupied:ident+='x'
            occupied.add(ident)
            slot={'id':ident,'name':decl['name'],'defaultSource':decl.get('defaultSource','builtin:banana') if key=='input:0' else decl['source']}
            slots.append(slot)
            if key=='input:0':legacy=ident
        slot.setdefault('legacyKeys',[])
        if key=='input:0' and 'topInputs' not in graph:slot['defaultSource']=decl.get('defaultSource','builtin:banana')
        if key not in slot['legacyKeys']:slot['legacyKeys'].append(key)
        if decl.get('expose'):
            slot['expose']=True;slot['exposeName']=decl.get('exposeName') or decl['name']
        mapping[decl['id']]=slot['id']
    for index,slot in enumerate(slots):
        if slot.get('name')!='sTD2DInputs['+str(index)+']':slot.setdefault('label',slot.get('name',''))
        slot['name']='sTD2DInputs['+str(index)+']';slot['matchDefault']=True
    for owner,data in [(None,s) for s in result['stages'].values()]+[(f['id'],f['graph']) for f in result.get('functions',[])]:
        for n in list(data['nodes']):
            p=n.get('params',{});definition=BY_UUID.get(n.get('definitionUuid'),{})
            if definition.get('key') not in ('sampler','texture') or p.get('declarationId') not in mapping:continue
            p['inputId']=mapping[p.pop('declarationId')]
            if definition['key']=='sampler':
                n['definitionUuid']=CATALOG['top_input']['definitionUuid'];n['revisionHash']=CATALOG['top_input']['revisionHash']
            else:
                # Keep the original sample node and its UV/output connections.
                source=next((s for s in data['nodes'] if s.get('definitionUuid')==CATALOG['top_input']['definitionUuid'] and s.get('params',{}).get('inputId')==p['inputId']),None)
                if source is None:
                    ident='source_'+digest([n['id'],p['inputId']])[:20]
                    while any(s['id']==ident for s in data['nodes']):ident+='x'
                    source=node('top_input',ident,inputId=p['inputId'])
                    source['ui']={'x':n.get('ui',{}).get('x',0)-288,'y':n.get('ui',{}).get('y',0)+168}
                    data['nodes'].append(source)
                n['definitionUuid']=CATALOG['texture_sample']['definitionUuid'];n['revisionHash']=CATALOG['texture_sample']['revisionHash']
                p.pop('inputId');data['edges'].append(edge(source['id'],n['id'],'sampler'))
            if owner and owner not in changed_functions:changed_functions.append(owner)
    result['declarations']=[d for d in result['declarations'] if d.get('kind')!='sampler']
    result.pop('topInputLegacyId',None);result['topSourceVersion']=1
    top_input_slots(result)
    return result,changed_functions


def top_input_slots(graph):
    """Optional managed COMP inputs. Absence preserves legacy source ordering."""
    slots=graph.get('topInputs')
    if graph.get('topSourceVersion')==1 and slots is None:raise GraphError('The TOP source inventory is missing')
    if slots is None:return []
    if graph_target(graph)!='top':raise GraphError('TOP Inputs belong to Grape TOP only')
    if not isinstance(slots,list) or not 0<=len(slots)<=16:raise GraphError('Keep between 0 and 16 TOP Inputs')
    seen=set()
    for slot in slots:
        if not isinstance(slot,dict) or not ID.fullmatch(str(slot.get('id',''))) or slot['id'] in seen:raise GraphError('Invalid or duplicate TOP Input identity')
        seen.add(slot['id'])
        name=slot.get('name')
        if not isinstance(name,str) or not 1<=len(name)<=48 or any(ord(c)<32 for c in name):raise GraphError('TOP Input name must contain 1–48 plain text characters')
        if not texture_source_valid(slot.get('defaultSource')):raise GraphError('Choose a TOP Input default image or absolute TOP path')
        if not isinstance(slot.get('expose',False),bool):raise GraphError('Expose must be a boolean')
        label=slot.get('exposeName','')
        if not isinstance(label,str) or len(label)>80 or any(ord(c)<32 for c in label):raise GraphError('Public texture label must be plain text up to 80 characters')
    if graph.get('topInputLegacyId') is not None and graph['topInputLegacyId'] not in seen:raise GraphError('The legacy TOP Input slot is still referenced')
    return slots


def _compile_flat(graph,annotation_scopes=None):
    if not isinstance(graph,dict) or graph.get('schemaVersion')!=VERSION:
        raise GraphError('Unsupported graph version; original data has been kept')
    # Internal annotation memberships do not consume the user's graph budget.
    sized=copy.deepcopy(graph)
    for data in sized.get('stages',{}).values():
        for item in data.get('nodes',[]):item.pop('_annotationScopes',None)
    if len(json.dumps(sized,allow_nan=False))>512000: raise GraphError('Graph exceeds 512 KB')
    if set(graph.get('stages',{}))!=set(graph_stages(graph)): raise GraphError('Shader stages do not match its target')
    slots=top_input_slots(graph)
    managed=graph.get('topSourceVersion')==1
    if managed and any(d.get('kind')=='sampler' for d in graph.get('declarations',[])):
        raise GraphError('Grape TOP texture sources belong in TOP Inputs; nodes reference an input ID')
    declarations={}; names=set()
    for d in graph.get('declarations',[]):
        if not isinstance(d,dict) or not ID.fullmatch(str(d.get('id',''))): raise GraphError('Invalid declaration ID')
        if d['id'] in declarations: raise GraphError('Duplicate declaration ID')
        name=d.get('name','')
        if not NAME.fullmatch(name) or name.startswith(('gl_','TD','sg_')) or name in names: raise GraphError('Invalid or duplicate declaration name')
        if d.get('id')=='grapeFallbackSampler': raise GraphError('Reserved fallback sampler identity')
        if d.get('kind')=='sampler':
            if d.get('type')!='sampler2D': raise GraphError('Only sampler2D is currently supported')
            if 'fallback' in d and d['fallback']!='opaque-black':raise GraphError('Unsupported sampler fallback')
            if not texture_source_valid(d.get('source')) and not (graph_target(graph)=='top' and d.get('source')=='input:0'):
                raise GraphError('Choose a built-in image or absolute TOP path')
            if 'defaultSource' in d and (d['source']!='input:0' or not texture_source_valid(d['defaultSource'])):
                raise GraphError('A default source belongs to TOP Input 1 and must be an image or absolute TOP path')
            if not isinstance(d.get('expose',False),bool):raise GraphError('Expose must be a boolean')
            label=d.get('exposeName','')
            if not isinstance(label,str) or len(label)>80 or any(ord(c)<32 for c in label):raise GraphError('Public texture label must be plain text up to 80 characters')
        elif d.get('kind')=='constant':
            if d.get('type') not in TYPES:raise GraphError('Unsupported constant type')
            literal(d.get('value'),d['type'])
            if d.get('initialDriver') or d.get('expose'):raise GraphError('Constants cannot have a live Uniform driver')
        elif d.get('kind')=='uniform':
            if d.get('type') not in TYPES: raise GraphError('Unsupported uniform type')
            if d.get('nativeSequence','vec') not in ('vec','color'):raise GraphError('Unsupported native Uniform page')
            if 'initialDriver' in d and d['initialDriver'] not in ('time','frame','absTime','absFrame'):raise GraphError('Unsupported initial Uniform driver')
            literal(d.get('value'), d['type'])
            if not isinstance(d.get('expose',False),bool): raise GraphError('Expose must be a boolean')
            label=d.get('exposeName','')
            if not isinstance(label,str) or len(label)>80 or any(ord(c)<32 for c in label):
                raise GraphError('Public Uniform label must be plain text up to 80 characters')
        else: raise GraphError('Unsupported declaration kind')
        if graph_target(graph)=='top' and name.startswith('sTD'): raise GraphError('Reserved TOP declaration name')
        declarations[d['id']]=d; names.add(name)
    input_specs={(d.get('defaultSource','builtin:banana'),d.get('expose',False),d.get('exposeName','') if d.get('expose') else '') for d in declarations.values() if d.get('source')=='input:0'}
    if len(input_specs)>1:raise GraphError('Samplers using Input 1 must share its default source and exposed parameter settings')
    slot_bindings=[]
    for index,slot in enumerate(slots):
        ident='grapeTop_'+slot['id']
        if ident in declarations:raise GraphError('Reserved TOP Input identity')
        binding={'id':ident,'kind':'sampler','name':'sg_topInput'+str(index),'type':'sampler2D',
                 'source':'input:'+str(index),'topInputId':slot['id'],'defaultSource':slot['defaultSource'],
                 'fallback':'opaque-black','internal':True}
        declarations[ident]=binding;slot_bindings.append(ident)
    stages={}; used=set(slot_bindings); diagnostics=[]
    for stage in graph_stages(graph):
        try:
            data=graph['stages'][stage]
            if not isinstance(data,dict) or not isinstance(data.get('nodes'),list) or not isinstance(data.get('edges'),list): raise GraphError('Invalid stage data')
            if len(data['nodes'])>2048 or len(data['edges'])>8192: raise GraphError('Expanded graph is too large')
            nodes={}; defs={}; ports={}; links={}
            for n in data['nodes']:
                ident=n.get('id','')
                if not ID.fullmatch(ident) or ident in nodes: raise GraphError('Invalid or duplicate node ID',ident)
                d=BY_UUID.get(n.get('definitionUuid'))
                if not d or stage not in d['stages']: raise GraphError('Unknown node or wrong shader stage',ident)
                params=n.get('params')
                if not isinstance(params,dict): raise GraphError('Invalid node parameters',ident)
                ty=params.get('type','float')
                if ty not in (PORT_TYPES if d['key']=='relay' else TYPES): raise GraphError('Unsupported numeric type',ident)
                if d['key'] in ('float','vec2','vec3','color'):
                    literal(params.get('value'),next(iter(d['outputs'].values())))
                declaration=None
                if d['key'] in ('uniform','constant','texture','sampler'):
                    declaration=declarations.get('grapeTop_'+str(params['inputId'])) if managed and d['key']=='texture' and params.get('inputId') else declarations.get(params.get('declarationId'))
                    expected=d['key'] if d['key'] in ('uniform','constant') else 'sampler'
                    if not declaration or declaration['kind']!=expected: raise GraphError('Select a matching declaration',ident)
                if d['key']=='top_input' and not any(slot['id']==params.get('inputId') for slot in slots):
                    raise GraphError('Select an existing TOP Input',ident)
                if d['key']=='pixel_out' and graph_target(graph)=='top' and pixel_buffer_count(params)!=1:
                    raise GraphError('Multiple color buffers are currently supported for MAT only',ident)
                try:
                    resolved = resolved_ports(d, params, declaration)
                    if d['key']=='glsl_code':glsl_code_body(params)
                except GraphError as exc:raise GraphError(str(exc),ident) from exc
                ports[ident]={'in':resolved['inputs'], 'out':resolved['outputs']}
                values=n.get('inputValues',{})
                if not isinstance(values,dict) or any(port not in ports[ident]['in'] for port in values):
                    raise GraphError('Invalid input default values',ident)
                for port,value in values.items():
                    try: literal(value,ports[ident]['in'][port])
                    except GraphError as exc: raise GraphError(str(exc),ident) from exc
                nodes[ident]=n; defs[ident]=d
            outputs=[i for i,d in defs.items() if d['key']==stage+'_out']
            if len(outputs)!=1: raise GraphError('Exactly one '+stage+' output is required')
            for e in data['edges']:
                try: src,sp=e['from']; dst,dp=e['to']
                except (KeyError,ValueError,TypeError): raise GraphError('Invalid connection')
                if src not in ports or sp not in ports[src]['out'] or dst not in ports or dp not in ports[dst]['in']: raise GraphError('Connection endpoint no longer exists',dst)
                if (dst,dp) in links: raise GraphError('An input can only have one connection',dst)
                a=ports[src]['out'][sp]; b=ports[dst]['in'][dp]
                if conversion_kind(a,b) is None: raise GraphError(a+' cannot connect to '+b,dst)
                links[(dst,dp)]=(src,sp)
            visited=set(); active=set(); order=[]
            def visit(ident):
                if ident in active: raise GraphError('Cycle detected',ident)
                if ident in visited: return
                active.add(ident)
                for port in sorted(ports[ident]['in']):
                    source=links.get((ident,port))
                    if source: visit(source[0])
                active.remove(ident); visited.add(ident); order.append(ident)
            # Reject cycles even in disconnected edits. Only live nodes are emitted.
            for ident in sorted(nodes): visit(ident)
            visited.clear(); order.clear(); visit(outputs[0])
            live=set(order)
            for ident in sorted(set(nodes)-live): diagnostics.append({'node':ident,'stage':stage,'message':'Disconnected node is not emitted'})
            expressions={}; lines=[]; line_nodes=[]; helpers=[]; helper_nodes=[]
            def inp(ident,port):
                target=ports[ident]['in'][port]; source=links.get((ident,port))
                if source:
                    val=expressions[source]
                    return convert_expression(val, ports[source[0]]['out'][source[1]], target)
                if target in RESOURCE_TYPES:
                    if managed:
                        diagnostics.append({'node':ident,'stage':stage,'message':'Sampler input is unconnected; sampling returns opaque black without allocating a TOP Input'})
                        return 'sg_unconnectedSampler'
                    # One defined fallback binding per Shader, even through nested interfaces.
                    fallback={'id':'grapeFallbackSampler','kind':'sampler','name':'sg_fallbackTexture',
                              'type':'sampler2D','source':'builtin:black','fallback':'opaque-black','internal':True}
                    if fallback['id'] in declarations and declarations[fallback['id']]!=fallback:
                        raise GraphError('Reserved fallback sampler identity',ident)
                    declarations[fallback['id']]=fallback; used.add(fallback['id'])
                    diagnostics.append({'node':ident,'stage':stage,'message':'Sampler input is unconnected; using opaque black'})
                    return 'sg_sampler_'+fallback['id'] if graph_target(graph)=='top' else fallback['name']
                saved=nodes[ident].get('inputValues',{})
                if port in saved: return literal(saved[port],target)
                default=([0,0,0,0] if defs[ident]['key']=='pixel_out' and graph_target(graph)=='mat'
                         else input_default(defs[ident]['key'],port,target))
                if default is None: return 'sg_uv'
                return literal(default,target)
            for ident in order:
                line_start=len(lines)
                note=nodes[ident].get('ui',{});note=note if isinstance(note,dict) else {}
                d=defs[ident]; k=emitter_id(d); p=nodes[ident]['params']; ty=ports[ident]['out'].get('out'); expr=None
                a=lambda port:inp(ident,port)
                if k in ('float','vec2','vec3','color'): expr=literal(p.get('value'),ty)
                elif k in ('add','subtract','multiply','divide'): expr='('+a('a')+{'add':' + ','subtract':' - ','multiply':' * ','divide':' / '}[k]+a('b')+')'
                elif k in ('min','max','dot'): expr=k+'('+a('a')+', '+a('b')+')'
                elif k=='clamp': expr='clamp('+a('value')+', '+a('min')+', '+a('max')+')'
                elif k=='smoothstep': expr='smoothstep('+a('edge0')+', '+a('edge1')+', '+a('value')+')'
                elif k=='pow': expr='pow('+a('base')+', '+a('exponent')+')'
                elif k=='mix': expr='mix('+a('a')+', '+a('b')+', '+a('factor')+')'
                elif k in ('sin','cos','abs','fract','length','normalize'): expr=k+'('+a('value')+')'
                elif k=='relay': expr=a('value')
                elif k=='rgba': expr='vec4('+a('rgb')+', '+a('alpha')+')'
                elif k=='split':
                    for port in ports[ident]['out']: expressions[(ident,port)]='('+a('color')+').'+port
                elif k in ('uniform','constant','texture','sampler'):
                    decl=declarations['grapeTop_'+p['inputId']] if managed and k=='texture' and p.get('inputId') else declarations[p['declarationId']]; used.add(decl['id'])
                    symbol='sg_sampler_'+decl['id'] if graph_target(graph)=='top' and k not in ('uniform','constant') else decl['name']
                    expr='texture('+symbol+', '+a('uv')+')' if k=='texture' else symbol
                elif k=='top_input':
                    index=next(i for i,slot in enumerate(slots) if slot['id']==p['inputId'])
                    expr='sTD2DInputs['+str(index)+']'
                    expressions[(ident,'size')]='uTD2DInfos['+str(index)+'].res.zw'
                    expressions[(ident,'pixelSize')]='uTD2DInfos['+str(index)+'].res.xy'
                elif k=='texture_sample':
                    sampler=a('sampler')
                    expr='vec4(0.0, 0.0, 0.0, 1.0)' if sampler=='sg_unconnectedSampler' else 'texture('+sampler+', '+a('uv')+')'
                elif k=='glsl_code':
                    function='sg_code_'+ident+'_'+p['functionName']
                    signature=[('in' if direction=='inputs' else 'out')+' '+port['type']+' '+port['name']
                               for direction in ('inputs','outputs') for port in p[direction]]
                    body=glsl_code_body(p).split('\n')
                    block=['void '+function+'('+', '.join(signature)+') {']
                    block.extend('    '+port['name']+' = '+literal(filled_value(port['type']),port['type'])+';' for port in p['outputs'])
                    body_start=len(block)
                    block.extend('    '+line for line in body)
                    block.append('}')
                    helper_nodes.extend(dict(node=ident,stage=stage,trail=[],**({'codeLine':i-body_start+1} if body_start<=i<body_start+len(body) else {})) for i in range(len(block)))
                    helpers.extend(block)
                    arguments=[a(port['id']) for port in p['inputs']]
                    if 'sg_unconnectedSampler' in arguments:raise GraphError('Connect every GLSL Code sampler input to an existing TOP Input',ident)
                    for port in p['outputs']:
                        variable='sg_n_'+ident+'_'+port['id']
                        lines.append('    '+port['type']+' '+variable+';')
                        expressions[(ident,port['id'])]=variable;arguments.append(variable)
                    lines.append('    '+function+'('+', '.join(arguments)+');')
                elif k=='uv': expr='sg_uv'
                elif k=='position': expr='TDPos()'
                elif k=='deform': expr='TDDeform('+a('position')+')'
                elif k=='to_clip': expr='TDWorldToProj('+a('world')+')'
                elif k=='vertex_out': lines.append('    gl_Position = '+a('position')+';')
                elif k=='pixel_out':
                    if graph_target(graph)=='top':
                        lines.extend(['    vec4 sg_color = '+a('color')+';','    fragColor = TDOutputSwizzle(sg_color);'])
                    else:
                        # Native MAT previews and each Render TOP can allocate a different count.
                        # Initialize every allocated buffer, including slots beyond this graph.
                        lines.extend(['    for (int sg_buffer = 0; sg_buffer < TD_NUM_COLOR_BUFFERS; ++sg_buffer) {',
                                      '        fragColor[sg_buffer] = TDOutputSwizzle(vec4(0.0, 0.0, 0.0, 0.0));',
                                      '    }',
                                      '    vec4 sg_color = '+a('color')+';', '    TDAlphaTest(sg_color.a);'])
                        # Keep primary color dithering; an empty slot must remain exactly zero.
                        saved=nodes[ident].get('inputValues',{})
                        if (ident,'color') in links or any(saved.get('color',[])):
                            lines.append('    fragColor[0] = TDOutputSwizzle(TDDither(sg_color));')
                        for index,port in enumerate(PIXEL_BUFFER_PORTS[1:pixel_buffer_count(p)],1):
                            lines.extend(['#if TD_NUM_COLOR_BUFFERS > '+str(index),
                                          '    fragColor['+str(index)+'] = TDOutputSwizzle('+a(port)+');',
                                          '#endif'])
                if expr is not None and (ty in RESOURCE_TYPES or k=='constant'):
                    # Opaque GLSL samplers are references, never local variables.
                    expressions[(ident,'out')]=expr
                elif expr is not None:
                    variable='sg_n_'+ident
                    lines.append('    '+ty+' '+variable+' = '+expr+';')
                    expressions[(ident,'out')]=variable
                label_lines=_comment_lines(note.get('label'),None)
                if label_lines:
                    if len(lines)>line_start:
                        # The first emitted statement identifies this node; any
                        # extra imported Label lines remain inert line comments.
                        lines[line_start]+=' '+label_lines[0].lstrip()
                        lines[line_start+1:line_start+1]=label_lines[1:]
                    else:
                        # Inline expressions and opaque resources have no local
                        # statement. Keep their marker without inventing code.
                        lines.extend(label_lines)
                lines.extend(_comment_lines(note.get('comment'),'Comment'))
                line_nodes.extend([ident]*(len(lines)-line_start))
            lines,line_nodes=_scope_comments(lines,line_nodes,nodes,annotation_scopes or {},stage)
            stages[stage]={'lines':lines,'ports':ports,'live':sorted(live),'lineNodes':line_nodes,'helpers':helpers,'helperNodes':helper_nodes}
        except GraphError as exc:
            exc.stage=stage; raise
    aliases={i for i in used if slots and declarations[i].get('source')=='input:0' and not declarations[i].get('topInputId')}
    binding_ids=slot_bindings+sorted(used-set(slot_bindings)-aliases)
    def header(d):
        return ('const '+d['type']+' '+d['name']+' = '+literal(d['value'],d['type'])+';' if d['kind']=='constant'
                else 'uniform '+d['type']+' '+d['name']+';')
    if graph_target(graph)=='top':
        samplers=[declarations[i] for i in binding_ids if declarations[i]['kind']=='sampler']
        if len(samplers)>(32 if slots else 16): raise GraphError('Too many texture sources: up to 16 TOP Inputs plus 16 legacy/fallback sources')
        headers=[header(declarations[i]) for i in sorted(used) if declarations[i]['kind'] in ('uniform','constant')]
        if slots:headers+=['#if TD_NUM_2D_INPUTS != '+str(len(samplers)), '#error Grape TOP Inputs require 2D textures in every slot', '#endif']
        vertex=''
        pixel='\n'.join(headers+['layout(location=0) out vec4 fragColor;']+stages['pixel']['helpers']+['void main() {','    vec2 sg_uv = vUV.st;']+stages['pixel']['lines']+['}',''])
        for i,d in list(enumerate(samplers))+[(next((j for j,slot in enumerate(slots) if slot['id']==graph.get('topInputLegacyId')),0),declarations[ident]) for ident in aliases]:
            pixel='\n'.join(re.sub(r'\b'+re.escape('sg_sampler_'+d['id'])+r'\b','sTD2DInputs['+str(i)+']',code)+marker+comment for code,marker,comment in (line.partition('//') for line in pixel.split('\n')))
    else:
        headers=[header(declarations[i]) for i in sorted(used)]
        vertex='\n'.join(headers+['out vec2 sg_uv;']+stages['vertex']['helpers']+['void main() {','    sg_uv = TDTexCoord(0u).xy;']+stages['vertex']['lines']+['}',''])
        pixel='\n'.join(headers+['in vec2 sg_uv;','layout(location=0) out vec4 fragColor[TD_NUM_COLOR_BUFFERS];']+stages['pixel']['helpers']+[
                                 'void main() {','    TDCheckDiscard();']+stages['pixel']['lines']+['}',''])
    source_map={}
    for stage in graph_stages(graph):
        prefix=len(headers)+(3 if graph_target(graph)=='top' or stage=='vertex' else 4)
        helpers=stages[stage].pop('helpers');helper_nodes=stages[stage].pop('helperNodes')
        source_map[stage]=[dict(location,line=prefix-2+i+1) for i,location in enumerate(helper_nodes)]
        source_map[stage].extend(dict(location,line=prefix+len(helpers)+i+1) for i,location in enumerate(stages[stage].pop('lineNodes')))
    return {'sourceMap':source_map,'vertex':vertex,'pixel':pixel,'hash':digest(clean_semantic(graph)),
            'bindings':[declarations[i] for i in binding_ids],'stages':stages,'diagnostics':diagnostics}


def function_library(with_browser=False):
    """Versioned library snapshots. Shader edits never write to this source."""
    fn={'id':'library_tint_v1','name':'Tint','scope':'library','stages':['pixel','vertex'],
        'inputs':[{'id':'color','name':'Color','type':'vec4','default':[1,1,1,1]},
                  {'id':'tint','name':'Tint','type':'vec4','default':[.7,.3,1,1]}],
        'outputs':[{'id':'color','name':'Color','type':'vec4','default':[0,0,0,1]}],
        'graph':{'nodes':[
            {'id':'input','definitionUuid':FUNCTION_INPUT,'params':{},'ui':{'x':48,'y':144}},
            node('multiply','multiply',336,144,type='vec4'),
            {'id':'output','definitionUuid':FUNCTION_OUTPUT,'params':{},'ui':{'x':624,'y':144}}],
            'edges':[edge('input','multiply','a','color'),edge('input','multiply','b','tint'),edge('multiply','output','color')]}}
    fn['source']={'id':'sgrape.library.tint','version':digest(fn)}
    # Keep the original Tint snapshot byte-for-byte compatible with 0.2.
    def color_function(key,name,parameters,body,links,last):
        color={'id':'color','name':'Color','type':'vec4','default':[.5,.5,.5,1]}
        f={'id':'library_'+key+'_v1','name':name,'scope':'library','stages':['pixel','vertex'],
           'descriptionKey':'help.filter.'+key,'inputs':[color]+parameters,
           'outputs':[{'id':'color','name':'Color','type':'vec4','default':[0,0,0,1]}],
           'graph':{'nodes':[
               {'id':'input','definitionUuid':FUNCTION_INPUT,'params':{},'ui':{'x':48,'y':144}},
               node('split','split',288,144),*body,node('rgba','rgba',1200,144),
               {'id':'output','definitionUuid':FUNCTION_OUTPUT,'params':{},'ui':{'x':1440,'y':144}}],
               'edges':[edge('input','split','color','color'),*links,
                        edge(last,'rgba','rgb'),edge('split','rgba','alpha','a'),edge('rgba','output','color')]}}
        f['source']={'id':'sgrape.library.'+key,'version':digest(f)}
        return f
    def scalar(ident,name,value): return {'id':ident,'name':name,'type':'float','default':value}
    invert=node('subtract','invert',576,144,type='vec3');invert['inputValues']={'a':[1,1,1]}
    filters=[color_function('invert','Invert',[],[invert],[edge('split','invert','b','rgb')],'invert'),
             color_function('contrast','Contrast',[scalar('contrast','Contrast',1),scalar('pivot','Pivot',.5)],
                 [node('subtract','center',528,144,type='vec3'),node('multiply','scale',744,144,type='vec3'),node('add','restore',960,144,type='vec3')],
                 [edge('split','center','a','rgb'),edge('input','center','b','pivot'),edge('center','scale','a'),
                  edge('input','scale','b','contrast'),edge('scale','restore','a'),edge('input','restore','b','pivot')],'restore'),
             color_function('color_clamp','Color Clamp',[scalar('minimum','Minimum',0),scalar('maximum','Maximum',1)],
                 [node('clamp','limit',576,144,type='vec3')],
                 [edge('split','limit','value','rgb'),edge('input','limit','min','minimum'),edge('input','limit','max','maximum')],'limit')]
    result = [fn]+filters
    if with_browser:
        # Browser-only projection: default library snapshots and versions stay intact.
        for f in result:
            f['browser'] = {'category':'color','source':'editor','aliases':[],
                            'descriptionKey':f.get('descriptionKey','help.function')}
    return result


def _functions(graph):
    entries=graph.get('functions',[])
    if not isinstance(entries,list) or len(entries)>64: raise GraphError('At most 64 Function definitions are supported')
    functions={}
    for fn in entries:
        ident=fn.get('id','') if isinstance(fn,dict) else ''
        if not ID.fullmatch(ident) or ident in functions: raise GraphError('Invalid or duplicate Function ID')
        if fn.get('scope') not in ('local','library','personal'): raise GraphError('Invalid Function scope')
        if not isinstance(fn.get('name'),str) or not 1<=len(fn['name'])<=80: raise GraphError('Function name must contain 1–80 characters')
        if not isinstance(fn.get('stages'),list) or not fn['stages'] or set(fn['stages'])-{'vertex','pixel'}: raise GraphError('Invalid Function stages')
        for direction in ('inputs','outputs'):
            ports=fn.get(direction); seen=set()
            if not isinstance(ports,list) or len(ports)>16: raise GraphError('Function supports at most 16 ports per direction')
            for p in ports:
                if not isinstance(p,dict) or not ID.fullmatch(p.get('id','')) or p['id'] in seen: raise GraphError('Invalid or duplicate Function port')
                if p.get('type') not in PORT_TYPES: raise GraphError('Unsupported Function port type')
                literal(p.get('default'),p['type']); seen.add(p['id'])
        functions[ident]=fn
    active=set(); done=set()
    def visit(ident):
        if ident in active: raise GraphError('Function reference cycle: '+ident)
        if ident in done: return
        if ident not in functions: raise GraphError('Missing Function: '+ident)
        active.add(ident); fn=functions[ident]; data=fn.get('graph')
        if not isinstance(data,dict) or not isinstance(data.get('nodes'),list) or not isinstance(data.get('edges'),list): raise GraphError('Invalid Function graph')
        for n in data['nodes']:
            if n.get('definitionUuid')==CALL: visit(n.get('params',{}).get('functionId',''))
        active.remove(ident); done.add(ident)
    for ident in functions: visit(ident)
    return functions


def _expand(graph,functions):
    expanded=copy.deepcopy(graph); expanded.pop('functions',None)
    origins={};annotation_scopes={}
    for stage in graph_stages(graph):
        flat={'nodes':[],'edges':[]}; budget=[0]
        def scope_record(identity,n,path,node_id,depth):
            ui=n.get('ui',{});ui=ui if isinstance(ui,dict) else {}
            if not any(isinstance(ui.get(k),str) and ui[k].strip() for k in ('label','comment')):return None
            annotation_scopes[identity]={'label':ui.get('label'),'comment':ui.get('comment'),'depth':depth,
                'origin':{'node':node_id,'trail':[step[0] for step in path],**({'functionId':path[-1][0]} if path else {})}}
            return identity
        def add(n,path,scopes):
            budget[0]+=1
            if budget[0]>2048: raise GraphError('Expanded Function graph exceeds 2048 nodes')
            n['_annotationScopes']=list(scopes)
            flat['nodes'].append(n)
            if path: origins[(stage,n['id'])]={'node':path[-1][1],'functionId':path[-2][0] if len(path)>1 else None,'trail':[step[0] for step in path[:-1]]}
        def mapped(ident,path):
            return ident if not path else 'f'+digest([path,ident])[:40]
        def relay(ident,ty,value,path,scopes):
            add({'id':ident,'definitionUuid':'sgrape.internal.relay','params':{'type':ty},'inputValues':{'value':copy.deepcopy(value)}},path,scopes)
        def expand(data,path=(),boundary=None,scopes=()):
            try: expand_data(data,path,boundary,scopes)
            except GraphError as exc:
                if not hasattr(exc,'stage'): exc.stage=stage
                if path and not hasattr(exc,'functionId'):
                    exc.functionId=path[-1][0]; exc.trail=[step[0] for step in path]
                raise
        def expand_data(data,path=(),boundary=None,scopes=()):
            if not isinstance(data,dict) or not isinstance(data.get('nodes'),list) or not isinstance(data.get('edges'),list): raise GraphError('Invalid graph data')
            if len(data['nodes'])>256 or len(data['edges'])>1024: raise GraphError('Graph is too large')
            maps={}; kinds=[]
            for n in data['nodes']:
                ident=n.get('id',''); key=n.get('definitionUuid'); params=n.get('params')
                if not ID.fullmatch(ident) or ident in maps: raise GraphError('Invalid or duplicate node ID',ident)
                if not isinstance(params,dict): raise GraphError('Invalid node parameters',ident)
                if key in (FUNCTION_INPUT,FUNCTION_OUTPUT):
                    if boundary is None: raise GraphError('Function ports belong inside a Function',ident)
                    annotation=scope_record(digest([stage,path,'interface',ident]),n,path,ident,len(path)*2+1)
                    if annotation:
                        endpoints=boundary[0] if key==FUNCTION_INPUT else boundary[1]
                        for rid,port in endpoints.values():
                            target=next(x for x in flat['nodes'] if x['id']==rid)
                            target['_annotationScopes'].append(annotation)
                    kinds.append(key)
                    maps[ident]={'in':{},'out':boundary[0]} if key==FUNCTION_INPUT else {'in':boundary[1],'out':{}}
                    values=n.get('inputValues',{})
                    if not isinstance(values,dict) or set(values)-set(maps[ident]['in']): raise GraphError('Invalid Function port defaults',ident)
                    for port,value in values.items():
                        target=next(x for x in flat['nodes'] if x['id']==boundary[1][port][0])
                        literal(value,target['params']['type']); target['inputValues']['value']=copy.deepcopy(value)
                    continue
                if key==CALL:
                    fn=functions.get(params.get('functionId'))
                    if not fn or stage not in fn['stages']: raise GraphError('Missing Function or wrong shader stage',ident)
                    saved=n.get('inputValues',{})
                    if not isinstance(saved,dict) or set(saved)-{p['id'] for p in fn['inputs']}: raise GraphError('Invalid Function input values',ident)
                    inside=path+((fn['id'],ident),); ins={}; outs={}; local_in={}; local_out={}
                    annotation=scope_record(digest([stage,inside]),n,path,ident,len(path)*2)
                    nested_scopes=scopes+((annotation,) if annotation else ())
                    for direction in ('inputs','outputs'):
                        for p in fn[direction]:
                            value=saved.get(p['id'],p['default']) if direction=='inputs' else p['default']
                            literal(value,p['type'])
                            rid='f'+digest([inside,direction,p['id']])[:40]
                            relay(rid,p['type'],value,inside,nested_scopes)
                            if direction=='inputs': ins[p['id']]=[rid,'value']; local_in[p['id']]=[rid,'out']
                            else: outs[p['id']]=[rid,'out']; local_out[p['id']]=[rid,'value']
                    maps[ident]={'in':ins,'out':outs}
                    expand(fn['graph'],inside,(local_in,local_out),nested_scopes)
                else:
                    if key not in BY_UUID or key=='sgrape.internal.relay': raise GraphError('Unknown node',ident)
                    d=BY_UUID[key]
                    if boundary is not None and d['key'].endswith('_out'): raise GraphError('Use Function Output inside a Function',ident)
                    nid=mapped(ident,path); out=copy.deepcopy(n); out['id']=nid; add(out,path,scopes)
                    if path: origins[(stage,nid)]={'node':ident,'functionId':path[-1][0],'trail':[step[0] for step in path]}
                    try:templates=definition_ports(d,n.get('params',{}))
                    except GraphError as exc:
                        exc.node=ident;raise
                    maps[ident]={'in':{p:[nid,p] for p in templates['inputs']},'out':{p:[nid,p] for p in templates['outputs']}}
            if boundary is not None and (kinds.count(FUNCTION_INPUT)!=1 or kinds.count(FUNCTION_OUTPUT)!=1): raise GraphError('Exactly one Function Input and Output are required')
            for e in data['edges']:
                try:
                    src,sp=e['from']; dst,dp=e['to']
                    flat['edges'].append({'from':maps[src]['out'][sp],'to':maps[dst]['in'][dp]})
                except (KeyError,TypeError,ValueError): raise GraphError('Connection endpoint no longer exists')
        expand(graph['stages'][stage]); expanded['stages'][stage]=flat
    return expanded,origins,annotation_scopes


def compile_graph(graph):
    if not isinstance(graph,dict) or graph.get('schemaVersion')!=VERSION: raise GraphError('Unsupported graph version; original data has been kept')
    if len(json.dumps(graph,allow_nan=False))>512000: raise GraphError('Graph exceeds 512 KB')
    if set(graph.get('stages',{}))!=set(graph_stages(graph)): raise GraphError('Shader stages do not match its target')
    functions=_functions(graph)
    # Check unused definitions too, before any material is touched.
    for fn in functions.values():
        for stage in fn['stages']:
            probe=demo_graph('color',target=graph_target(graph) if stage=='pixel' else 'mat')
            probe['declarations']=copy.deepcopy(graph.get('declarations',[]))
            if graph_target(graph)=='top' and stage=='vertex':
                for decl in probe['declarations']:
                    if decl.get('source')=='input:0': decl['source']='builtin:banana'
            probe['stages'][stage]={'nodes':[node(stage+'_out','result'),{'id':'probe','definitionUuid':CALL,'params':{'functionId':fn['id']}}],'edges':[]}
            probe_origins={}
            try:
                flat,probe_origins,probe_annotations=_expand(probe,functions); _compile_flat(flat,probe_annotations)
            except GraphError as exc:
                origin=probe_origins.get((getattr(exc,'stage',stage),exc.node))
                if origin:
                    for key,value in origin.items(): setattr(exc,key,value)
                if not getattr(exc,'functionId',None): exc.functionId=fn['id']; exc.trail=[fn['id']]
                if not hasattr(exc,'stage'): exc.stage=stage
                raise
    expanded,origins,annotations=_expand(graph,functions)
    try: result=_compile_flat(expanded,annotations)
    except GraphError as exc:
        origin=origins.get((getattr(exc,'stage',None),exc.node))
        if origin:
            for key,value in origin.items(): setattr(exc,key,value)
        raise
    result['hash']=digest(clean_semantic(graph))
    for stage,rows in result['sourceMap'].items():
        for item in rows:
            if item.pop('_originResolved',False):continue
            origin=origins.get((stage,item['node']))
            if origin: item.update(origin)
    for item in result['diagnostics']:
        origin=origins.get((item['stage'],item['node']))
        if origin: item.update(origin)
    return result


def native_compile_diagnostics(info,compiled,source_paths):
    """Map only TD errors that identify a known source DAT and exact line.

    Unknown driver/link errors remain useful text, never guessed node locations.
    sourceMap is compiler-owned metadata; generated GLSL is unchanged.
    """
    rows=[]; seen=set()
    for text in info.splitlines():
        match=re.match(r'^ERROR:\s+(.+):(\d+):\s*(.*)$',text)
        if not match: continue
        path,line,message=match.groups();line=int(line)
        key=(path,line,message)
        if key in seen:continue
        seen.add(key);stage=next((stage for stage,value in source_paths.items() if value==path),None)
        row={'message':message,'line':line,'stage':stage}
        if stage:
            location=next((item for item in compiled.get('sourceMap',{}).get(stage,[]) if item['line']==line),None)
            if location:row.update(location)
        rows.append(row)
        if len(rows)>=32:break
    return rows
