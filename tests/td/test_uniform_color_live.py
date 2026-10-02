"""Disposable native grouped Color gestures; no registered user Shader writes."""
from pathlib import Path
from types import SimpleNamespace
import copy, json, uuid

original=op('/TD_Grape/runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original._shaders.values() if s and s.valid}
root=op('/').create(baseCOMP,'grape_grouped_color_test_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();m=r.source_module();module=manager.op('live').module
    callbacks=[]
    module.ui=SimpleNamespace(undo=SimpleNamespace(globalState=True,startBlock=lambda *a:None,endBlock=lambda:None,addCallback=lambda fn,data:callbacks.append((fn,data))))
    for target in ('top','mat'):
        graph=c.normalize_top_sources(c.demo_graph('color',target=target))[0] if target=='top' else c.demo_graph('color',target=target)
        graph['declarations']=[dict(id='tint',kind='uniform',name='uTint',type='vec4',nativeSequence='color',value=[.1,.2,.3,.4])]
        shader=r.create_shader(root,'Color_'+target,graph,target)
        with r.shader_context(shader):m.snapshot(r)
        saved={n:shader.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if shader.op(n)}
        messages=[];server=SimpleNamespace(webSocketSendText=lambda client,text:messages.append(json.loads(text)))
        live=module.Live(r,server,False);source=module.Source(live,shader,'tint')
        def session():return dict(comp=shader,identity=shader.id,sources={'tint':source},source=source,gesture=None,last={},seen=0)
        live.clients['one']=session()
        def send(kind,client='one',**body):
            live.message(client,json.dumps(dict(type=kind,request=len(messages),**body)))
            return messages[-1]
        def begin():
            reply=send('begin',source='tint',components=[0,1,2,3],expected=source.values());assert 'error' not in reply,reply
        def values():return [item['value'] for item in source.values()]
        initial=values();count=len(callbacks);begin()
        for i in range(100):
            reply=send('update',sequence=i,value=[i/100,.4,.5,.6]);assert 'error' not in reply,reply
        assert len(callbacks)==count
        final=[.91,.42,.53,.64];reply=send('commit',sequence=100,value=final);assert 'error' not in reply,reply
        assert len(callbacks)==count+1 and values()==final
        receipt=reply['receipt'];live.restore(shader,dict(receipt=receipt,undo=True));assert values()==initial
        live.restore(shader,dict(receipt=receipt,undo=False));assert values()==final
        callback,data=callbacks[-1];callback(True,data);assert values()==initial;callback(False,data);assert values()==final
        checks.append(target+': 100 grouped previews, one receipt/atomic Undo callback; browser/native callback restores all RGBA channels')
        begin();send('update',sequence=0,value=[.2,.3,.4,.5]);send('update',sequence=1,value=[.3,.4,.5,.6]);reply=send('cancel')
        assert reply['receipt'] is None and values()==final and len(callbacks)==count+1
        checks.append(target+': cancellation restores opening color without adding history')
        begin();send('update',sequence=0,value=[.7,.7,.7,.7]);source.pars[3].val=.25;outside=values();reply=send('cancel')
        assert values()==outside and reply['receipt']
        try:live.restore(shader,dict(receipt=reply['receipt'],undo=True));raise AssertionError('Overwrote external alpha')
        except RuntimeError:pass
        checks.append(target+': stale alpha blocks whole rollback/Undo; external value remains untouched')
        live.clients['two']=session();begin();reply=send('begin',client='two',source='tint',component=3,expected=source.values()[3]);assert 'error' in reply
        send('cancel');live.clients.pop('two')
        checks.append(target+': active grouped writer excludes scalar Alpha writer')
        page=shader.appendCustomPage('Color test');controls=list(page.appendRGBA('Testcolor'))
        for p,value in zip(controls,values()):p.val=value
        for native,control in zip(source.pars,controls):native.bindExpr='parent().par.'+control.name
        bindings=[p.bindExpr for p in source.pars];bound=values();begin();reply=send('commit',sequence=0,value=[.23,.34,.45,.56])
        assert 'error' not in reply and values()==[.23,.34,.45,.56],reply
        assert [p.bindExpr for p in source.pars]==bindings
        live.restore(shader,dict(receipt=reply['receipt'],undo=True));assert values()==bound
        begin();send('update',sequence=0,value=[.3,.4,.5,.6]);controls[2].expr='0.123';outside=values()
        reply=send('update',sequence=1,value=[.7,.8,.9,1]);assert 'error' in reply and values()==outside
        assert controls[2].expr=='0.123' and [p.bindExpr for p in source.pars]==bindings
        checks.append(target+': grouped writes target existing Bind masters; changed master Expression rejects the entire update')
        assert all(shader.op(n).text==text for n,text in saved.items())
    result=dict(passed=True,checks=checks,previews=200,userShadersPreserved=True)
finally:
    root.destroy()
    assert all(op(path) and all(op(path).op(n).text==text for n,text in saved.items()) for path,saved in before.items())
