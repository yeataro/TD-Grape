"""Compile every declared native-call signature against the installed TD headers.

Batch and bisect failures to avoid hundreds of unnecessary render cooks.
All fixtures are disposable; no existing Shader is updated.
"""
from pathlib import Path
import json,uuid,time
selection_path=Path(GRAPE_WORK)/'legacy-signature-selection.json'
selection=json.loads(selection_path.read_text(encoding='utf-8')) if selection_path.exists() else {'target':'mat','stage':'pixel','start':0,'count':8}
assert 1<=selection.get('count',8)<=12,'Use short TD jobs, at most twelve signatures'
progress_count=0
def mark(phase,**data):
    global progress_count
    progress_count+=1
    # Separate snapshots avoid racing a sync client opening the previous file.
    try:(Path(GRAPE_TEST_OUTPUT)/('progress-'+str(progress_count)+'.json')).write_text(json.dumps(dict(phase=phase,time=time.time(),**data)),encoding='utf-8')
    except OSError:pass
root=op('/').create(baseCOMP,'grape_signatures_'+uuid.uuid4().hex[:8])
failures=[];passed=[];batches=0
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder')
    manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();m=c._legacy_nodes
    if selection.get('unavailable'):
        m.CALLS.update(m.UNAVAILABLE);selection['keys']=list(m.UNAVAILABLE)
    kind=selection['target'];g=c.demo_graph('color',kind)
    if kind=='top':g=c.normalize_top_sources(g)[0]
    mark('create',target=kind)
    fixtures={kind:r.create_shader(root,kind,g,kind)}
    mark('created')
    baseline={kind:{stage:shader.op(stage+'_shader').text for stage in ('pixel','vertex') if shader.op(stage+'_shader')} for kind,shader in fixtures.items()}
    def source(cases,stage,kind):
        headers=['#include <'+name+'>' for name in selection.get('includeHeaders',[])];body=[]
        for index,(key,ty) in enumerate(cases):
            spec=m.CALLS[key];row=m.interface(key,ty);ident='test'+str(index);args={}
            for port,t in row['inputs'].items():
                if t in c.RESOURCE_TYPES:
                    name=ident+'_'+port;headers.append('uniform '+t+' '+name+';');args[port]=name
                else:
                    value=c.matrix_identity(t) if t in c.MATRIX_TYPES else c.filled_value(t,0 if port in ('component','offset','camera','light','instance') else 1)
                    args[port]=c.literal(value,t)
            symbols={(ident,p):ident+'_'+p for p in row['outputs']};lines=[];expressions={}
            value=m.emit(key,{'in':row['inputs'],'out':row['outputs']},args.__getitem__,symbols,lines,expressions,ident)
            if value is not None:lines.append('    '+row['outputs']['out']+' '+ident+'_value = '+value+';')
            body+=lines
        # Force one regular-light signature in the MAT validation render context.
        headers+=['// TD_NUM_LIGHTS'] if kind=='mat' else []
        if stage=='vertex':return '\n'.join(headers+['out vec2 sg_uv;','void main(){','sg_uv = TDTexCoord(0u).xy;']+body+['gl_Position = TDWorldToProj(TDDeform(TDPos()));','}'])
        headers+=['layout(location=0) out vec4 fragColor'+('[TD_NUM_COLOR_BUFFERS]' if kind=='mat' else '')+';']
        return '\n'.join(headers+['void main(){']+body+[('fragColor[0]' if kind=='mat' else 'fragColor')+'=vec4(1);','}'])
    def check(cases,stage,kind):
        global batches
        shader=fixtures[kind];batches+=1
        with r.shader_context(shader):
            for st,code in baseline[kind].items():shader.op(st+'_shader').text=code
            shader.op(stage+'_shader').text=source(cases,stage,kind)
            mark('compile',cases=cases,stage=stage,target=kind)
            try:r.validate_material(shader)
            except Exception as exc:
                if len(cases)>1:
                    middle=len(cases)//2;check(cases[:middle],stage,kind);check(cases[middle:],stage,kind)
                else:failures.append(dict(key=cases[0][0],type=cases[0][1],stage=stage,target=kind,error=str(exc),info=shader.op('compile_info').text))
            else:passed.extend(dict(key=k,type=t,stage=stage,target=kind) for k,t in cases)
            mark('compiled',passed=len(passed),failures=len(failures))
    stage=selection['stage']
    cases=[(key,ty) for key,spec in m.CALLS.items() if kind in spec['targets'] and stage in spec['stages'] for ty in spec['variants']]
    if selection.get('keys'):cases=[row for row in cases if row[0] in selection['keys']]
    start=selection.get('start',0);check(cases[start:start+selection.get('count',8)],stage,kind)
    result=dict(passed=len(passed),failures=failures,batches=batches,build=str(app.build))
    (Path(GRAPE_TEST_OUTPUT)/'results.json').write_text(json.dumps(dict(result,signatures=passed),indent=2),encoding='utf-8')
finally:
    try:root.destroy()
    finally:mark('done')
