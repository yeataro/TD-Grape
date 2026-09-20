"""Native Uniform gestures, conflicts and bounded per-update work."""
from pathlib import Path
import copy, json, time, uuid

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
        def parent(self): return manager
        def webSocketSendText(self, client, text): self.messages.append((client,json.loads(text)))
        def webSocketClose(self, client): self.closed.append(client)
    server = Server(); live = module.Live(r, server, False)
    r._live = live
    live.tickets['ticket']=(time.monotonic()+10,shader)
    # TD callbacks may run in a fresh DAT namespace, outside dat.module.
    callbacks = {}
    exec(compile(manager.op('live').text, 'fresh-live-callbacks', 'exec'), callbacks)
    callbacks['onWebSocketOpen'](server,'127.0.0.1:5000','/uniforms?ticket=ticket'); client='127.0.0.1:5000'
    assert server.messages[-1][1]['type']=='ready'
    live.open('127.0.0.1:5001','/uniforms?ticket=ticket'); assert '127.0.0.1:5001' in server.closed
    checks.append('authenticated, one-use tickets; replay rejected')
    checks.append('fresh callback namespace uses the HTTP runtime session and tickets')
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
    external=root.create(constantCHOP,'ExternalMaster');external.par.const0value=.31
    p.bindExpr="op('"+external.path+"').par.const0value";binding=p.bindExpr
    send('subscribe',source='u0');source=live.clients[client]['source']
    assert source.values()[0]['writable'] and source.values()[0]['mode']=='BIND'
    answer=send('begin',source='u0',component=0,expected=source.values()[0]);assert 'error' not in answer,answer
    answer=send('commit',sequence=0,value=.57);assert 'error' not in answer,answer
    assert abs(external.par.const0value.eval()-.57)<1e-6 and p.bindExpr==binding
    live.restore(shader,{'receipt':answer['receipt'],'undo':True});assert abs(external.par.const0value.eval()-.31)<1e-6 and p.bindExpr==binding
    send('begin',source='u0',component=0,expected=source.values()[0]);p.bindExpr='parent().par.Livevalue'
    answer=send('update',sequence=0,value=.9);assert 'error' in answer and abs(external.par.const0value.eval()-.31)<1e-6
    checks.append('external Bind master supports live edits and Undo; retargeting mid-gesture rejects further writes')
    live.next_poll=live.next_inventory=0;start=time.perf_counter();live.tick();inventory_ms=(time.perf_counter()-start)*1000
    assert any(message.get('type')=='values' for _,message in server.messages)
    old_counts=dict(counts)
    start=time.perf_counter()
    batch=send('subscribe',sources=['u'+str(i) for i in range(200)]+['u1','u1','missing'])
    subscribe_ms=(time.perf_counter()-start)*1000
    assert len(batch['values'])==200 and len(batch['unavailable'])==1,batch
    assert counts['state']==old_counts['state']+1 and counts['scan']==old_counts['scan'] and counts['compile']==old_counts['compile'],counts
    checks.append('200 unique visible sources plus duplicates: one graph read, no inventory scan, missing identity isolated')
    evaluations={};real_values=module.Source.values
    def values(source):evaluations[source.ident]=evaluations.get(source.ident,0)+1;return real_values(source)
    module.Source.values=values
    old_counts=dict(counts);server.messages.clear()
    native=r.shader_operator(shader);native.par.vec1valuex=.333;native.par.vec2valuex=.444
    live.next_poll=0;start=time.perf_counter();live.tick();multi_tick_ms=(time.perf_counter()-start)*1000
    assert len(evaluations)==200 and set(evaluations.values())=={1},evaluations
    assert counts==old_counts,counts
    pushed={msg['source']:msg for _,msg in server.messages if msg['type']=='values'}
    assert set(pushed)=={'u1','u2'},pushed
    assert all(shader.op(n).text==text for n,text in saved.items())
    checks.append('one evaluation per unique source per tick; only changed values sent; no graph read/write, compilation or inventory scan')
    smaller=send('subscribe',sources=['u2']);assert set(live.clients[client]['sources'])=={'u2'}
    source=live.clients[client]['sources']['u2']
    assert 'error' not in send('begin',source='u2',component=0,expected=source.values()[0])
    assert 'error' not in send('commit',sequence=0,value=.555)
    assert native.par.vec2valuex.eval()==.555
    checks.append('shrinking subscriptions stops removed sources and retained sources remain editable')
    module.Source.values=real_values
    # Layout saves advance the graph revision but must preserve live Par identities.
    bound=native.par.vec2valuex;bound.bindExpr="op('"+external.path+"').par.const0value"
    binding=bound.bindExpr;native_id=native.id
    with r.shader_context(shader):
        seen=m.snapshot(r)
        send('subscribe',sources=['u2']);source=live.clients[client]['sources']['u2']
        initial=bound.eval()
        assert 'error' not in send('begin',source='u2',component=0,expected=source.values()[0])
        assert 'error' not in send('update',sequence=0,value=.48)
        moved=copy.deepcopy(r.state()['graph']);ui=moved['stages']['pixel']['nodes'][0].setdefault('ui',{})
        ui.update(x=ui.get('x',0)+25,y=ui.get('y',0)+40,width=340,height=220)
        applied=r.deploy(moved,seen['revision'])
        assert applied['ok'] and applied['shaderUpdated'] is False,applied
        assert r.shader_operator(shader).id==native_id and bound.bindExpr==binding
        assert live.clients[client]['sources']['u2'] is source
        assert 'error' not in send('update',sequence=1,value=.61)
        committed=send('commit',sequence=2,value=.62);assert 'error' not in committed,committed
        assert abs(bound.eval()-.62)<1e-6 and bound.bindExpr==binding
        live.restore(shader,{'receipt':committed['receipt'],'undo':True});assert abs(bound.eval()-initial)<1e-6
        live.restore(shader,{'receipt':committed['receipt'],'undo':False});assert abs(bound.eval()-.62)<1e-6
        checks.append('layout position/size save preserves native identity and Bind; held live update/commit and value Undo/Redo remain valid')
        current=m.snapshot(r);item=next(row for row in current['uniforms'] if row['id']=='u2')['components'][0]
        request=dict(id='u2',component=0,value=.73,expected=item,revision=seen['revision'])
        try:m.write_value(r,request);raise AssertionError('Stale layout revision accepted')
        except RuntimeError:pass
        assert abs(bound.eval()-.62)<1e-6
        m.write_value(r,{**request,'revision':current['revision']})
        assert abs(bound.eval()-.73)<1e-6 and bound.bindExpr==binding
        assert r.state()['graph']==applied['state']['graph']
        checks.append('REST fallback rejects a pre-layout revision and accepts the acknowledged revision without altering binding or graph')
    result={'checks':checks,'updates':100,'meanMs':sum(timings)/len(timings),'maxMs':max(timings),'counts':counts}
    result['inventoryAndSelectedValuesMs']=inventory_ms
    result.update(multiSubscribeMs=subscribe_ms,multiTickMs=multi_tick_ms)
finally:
    root.destroy()
    assert all(op(path) and all(op(path).op(n).text==text for n,text in saved.items()) for path,saved in before.items())
