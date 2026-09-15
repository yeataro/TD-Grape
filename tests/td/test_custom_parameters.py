from pathlib import Path
import json,copy,uuid
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
original=next(n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager', False)).op('runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
assert not op('/grape_custom_test')
root=op('/').create(baseCOMP,'grape_custom_test');checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    mapping={'node_catalog':'node_catalog.json','core':'sgrape_core.py','personal_library':'sgrape_library.py','document':'sgrape_document.py','sources':'sgrape_sources.py','runtime':'sgrape_runtime.py','shader_controls':'shader_controls.py','parameters':'sgrape_parameters.py','parameter_links':'sgrape_parameter_links.py'}
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();sources=manager.op('sources').module;q=manager.op('parameters').module
    for kind in ('mat','top'):
        graph=c.demo_graph('color',target=kind)
        graph['declarations']=[{'id':'gain','kind':'uniform','name':'uGain','type':'float','value':.25,'expose':True}, {'id':'tint','kind':'uniform','name':'uTint','type':'vec4','value':[.1,.2,.3,.4]}]
        shader=r.create_shader(root,'Test_'+kind,graph,kind);native=r.shader_operator(shader)
        with r.shader_context(shader):
            legacy_name=shader.fetch('sgrapePublicUniforms')['gain']['parameters'][0];legacy=getattr(shader.par,legacy_name);legacy.val=.62;legacy.default=.13;legacy.label='Existing label'
            data=q.snapshot(r);model=shader.op('parameter_links').module
            assert legacy.val==.62 and legacy.default==.13 and legacy.label=='Existing label'
            assert native.par.vec0valuex.bindMaster.isSamePar(legacy)
            checks.append(kind+': old Expose adopts existing custom Par, label, current value and default')
            def action(action,**body):
                data=q.snapshot(r)
                if 'name' in body:
                    row=next((g for g in data['controls'] if g['name']==body['name']),None)
                    if row:body.setdefault('expected',row['expected'])
                body.setdefault('expectedPages',data['expectedPages']);body.setdefault('revision',data['revision'])
                return q.edit(r,{'action':action,**body})
            action('page-create',name='Look');action('page-create',name='Motion')
            action('page',name=legacy.parGroup.name,page='Look');action('label',name=legacy.parGroup.name,label='Brightness')
            data=action('create',name='Unbound',style='vec4',page='Motion');group=next(g for g in data['controls'] if g['label']=='Unbound')
            name=group['name'];action('default',name=name,component=0,value=.12)
            data=q.snapshot(r);row=next(g for g in data['controls'] if g['name']==name)
            action('value',name=name,component=0,value=.48,expectedValue=row['components'][0])
            assert getattr(shader.parGroup,name)[0].eval()==.48 and getattr(shader.parGroup,name)[0].default==.12
            action('page-rename',page='Motion',name='Animation');action('page-move',page='Animation',direction=-1)
            try:action('page-remove',page='Animation');raise AssertionError('Nonempty page removed')
            except RuntimeError:pass
            checks.append(kind+': independent pages and unbound controls edit native values/defaults without a graph node')
            row=next(x for x in sources.snapshot(r)['uniforms'] if x['id']=='tint')
            data=action('bind',id='tint',page='Look',sourceExpected=row['expected'])
            control=next(g for g in data['controls'] if 'tint' in g['sources']);tint=getattr(shader.parGroup,control['name'])
            assert tint.name=='Utint';assert len(tint)==4
            tint[0].val=.66;row=next(x for x in sources.snapshot(r)['uniforms'] if x['id']=='tint')
            assert row['components'][0]['value']==.66 and row['components'][0]['writable']
            sources.write_value(r,{'id':'tint','revision':r.state()['revision'],'component':0,'expected':row['components'][0],'value':.77})
            assert tint[0].eval()==.77
            native.par.vec1valuey.val=.81;assert tint[1].eval()==.81
            checks.append(kind+': COMP, Uniform panel and actual native Bind write the same control')
            tint.name='Renamed';model.sync(shader)
            assert native.par.vec1valuex.bindMaster.name=='Renamed1' and native.par.vec1valuex.eval()==.77
            action('style',name='Renamed',style='rgba');tint=shader.parGroup.Renamed
            assert tint.style=='RGBA' and tint[0].eval()==.77 and tint[0].default==.1
            assert native.par.vec1valuex.bindMaster.name=='Renamedr'
            action('style',name='Renamed',style='vec4');tint=shader.parGroup.Renamed
            assert tint[1].eval()==.81 and tint[1].default==.2
            checks.append(kind+': native rename and Vector/RGBA conversion preserve owned links, values and defaults')
            graph=copy.deepcopy(r.state()['graph']);graph['stages']['pixel']['nodes'][0]['params']['value']=[.3,.2,.1,1]
            applied=r.deploy(graph,r.state()['revision']);assert applied['ok'],applied
            assert legacy.page.name=='Look' and legacy.label=='Brightness' and legacy.default==.13
            assert native.par.vec1valuex.bindMaster.name=='Renamed1' and native.par.vec1valuex.eval()==.77
            checks.append(kind+': compile preserves user page layout/labels/defaults and native bindings')
            before_controls=q.snapshot(r)['controls'];before_links=copy.deepcopy(shader.fetch(model.STORE))
            failed=copy.deepcopy(r.state()['graph']);failed['stages']['pixel']['nodes'][0]['params']['value']=[.4,.3,.2,1]
            try:r.deploy(failed,r.state()['revision'],inject_failure=True);raise AssertionError('Injected compile failure was accepted')
            except RuntimeError:pass
            assert q.snapshot(r)['controls']==before_controls and shader.fetch(model.STORE)==before_links
            checks.append(kind+': failed Apply preserves custom controls and owned links')
            outside=root.create(baseCOMP,'external_'+kind);external=outside.appendCustomPage('Controls').appendFloat('Reference')[0]
            external.bindExpr="op('"+shader.path+"').par.Renamed1"
            assert abs(external.eval()-.77)<1e-6 and external.bindMaster is not None
            try:action('style',name='Renamed',style='rgba');raise AssertionError('External Bind silently broken')
            except RuntimeError:pass
            assert external.bindMaster.isSamePar(tint[0]);outside.destroy()
            checks.append(kind+': style changes reject external Bind breakage before mutation')

            stale=next(g for g in q.snapshot(r)['controls'] if g['name']=='Renamed');tint.label='Native change'
            try:action('label',name='Renamed',label='Stale',expected=stale['expected']);raise AssertionError('Stale edit accepted')
            except RuntimeError:pass
            action('remove',name='Renamed')
            assert native.par.vec1valuex.mode==ParMode.CONSTANT and native.par.vec1valuex.eval()==.77
            assert native.par.vec1valuex.default==1
            assert getattr(shader.parGroup,'Renamed',None) is None
            checks.append(kind+': stale metadata edits rejected; control deletion leaves Uniform at last value with its default unchanged')
            gain=next(x for x in sources.snapshot(r)['uniforms'] if x['id']=='gain')
            sources.edit(r,{'action':'remove','id':'gain','revision':r.state()['revision'],'expected':gain['expected']})
            q.snapshot(r)
            assert legacy.valid and legacy.eval()==.62 and legacy.default==.13 and 'gain' not in shader.fetch(model.STORE,{})
            checks.append(kind+': source deletion leaves the independent COMP control and default intact')
            (w/(kind+'-fixture.json')).write_text(json.dumps(q.snapshot(r),indent=2),encoding='utf-8')
    after={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
    assert after==before
    result={'passed':True,'checks':checks,'existingShadersPreserved':True}
    (w/'native-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
finally:root.destroy()
