"""Exercise the live validation route without applying or saving graph edits."""
import copy
import json
owner=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False))
runtime=owner.op('runtime').module
core=runtime.core()
assert core.CATALOG['generated_glsl']['inputs']=={} and core.CATALOG['generated_glsl']['outputs']=={}
records=[]
for key in ('top','mat','phong','pbr'):
    master=runtime.master_template(key)
    before={name:master.op(name).text for name in ('graph','state','manifest','pixel_shader','vertex_shader') if master.op(name)}
    with runtime.shader_context(master):
        graph=copy.deepcopy(runtime.checked_state()['graph'])
        baseline=runtime.process_shader_request('POST','/api/validate',{'graph':graph})
        for stage,data in graph['stages'].items():
            if not any(n.get('definitionUuid')=='sgrape.builtin.generated_glsl' for n in data['nodes']):
                ids={n['id'] for n in data['nodes']};ident='viewer_probe'
                while ident in ids:ident+='x'
                data['nodes'].append(core.node('generated_glsl',ident))
        shown=runtime.process_shader_request('POST','/api/validate',{'graph':graph})
        for field in ('vertex','pixel','hash','sourceMap','bindings','diagnostics'):assert shown[field]==baseline[field],(key,field)
        records.append({'master':key,'pixelChars':len(shown['pixel']),'vertexChars':len(shown.get('vertex') or ''),'unchanged':True})
    assert before=={name:master.op(name).text for name in before},'Live graph changed'
result={'version':runtime.PRODUCT_VERSION,'checks':records,'liveGraphsPreserved':True}
