"""Portable, immutable personal Function snapshots. No TouchDesigner dependency."""
import copy
import json
import os
import re
import tempfile
from pathlib import Path

FORMAT='td-sgrape-function'
MAX_BYTES=256000
MAX_FILES=64
MAX_TOTAL_BYTES=4000000
SUFFIX='.sgrape-function.json'

def encode(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf-8')

def reachable(core,functions,root):
    found={f['id']:f for f in functions};seen=set();order=[]
    def visit(ident):
        if ident in seen:return
        if ident not in found:raise ValueError('Missing nested Function: '+str(ident))
        seen.add(ident);order.append(ident)
        for n in found[ident]['graph']['nodes']:
            if n['definitionUuid']==core.CALL:visit(n['params']['functionId'])
    visit(root)
    return order

def validate_functions(core,functions,root):
    probe=core.demo_graph('color');probe['declarations']=[];probe['functions']=functions
    checked=core._functions(probe)
    if root not in checked:raise ValueError('Missing root Function')
    if len(reachable(core,functions,root))!=len(functions):raise ValueError('Unrelated Function in personal snapshot')
    for f in functions:
        for n in f['graph']['nodes']:
            if n.get('definitionUuid') in ('sgrape.builtin.uniform','sgrape.builtin.texture','sgrape.builtin.sampler'):
                raise ValueError('Personal Functions must be self-contained. Place Uniform and Texture 2D outside the Function and pass their values through Function Input.')
    # This validates all definitions and each promised stage, including unused nodes.
    core.compile_graph(probe)

def build(core,graph,root):
    if not isinstance(graph,dict) or graph.get('schemaVersion')!=1:raise ValueError('Unsupported graph version')
    if len(encode(graph))>512000:raise ValueError('Graph exceeds 512 KB')
    checked=core._functions(graph)
    order=reachable(core,list(checked.values()),root)
    remap={ident:'fn'+str(i) for i,ident in enumerate(order)}
    definitions=[]
    for ident in order:
        original=checked[ident]
        # Only portable definition data is exported; source paths and Shader IDs stay out.
        f={key:copy.deepcopy(original[key]) for key in ('name','stages','inputs','outputs','graph')}
        f['id']=remap[ident];f['scope']='local'
        for n in f['graph']['nodes']:
            if n['definitionUuid']==core.CALL:n['params']['functionId']=remap[n['params']['functionId']]
        definitions.append(f)
    validate_functions(core,definitions,'fn0')
    payload={'format':FORMAT,'formatVersion':1,'root':'fn0','functions':definitions}
    packet={**payload,'contentHash':core.digest(payload)}
    if len(encode(packet))>MAX_BYTES:raise ValueError('Personal Function exceeds 256 KB')
    return packet

def validate(core,packet):
    if not isinstance(packet,dict) or packet.get('format')!=FORMAT or packet.get('formatVersion')!=1:
        raise ValueError('Unsupported personal Function format')
    if set(packet)!={'format','formatVersion','root','functions','contentHash'}:raise ValueError('Unexpected personal Function fields')
    if len(encode(packet))>MAX_BYTES:raise ValueError('Personal Function exceeds 256 KB')
    payload={key:value for key,value in packet.items() if key!='contentHash'}
    if core.digest(payload)!=packet['contentHash']:raise ValueError('Personal Function checksum mismatch')
    validate_functions(core,packet['functions'],packet['root'])
    return packet

def entry(core,packet):
    validate(core,packet)
    version=packet['contentHash'];defs=copy.deepcopy(packet['functions'])
    remap={f['id']:'personal_'+version[:24]+'_'+str(i) for i,f in enumerate(defs)}
    for f in defs:
        old=f['id'];f['id']=remap[old];f['scope']='personal'
        f['source']={'id':'sgrape.personal.'+version+'.'+old,'version':version}
        for n in f['graph']['nodes']:
            if n['definitionUuid']==core.CALL:n['params']['functionId']=remap[n['params']['functionId']]
    root=next(f for f in defs if f['id']==remap[packet['root']])
    root['dependencies']=[f for f in defs if f is not root]
    return root

def read(core,folder):
    folder=Path(folder);items=[];issues=[];total=0
    if not folder.exists():return {'items':items,'issues':issues,'folder':str(folder)}
    if not folder.is_dir():raise ValueError('Personal Folder must be a directory')
    paths=sorted(folder.glob('*'+SUFFIX),key=lambda p:p.name.casefold())
    if len(paths)>MAX_FILES:issues.append({'file':'','error':'Only the first 64 personal Function files are loaded.'})
    seen=set()
    for path in paths[:MAX_FILES]:
        try:
            if path.is_symlink() or path.resolve().parent!=folder.resolve():raise ValueError('Linked files outside Personal Folder are not loaded')
            if not path.is_file() or path.stat().st_size>MAX_BYTES:raise ValueError('Personal Function exceeds 256 KB or is not a file')
            total+=path.stat().st_size
            if total>MAX_TOTAL_BYTES:raise ValueError('Personal library exceeds 4 MB load limit')
            with path.open('rb') as handle:data=handle.read(MAX_BYTES+1)
            if len(data)>MAX_BYTES:raise ValueError('Personal Function exceeds 256 KB')
            packet=validate(core,json.loads(data))
            if packet['contentHash'] in seen:continue
            seen.add(packet['contentHash']);items.append(entry(core,packet))
        except Exception as exc:issues.append({'file':path.name,'error':str(exc)})
    return {'items':items,'issues':issues,'folder':str(folder)}

def save(core,folder,graph,root):
    packet=build(core,graph,root);data=encode(packet);folder=Path(folder)
    name=packet['contentHash']+SUFFIX
    folder.mkdir(parents=True,exist_ok=True);path=folder/name
    if path.exists():
        if path.is_symlink() or path.read_bytes()!=data:raise ValueError('A different file already occupies this snapshot name; it was preserved')
        return {'created':False,'file':name,'entry':entry(core,packet)}
    if len(list(folder.glob('*'+SUFFIX)))>=MAX_FILES:raise ValueError('Personal Folder contains 64 snapshots; choose another folder or organize existing files first')
    temp=None
    try:
        with tempfile.NamedTemporaryFile(prefix='.sgrape-',suffix='.tmp',dir=folder,delete=False) as handle:
            temp=Path(handle.name);handle.write(data);handle.flush();os.fsync(handle.fileno())
        # Atomic publish without overwriting another writer's existing snapshot.
        try:os.link(temp,path)
        except FileExistsError:
            if path.is_symlink() or path.read_bytes()!=data:raise ValueError('Snapshot name conflict; existing file was preserved')
            return {'created':False,'file':name,'entry':entry(core,packet)}
    finally:
        if temp is not None:temp.unlink(missing_ok=True)
    return {'created':True,'file':name,'entry':entry(core,packet)}
