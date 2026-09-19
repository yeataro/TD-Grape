"""Native Uniform gestures, conflicts and bounded per-update work."""
from pathlib import Path
import json, time, uuid

original = op('/TD_Grape/runtime').module
before = {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original._shaders.values() if s and s.valid}
assert not op('/grape_live_test')
root = op('/').create(baseCOMP, 'grape_live_test')
checks = []
try:
    manager = root.create(baseCOMP, 'manager')
    manager.store('sgrapeManager', True); manager.store('sgrapeManagerId', uuid.uuid4().hex)
    page = manager.appendCustomPage('Test'); page.appendStr('Updatestatus'); page.appendFolder('Personalfolder')
    manager.par.Personalfolder = str(Path(GRAPE_TEST_OUTPUT) / 'empty')
    for dat, name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():
        manager.create(textDAT, dat).text = source_path(name).read_text(encoding='utf-8')
    r = manager.op('runtime').module; r._owner = manager
    c = r.core(); m = r.source_module(); module = manager.op('live').module
    graph = c.normalize_top_sources(c.demo_graph('color', target='top'))[0]
    graph['declarations'] = [dict(id='u'+str(i), name='uValue'+str(i), kind='uniform', type='float', value=.25) for i in range(200)]
    shader = r.create_shader(root, 'Live', graph, 'top')
    with r.shader_context(shader): seen = r.process_shader_request('GET', '/api/sources', {})
    class Server:
        def __init__(self): self.messages=[]; self.closed=[]
        def webSocketSendText(self, client, text): self.messages.append((client,json.loads(text)))
        def webSocketClose(self, client): self.closed.append(client)
    server = Server(); live = module.Live(r, server, False)
    module.service = live
    live.tickets['ticket']=(time.monotonic()+10,shader)
    live.open('127.0.0.1:5000','/uniforms?ticket=ticket'); client='127.0.0.1:5000'
    assert server.messages[-1][1]['type']=='ready'
    live.open('127.0.0.1:5001','/uniforms?ticket=ticket'); assert '127.0.0.1:5001' in server.closed
    checks.append('authenticated, one-use tickets; replay rejected')
    def send(kind, **body):
        live.message(client,json.dumps(dict(type=kind,request=len(server.messages),**body)))
        return server.messages[-1][1]
    assert 'error' not in send('subscribe',source='u0')
    source=live.clients[client]['source']; p=source.pars[0]
    saved={n:shader.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if shader.op(n)}
    counts={'scan':0,'state':0,'compile':0,'undo':0}
    real_rows=m.native_rows; real_state=r.state; real_compile=c.compile_graph; real_record=r.record_parameter_undo
    def scan(*args,**kw): counts['scan']+=1; return real_rows(*args,**kw)
    def state(*args,**kw): counts['state']+=1; return real_state(*args,**kw)
    def compile(*args,**kw): counts['compile']+=1; return real_compile(*args,**kw)
    def record(*args,**kw): counts['undo']+=1
    m.native_rows=scan; r.state=state; c.compile_graph=compile; r.record_parameter_undo=record
    assert 'error' not in send('begin',source='u0',component=0,expected=source.values()[0])
    timings=[]
    for i in range(100):
        start=time.perf_counter(); answer=send('update',sequence=i,value=i/100); timings.append((time.perf_counter()-start)*1000)
        assert 'error' not in answer,answer
    answer=send('commit',sequence=100,value=.9);receipt=answer['receipt']
    assert p.eval()==.9 and counts=={'scan':0,'state':0,'compile':0,'undo':1},counts
    assert all(shader.op(n).text==text for n,text in saved.items())
    checks.append('200 sources, 100 updates: no inventory scan, graph read/write or compile; one Undo at commit')
    live.restore(shader,{'receipt':receipt,'undo':True});assert p.eval()==.25
    live.restore(shader,{'receipt':receipt,'undo':False});assert p.eval()==.9
    checks.append('browser Undo/Redo restores only the target value')
    send('begin',source='u0',component=0,expected=source.values()[0]);send('update',sequence=0,value=.5)
    send('cancel');assert p.eval()==.9 and counts['undo']==1
    checks.append('Escape restores initial value without an Undo step')
    send('begin',source='u0',component=0,expected=source.values()[0]);send('update',sequence=0,value=.6)
    p.val=.7;answer=send('update',sequence=1,value=.8)
    assert 'error' in answer and p.eval()==.7
    try:live.restore(shader,{'receipt':answer['receipt'],'undo':True});raise AssertionError('Overwrote outside change')
    except RuntimeError:pass
    checks.append('outside edit wins over both live updates and later Undo')
    send('begin',source='u0',component=0,expected=source.values()[0]);send('update',sequence=0,value=.8)
    live.close(client);assert p.eval()==.8 and not live.clients
    checks.append('disconnect retains last accepted value and closes the gesture')
    live.tickets['again']=(time.monotonic()+10,shader);live.open(client,'/uniforms?ticket=again')
    send('subscribe',source='u0');source=live.clients[client]['source']
    ident=uuid.uuid4().hex
    send('begin',source='u0',component=0,expected=source.values()[0],gesture=ident);send('update',sequence=0,value=.83)
    live.close(client)
    assert live.seal(shader,{'gesture':ident})['receipt']==ident
    live.restore(shader,{'receipt':ident,'undo':True});assert p.eval()==.8
    checks.append('lost commit/close receipt is recoverable by gesture identity without replaying values')
    page=shader.appendCustomPage('Live test');control=page.appendFloat('Livevalue')[0];control.val=.2
    helper=shader.create(textDAT,'parameter_links');helper.text=manager.op('parameter_links').text
    helper.module.bind(shader,'u0',[control])
    live.tickets['bound']=(time.monotonic()+10,shader);live.open(client,'/uniforms?ticket=bound')
    send('subscribe',source='u0');source=live.clients[client]['source'];binding=p.bindExpr
    answer=send('begin',source='u0',component=0,expected=source.values()[0]);assert 'error' not in answer,answer
    answer=send('commit',sequence=0,value=.42);assert 'error' not in answer,answer
    assert control.eval()==.42 and p.eval()==.42 and p.bindExpr==binding
    live.restore(shader,{'receipt':answer['receipt'],'undo':True});assert control.eval()==.2 and p.bindExpr==binding
    checks.append('owned Bind edits and Undo target the original COMP master; binding remains intact')
    send('begin',source='u0',component=0,expected=source.values()[0]);control.expr='0.5'
    answer=send('update',sequence=0,value=.9);assert 'error' in answer and control.expr=='0.5' and p.bindExpr==binding
    checks.append('a newly controlled master rejects the gesture without changing its Expression or Bind')
    live.next_poll=live.next_inventory=0;start=time.perf_counter();live.tick();inventory_ms=(time.perf_counter()-start)*1000
    assert any(message.get('type')=='values' for _,message in server.messages)
    result={'checks':checks,'updates':100,'meanMs':sum(timings)/len(timings),'maxMs':max(timings),'counts':counts}
    result['inventoryAndSelectedValuesMs']=inventory_ms
finally:
    root.destroy()
    assert all(op(path) and all(op(path).op(n).text==text for n,text in saved.items()) for path,saved in before.items())
