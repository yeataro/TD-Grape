"""Isolated TOP/MAT native CHOP Uniform Array configuration and history.

Run only through the coordinated job runner; never change the user's manager.
"""
from pathlib import Path
import copy
import json
import uuid

w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
owners=[n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False)]
assert len(owners)==1
original=owners[0].op('runtime').module
def saved():
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)}
            for s in original._shaders.values() if s and s.valid}
before_user=saved();original_selection=original._shader
original_registry={k:s.path for k,s in original._shaders.items() if s and s.valid}
root_name='grape_array_sources_'+uuid.uuid4().hex[:8]
area=op('/').create(baseCOMP,root_name);checks=[];completed=False
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder')
    manager.par.Personalfolder=str(w/'empty_personal')
    mapping=json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat,file in mapping.items():manager.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
    runtime=manager.op('runtime').module;runtime._owner=manager;core=runtime.core()
    callbacks=area.create(textDAT,'array_callbacks')
    callbacks.text="import numpy as np\ndef onCook(scriptOp):\n    scriptOp.copyNumpyArray(np.ascontiguousarray(np.asarray(scriptOp.fetch('samples'), dtype=np.float32).T))\n"
    data=area.create(scriptCHOP,'points');data.par.callbacks=callbacks
    data.store('samples',[[1.,2.,3.,4.],[5.,6.,7.,8.],[9.,10.,11.,12.]])
    data.cook(force=True)
    def api(method,endpoint,body=None):
        with runtime.history_native_writes():return runtime.process_shader_request(method,'/api/'+endpoint,body or {})
    def row(seen,ident='array'):
        return next(r for r in seen['uniforms'] if r['id']==ident)
    def edit_binding(mode,value):
        seen=api('GET','sources');item=row(seen)
        return api('POST','source-edit',dict(action='arrayBinding',id=item['id'],revision=seen['revision'],expected=item['arrayBinding']['expected'],mode=mode,**({'expression':value} if mode=='EXPRESSION' else {'value':value})))
    def restore(before,after):
        return api('POST','history-restore',dict(requestId=uuid.uuid4().hex,revision=runtime.state()['revision'],
            fromToken=after['history']['token'],toToken=before['history']['token'],sourceIds=['array'],
            currentGraph=copy.deepcopy(after['graph']),graph=copy.deepcopy(before['graph'])))
    for kind in ('top','mat'):
        graph=core.normalize_top_sources(core.demo_graph('color',target=kind))[0]
        graph['declarations']=[dict(id='array',kind='uniform',name='uPoints',type='vec3[3]',value=[[0.,0.,0.] for _ in range(3)],nativeSequence='array',arraySource=data.path)]
        shader=runtime.create_shader(area,'Test_'+kind,graph,kind);native=runtime.shader_operator(shader)
        with runtime.shader_context(shader):
            initial=api('GET','sources');item=row(initial)
            assert item['components']==[] and item['arrayBinding']['length']==3
            assert item['arrayBinding']['elementType']=='vec3' and item['arrayBinding']['arrayType']=='uniformarray'
            p=getattr(native.par,item['arrayBinding']['parameter']);assert p.eval()==data
            changed=edit_binding('EXPRESSION',"op('../points')")
            assert p.expr=="op('../points')" and p.eval()==data
            undone=restore(initial,changed);assert str(p.mode).endswith('CONSTANT') and p.eval()==data
            redone=restore(changed,undone);assert str(p.mode).endswith('EXPRESSION') and p.eval()==data
            token=redone['history']['token'];program=shader.op('pixel_shader').text
            for count in (3,4,5):
                data.store('samples',[[float(i+j) for j in range(4)] for i in range(count)]);data.cook(force=True)
                snapshot=api('GET','sources')
                assert snapshot['history']['token']==token and row(snapshot)['type']=='vec3[3]'
                assert shader.op('pixel_shader').text==program
            checks.append(kind+': native binding, Undo/Redo, animated data is not configuration history')
            updated=copy.deepcopy(runtime.state()['graph'])
            assert runtime.deploy(updated,runtime.state()['revision'])['ok']
            assert p.expr=="op('../points')" and p.eval()==data
            checks.append(kind+': candidate validation keeps original relative CHOP ownership')
            # Import a native row: its type is inferred from the native element
            # menu and sample count once, without copying any sampled values.
            index=native.seq.array.numBlocks;native.seq.array.numBlocks=index+1
            getattr(native.par,'array'+str(index)+'name').val='uImported'
            getattr(native.par,'array'+str(index)+'type').val='vec4'
            getattr(native.par,'array'+str(index)+'arraytype').val='uniformarray'
            getattr(native.par,'array'+str(index)+'chop').val=data.path
            imported=api('GET','sources');new=next(r for r in imported['uniforms'] if r['name']=='uImported')
            assert new['type']=='vec4[5]' and new['components']==[]
            for element in ('float','vec2','vec3','vec4'):
                seen=api('GET','sources')
                created=api('POST','source-edit',dict(action='create',revision=seen['revision'],name='uNative_'+element,type=element+'[3]',sequence='array',arraySource=data.path))
                added=next(r for r in created['uniforms'] if r['name']=='uNative_'+element)
                assert added['sequence']=='array' and not added['missing']
            checks.append(kind+': native import and all four CHOP element carriers')
            if kind=='top':
                previous={n:shader.op(n).text for n in ('state','graph','manifest','pixel_shader')}
                empty=copy.deepcopy(runtime.state()['graph']);empty['topInputs']=[]
                empty['stages']['pixel']=dict(nodes=[core.node('builtin_source','infos',source='uTD2DInfos'),core.node('array_get','get',type='TDTexInfo[TD_NUM_2D_INPUTS]'),core.node('struct_field','field',type='TDTexInfo',field='res'),core.node('pixel_out','result')],edges=[core.edge('infos','get','Array'),core.edge('get','field','value'),core.edge('field','result','color')])
                rejected=False
                try:runtime.deploy(empty,runtime.state()['revision'])
                except Exception as exc:
                    rejected=True
                    assert 'source' in str(exc).lower() or 'array' in str(exc).lower(),str(exc)
                assert rejected and previous=={n:shader.op(n).text for n in previous}
                checks.append('TOP: empty builtin source rejects candidate and preserves graph and last valid shader')
        runtime._shaders.pop(shader.fetch('sgrapeShaderId'),None);shader.destroy()
    graph=core.demo_graph('color',target='mat')
    graph['stages']['pixel']=dict(nodes=[core.node('builtin_source','lights',source='uTDLights'),
        core.node('array_get','get',type='TDLight[TD_NUM_LIGHTS]'),core.node('struct_field','field',type='TDLight',field='diffuse'),
        core.node('rgba','rgba'),core.node('pixel_out','result')],edges=[core.edge('lights','get','Array'),core.edge('get','field','value'),core.edge('field','rgba','rgb'),core.edge('rgba','result','color')])
    shader=runtime.create_shader(area,'Test_mat_lights',graph,'mat')
    runtime.validate_material(shader)
    validation=manager.op('compiler_validation')
    assert validation.op('array_validation_light') is None
    assert 'array_validation_light' not in str(validation.op('render').par.lights.val)
    checks.append('MAT: light-array schema validates in isolated representative context; Render lights restored afterward')
    runtime._shaders.pop(shader.fetch('sgrapeShaderId'),None);shader.destroy()
    completed=True
finally:
    area.destroy()
    preserved=saved()==before_user and original._shader==original_selection
    registry_preserved=original_registry=={k:s.path for k,s in original._shaders.items() if s and s.valid}
    result=dict(passed=completed and preserved and registry_preserved,checks=checks,existingShadersPreserved=preserved,registryPreserved=registry_preserved,fixtureRemoved=op('/'+root_name) is None)
    (w/'array-sources-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    assert preserved and registry_preserved
