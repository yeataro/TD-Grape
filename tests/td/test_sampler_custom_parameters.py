"""Sampler custom controls: actual TD resolver, definitions, history and Apply."""
from pathlib import Path
import copy,json,uuid
out=Path(GRAPE_TEST_OUTPUT);out.mkdir(parents=True,exist_ok=True)
area=op('/').create(baseCOMP,'grape_sampler_controls_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(out/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();q=manager.op('parameters').module
    image=area.create(constantTOP,'image');image.par.colorr=.35
    image2=area.create(constantTOP,'image2');image2.par.colorg=.6
    for legacy in (False,True):
        graph=c.demo_graph('banana','mat');decl=graph['declarations'][0];ident=decl['id'];decl['expose']=legacy
        shader=r.create_shader(area,'Material'+str(int(legacy)),graph,'mat')
        with r.shader_context(shader):
            def snap():return q.snapshot(r)
            def action(action,**body):
                data=snap();body.setdefault('revision',data['revision']);body.setdefault('expectedPages',data['expectedPages']);body.setdefault('expectedHistory',data['history'].get('expected'))
                if body.get('name'):
                    row=next((x for x in data['controls'] if x['name']==body['name']),None)
                    if row:body.setdefault('expected',row['expected'])
                return q.edit(r,dict(body,action=action))
            def bind(page):
                row=next(x for x in snap()['samplerSources'] if x['id']==ident)
                return action('bind',id=ident,page=page,sourceExpected=row['expected'])
            def control():return next(x for x in snap()['controls'] if ident in x['sources'])
            def resolve():return shader.op('texture_sources').module.resolve(r.texture_key(decl))
            def apply(fail=False):
                return r.deploy(copy.deepcopy(r.state()['graph']),r.state()['revision'],inject_failure=fail)
            action('page-create',name='Look');action('page-create',name='Motion')
            old=None
            if legacy:
                old=getattr(shader.par,shader.fetch('sgrapePublicTextures')[r.texture_key(decl)]['parameter']);old.val=image.path;old.default=image2.path;old.label='Native label'
            state=copy.deepcopy(r.state());bind('Look');row=control();name=row['name'];p=getattr(shader.par,name)
            assert row['style']=='TOP' and row['size']==1
            if old is not None:assert p.isSamePar(old) and p.default==image2.path and p.label=='Native label'
            action('undo')
            if old is not None:assert old.valid and old.page.name=='Textures' and resolve()==image
            else:assert getattr(shader.par,name,None) is None
            action('redo');row=control();p=getattr(shader.par,row['name']);name=p.name
            assert r.state()==state
            checks.append(str(legacy)+': create/adopt and initial undo/redo preserve source and legacy parameter identity')
            row=control();action('value',name=name,value=image.path,component=0,expectedValue=row['components'][0]);assert resolve()==image
            action('default',name=name,value=image2.path,component=0);action('label',name=name,label='My texture')
            bind('Motion');assert p.valid and p.page.name=='Motion' and p.label=='My texture' and p.default==image2.path and resolve()==image
            assert len([x for x in snap()['controls'] if ident in x['sources']])==1
            action('undo');assert p.page.name=='Look';action('redo');assert p.page.name=='Motion'
            try:apply(True);raise AssertionError('Injected failure passed')
            except RuntimeError as e:assert 'Injected' in str(e),str(e)
            assert p.valid and p.page.name=='Motion' and resolve()==image and p.default==image2.path
            assert apply()['ok'];assert p.valid and p.page.name=='Motion' and p.label=='My texture' and p.default==image2.path and resolve()==image
            checks.append(str(legacy)+': move/deduplicate, edit and failed/successful Apply preserve native control and texture')
            action('remove',name=name);assert not p.valid and resolve()==image
            r.validate_material(shader)
            assert apply()['ok'] and resolve()==image and getattr(shader.par,name,None) is None
            # Apply may change revision; definition history remains source-compatible.
            action('undo');p=getattr(shader.par,name);assert p is not None and resolve()==image
            action('redo');assert getattr(shader.par,name,None) is None and resolve()==image
            action('undo');p=getattr(shader.par,name)
            checks.append(str(legacy)+': remove/cook/Apply/undo/redo retain last texture and declaration')
            stale=control();p.label='Edited in TD'
            try:q.edit(r,{'action':'remove','name':name,'revision':r.state()['revision'],'expected':stale['expected']});raise AssertionError('Stale edit passed')
            except RuntimeError:pass
            try:action('undo');raise AssertionError('External change overwritten')
            except RuntimeError:pass
            p.expr='op('+repr(image2.path)+')';assert resolve()==image2
            bind('Look');assert p.mode==ParMode.EXPRESSION and resolve()==image2
            assert apply()['ok'] and p.mode==ParMode.EXPRESSION and resolve()==image2
            p.mode=ParMode.CONSTANT;p.val=image.path
            p.parGroup.name='Renamedtexture';name=p.name;snap();assert resolve()==image and control()['name']==name
            external=area.create(baseCOMP,'external'+str(legacy)).appendCustomPage('Test').appendTOP('Reference')[0];external.bindExpr='op('+repr(shader.path)+').par.'+name
            assert external.eval()==image
            try:action('remove',name=name);raise AssertionError('External bind lost')
            except RuntimeError:pass
            assert p.valid;external.owner.destroy()
            for bad in (shader.op('material').path,shader.op('vertex_shader').path,'/missing_top'):
                row=control()
                try:action('value',name=name,value=bad,expectedValue=row['components'][0]);raise AssertionError('Invalid TOP accepted')
                except RuntimeError:pass
                assert resolve()==image
            checks.append(str(legacy)+': TD label, Expression, rename, external Bind and stale/invalid paths protected')
            (out/('controls-'+str(legacy)+'.json')).write_text(json.dumps(snap(),ensure_ascii=False,indent=2),encoding='utf-8')
            (out/('sources-'+str(legacy)+'.json')).write_text(json.dumps(r.source_module().snapshot(r),ensure_ascii=False,indent=2),encoding='utf-8')
            (out/('state-'+str(legacy)+'.json')).write_text(json.dumps(r.process_shader_request('GET','/api/state',{}),ensure_ascii=False,indent=2),encoding='utf-8')
    result={'passed':True,'checks':checks};(out/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
finally:area.destroy()
