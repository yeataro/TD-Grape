"""Shared default images retain independent map controls and stable MAT bindings."""
import copy,hashlib,json,uuid

area=op('/').create(baseCOMP,'grape_shared_textures_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(GRAPE_TEST_OUTPUT/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager
    presets=json.loads(manager.op('material_presets').text)
    red=area.create(constantTOP,'red');red.par.colorr=1;red.par.colorg=0;red.par.colorb=0
    green=area.create(constantTOP,'green');green.par.colorr=0;green.par.colorg=1;green.par.colorb=0
    for model,count in (('pbr',10),('phong',9)):
        shader=r.create_shader(area,model,presets[model+'_textured'],'mat')
        def source(key):return shader.op('texture_sources').module.resolve(key)
        def control(key):return getattr(shader.par,shader.fetch('sgrapePublicTextures')[key]['parameter'])
        def endpoint(key):return shader.op('texture_source_'+hashlib.sha256(key.encode()).hexdigest()[:16])
        def endpoints():return {k:endpoint(k).id for k in shader.fetch('sgrapeTextureSources')}
        with r.shader_context(shader):
            specs=shader.fetch('sgrapeTextureSources');white=shader.op('texture_white');normal=shader.op('texture_flat_normal')
            assert len([n for n in shader.children if n.family=='TOP'])==count+2
            assert len([n for n in shader.children if n.opType=='selectTOP'])==count
            assert all(source(k)==(normal if k=='normalMap' else white) for k in specs)
            assert tuple(normal.numpyArray(delayed=False)[0,0,:3])==(.5,.5,1.)
            assert len({getattr(shader.op('material').par,'sampler'+str(i)+'top').eval().id for i in range(count)})==count
            ids=endpoints();base=control('baseColorMap');alpha=control('alphaMap')
            base.val=red.path;alpha.expr='op('+repr(green.path)+')'
            assert source('baseColorMap')==red and source('alphaMap')==green and source('normalMap')==normal
            assert all(source(k)==white for k in specs if k not in ('baseColorMap','alphaMap','normalMap'))
            endpoint('baseColorMap').cook(force=True);endpoint('alphaMap').cook(force=True)
            assert tuple(endpoint('baseColorMap').numpyArray(delayed=False)[0,0,:3])==(1.,0.,0.)
            assert tuple(endpoint('alphaMap').numpyArray(delayed=False)[0,0,:3])==(0.,1.,0.)
            base.val='';assert source('baseColorMap')==white
            state=copy.deepcopy(r.state());graph=copy.deepcopy(state['graph'])
            next(d for d in graph['declarations'] if d['id']=='baseColorMap')['source']='builtin:black'
            assert r.deploy(graph,r.state()['revision'])['ok']
            assert source('baseColorMap')==shader.op('texture_black') and source('alphaMap')==green
            assert all(source(k)==white for k in specs if k not in ('baseColorMap','alphaMap','normalMap'))
            assert endpoints()==ids and control('baseColorMap').isSamePar(base) and control('alphaMap').isSamePar(alpha)
            assert alpha.mode==ParMode.EXPRESSION
            assert r.deploy(state['graph'],r.state()['revision'])['ok'];assert source('baseColorMap')==white
            assert shader.op('texture_black') is None
            checks.append(model+': shared defaults, independent live overrides, expressions, default change and stable endpoints')

            # Recreate the old registry-backed default chain, then migrate in place.
            old=[];old_specs=copy.deepcopy(shader.fetch('sgrapeTextureSources'))
            for key,spec in old_specs.items():
                name='texture_default_'+hashlib.sha256(key.encode()).hexdigest()[:16]
                image=shader.create(constantTOP,name+'_constant');image.par.resolutionw=2;image.par.resolutionh=2
                rgb=(.5,.5,1) if key=='normalMap' else (1,1,1)
                for channel,value in zip('rgb',rgb):getattr(image.par,'color'+channel).val=value
                image.par.format='rgba32float';image.par.alpha=1
                selected=shader.create(selectTOP,name);selected.par.top=image.name;selected.par.format='useinput'
                spec['asset']=selected.name;old.extend((image,selected))
            shader.store('sgrapeTextureSources',old_specs)
            saved=r.state();shader.op('manifest').text=shader.op('manifest').text.replace('0.8.250','0.8.249')
            try:r.deploy(saved['graph'],saved['revision'],inject_failure=True)
            except RuntimeError as exc:assert 'Injected' in str(exc),str(exc)
            else:raise AssertionError('Expected injected failure')
            assert all(n.valid for n in old), 'Legacy sources removed before a successful deployment'
            assert source('alphaMap')==green and source('normalMap')==normal
            assert r.deploy(saved['graph'],r.state()['revision'])['ok']
            assert all(not n.valid for n in old)
            assert endpoints()==ids and len([n for n in shader.children if n.family=='TOP'])==count+2
            assert control('alphaMap').isSamePar(alpha) and alpha.mode==ParMode.EXPRESSION
            checks.append(model+': legacy duplicate cleanup waits for success; failed Apply retains working bindings')

            alpha.mode=ParMode.CONSTANT;alpha.val=''
            file=GRAPE_TEST_OUTPUT/(model+'.tox');shader.save(str(file));loaded=area.loadTox(str(file))
            try:
                r.register_shader(loaded,fresh=True);r.validate_material(loaded)
                for key in specs:
                    assert loaded.op('texture_sources').module.resolve(key).parent()==loaded
                assert loaded.op('texture_white')!=white
            finally:loaded.destroy()
            checks.append(model+': TOX copy resolves its own shared images')

            # The generic missing-source fallback remains opaque black, distinct
            # from a deliberately blank map field's neutral white default.
            original=copy.deepcopy(r.state()['graph']);graph=copy.deepcopy(original)
            next(d for d in graph['declarations'] if d['id']=='alphaMap')['fallback']='opaque-black'
            assert r.deploy(graph,r.state()['revision'])['ok']
            alpha.val='/missing_material_map'
            row=shader.op('texture_sources').module.effective('alphaMap')
            assert row['status']=='missing' and row['recoverable'] and row['source']==shader.op('texture_black')
            endpoint('alphaMap').cook(force=True)
            assert tuple(endpoint('alphaMap').numpyArray(delayed=False)[0,0,:])==(0.,0.,0.,1.)
            assert r.deploy(graph,r.state()['revision'])['ok']
            alpha.val='';assert source('alphaMap')==white
            assert r.deploy(original,r.state()['revision'])['ok'];assert shader.op('texture_black') is None
            checks.append(model+': missing-path black fallback remains distinct from the blank-field white default')
    result={'passed':True,'checks':checks}
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:area.destroy()
