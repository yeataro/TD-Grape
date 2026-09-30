"""Render Bump against an independent tangent-constraint CPU oracle."""
import importlib.util
import json
import math
import sys
import uuid
import numpy as np

live=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False))
before={n.path:{key:n.op(key).text for key in ('graph','state','manifest','pixel_shader','vertex_shader') if n.op(key)}
        for n in live.op('runtime').module._shaders.values() if n and n.valid}
area=op('/').create(baseCOMP,'grape_bump_'+uuid.uuid4().hex[:8]);old_path=list(sys.path);checks=[]


def unit(value):
    value=np.array(value,dtype=float);length=np.linalg.norm(value)
    return value/max(length,1e-10)


def oracle(values,slope=(1,.5,0),rotation=0,geometry_normal=False):
    angle=math.radians(rotation);u=np.array([1,0,0]);v=np.array([0,math.cos(angle),math.sin(angle)])
    normal=unit(np.cross(u,v) if geometry_normal else values.get('normal',[0,0,1]))
    if 'position' in values or np.linalg.norm(normal)==0:return normal
    constraints=np.array([u,v,normal])
    if abs(np.linalg.det(constraints))<1e-6:return normal
    slope=np.zeros(3) if 'height' in values else np.array(slope)
    # A surface gradient is tangent to Normal and reproduces directional
    # height changes along the two geometric tangents. No cross-product
    # gradient formula or graph evaluator is shared with the implementation.
    gradient=np.linalg.solve(constraints,[np.dot(slope,u),np.dot(slope,v),0])
    perturbed=unit(normal-values.get('distance',.1)*gradient)
    strength=min(1,max(0,values.get('strength',1)))
    return unit((1-strength)*normal+strength*perturbed)


try:
    sys.path[:0]=[str(GRAPE_ROOT/'src/core'),str(GRAPE_ROOT/'tests/unit')]
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(GRAPE_TEST_OUTPUT/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager
    spec=importlib.util.spec_from_file_location('bump_fixture',GRAPE_ROOT/'tests/unit/test_bump.py')
    fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture);fixture.c=r.core()
    fixture.library=lambda key:next(f for f in r.core().function_library() if f['source']['id']=='sgrape.library.'+key)
    cases=[('slope',{}),('constant-height',{'height':.75}),('zero-strength',{'strength':0}),
           ('partial-strength',{'strength':.35}),('negative-strength',{'strength':-1}),('clamped-strength',{'strength':2}),
           ('zero-distance',{'distance':0}),('inverted',{'distance':-.4}),('strong-relief',{'distance':3}),
           ('nonunit-normal',{'normal':[0,0,8]}),('tilted-normal',{'normal':[.3,.2,1]}),
           ('reversed-normal',{'normal':[0,0,-1]}),('zero-normal',{'normal':[0,0,0]}),
           ('degenerate-position',{'position':[0,0,0],'normal':[.2,.3,1]}),('grazing-normal',{'normal':[1,0,0]})]
    cases += [('geometry-rotated',{}),('geometry-reversed',{}),('texture-height',{}),('normal-map-chain',{})]
    ramp=area.create(glslTOP,'height_texture');ramp.par.outputresolution='custom';ramp.par.resolutionw=128;ramp.par.resolutionh=128;ramp.par.format='rgba32float'
    ramp_dat=area.create(textDAT,'height_texture_pixel');ramp.par.pixeldat=ramp_dat
    ramp_dat.text='layout(location=0) out vec4 fragColor; void main(){fragColor=vec4(vUV.x,0.0,0.0,1.0);}'
    ramp.cook(force=True);assert not ramp.errors(),ramp.errors()
    for label,values in cases:
        rotation=32 if label=='geometry-rotated' else 180 if label=='geometry-reversed' else 0
        geometry_normal=label.startswith('geometry-')
        slope=(.1,0,0) if label=='texture-height' else (1,.5,0)
        graph=fixture.bump_graph(values,slope,geometry_normal,texture=ramp.path if label=='texture-height' else None)
        if label=='normal-map-chain':
            normal_map=fixture.library('normal_map');graph['functions'].append(normal_map)
            graph['stages']['pixel']['nodes'].append(dict(id='normal_map',name='Normal_Map',definitionUuid=r.core().CALL,
                params={'functionId':normal_map['id']},inputValues={'color':[.65,.35,1,1]},ui={'x':300,'y':400}))
            graph['stages']['pixel']['edges'] += [r.core().edge('inputs','normal_map','position','world'),
                r.core().edge('inputs','normal_map','normal','normal'),r.core().edge('normal_map','bump','normal','normal')]
            values={'normal':[.3,-.3,1]}
        expected=oracle(values,slope,rotation,geometry_normal)
        shader=r.create_shader(area,'helper',graph,'mat')
        try:
            reference=shader.copy(shader.op('material'),name='reference')
            dat=shader.create(textDAT,'reference_pixel');reference.par.pdat=dat
            header=shader.op('pixel_shader').text.split('void main()',1)[0]
            dat.text=header+'void main(){fragColor[0]=vec4(1.0);}'
            with r.validation_scene(shader) as render:
                geo=render.parent().op('geometry');original_rx=geo.par.rx.eval()
                try:
                    geo.par.rx=rotation;render.par.format='rgba32float';render.par.dither=False
                    geo.par.material=reference;render.cook(force=True)
                    mask=render.numpyArray(delayed=False)[:,:,3]>.5
                    for axis in (0,1):mask &= np.roll(mask,2,axis)&np.roll(mask,-2,axis)
                    assert int(mask.sum())>100,(label,'empty geometry')
                    geo.par.material=shader.op('material');render.cook(force=True)
                    image=render.numpyArray(delayed=False).copy()
                    assert not shader.op('material').errors(),shader.op('material').errors()
                    assert np.isfinite(image).all(),(label,'nonfinite')
                    error=float(np.max(np.abs(image[mask,:3]-expected)))
                    tolerance=.003 if label=='texture-height' else .0003
                    assert error<tolerance,(label,error,image[mask][0].tolist(),expected.tolist())
                    assert np.max(np.abs(image[mask,3]-1))<1e-6
                    checks.append(dict(case=label,maxError=error,pixels=int(mask.sum())))
                    (GRAPE_TEST_OUTPUT/'progress.json').write_text(json.dumps(checks,indent=2))
                finally:geo.par.rx=original_rx
        finally:shader.destroy()
    for material in ('material_phong','material_pbr'):
        shader=r.create_shader(area,'material_integration',fixture.bump_graph(geometry_normal=True,material=material),'mat')
        try:
            assert not shader.op('material').errors(),shader.op('material').errors()
            assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
            checks.append(dict(case=material+'-normal-input',compiled=True))
        finally:shader.destroy()
    assert before=={path:{key:op(path).op(key).text for key in values} for path,values in before.items()}
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(dict(passed=True,build=str(app.build),checks=checks,
        shadersPreserved=len(before)),indent=2),encoding='utf-8')
finally:
    sys.path[:]=old_path
    area.destroy()
