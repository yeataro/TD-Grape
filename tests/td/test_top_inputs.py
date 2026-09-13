from pathlib import Path
import copy,json,uuid,numpy as np
w=Path(GRAPE_TEST_OUTPUT)
original=op('/project1/TD_Sgrape/runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()}
assert not op('/grape_inputs_test')
root=op('/').create(baseCOMP,'grape_inputs_test');checks=[];success=False

def check(label,condition):
    checks.append({'name':label,'passed':bool(condition)})
    assert condition,label
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(w/'empty_personal')
    mapping={'node_catalog':'node_catalog.json','core':'sgrape_core.py','personal_library':'sgrape_library.py','document':'sgrape_document.py','sources':'sgrape_sources.py','parameters':'sgrape_parameters.py','parameter_links':'sgrape_parameter_links.py','runtime':'sgrape_runtime.py','shader_controls':'shader_controls.py'}
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    red=root.create(constantTOP,'red');red.par.resolutionw=32;red.par.resolutionh=24;red.par.colorr=.75;red.par.colorg=0;red.par.colorb=0
    green=root.create(constantTOP,'green');green.par.colorr=0;green.par.colorg=.5;green.par.colorb=0
    g=c.demo_graph('color','top');g['declarations']=[]
    g['topInputs']=[{'id':'a','name':'First','defaultSource':'builtin:black'},{'id':'b','name':'Second','defaultSource':'builtin:white'}]
    g['stages']['pixel']={'nodes':[c.node('top_input','input',inputId='b'),c.node('texture_sample','sample'),c.node('pixel_out','output')],'edges':[c.edge('input','sample','sampler'),c.edge('sample','output','color')]}
    shader=r.create_shader(root,'Test_top',g,'top');original_operator=shader.op('shader').id
    def pixels(expected):
        shader.op('shader').cook(force=True);a=shader.op('shader').numpyArray(delayed=False);check('pixels '+str(expected),float(np.max(np.abs(a-np.array(expected))))<.01)
    pixels([1,1,1,1])
    check('two external ports',len(shader.inputConnectors)==2)
    shader.inputConnectors[1].connect(red);pixels([.75,0,0,1])
    check('size is source size',shader.op('shader').width==2) # Match Input uses the first slot, not the sampled slot.
    with r.shader_context(shader):
        g=copy.deepcopy(r.state()['graph']);g['topInputs'].reverse()
        check('reorder apply',r.deploy(g,r.state()['revision'])['ok']);pixels([.75,0,0,1])
        check('wire follows slot',shader.inputConnectors[0].connections[0].owner==red)
        check('same shader object',shader.op('shader').id==original_operator)
        g=copy.deepcopy(r.state()['graph']);g['topInputs'][0]['name']='Renamed'
        check('rename apply',r.deploy(g,r.state()['revision'])['ok']);pixels([.75,0,0,1])
        good=shader.op('graph').text
        bad=copy.deepcopy(g);bad['topInputs']=bad['topInputs'][1:];bad['stages']['pixel']['nodes'][0]['params']['inputId']='a'
        try:r.deploy(bad,r.state()['revision']);raise AssertionError('Connected slot removal allowed')
        except RuntimeError:pass
        check('failed removal preserves graph',shader.op('graph').text==good);pixels([.75,0,0,1])
        g['topInputs'] += [{'id':'extra'+str(i),'name':'Extra '+str(i),'defaultSource':'builtin:black'} for i in range(14)]
        check('16 slots compile',r.deploy(g,r.state()['revision'])['ok']);pixels([.75,0,0,1]);check('16 ports',len(shader.inputConnectors)==16)
        # Unconnected sampling still has a defined black texture with 16 COMP slots.
        g['stages']['pixel']['edges']=[c.edge('sample','output','color')]
        check('16 slots plus fallback',r.deploy(g,r.state()['revision'])['ok']);pixels([0,0,0,1])
        saved=shader.op('state').text;wires=r.top_external_connections(shader)
        try:r.deploy(g,r.state()['revision'],inject_failure=True);raise AssertionError('Injected failure accepted')
        except RuntimeError:pass
        check('rollback state and wires',shader.op('state').text==saved and r.top_external_connections(shader)==wires)
        g['declarations']=[{'id':'constant','kind':'constant','type':'vec4','name':'cColor','value':[.2,.4,.6,1]}]
        g['stages']['pixel']={'nodes':[c.node('constant','color',declarationId='constant'),c.node('pixel_out','output')],'edges':[c.edge('color','output','color')]}
        check('constant native compile',r.deploy(g,r.state()['revision'])['ok']);pixels([.2,.4,.6,1])
        check('no uniform row created',not any(row['name']=='cColor' for row in r.source_module().snapshot(r)['uniforms']))
    saved_top=w/'managed-inputs.tox';shader.save(str(saved_top));loaded=root.loadTox(str(saved_top))
    check('slot records persist',loaded.fetch('grapeTopSlots')==shader.fetch('grapeTopSlots'))
    r.validate_material(loaded);check('reopened constant output',float(np.max(np.abs(loaded.op('shader').numpyArray(delayed=False)-np.array([.2,.4,.6,1]))))<.01)
    # Reject a 3D source instead of silently shifting sTD2DInputs indices.
    volume=root.create(texture3dTOP,'volume');volume.inputConnectors[0].connect(red)
    bad=copy.deepcopy(g);bad['topInputs'][1]['defaultSource']='op:'+volume.path
    with r.shader_context(shader):
        good=shader.op('graph').text
        try:r.deploy(bad,r.state()['revision']);raise AssertionError('3D input accepted')
        except RuntimeError as exc:check('2D guard reports dimensionality','2D textures' in str(exc) or 'ERROR:' in str(exc))
        check('wrong dimension preserved previous output',shader.op('graph').text==good);pixels([.2,.4,.6,1])
    legacy=c.demo_graph('banana','top');legacy['declarations'][0]['expose']=True
    legacy_shader=r.create_shader(root,'Legacy_top',legacy,'top')
    parameter=getattr(legacy_shader.par,legacy_shader.fetch('sgrapePublicTextures')['input:0']['parameter']);parameter.expr='op('+repr(red.path)+')'
    with r.shader_context(legacy_shader):
        legacy=copy.deepcopy(r.state()['graph']);legacy['topInputs']=[{'id':'original','name':'Original','defaultSource':'builtin:banana','matchDefault':False},{'id':'new','name':'New','defaultSource':'builtin:white'}];legacy['topInputLegacyId']='original'
        check('legacy adoption',r.deploy(legacy,r.state()['revision'])['ok'])
        legacy['topInputs'].reverse();check('legacy reorder',r.deploy(legacy,r.state()['revision'])['ok'])
        check('legacy reference follows original slot','texture(sTD2DInputs[1]' in legacy_shader.op('pixel_shader').text)
        check('legacy public parameter survives',getattr(legacy_shader.par,parameter.name).isSamePar(parameter) and parameter.mode==ParMode.EXPRESSION)
        r.validate_material(legacy_shader);check('legacy expression image survives',float(np.max(np.abs(legacy_shader.op('shader').numpyArray(delayed=False)-np.array([.75,0,0,1]))))<.01)
    success=True
finally:
    root.destroy()
    check('user shaders preserved',before=={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in original.shaders()})
result={'ok':success,'checks':checks}
