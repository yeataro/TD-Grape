from pathlib import Path
import copy,json,uuid
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)

original=op('/TD_Grape/runtime').module
def saved():return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original._shaders.values() if s and s.valid}
before=saved();assert not op('/grape_sources_test')
root=op('/').create(baseCOMP,'grape_sources_test');checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    mapping=json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();m=manager.op('sources').module
    for kind in ('mat','top'):
        gain_id='gain'
        graph=c.normalize_top_sources(c.demo_graph('color',target=kind))[0]
        graph['declarations']=[{'id':gain_id,'kind':'uniform','name':'uGain','type':'float','value':0.25}]
        shader=r.create_shader(root,'Test_'+kind,graph,kind);operator=r.shader_operator(shader)
        with r.shader_context(shader):
            seen=m.snapshot(r);assert seen['enabled'] and not seen['uniforms'][0]['missing']
            assert seen['uniforms'][0]['components'][0]['value']==0.25
            checks.append(kind+': unused, unexposed Uniform exists in the actual GLSL OP')
            row=seen['uniforms'][0];p=getattr(operator.par,row['components'][0]['parameter'])
            p.expr='0.75';z=getattr(operator.par,row['components'][2]['parameter']);z.val=0.81
            before_mode=(p.expr,p.mode,z.eval());native_common=operator.par.cullface if kind=='mat' else operator.par.inputfiltertype
            old_common=native_common.eval()
            wanted=native_common.menuNames[-1]
            native_common.val=wanted
            g=copy.deepcopy(r.state()['graph']);g['stages']['pixel']['nodes'][0]['params']['value']=[0.2,0.3,0.4,1.0]
            result=r.deploy(g,r.state()['revision']);assert result['ok'],result
            assert (p.expr,p.mode,z.eval())==before_mode
            assert native_common.eval()==wanted
            checks.append(kind+': recompilation preserves Expression, unused components and Common settings')
            p.mode=ParMode.CONSTANT;p.val=0.33
            seen=m.snapshot(r);row=seen['uniforms'][0]
            request={'id':gain_id,'component':0,'value':0.64,'revision':seen['revision'],'expected':row['components'][0]}
            response=m.write_value(r,request);assert p.eval()==0.64
            try:m.write_value(r,request);raise AssertionError('Stale value accepted')
            except RuntimeError:pass
            p.expr='0.3';seen=m.snapshot(r)
            try:m.write_value(r,{**request,'expected':seen['uniforms'][0]['components'][0]});raise AssertionError('Expression overwritten')
            except RuntimeError:pass
            checks.append(kind+': bidirectional value reads/writes reject stale and driven fields')
            p.mode=ParMode.CONSTANT
            seen=m.snapshot(r);row=seen['uniforms'][0]
            seen=m.edit(r,{'action':'create','name':'uOther','type':'vec4','revision':seen['revision']})
            assert len(seen['uniforms'])==2 and len(m.native_rows(operator))==2
            operator.seq.vec.moveBlock(0,1)
            seen=m.snapshot(r);assert {x['id']:x['name'] for x in seen['uniforms']}[gain_id]=='uGain'
            gain=next(x for x in seen['uniforms'] if x['id']==gain_id)
            np=m.parameter(operator,'vec',shader.fetch(m.STORE)[gain_id]['index'],'name');np.val='uRenamed'
            seen=m.snapshot(r);assert next(x for x in seen['uniforms'] if x['id']==gain_id)['name']=='uRenamed'
            checks.append(kind+': native row reorder/rename preserve the source identity')
            gain=next(x for x in seen['uniforms'] if x['id']==gain_id)
            seen=m.edit(r,{'action':'remove','id':gain_id,'revision':seen['revision'],'expected':gain['expected']})
            assert all(x['id']!=gain_id for x in seen['uniforms']) and gain_id not in shader.fetch(m.STORE)
            assert all(x['name']!='uRenamed' for x in m.native_rows(operator))
            assert m.snapshot(r)['graph']==seen['graph']
            assert r.process_shader_request('GET','/api/state',{})['savedStateIssue'] is None
            seen=m.edit(r,{'action':'create','name':'uRenamed','type':'float','revision':seen['revision']})
            gain_id=next(x['id'] for x in seen['uniforms'] if x['name']=='uRenamed')
            checks.append(kind+': unused source deletion removes inventory and native row; poll does not recreate it')
            g=copy.deepcopy(r.state()['graph']);next(d for d in g['declarations'] if d['id']==gain_id)['expose']=True
            assert r.deploy(g,r.state()['revision'])['ok']
            public=shader.fetch('sgrapePublicUniforms')[gain_id]['parameters'][0];master=getattr(shader.par,public)
            old_ui=r.uniform_snapshot();item=old_ui['uniforms'][gain_id]['components'][0]
            assert item['parameter']==public and item['writable']
            r.set_uniform_value({'declarationId':gain_id,'component':0,'revision':old_ui['revision'],'expected':item,'value':0.43})
            assert master.eval()==0.43
            native=m.snapshot(r);gain=next(x for x in native['uniforms'] if x['id']==gain_id)
            assert gain['components'][0]['value']==0.43 and not gain['components'][0]['writable']
            g=copy.deepcopy(r.state()['graph']);next(d for d in g['declarations'] if d['id']==gain_id)['expose']=False
            assert r.deploy(g,r.state()['revision'])['ok']
            gain=next(x for x in m.snapshot(r)['uniforms'] if x['id']==gain_id);assert gain['components'][0]['value']==0.43 and gain['components'][0]['writable']
            checks.append(kind+': legacy Expose control stays writable; enabling binds and detaching keeps the last value')

            # Native-only additions enter the source inventory without a graph node.
            operator.seq.vec.numBlocks+=1
            last=operator.seq.vec.numBlocks-1
            m.parameter(operator,'vec',last,'name').val='uNativeOnly'
            m.parameter(operator,'vec',last,'valuex').val=0.52
            seen=m.snapshot(r)
            assert any(x['name']=='uNativeOnly' for x in seen['uniforms'])
            g=copy.deepcopy(r.state()['graph'])
            g['stages']['pixel']['nodes'].append(c.node('uniform','gain_ref',declarationId=gain_id))
            g['stages']['pixel']['edges']=[c.edge('gain_ref','pixel','color')]
            assert r.deploy(g,r.state()['revision'])['ok']
            # A second missing source with zero references must remain removable
            # even while the first missing source is still used by this graph.
            seen=m.snapshot(r)
            seen=m.edit(r,{'action':'create','name':'uUnusedMissing','type':'float','revision':seen['revision']})
            unused=next(x for x in seen['uniforms'] if x['name']=='uUnusedMissing')
            unused_id=unused['id'];unused_record=shader.fetch(m.STORE)[unused_id]
            m.parameter(operator,unused_record['sequence'],unused_record['index'],'name').val=''
            seen=m.snapshot(r);assert next(x for x in seen['uniforms'] if x['id']==unused_id)['missing']
            saved_code=shader.op('pixel_shader').text
            seen=m.snapshot(r);gain=next(x for x in seen['uniforms'] if x['id']==gain_id)
            seen=m.edit(r,{'action':'remove','id':gain_id,'revision':seen['revision'],'expected':gain['expected']})
            assert r.state()['graph']['stages']['pixel']['edges']==g['stages']['pixel']['edges']
            assert r.process_shader_request('GET','/api/state',{})['savedStateIssue'] is None
            try:r.deploy(r.state()['graph'],r.state()['revision']);raise AssertionError('Missing source silently recreated')
            except RuntimeError as exc:assert 'missing' in str(exc)
            assert shader.op('pixel_shader').text==saved_code
            unchanged=copy.deepcopy(r.state())
            try:m.edit(r,{'action':'remove','id':gain_id,'revision':seen['revision'],'expected':None});raise AssertionError('Referenced missing source purged')
            except RuntimeError as exc:assert 'graph references' in str(exc)
            assert r.state()==unchanged
            purge={'action':'remove','id':unused_id,'revision':seen['revision'],'expected':None}
            try:m.edit(r,{**purge,'revision':seen['revision']-1});raise AssertionError('Stale purge accepted')
            except RuntimeError as exc:assert 'Conflict' in str(exc)
            seen=m.edit(r,purge)
            assert all(x['id']!=unused_id for x in seen['uniforms']) and unused_id not in shader.fetch(m.STORE)
            assert all(i.get('id')!=unused_id for i in seen['issues'])
            assert next(x for x in seen['uniforms'] if x['id']==gain_id)['missing']
            assert r.state()['graph']['stages']['pixel']['edges']==g['stages']['pixel']['edges']
            assert shader.op('pixel_shader').text==saved_code
            assert m.snapshot(r)['graph']==seen['graph']
            checks.append(kind+': unused missing cleanup succeeds beside a used missing source; stale/used purge rejected')
            seen=m.edit(r,{'action':'restore','id':gain_id,'revision':seen['revision']})
            checks.append(kind+': native additions sync; used-source deletion keeps wires/code and blocks silent recreation')
            before_native=m.native_rows(operator);before_registry=copy.deepcopy(shader.fetch(m.STORE));before_state=shader.op('state').text
            g=copy.deepcopy(r.state()['graph']);g['declarations'].append({'id':'fail','kind':'uniform','name':'uFailure','type':'float','value':0.9})
            try:r.deploy(g,r.state()['revision'],inject_failure=True);raise AssertionError('Injected failure accepted')
            except RuntimeError as exc:assert 'Injected' in str(exc)
            assert m.native_rows(operator)==before_native and shader.fetch(m.STORE)==before_registry and shader.op('state').text==before_state
            checks.append(kind+': failed commit restores native rows, source mapping and saved state')
            page=shader.appendCustomPage('Independent');master=page.appendFloat('Bound')[0];master.val=0.37
            seen=m.snapshot(r);gain=next(x for x in seen['uniforms'] if x['id']==gain_id);p=getattr(operator.par,gain['components'][0]['parameter'])
            p.bindExpr='parent().par.Bound'
            binding=(p.mode,p.bindExpr,p.eval(),master.default)
            g=copy.deepcopy(r.state()['graph']);g['declarations'].append({'id':'more','kind':'uniform','name':'uMore','type':'float','value':0.8})
            assert r.deploy(g,r.state()['revision'])['ok']
            assert (p.mode,p.bindExpr,p.eval(),master.default)==binding
            checks.append(kind+': native Bind and independent COMP control/default survive recompilation')
            external=root.create(constantCHOP,'BindingMaster_'+kind);external.par.const0value=.31
            master.bindExpr="op('"+external.path+"').par.const0value"
            seen=m.snapshot(r);gain=next(x for x in seen['uniforms'] if x['id']==gain_id)
            assert gain['components'][0]['writable'] and gain['components'][0]['mode']=='BIND'
            state_before=shader.op('state').text;bindings=(p.bindExpr,master.bindExpr)
            m.write_value(r,dict(id=gain_id,revision=seen['revision'],component=0,value=.61,expected=gain['components'][0]))
            assert abs(external.par.const0value.eval()-.61)<1e-6 and abs(p.eval()-.61)<1e-6
            assert (p.bindExpr,master.bindExpr)==bindings and str(p.mode).endswith('BIND') and str(master.mode).endswith('BIND')
            assert shader.op('state').text==state_before
            external.par.const0value.expr='0.7'
            assert not next(x for x in m.snapshot(r)['uniforms'] if x['id']==gain_id)['components'][0]['writable']
            assert external.par.const0value.expr=='0.7'
            checks.append(kind+': external native Bind chains write their master without changing bindings or graph; driven masters remain read-only')
            if kind=='mat':
                fixture=r.process_shader_request('GET','/api/state',{})
                fixture['upgradeReview']=None
                (w/'fixture.json').write_text(json.dumps(fixture,ensure_ascii=False),encoding='utf-8')
                (w/'source-fixture.json').write_text(json.dumps(seen,ensure_ascii=False),encoding='utf-8')
        r._shaders.pop(shader.fetch('sgrapeShaderId'),None);shader.destroy()
    # Legacy used/unexposed vectors migrate without resetting their values;
    # unused declarations gain a native row on the first explicit Apply.
    source_function=r.source_module;r.source_module=lambda:None
    legacy_graph=c.demo_graph('color');legacy_graph['declarations']=[{'id':'legacy','kind':'uniform','name':'uLegacy','type':'float','value':0.2}]
    legacy=r.create_shader(root,'Legacy',legacy_graph,'mat');r.source_module=source_function
    with r.shader_context(legacy):
        assert not m.snapshot(r)['enabled']
        assert r.deploy(r.state()['graph'],r.state()['revision'])['ok']
        assert m.snapshot(r)['enabled'] and not m.snapshot(r)['uniforms'][0]['missing']
        only=m.snapshot(r);row=only['uniforms'][0]
        removed=m.edit(r,{'action':'remove','id':'legacy','revision':only['revision'],'expected':row['expected']})
        assert removed['uniforms']==[] and not m.native_rows(r.shader_operator(legacy))
        assert legacy.fetch(m.STORE)=={} and m.snapshot(r)['uniforms']==[]
    checks.append('Legacy same-hash Apply initializes native sources instead of taking the old layout-only shortcut')
    r._shaders.pop(legacy.fetch('sgrapeShaderId'),None);legacy.destroy()
    assert saved()==before
    result={'passed':True,'checks':checks,'existingShadersPreserved':True}
    (w/'native-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
finally:
    root.destroy()
