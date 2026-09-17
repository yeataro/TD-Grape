"""Native Spec Constants source identity, values, compile and shared history."""
from pathlib import Path
import copy, json, uuid

w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=op('/TD_Grape/runtime').module
def saved():
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
            for s in original._shaders.values() if s and s.valid}
before_user=saved();checks=[]
assert not op('/grape_spec_test')
root=op('/').create(baseCOMP,'grape_spec_test')
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder')
    manager.par.Personalfolder=str(w/'empty_personal')
    mapping=json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    def api(method,name,body=None):
        with r.history_native_writes():return r.process_shader_request(method,'/api/'+name,body or {})
    def snap():return api('GET','sources')
    def item(data,ident):return next(x for x in data['specConstants'] if x['id']==ident)
    def par(ident):return getattr(r.shader_operator(r.target()).par,item(snap(),ident)['components'][0]['parameter'])
    def value(ident,new):
        data=snap();return api('POST','source-value',{'revision':data['revision'],'id':ident,'component':0,
            'expected':item(data,ident)['components'][0],'value':new})
    def edit(ident,action,**extra):
        data=snap();return api('POST','source-edit',{'revision':data['revision'],'id':ident,'action':action,
            'expected':item(data,ident)['expected'],**extra})
    def restore(current,target,ids,delta=None):
        body={'requestId':uuid.uuid4().hex,'revision':r.state()['revision'],'fromToken':current['history']['token'],
            'toToken':target['history']['token'],'sourceIds':ids,'graph':copy.deepcopy(target['graph']),
            'currentGraph':copy.deepcopy(current.get('workingGraph',current['graph']))}
        if delta:body.update(deltaFromToken=delta[0]['history']['token'],deltaToToken=delta[1]['history']['token'])
        return api('POST','history-restore',body)
    for kind in ('top','mat'):
        graph=c.normalize_top_sources(c.demo_graph('color',target=kind))[0]
        graph['declarations']=[{'id':'mode','kind':'spec_constant','name':'sMode','type':'int','value':1,'constantId':7,'nativeSequence':'const'},
                               {'id':'gain','kind':'uniform','name':'uGain','type':'float','value':.4}]
        graph['stages']['pixel']={'nodes':[c.node('spec_constant','mode',declarationId='mode'),c.node('pixel_out','output')],
                                   'edges':[{'from':['mode','out'],'to':['output','color']}]}
        shader=r.create_shader(root,'Spec_'+kind,graph,kind)
        with r.shader_context(shader):
            initial=snap();native=par('mode');code=shader.op('pixel_shader').text
            assert item(initial,'mode')['constantId']==7 and native.eval()==1
            assert 'layout(constant_id = 7) const int sMode = 1;' in code
            changed=value('mode',3);assert native.eval()==3 and shader.op('pixel_shader').text==code
            undone=restore(changed,initial,['mode']);assert native.isSamePar(par('mode')) and native.eval()==1
            redone=restore(undone,changed,['mode'],delta=(initial,changed));assert native.eval()==3
            checks.append(kind+': Spec current value changes and Undo/Redo edit one native Par, preserve generated source and constant ID')
            for ty,default,current in [('int',2,5),('uint',2,5),('bool',False,True),('float',.25,.75)]:
                g=copy.deepcopy(r.state()['graph']);d=next(d for d in g['declarations'] if d['id']=='mode');d.update(type=ty,value=default)
                assert r.deploy(g,r.state()['revision'])['ok']
                value('mode',current)
                assert abs(float(par('mode').eval())-float(current))<1e-6
                assert next(d for d in r.state()['graph']['declarations'] if d['id']=='mode')['constantId']==7
            checks.append(kind+': all supported scalar types compile and apply native values while retaining stable constant_id')
            applied=snap();native=par('mode');code=shader.op('pixel_shader').text
            invalid_type=copy.deepcopy(applied['graph']);next(d for d in invalid_type['declarations'] if d['id']=='mode').update(type='int',value=0)
            try:r.deploy(invalid_type,r.state()['revision']);raise AssertionError('Fractional current accepted as integer')
            except RuntimeError:pass
            assert native.eval()==.75 and shader.op('pixel_shader').text==code
            draft_target=dict(applied,graph=invalid_type)
            undone=restore(applied,draft_target,['mode'])
            assert undone['workingGraph']==invalid_type and native.isSamePar(par('mode')) and native.eval()==.75
            assert next(d for d in r.state()['graph']['declarations'] if d['id']=='mode')['type']=='float'
            redone=restore(undone,applied,['mode'])
            assert 'workingGraph' not in redone and native.eval()==.75 and shader.op('pixel_shader').text==code
            checks.append(kind+': Undo reaches a failed Spec type draft and Redo returns to the applied type without changing native value or shader')
            before_rename=snap();renamed=edit('mode','rename',name='sRenamed')
            assert item(renamed,'mode')['name']=='sRenamed' and item(renamed,'mode')['constantId']==7
            restored=restore(renamed,before_rename,['mode']);assert item(restored,'mode')['name']=='sMode'
            checks.append(kind+': rename and Undo preserve one source identity')
            before_remove=snap();removed=edit('mode','remove')
            assert item(removed,'mode')['missing']
            restored=restore(removed,before_remove,['mode']);assert not item(restored,'mode')['missing']
            assert item(restored,'mode')['constantId']==7 and abs(par('mode').eval()-.75)<1e-6
            checks.append(kind+': deleting a referenced source leaves a missing reference and Undo restores ID and live value')
            before_create=snap()
            created=api('POST','source-edit',{'revision':before_create['revision'],'kind':'spec_constant','action':'create','name':'sNew','type':'int'})
            new=next(x for x in created['specConstants'] if x['name']=='sNew');assert new['constantId']==0
            undone=restore(created,before_create,[new['id']]);assert not any(x['id']==new['id'] for x in undone['specConstants'])
            redone=restore(undone,created,[new['id']],delta=(before_create,created));assert item(redone,new['id'])['constantId']==0
            removed=edit(new['id'],'remove');assert not any(x['id']==new['id'] for x in removed['specConstants'])
            checks.append(kind+': create, Undo/Redo and unused deletion maintain inventory without ghost entries')
            g=copy.deepcopy(r.state()['graph']);d=next(d for d in g['declarations'] if d['id']=='mode');d.update(type='int',value=2)
            # The existing float value is fractional, so first set a valid
            # value through its present float declaration, then change type.
            value('mode',2.0);assert r.deploy(g,r.state()['revision'])['ok']
            native=par('mode');before=(native.eval(),shader.op('state').text,shader.op('pixel_shader').text)
            for invalid in [-1]+([16777217,2147483647] if kind=='mat' else []):
                try:value('mode',invalid);raise AssertionError('Unsafe native integer was accepted')
                except RuntimeError:pass
                assert before==(native.eval(),shader.op('state').text,shader.op('pixel_shader').text)
            value('mode',1073741824);assert native.eval()==1073741824
            checks.append(kind+': native integer transport guard rejects unsafe values without mutation and permits exact large float32 integers')
            before=(native.eval(),shader.op('state').text,shader.op('pixel_shader').text)
            invalid_graph=copy.deepcopy(r.state()['graph']);next(d for d in invalid_graph['declarations'] if d['id']=='mode')['value']=-1
            try:r.deploy(invalid_graph,r.state()['revision']);raise AssertionError('Unsafe native default was accepted')
            except RuntimeError:pass
            assert before==(native.eval(),shader.op('state').text,shader.op('pixel_shader').text)
            checks.append(kind+': invalid native default fails candidate validation before changing the source, state or shader')
            native.val=-1
            external=snap();assert item(external,'mode')['components'][0]['value']==-1
            assert any(issue.get('code')=='spec-native-value' and issue.get('id')=='mode' for issue in external['issues'])
            value('mode',2);assert native.eval()==2
            checks.append(kind+': invalid external TD value is reported without clamping and can be repaired through the same source')
        r._shaders.pop(shader.fetch('sgrapeShaderId'),None);shader.destroy()
    assert saved()==before_user
    result={'passed':True,'checks':checks,'existingShadersPreserved':True}
    (w/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
finally:root.destroy()
