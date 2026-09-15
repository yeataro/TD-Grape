import copy,json
r=op('/TD_Grape/runtime').module;c=r.core()
area=op('/').create(baseCOMP,'grape_upgrade_test');checks=[]
try:
    old=c.demo_graph(target='top');old['declarations'][0].update(expose=True,exposeName='Original Input')
    s=r.make_scene(area,'legacy','top');r.configure(s,c.compile_graph(old),old);r.register_shader(s,fresh=True)
    ext=area.create(constantTOP,'image');ext.par.resolutionw=160;ext.par.resolutionh=90
    binding=s.fetch('sgrapePublicTextures')['input:0'];par=getattr(s.par,binding['parameter'])
    par.expr="op('/grape_upgrade_test/image')";identity=par
    with r.shader_context(s):
        review=r.prepare_upgrade_review();assert not review['blocked'],review
        old_state=s.op('state').text;old_code=s.op('pixel_shader').text
        try:r.deploy(review['candidate'],review['revision'],upgrade_token=review['token'],inject_failure=True)
        except RuntimeError as exc:
            if 'Injected commit failure' not in str(exc):
                (GRAPE_TEST_OUTPUT/'failure.json').write_text(json.dumps({'storage':repr(s.storage),'par':{'mode':str(par.mode),'expr':par.expr,'value':str(par.eval())},'rows':{key:{k:str(v) for k,v in s.op('texture_sources').module.effective(key).items()} for key in s.fetch('sgrapeTextureSources',{})}},indent=2),encoding='utf-8')
            assert 'Injected commit failure' in str(exc),str(exc)
        else:raise AssertionError('Expected rollback test failure')
        assert s.op('state').text==old_state and s.op('pixel_shader').text==old_code
        checks.append('legacy rollback preserves graph and output')
        review=r.prepare_upgrade_review();out=r.deploy(review['candidate'],review['revision'],upgrade_token=review['token']);assert out['ok']
        key='slot:'+out['state']['graph']['topInputs'][0]['id']
        p=getattr(s.par,s.fetch('sgrapePublicTextures')[key]['parameter'])
        assert p.isSamePar(identity) and p.mode==ParMode.EXPRESSION and p.expr=="op('/grape_upgrade_test/image')"
        assert p.enable and str(p.page.name)=='Textures'
        assert (s.op('shader').width,s.op('shader').height)==(160,90)
        checks.append('exposed source expression, parameter identity, size preserved')
        g=copy.deepcopy(out['state']['graph']);g['topInputs']=[];g['stages']['pixel']={'nodes':[c.node('pixel_out','out')],'edges':[]}
        current=s.op('state').text
        try:r.deploy(g,out['state']['revision'],inject_failure=True)
        except RuntimeError as exc:assert 'Injected commit failure' in str(exc),str(exc)
        else:raise AssertionError('Expected empty rollback failure')
        assert s.op('state').text==current and len(s.fetch('grapeTopSlots'))==1
        assert getattr(s.par,p.name).mode==ParMode.EXPRESSION
        checks.append('zero-input transaction failure restores prior source')
    mat=r.create_shader(area,'mat',kind='mat');r.validate_material(mat)
    assert len(json.loads(mat.op('graph').text)['declarations'])==1
    checks.append('MAT still uses its sampler declaration')
finally:
    r._shaders={k:v for k,v in r._shaders.items() if v and v.valid and not v.path.startswith(area.path+'/')};area.destroy()
result={'checks':checks}

