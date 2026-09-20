"""Graph-owned struct construction, arrays, native compilation and failure isolation."""
from pathlib import Path
import copy,json,uuid
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/TD_Grape/runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original._shaders.values() if s and s.valid}
root=op('/').create(baseCOMP,'grape_color_palette_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    sources=manager.op('sources').module;history=manager.op('history').module
    for target in ('top','mat'):
        graph=c.normalize_top_sources(c.demo_graph('color',target))[0]
        graph['declarations'].append(dict(id='tint',kind='uniform',name='uTint',type='vec4',nativeSequence='color',value=[.1,.2,.3,.4]))
        shader=r.create_shader(root,'Color_'+target,graph,target)
        with r.shader_context(shader):
            native=r.shader_operator(shader)
            def row():return next(v for v in sources.snapshot(r)['uniforms'] if v['id']=='tint')
            def body(values):
                value=row();return dict(revision=r.state()['revision'],id='tint',components=[dict(component=i,value=v,expected=value['components'][i]) for i,v in enumerate(values)])
            before_graph=copy.deepcopy(r.state()['graph']);before_shader=shader.op('pixel_shader').text;before_token=history.capture(r)['token'];before_components=[i['value'] for i in row()['components']]
            with r.history_native_writes():result=r.process_shader_request('POST','/api/source-value',body([.7,.5,.2]))
            assert [i['value'] for i in row()['components']]==[.7,.5,.2,before_components[3]]
            assert r.state()['graph']==before_graph and shader.op('pixel_shader').text==before_shader
            after_token=history.capture(r)['token']
            with r.history_native_writes():history.restore(r,dict(requestId=uuid.uuid4().hex,revision=r.state()['revision'],fromToken=after_token,toToken=before_token,sourceIds=['tint'],currentGraph=before_graph,graph=before_graph))
            assert [i['value'] for i in row()['components']]==before_components
            checks.append(target+': one RGB request updates values, preserves Alpha and graph/GLSL, and Undo restores every component')
            stale=body([.8,.6,.4]);stale['components'][-1]['expected']['value']=123
            try:sources.write_value(r,stale);raise AssertionError('stale blue accepted')
            except sources.SourceError:pass
            assert [i['value'] for i in row()['components']]==before_components
            green=getattr(native.par,row()['components'][1]['parameter']);green.expr='.25';green.mode=ParMode.EXPRESSION
            try:sources.write_value(r,body([.8,.6,.4]));raise AssertionError('driven green accepted')
            except sources.SourceError:pass
            assert green.mode==ParMode.EXPRESSION and green.expr=='.25' and row()['components'][0]['value']==before_components[0]
            green.mode=ParMode.CONSTANT;green.val=before_components[1]
            checks.append(target+': stale or driven component rejects entire palette request without partial writes or mode changes')
            with r.history_native_writes():
                q=manager.op('parameters').module;seen=q.snapshot(r);q.edit(r,dict(action='page-create',name='Palette',revision=r.state()['revision'],expectedPages=seen['expectedPages']));seen=q.snapshot(r);source=row()
                q.edit(r,dict(action='bind',id='tint',page='Palette',revision=r.state()['revision'],expectedPages=seen['expectedPages'],sourceExpected=source['expected']))
                bound=row();assert all(i['writable'] and i['mode']=='BIND' for i in bound['components'])
                sources.write_value(r,body([.3,.6,.9]))
            assert [i['value'] for i in row()['components']][:3]==[.3,.6,.9] and all(i['mode']=='BIND' for i in row()['components'])
            checks.append(target+': existing managed Bind masters receive RGB while Bind and Alpha remain intact')
    after={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original._shaders.values() if s and s.valid}
    assert before==after
    result=dict(passed=True,checks=checks,userShadersPreserved=len(before));(w/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:root.destroy()
