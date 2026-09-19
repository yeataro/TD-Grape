"""Native scalar value request cost and graph isolation in disposable fixtures."""
from pathlib import Path
import copy, json, time, uuid
original=op('/TD_Grape/runtime').module
def live():return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original._shaders.values() if s and s.valid}
before=live();registry_before=dict(original._shaders)
assert not op('/grape_value_cost_test')
root=op('/').create(baseCOMP,'grape_value_cost_test');measurements=[];checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder')
    manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty_personal')
    mapping=json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat,name in mapping.items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();m=r.source_module()
    real_rows=m.native_rows;real_locate=m.locate;real_compile=c.compile_graph;real_write=r.write_state
    calls={}
    def rows(operator):
        values=real_rows(operator);calls['scans']=calls.get('scans',0)+1;calls['rows']=calls.get('rows',0)+len(values);return values
    def compile(graph):calls['compile']=calls.get('compile',0)+1;return real_compile(graph)
    def write(state):calls['stateWrites']=calls.get('stateWrites',0)+1;return real_write(state)
    def legacy_locate(operator,record,index=None):
        if not record or record.get('missing'):return None
        found=[row for row in m.native_rows(operator) if row['sequence']==record['sequence'] and row['name']==record['name']]
        return found[0] if len(found)==1 else None
    m.native_rows=rows;c.compile_graph=compile;r.write_state=write
    for count in (1,100,200):
        graph=c.normalize_top_sources(c.demo_graph('color',target='top'))[0]
        graph['declarations']=[dict(id='u'+str(i),name='uValue'+str(i),kind='uniform',type='float',value=.25) for i in range(count)]
        shader=r.create_shader(root,'Value'+str(count),graph,'top')
        with r.shader_context(shader):
            seen=r.process_shader_request('GET','/api/sources',{})
            saved={n:shader.op(n).text for n in ('state','graph','manifest','pixel_shader')}
            for indexed in (False,True):
                m.locate=real_locate if indexed else legacy_locate
                for i in range(2):
                    row=seen['uniforms'][0];value=.5 if row['components'][0]['value']!=.5 else .75
                    body=dict(id=row['id'],component=0,value=value,revision=seen['revision'],expected=row['components'][0])
                    calls.clear();start=time.perf_counter()
                    seen=r.process_shader_request('POST','/api/source-value',body)
                    elapsed=(time.perf_counter()-start)*1000
                    assert seen['uniforms'][0]['components'][0]['value']==value
                    assert all(shader.op(n).text==text for n,text in saved.items())
                    assert calls.get('compile',0)==0 and calls.get('stateWrites',0)==0,calls
                    if indexed:assert calls.get('scans',0)<=12,calls
                    measurements.append(dict(sources=count,indexed=indexed,ms=elapsed,**calls))
            try:r.process_shader_request('POST','/api/source-value',body);raise AssertionError('Stale value allowed')
            except RuntimeError as exc:assert 'changed' in str(exc)
            assert all(shader.op(n).text==text for n,text in saved.items())
            checks.append(str(count)+': value updates preserve every graph/shader DAT and revision; zero compile/state write; stale write rejected')
        m.locate=real_locate;shader.destroy()
    result=dict(checks=checks,measurements=measurements)
    Path(GRAPE_TEST_OUTPUT).mkdir(parents=True,exist_ok=True)
    (Path(GRAPE_TEST_OUTPUT)/'measurements.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:
    root.destroy()
    assert live()==before and original._shaders==registry_before
