"""Isolated native parameter editor contracts. Never edits the user's shaders."""
from pathlib import Path
import copy,json,uuid
out=Path(GRAPE_TEST_OUTPUT);out.mkdir(parents=True,exist_ok=True)
AREA='/grape_parameter_editor_test'
assert not op(AREA)
managers=[n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False)]
assert len(managers)==1
original=managers[0].op('runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
root=op('/').create(baseCOMP,'grape_parameter_editor_test');checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(out/'empty_library')
    mapping=json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();sources=manager.op('sources').module;q=manager.op('parameters').module
    for kind in ('top','mat'):
        graph=c.normalize_top_sources(c.demo_graph('color',target=kind))[0]
        graph['declarations']=[{'id':'gain','kind':'uniform','name':'uGain','type':'float','value':.25},{'id':'tint','kind':'uniform','name':'uTint','type':'vec3','nativeSequence':'color','value':[.1,.2,.3]}]
        for i,ty in enumerate(('int','uint','bool','float')):graph['declarations'].append({'id':'spec_'+ty,'kind':'spec_constant','name':'s'+ty.title(),'type':ty,'value':False if ty=='bool' else 1,'constantId':i,'nativeSequence':'const'})
        shader=r.create_shader(root,'Test_'+kind,graph,kind)
        with r.shader_context(shader):
            model=q.ensure(r)
            def snap():return q.snapshot(r)
            def action(action,**body):
                data=snap();body.setdefault('revision',data['revision']);body.setdefault('expectedPages',data['expectedPages'])
                if body.get('name'):
                    row=next((g for g in data['controls'] if g['name']==body['name']),None)
                    if row:body.setdefault('expected',row['expected'])
                return q.edit(r,dict(body,action=action))
            def bind(ident,page,before=None):
                data=sources.snapshot(r);row=next(g for g in data['uniforms']+data['specConstants'] if g['id']==ident)
                return action('bind',id=ident,page=page,before=before,sourceExpected=row['expected'])
            def control(ident):return next(g for g in snap()['controls'] if ident in g['sources'])
            action('page-create',name='Look');action('page-create',name='Motion')
            protected={p.name:([g.name for g in p.parGroups],[(p.name,p.label,str(p.mode),p.eval()) for g in p.parGroups for p in g]) for p in shader.customPages if not q.editable_page(p)}
            for p in protected:
                for operation,kw in [('page-rename',{'name':'Bad'}),('page-remove',{}),('page-reorder',{'before':None})]:
                    try:action(operation,page=p,**kw);raise AssertionError('Protected page changed')
                    except RuntimeError:pass
                try:bind('gain',p);raise AssertionError('Bound into protected page')
                except RuntimeError:pass
            for operation in ('create','style'):
                try:action(operation,name='Bad',style='float',page='Look');raise AssertionError('Manual create/style accepted')
                except RuntimeError:pass
            assert any(g['name']=='Openeditor' for g in snap()['controls'])
            checks.append(kind+': built-in pages remain visible for operation but reject metadata, source drops, deletion and reordering; manual create/style reject')
            bind('gain','Look');first=control('gain');group=shader.parGroup[first['name']];group[0].val=.64;group[0].default=.12;group.label='Gain label'
            bind('gain','Motion');moved=control('gain');assert moved['name']==first['name'] and moved['page']=='Motion' and moved['components'][0]['value']==.64 and moved['components'][0]['default']==.12 and moved['label']=='Gain label'
            assert len([g for g in snap()['controls'] if 'gain' in g['sources']])==1
            bind('tint','Motion',moved['name']);color=control('tint');assert color['style']=='RGBA' and color['size']==3
            action('place',name=moved['name'],page='Motion',before=color['name']);assert [g.name for g in next(p for p in shader.customPages if p.name=='Motion').parGroups]==[moved['name'],color['name']]
            before_pages=[p.name for p in shader.customPages];positions={p.name:i for i,p in enumerate(shader.customPages) if not q.editable_page(p)}
            action('page-reorder',page='Motion',before='Look');assert positions=={p.name:i for i,p in enumerate(shader.customPages) if not q.editable_page(p)}
            assert all(protected[p.name][0]==[g.name for g in p.parGroups] for p in shader.customPages if not q.editable_page(p))
            checks.append(kind+': duplicate drops move the same native control with label/value/default intact; parameter/page order changes preserve built-in slots')
            for ty,value in [('int',-4),('uint',4294967295),('bool',1),('float',.375)]:
                ident='spec_'+ty;bind(ident,'Look');row=control(ident);item=row['components'][0]
                action('value',name=row['name'],component=0,value=value,expectedValue=item)
                p=model.source_pars(shader,ident)[0];assert p.bindMaster is not None and p.eval()==value,(ty,p.eval())
                if ty=='uint':
                    assert control(ident)['components'][0]['clampMin'] and control(ident)['components'][0]['min']==0
                    item=control(ident)['components'][0]
                    try:action('value',name=row['name'],component=0,value=-1,expectedValue=item);raise AssertionError('Invalid uint accepted')
                    except RuntimeError:pass
                action('remove',name=row['name']);assert p.eval()==value and str(p.mode).endswith('CONSTANT');assert any(d['id']==ident for d in r.state()['graph']['declarations'])
            checks.append(kind+': int/uint/bool/float specialization sources bind, validate edits and preserve last values and declarations when controls are removed')
            graph=copy.deepcopy(r.state()['graph']);tint=next(d for d in graph['declarations'] if d['id']=='tint');tint['type']='vec4';tint['value']=[.1,.2,.3,.8]
            initial=snap();saved_graph=copy.deepcopy(r.state())
            try:r.deploy(graph,r.state()['revision'],inject_failure=True);raise AssertionError('Injected failure accepted')
            except RuntimeError as e:assert 'Injected' in str(e)
            assert snap()['controls']==initial['controls'] and r.state()==saved_graph
            external=root.create(baseCOMP,'external_'+kind).appendCustomPage('Test').appendFloat('Value')[0]
            external.bindExpr='op('+repr(shader.path)+').par.'+color['components'][0]['name']
            assert external.eval()==.1 and external.bindMaster is not None
            try:r.deploy(graph,r.state()['revision']);raise AssertionError('External Bind reference lost')
            except RuntimeError as e:assert 'external Bind' in str(e),str(e)
            assert snap()['controls']==initial['controls'] and r.state()==saved_graph
            external.owner.destroy()
            assert r.deploy(graph,r.state()['revision'])['ok'];updated=control('tint');assert updated['name']==color['name'] and updated['size']==4 and updated['style']=='RGBA';assert updated['components'][3]['value']==.8
            assert len(shader.fetch(model.STORE)['tint']['components'])==4
            checks.append(kind+': shape changes expand/rebind automatically; failed Apply restores definitions, values and pages; external Bind conflicts reject before mutation')
            row=control('tint');components=[dict(component=i,value=value,expectedValue=row['components'][i]) for i,value in enumerate((.4,.5,.6))]
            action('color',name=row['name'],components=components)
            assert [p.eval() for p in model.source_pars(shader,'tint')[:3]]==[.4,.5,.6]
            if kind=='top':
                resolution=next(g for g in snap()['controls'] if g['name']=='Resolution')
                action('value',name='Resolution',value=1,expectedValue=resolution['components'][0]);assert shader.par.Resolution.eval()=='custom'
            checks.append(kind+': native color batch updates the same Bind masters; Output value operations retain page protection')
            row=control('gain');stale=row['expected'];getattr(shader.parGroup,row['name']).label='Native label'
            try:q.edit(r,{'action':'remove','revision':r.state()['revision'],'name':row['name'],'expected':stale});raise AssertionError('Stale metadata accepted')
            except RuntimeError:pass
            (out/(kind+'-controls.json')).write_text(json.dumps(snap(),ensure_ascii=False,indent=2),encoding='utf-8')
            (out/(kind+'-sources.json')).write_text(json.dumps(sources.snapshot(r),ensure_ascii=False,indent=2),encoding='utf-8')
            checks.append(kind+': externally edited metadata rejects stale UI writes')
    after={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
    assert after==before
    result={'passed':True,'checks':checks,'userShadersPreserved':True};(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result))
finally:root.destroy()
