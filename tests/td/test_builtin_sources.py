"""Compile each catalog source in an isolated native host; no user shader writes."""
from pathlib import Path
import copy,json,uuid

w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/TD_Grape/runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original._shaders.values() if s and s.valid}
root=op('/').create(baseCOMP,'grape_builtin_sources_'+uuid.uuid4().hex[:8]);results=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    for target in ('top','mat'):
        shader=r.create_shader(root,'Sources_'+target,c.normalize_top_sources(c.demo_graph('color',target))[0],target)
        with r.shader_context(shader):
            for ident,spec in c.type_contract()['composites']['sources'].items():
                if target not in spec['targets']:continue
                for stage in spec['stages']:
                    g=c.normalize_top_sources(c.demo_graph('color',target))[0];unit=g['stages'][stage];source=c.node('builtin_source','source',source=ident)
                    nodes=[source];edges=[];ty=spec['type'];last='source'
                    if '[' in ty:
                        nodes.append(c.node('array_length','length',type=ty));edges.append(c.edge(last,'length','Array'));last='length';ty='int'
                    if ty in c.RESOURCE_TYPES:
                        size='textureSize(value, 0)' if ty!='samplerBuffer' else 'textureSize(value)'
                        body='colour = vec4(float('+size+('' if ty in ('sampler1D','samplerBuffer') else '.x')+'));'
                    elif ty in c.type_registry().structs:
                        first=c.type_registry().structs[ty]['fields'][0];nodes.append(c.node('struct_field','field',type=ty,field=first['id']));edges.append(c.edge(last,'field','value'));last='field';ty=first['type'];body='colour = vec4(1.0);'
                    else:body='colour = vec4(1.0);'
                    nodes.extend([c.node('glsl_code','observe',functionName='observe',inputs=[dict(id='value',name='value',type=ty)],outputs=[dict(id='colour',name='colour',type='vec4')],code=body),c.node(stage+'_out','result')])
                    edges.extend([c.edge(last,'observe','value'),c.edge('observe','result','color' if stage=='pixel' else 'position','colour')]);unit.update(nodes=nodes,edges=edges)
                    try:
                        compiled=c.compile_graph(g);shader.op(stage+'_shader').text=compiled[stage]
                        if target=='mat':r.validate_material(shader)
                        else:r.shader_operator(shader).cook(force=True);assert not r.shader_operator(shader).errors(),r.shader_operator(shader).errors()
                        result=dict(source=ident,target=target,stage=stage,ok=True)
                    except Exception as exc:result=dict(source=ident,target=target,stage=stage,ok=False,error=str(exc))
                    results.append(result)
                    base=c.compile_graph(c.normalize_top_sources(c.demo_graph('color',target))[0])
                    for st in ('pixel','vertex'):
                        if shader.op(st+'_shader') and st in base:shader.op(st+'_shader').text=base[st]
    after={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original._shaders.values() if s and s.valid}
    assert before==after
    (w/'results.json').write_text(json.dumps(dict(passed=all(r['ok'] for r in results),count=len(results),results=results,userShadersPreserved=len(before)),indent=2),encoding='utf-8')
    assert all(item['ok'] for item in results),[item for item in results if not item['ok']]
finally:root.destroy()
