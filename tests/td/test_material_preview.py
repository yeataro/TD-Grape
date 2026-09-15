"""Isolated multi-frame MAT viewer, validation and TOX persistence checks.

Submit with the development runner; read native-result.json after passed appears.
The temporary Execute DAT is removed with its test component on completion.
"""
import copy,json,time,uuid,traceback,threading
from pathlib import Path
import numpy as np


def check(name,value):
    checks.append({'name':name,'passed':bool(value)})
    assert value,name


def snapshot(runtime):
    return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in runtime.shaders()}


def job(comp):
    value={'args':('GET','/api/'+comp.fetch('sgrapeShaderId')+'/preview',{}),'lock':threading.Lock(),'done':threading.Event()}
    r._queue.put_nowait(value)
    return value


def pixels(comp):
    top=r.material_preview(comp);top.cook(force=True)
    return top.numpyArray(delayed=False).copy()


def begin(source_root,report,files,runtime_source=None):
    global root,w,original,before,r,c,checks,phase,mat,other,top,request,texture_request,render_cooks,previous,saved,target_id,original_material,metrics,deadline
    root=me.parent();w=Path(report);checks=[];phase=0;metrics={};deadline=time.monotonic()+20
    original=next(n for n in op('/project1').findChildren() if n.storage.get('sgrapeManager', False)).op('runtime').module;before=snapshot(original)
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder')
    manager.par.Personalfolder=str(w/'empty_personal')
    for dat,name in {'node_catalog':'node_catalog.json','core':'sgrape_core.py','personal_library':'sgrape_library.py','document':'sgrape_document.py','sources':'sgrape_sources.py','parameters':'sgrape_parameters.py','parameter_links':'sgrape_parameter_links.py','runtime':'sgrape_runtime.py','shader_controls':'shader_controls.py'}.items():
        path=runtime_source if dat=='runtime' and runtime_source else files[name]
        manager.create(textDAT,dat).text=Path(path).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    r.service_network=lambda:None;r.service_family_startup=lambda:None
    graph=c.demo_graph('color','mat');graph['declarations']=[{'id':'color','kind':'uniform','name':'uPreviewColor','type':'vec4','value':[.8,.2,.1,.6]}]
    graph['stages']['pixel']={'nodes':[c.node('uniform','source',declarationId='color'),c.node('pixel_out','output')],'edges':[c.edge('source','output','color')]}
    graph=manager.op('document').module.stamp_catalog(graph,c)
    review=manager.op('document').module.inspect_upgrade(graph,c,'mat',require_baseline=False)
    assert not review['required'] and not review['blocked'],json.dumps(review)
    mat=r.create_shader(root,'Mat',graph,'mat');other=r.create_shader(root,'Texture',kind='mat');top=r.create_shader(root,'Top',kind='top')
    for comp in (mat,other,top):comp.viewer=False
    original_material=mat.op('material');target_id=mat.fetch('sgrapeShaderId');saved=mat.op('state').text
    check('MAT capture uses actual material',r.material_preview(mat).par.opviewer.eval()==original_material)
    check('COMP viewer uses material',mat.par.opviewer.eval()==original_material)
    check('TOP retains resolution preview',top.op('preview').inputs[0]==top.op('shader') and not top.op('grape_material_preview'))
    # Exercise conversion of an already saved old scene without recompilation.
    r.material_preview(mat).destroy();mat.par.opviewer.expr="me.op('preview')"
    r.register_shader(mat)
    check('register preserves graph and material identity',mat.op('state').text==saved and mat.op('material')==original_material and mat.fetch('sgrapeShaderId')==target_id)
    render_cooks=mat.op('preview').totalCooks
    request=job(mat);texture_request=job(other);r.tick();check('fresh image waits for TD drawing',not request['done'].is_set())
    callbacks=root.create(executeDAT,'frames');callbacks.text="def onFrameStart(frame):\n    parent().op('test').module.advance()\n";callbacks.par.framestart=True;callbacks.par.active=True


def advance():
    global phase,request,previous,loaded,saved,render_cooks
    try:
        if time.monotonic()>deadline:raise TimeoutError('MAT preview test did not finish within 20 seconds')
        if phase==0:
            r.tick()
            if not request['done'].is_set():return
            check('first preview responds after draw','error' not in request)
            image=pixels(mat);previous=image
            metrics['initialMax']=image.max(axis=(0,1)).tolist()
            metrics['initialMean']=image.mean(axis=(0,1)).tolist()
            check('native image has visible geometry and transparent background',image[:,:,3].max()>.5 and image[:,:,3].min()==0)
            check('first image uses the actual shader color',image[:,:,0].max()>.7 and image[:,:,1].max()<.3 and image[:,:,2].max()<.2)
            check('PNG path uses native image',request['result']==r.png(mat))
            check('native capture does not cook validation Render',mat.op('preview').totalCooks==render_cooks)
            r.material_preview(mat).save(str(w/'material.png'))
            check('second material request completes independently',texture_request['done'].is_set() and 'error' not in texture_request)
            texture=pixels(other);check('texture native image is not blank',texture[:,:,:3].max()>.3)
            r.material_preview(other).save(str(w/'texture.png'))
            start=time.perf_counter()
            for _ in range(3):r.png(mat)
            metrics['warmPngMeanMs']=(time.perf_counter()-start)*1000/3
            check('read-only previews preserve graph',mat.op('state').text==saved)
            for key,value in zip(('vec0valuex','vec0valuey','vec0valuez','vec0valuew'),(.1,.3,.9,.4)):
                getattr(mat.op('material').par,key).val=value
            request=job(mat);r.tick();phase=1
        elif phase==1:
            r.tick()
            if not request['done'].is_set():return
            check('changed Uniform capture completes','error' not in request)
            current=pixels(mat);r.material_preview(mat).save(str(w/'changed.png'));metrics['changedMax']=current.max(axis=(0,1)).tolist();check('native Uniform edit changes the image',float(np.max(np.abs(current-previous)))>.1)
            with r.shader_context(mat):
                try:r.deploy(copy.deepcopy(r.state()['graph']),r.state()['revision'],inject_failure=True)
                except RuntimeError:pass
                else:raise AssertionError('Injected compile failure was accepted')
            check('failed apply preserves saved graph and material',mat.op('state').text==saved and mat.op('material')==original_material)
            # Vertex transformation and multiple pixel outputs still compile in
            # the native viewer, whose render target count can differ.
            graph=copy.deepcopy(json.loads(mat.op('graph').text))
            output=graph['stages']['pixel']['nodes'][-1]
            output['params']['bufferCount']=4
            with r.shader_context(mat):r.deploy(graph,r.state()['revision'])
            r.validate_material(mat)
            saved=mat.op('state').text
            mat.save(str(w/'material.tox'));loaded=root.loadTox(str(w/'material.tox'));r.register_shader(loaded,fresh=True);loaded.viewer=False
            check('TOX preserves graph and capture source',loaded.op('state').text==saved and r.material_preview(loaded).par.opviewer.eval()==loaded.op('material'))
            request=job(loaded);r.tick();phase=2
        elif phase==2:
            r.tick()
            if not request['done'].is_set():return
            check('reloaded native capture responds','error' not in request)
            check('reloaded image is visible',pixels(loaded)[:,:,3].max()>.2)
            check('native viewer compilation has no errors',not loaded.op('material').errors() and not r.material_preview(loaded).errors())
            check('read-only TOP PNG still works',r.png(top).startswith(b'\x89PNG'))
            finish(True)
    except Exception:finish(False,traceback.format_exc())


def finish(passed,error=None):
    try:
        check('user shaders unchanged',before==snapshot(original))
    except Exception:
        passed=False;error=(error or '')+'\n'+traceback.format_exc()
    (w/'native-result.json').write_text(json.dumps({'passed':passed,'checks':checks,'error':error,'metrics':metrics,'build':app.build},indent=2),encoding='utf-8')
    root.destroy()


if __name__=='__grape_job__':
    test_root=op('/').create(baseCOMP,'grape_mat_preview_test_'+uuid.uuid4().hex[:8])
    test=test_root.create(textDAT,'test');test.text=Path(__file__).read_text(encoding='utf-8')
    paths=json.loads((GRAPE_ROOT/'src/td/source_files.json').read_text(encoding='utf-8'))
    files={name:str(GRAPE_ROOT/relative) for name,relative in paths.items()}
    try:test.module.begin(str(GRAPE_ROOT),str(GRAPE_TEST_OUTPUT),files,globals().get('GRAPE_RUNTIME_DRAFT'))
    except Exception:
        test_root.destroy();raise
    result={'started':True,'report':str(GRAPE_TEST_OUTPUT/'native-result.json')}
