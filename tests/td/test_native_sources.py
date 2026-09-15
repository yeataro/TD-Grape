from pathlib import Path
import copy,json,uuid
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)

original=next(n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager', False)).op('runtime').module
def saved():return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
before=saved();assert not op('/grape_sources_test')
root=op('/').create(baseCOMP,'grape_sources_test');checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    mapping={'node_catalog':'node_catalog.json','core':'sgrape_core.py','personal_library':'sgrape_library.py','document':'sgrape_document.py','sources':'sgrape_sources.py','runtime':'sgrape_runtime.py','shader_controls':'shader_controls.py'}
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();m=manager.op('sources').module
    for kind in ('mat','top'):
        graph=c.demo_graph('color',target=kind)
        graph['declarations']=[{'id':'gain','kind':'uniform','name':'uGain','type':'float','value':0.25}]
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
            request={'id':'gain','component':0,'value':0.64,'revision':seen['revision'],'expected':row['components'][0]}
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
            seen=m.snapshot(r);assert {x['id']:x['name'] for x in seen['uniforms']}['gain']=='uGain'
            gain=next(x for x in seen['uniforms'] if x['id']=='gain')
            np=m.parameter(operator,'vec',shader.fetch(m.STORE)['gain']['index'],'name');np.val='uRenamed'
            seen=m.snapshot(r);assert next(x for x in seen['uniforms'] if x['id']=='gain')['name']=='uRenamed'
            checks.append(kind+': native row reorder/rename preserve the source identity')
            gain=next(x for x in seen['uniforms'] if x['id']=='gain')
            seen=m.edit(r,{'action':'remove','id':'gain','revision':seen['revision'],'expected':gain['expected']})
            assert next(x for x in seen['uniforms'] if x['id']=='gain')['missing']
            assert r.process_shader_request('GET','/api/state',{})['savedStateIssue'] is None
            seen=m.edit(r,{'action':'restore','id':'gain','revision':seen['revision']})
            assert not next(x for x in seen['uniforms'] if x['id']=='gain')['missing']
            checks.append(kind+': source deletion leaves a recoverable reference; explicit restore works')
            g=copy.deepcopy(r.state()['graph']);next(d for d in g['declarations'] if d['id']=='gain')['expose']=True
            assert r.deploy(g,r.state()['revision'])['ok']
            public=shader.fetch('sgrapePublicUniforms')['gain']['parameters'][0];master=getattr(shader.par,public)
            old_ui=r.uniform_snapshot();item=old_ui['uniforms']['gain']['components'][0]
            assert item['parameter']==public and item['writable']
            r.set_uniform_value({'declarationId':'gain','component':0,'revision':old_ui['revision'],'expected':item,'value':0.43})
            assert master.eval()==0.43
            native=m.snapshot(r);gain=next(x for x in native['uniforms'] if x['id']=='gain')
            assert gain['components'][0]['value']==0.43 and not gain['components'][0]['writable']
            g=copy.deepcopy(r.state()['graph']);next(d for d in g['declarations'] if d['id']=='gain')['expose']=False
            assert r.deploy(g,r.state()['revision'])['ok']
            gain=next(x for x in m.snapshot(r)['uniforms'] if x['id']=='gain');assert gain['components'][0]['value']==0.43 and gain['components'][0]['writable']
            checks.append(kind+': legacy Expose control stays writable; enabling binds and detaching keeps the last value')

            # Native-only additions enter the source inventory without a graph node.
            operator.seq.vec.numBlocks+=1
            last=operator.seq.vec.numBlocks-1
            m.parameter(operator,'vec',last,'name').val='uNativeOnly'
            m.parameter(operator,'vec',last,'valuex').val=0.52
            seen=m.snapshot(r)
            assert any(x['name']=='uNativeOnly' for x in seen['uniforms'])
            g=copy.deepcopy(r.state()['graph'])
            g['stages']['pixel']['nodes'].append(c.node('uniform','gain_ref',declarationId='gain'))
            g['stages']['pixel']['edges']=[c.edge('gain_ref','pixel','color')]
            assert r.deploy(g,r.state()['revision'])['ok']
            saved_code=shader.op('pixel_shader').text
            seen=m.snapshot(r);gain=next(x for x in seen['uniforms'] if x['id']=='gain')
            seen=m.edit(r,{'action':'remove','id':'gain','revision':seen['revision'],'expected':gain['expected']})
            assert r.state()['graph']['stages']['pixel']['edges']==g['stages']['pixel']['edges']
            assert r.process_shader_request('GET','/api/state',{})['savedStateIssue'] is None
            try:r.deploy(r.state()['graph'],r.state()['revision']);raise AssertionError('Missing source silently recreated')
            except RuntimeError as exc:assert 'missing' in str(exc)
            assert shader.op('pixel_shader').text==saved_code
            seen=m.edit(r,{'action':'restore','id':'gain','revision':seen['revision']})
            checks.append(kind+': native additions sync; used-source deletion keeps wires/code and blocks silent recreation')
            before_native=m.native_rows(operator);before_registry=copy.deepcopy(shader.fetch(m.STORE));before_state=shader.op('state').text
            g=copy.deepcopy(r.state()['graph']);g['declarations'].append({'id':'fail','kind':'uniform','name':'uFailure','type':'float','value':0.9})
            try:r.deploy(g,r.state()['revision'],inject_failure=True);raise AssertionError('Injected failure accepted')
            except RuntimeError as exc:assert 'Injected' in str(exc)
            assert m.native_rows(operator)==before_native and shader.fetch(m.STORE)==before_registry and shader.op('state').text==before_state
            checks.append(kind+': failed commit restores native rows, source mapping and saved state')
            page=shader.appendCustomPage('Independent');master=page.appendFloat('Bound')[0];master.val=0.37
            seen=m.snapshot(r);gain=next(x for x in seen['uniforms'] if x['id']=='gain');p=getattr(operator.par,gain['components'][0]['parameter'])
            p.bindExpr='parent().par.Bound'
            binding=(p.mode,p.bindExpr,p.eval(),master.default)
            g=copy.deepcopy(r.state()['graph']);g['declarations'].append({'id':'more','kind':'uniform','name':'uMore','type':'float','value':0.8})
            assert r.deploy(g,r.state()['revision'])['ok']
            assert (p.mode,p.bindExpr,p.eval(),master.default)==binding
            checks.append(kind+': native Bind and independent COMP control/default survive recompilation')
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
        assert removed['uniforms'][0]['missing'] and not m.native_rows(r.shader_operator(legacy))
    checks.append('Legacy same-hash Apply initializes native sources instead of taking the old layout-only shortcut')
    r._shaders.pop(legacy.fetch('sgrapeShaderId'),None);legacy.destroy()
    assert saved()==before
    result={'passed':True,'checks':checks,'existingShadersPreserved':True}
    (w/'native-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
finally:
    root.destroy()
