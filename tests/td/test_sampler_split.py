from pathlib import Path
import copy,json,uuid,numpy as np
w=Path(GRAPE_TEST_OUTPUT)
original=next(n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager', False)).op('runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
assert not op('/grape_sampler_test')
root=op('/').create(baseCOMP,'grape_sampler_test');checks=[];success=False

def check(label,condition):
    checks.append({'name':label,'passed':bool(condition)})
    assert condition,label
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    mapping={'node_catalog':'node_catalog.json','core':'sgrape_core.py','personal_library':'sgrape_library.py','document':'sgrape_document.py','sources':'sgrape_sources.py','parameters':'sgrape_parameters.py','parameter_links':'sgrape_parameter_links.py','runtime':'sgrape_runtime.py','shader_controls':'shader_controls.py'}
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    red=root.create(constantTOP,'source');red.par.format='rgba32float';red.par.resolutionw=32;red.par.resolutionh=24
    values=[.7,.2,.1,.65]
    red.par.premultrgbbyalpha=False
    for key,value in zip(('colorr','colorg','colorb','alpha'),values):setattr(red.par,key,value)
    native_pages={}
    for kind in ('mat','top'):
        g=c.demo_graph('color',kind);g['declarations']=[]
        g['stages']['pixel']={'nodes':[c.node('texture_sample','sample'),c.node('pixel_out','output')],'edges':[c.edge('sample','output','color')]}
        shader=r.create_shader(root,'Test_'+kind,g,kind);operator=r.shader_operator(shader)
        native_pages[kind]={'pages':[p.name for p in operator.pages],'samplerSequence':getattr(operator.seq,'sampler',None) is not None}
        def pixels(label,expected):
            r.validate_material(shader);top=shader.op('preview') if kind=='mat' else shader.op('shader');top.cook(force=True)
            a=top.numpyArray(delayed=False)
            if kind=='mat':a=a[96:416,96:416,:]
            error=float(np.max(np.abs(a-np.array(expected))))
            check(kind+': '+label,error<.009)
        with r.shader_context(shader):
            g=copy.deepcopy(r.state()['graph'])
            pixels('unconnected texture is opaque black',[0,0,0,1])
            g['declarations']=[{'id':'image','kind':'sampler','name':'uImage','type':'sampler2D','source':'op:'+red.path,'fallback':'opaque-black','expose':True,'exposeName':'Image'}]
            p=g['stages']['pixel'];p['nodes'] += [c.node('sampler','source',declarationId='image'),c.node('texture_sample','second'),c.node('mix','mix')]
            p['edges']=[c.edge('source','sample','sampler'),c.edge('source','second','sampler'),c.edge('sample','mix','a'),c.edge('second','mix','b'),c.edge('mix','output','color')]
            outcome=r.deploy(g,r.state()['revision']);(w/'deploy-diagnostic.json').write_text(json.dumps(outcome,indent=2),encoding='utf-8');check(kind+': deploy shared sampler',outcome['ok']);pixels('two samples share one source',values)
            check(kind+': one binding',len(c.compile_graph(g)['bindings'])==1)
            public=getattr(shader.par,shader.fetch('sgrapePublicTextures')['image']['parameter']);identity=public
            public.expr='op('+repr(red.path)+')'
            g['stages']['pixel']['nodes'][0]['ui']['label']='Shared texture'
            check(kind+': recompile',r.deploy(g,r.state()['revision'])['ok']);pixels('source expression preserved',values)
            check(kind+': same exposed control',getattr(shader.par,public.name).isSamePar(identity) and public.mode==ParMode.EXPRESSION)
            public.mode=ParMode.CONSTANT;public.val='/missing_after_split'
            pixels('missing current source is opaque black',[0,0,0,1])
            row=r.uniform_snapshot()['textures']['image'];check(kind+': missing status retained',row['sourceStatus']=='missing')
            check(kind+': missing path deploy succeeds',r.deploy(g,r.state()['revision'])['ok']);pixels('missing source compiles safely',[0,0,0,1])
            public.val=manager.path
            check(kind+': wrong operator type is not a missing-source fallback',not shader.op('texture_sources').module.effective('image').get('recoverable'))
            public.val=red.path
            # A sampler-valued Subgraph output is expanded as a reference, never a GLSL return value.
            f={'id':'pass','name':'Pass texture','scope':'local','stages':['pixel'],
              'inputs':[{'id':'image','name':'uImage','type':'sampler2D','default':None}],
              'outputs':[{'id':'image','name':'Image','type':'sampler2D','default':None}],
              'graph':{'nodes':[{'id':'input','definitionUuid':c.FUNCTION_INPUT,'params':{},'ui':{'x':0,'y':0}},{'id':'output','definitionUuid':c.FUNCTION_OUTPUT,'params':{},'ui':{'x':200,'y':0}}],
                 'edges':[{'from':['input','image'],'to':['output','image']}]}}
            g['functions']=[f];p['nodes'].append({'id':'call','definitionUuid':c.CALL,'params':{'functionId':'pass'},'ui':{'x':200,'y':0}})
            p['edges']=[e for e in p['edges'] if e['from'][0]!='source']+[c.edge('source','call','image'),c.edge('call','sample','sampler','image'),c.edge('call','second','sampler','image')]
            check(kind+': sampler subgraph deploy',r.deploy(g,r.state()['revision'])['ok']);pixels('sampler passes through Subgraph',values)
            saved=shader.op('state').text
            try:r.deploy(g,r.state()['revision'],inject_failure=True);raise AssertionError('Injected failure accepted')
            except RuntimeError:pass
            check(kind+': failed apply leaves current graph',shader.op('state').text==saved);pixels('failed apply preserves output',values)
            file=w/('sampler-'+kind+'.tox');shader.save(str(file));loaded=root.loadTox(str(file));r.register_shader(loaded,fresh=True)
            check(kind+': TOX graph roundtrip',json.loads(loaded.op('graph').text)==g);r.validate_material(loaded);loaded.destroy()
            (w/('native-'+kind+'-graph.json')).write_text(json.dumps(g),encoding='utf-8')
    # Compare actual browser-generated split/group/paste graphs to the legacy image.
    cases=json.loads((GRAPE_ROOT/'tests/fixtures/sampler-browser-graphs.json').read_text(encoding='utf-8'))
    baseline=json.loads((GRAPE_ROOT/'tests/fixtures/editor-state.json').read_text(encoding='utf-8'))['state']['graph']
    prior=r.create_shader(root,'Before',baseline,'top');prior.inputConnectors[0].connect(red)
    prior.op('shader').cook(force=True);expected=prior.op('shader').numpyArray(delayed=False).copy()
    for i,case in enumerate(cases):
        sample=r.create_shader(root,'Case'+str(i),case,'top');sample.inputConnectors[0].connect(red)
        r.validate_material(sample);sample.op('shader').cook(force=True)
        check('browser split/group/paste '+str(i)+' preserves all pixels',float(np.max(np.abs(sample.op('shader').numpyArray(delayed=False)-expected)))<.00001)
    success=True
finally:
    root.destroy()
    check('real Shaders preserved',before=={s.path:{n:s.op(n).text for n in before[s.path]} for s in original.shaders()})
    report={'passed':success,'checks':checks,'tdBuild':app.build,'nativePages':native_pages}
    (w/'native-result.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'passed':success,'checks':len(checks),'nativePages':native_pages}))
