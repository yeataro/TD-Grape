"""Real Vertex sampler binding and displacement versus independent GLSL."""
import importlib.util
import json
import sys
import uuid
import numpy as np

live=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False))
before={n.path:{key:n.op(key).text for key in ('graph','state','pixel_shader','vertex_shader') if n.op(key)}
        for n in live.op('runtime').module._shaders.values() if n and n.valid}
area=op('/').create(baseCOMP,'grape_displacement_test_'+uuid.uuid4().hex[:8]);old_path=list(sys.path);checks=[]
try:
    sys.path.insert(0,str(GRAPE_ROOT/'src/core'));sys.path.insert(0,str(GRAPE_ROOT/'tests/unit'))
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(GRAPE_TEST_OUTPUT/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager
    spec=importlib.util.spec_from_file_location('displacement_fixture',GRAPE_ROOT/'tests/unit/test_displacement.py')
    fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture);fixture.c=r.core()
    fixture.builtin=lambda key:next(f for f in r.core().function_library() if f['source']['id']=='sgrape.library.'+key)
    image=area.create(constantTOP,'height_map');image.par.format='rgba32float'
    image.par.resolutionw=8;image.par.resolutionh=8;image.par.alpha=1
    cases=[('midlevel',.5,.3,.5,(1,2,3),False,False),('positive',.8,.3,.5,(1,2,3),False,False),
           ('negative',.2,.3,.5,(1,2,3),False,False),('scale-zero',.8,0,.5,(1,2,3),False,False),
           ('negative-scale',.8,-.3,.5,(1,2,3),False,False),('unclamped',1.5,.3,0,(1,2,3),False,False),
           ('vertex-texture',.8,.3,.5,(1,2,3),True,False),('shared-stages',.8,.3,.5,(1,2,3),True,True)]
    for label,height,scale,midlevel,normal,sampled,shared in cases:
        for channel,value in zip('rgb',[height,.31,.72]):getattr(image.par,'color'+channel).val=value
        graph=fixture.displacement_graph(height,scale,midlevel,normal,sampled,shared)
        if sampled:graph['declarations'][0]['source']='op:'+image.path
        shader=r.create_shader(area,'helper',graph,'mat')
        try:
            reference=shader.copy(shader.op('material'),name='reference')
            dat=shader.create(textDAT,'reference_vertex');reference.par.vdat=dat
            header=shader.op('vertex_shader').text.split('void main()',1)[0]
            h='textureLod(sHeight,TDTexCoord(0u).xy,0.0).r' if sampled else str(float(height))
            norm='vec3('+','.join(str(float(x)) for x in normal)+')'
            dat.text=header+'void main(){ vec3 displaced=TDPos()+normalize('+norm+')*(('+h+')-'+str(float(midlevel))+')*'+str(float(scale))+'; vec4 world=TDDeform(displaced); sg_v_world_0=world.xyz; sg_uv=TDTexCoord(0u).xy; gl_Position=TDWorldToProj(world); }'
            with r.validation_scene(shader) as render:
                render.par.format='rgba32float';render.par.dither=False
                geo=render.parent().op('geometry');geo.par.ry=17
                for update in ([height,.12] if sampled else [height]):
                    if sampled:image.par.colorr=update
                    geo.par.material=shader.op('material');render.cook(force=True);actual=render.numpyArray(delayed=False).copy()
                    assert not shader.op('material').errors(),shader.op('material').errors()
                    assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
                    geo.par.material=reference;render.cook(force=True);expected=render.numpyArray(delayed=False).copy()
                    info=shader.op('reference_info') or shader.create(infoDAT,'reference_info');info.par.op=reference;info.cook(force=True)
                    assert 'ERROR:' not in info.text,info.text
                    assert np.isfinite(actual).all() and np.isfinite(expected).all()
                    assert np.count_nonzero(expected[:,:,3]>.5)>100, 'Empty reference image'
                    error=float(np.max(np.abs(actual-expected)));assert error<.00002,(label,error)
                    checks.append(dict(case=label,height=update,maxError=error))
                geo.par.ry=0
        finally:shader.destroy()
    assert before=={path:{key:op(path).op(key).text for key in values} for path,values in before.items()}
    result=dict(passed=True,build=str(app.build),checks=checks,shadersPreserved=len(before))
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:
    sys.path[:]=old_path
    area.destroy()
