"""Back-light transmission against native lighting with CPU attenuation.

Uses live geometry and actual Light COMPs, including an independent occluder.
No existing shader or preset is deployed or edited.
"""
import importlib.util
import json
import math
import sys
import uuid
import numpy as np

live=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False))
before={n.path:{key:n.op(key).text for key in ('graph','state','pixel_shader','vertex_shader') if n.op(key)}
        for n in live.op('runtime').module._shaders.values() if n and n.valid}
area=op('/').create(baseCOMP,'grape_subsurface_'+uuid.uuid4().hex[:8]);old_path=list(sys.path);checks=[]


def vec(values):return 'vec3('+','.join(format(float(x),'.12f') for x in values)+')'


try:
    sys.path[:0]=[str(GRAPE_ROOT/'src/core'),str(GRAPE_ROOT/'tests/unit')]
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(GRAPE_TEST_OUTPUT/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager
    import test_subsurface_approx as fixture
    import test_view_material_helpers as helpers
    fixture.c=helpers.c=r.core()
    helpers.builtin=lambda key:next(f for f in r.core().function_library() if f['source']['id']=='sgrape.library.'+key)
    back=area.create(lightCOMP,'back');back.par.tz=-2;back.par.ry=180
    second=area.create(lightCOMP,'second');second.par.tz=-2;second.par.tx=.7;second.par.cr=.2;second.par.cg=.5;second.par.cb=1
    image=area.create(constantTOP,'environment');image.par.colorr=.7;image.par.colorg=.5;image.par.colorb=.3
    env=area.create(environmentlightCOMP,'environment_light');env.par.envlightmap=image
    occluder=area.create(geometryCOMP,'occluder');occluder.par.tz=-.7
    for child in occluder.children:
        if child.family in ('SOP','POP'):child.render=child.display=False
    blocker=occluder.create(boxSOP,'box');blocker.par.sizez=.1;blocker.render=blocker.display=True
    cases=[('unlit',{},'none'),('front',{},'front'),('back',{},'point'),('two-lights',{},'two'),
           ('cone',{},'cone'),('distant',{},'distant'),('attenuated',{},'attenuated'),('environment-only',{},'environment'),
           ('zero-thickness',dict(thickness=0),'point'),('negative-thickness',dict(thickness=-1),'point'),
           ('thick',dict(thickness=1),'point'),('long-distance',dict(distance=1),'point'),
           ('zero-distance',dict(distance=0),'point'),('negative-distance',dict(distance=-1),'point'),
           ('zero-strength',dict(strength=0),'point'),('negative-strength',dict(strength=-1),'point'),
           ('hdr',dict(color=[4,.5,.2],strength=3),'two'),('zero-normal',dict(normal=[0,0,0]),'point'),
           ('nonunit-normal',dict(normal=[0,0,4]),'point'),
           ('shadow-on',dict(shadowStrength=1),'shadow'),('shadow-off',dict(shadowStrength=0),'shadow'),
           ('shadow-half',dict(shadowStrength=.5),'shadow'),('shadow-negative',dict(shadowStrength=-1),'shadow'),
           ('shadow-above-one',dict(shadowStrength=2),'shadow')]
    images={}
    for label,values,kind in cases:
        g=fixture.subsurface_graph(values);shader=r.create_shader(area,'helper',g,'mat')
        try:
            reference=shader.copy(shader.op('material'),name='reference')
            pixel=shader.create(textDAT,'reference_pixel');reference.par.pdat=pixel
            factor=math.exp(-max(values.get('thickness',.1),0)/max(values.get('distance',.1),1e-6))*max(values.get('strength',1),0)
            tint=[v*factor for v in values.get('color',[1,1,1])]
            normal=vec(values['normal']) if 'normal' in values else 'sg_v_normal_0'
            shadow=min(1,max(0,values.get('shadowStrength',1)))
            header=shader.op('pixel_shader').text.split('void main()',1)[0]
            pixel.text=header+'''void main(){
                vec3 n = '''+normal+'''; n = -n / max(length(n), 1e-10);
                vec3 radiance = vec3(0.0);
                for(int i=0;i<TD_NUM_LIGHTS;i++){
                    radiance += TDLighting(i,sg_v_world_0,n,'''+format(shadow,'.8f')+''',vec3(0.0),vec3(0.0,0.0,1.0),1.0,1.0).diffuse;
                }
                fragColor[0]=vec4(radiance * '''+vec(tint)+''',1.0);
            }'''
            back.par.lighttype=kind if kind in ('cone','distant') else 'cone' if kind=='shadow' else 'point'
            back.par.tz=2 if kind=='front' else -2;back.par.ry=0 if kind=='front' else 180
            back.par.coneangle=80;back.par.conedelta=5
            back.par.attenuated=kind=='attenuated';back.par.attenuationstart=1;back.par.attenuationend=3
            back.par.shadowtype='hard2d' if kind=='shadow' else 'off';back.par.shadowcasters=occluder.path
            with r.validation_scene(shader) as render:
                render.par.format='rgba32float';render.par.dither=False
                geo=render.parent().op('geometry')
                original_geometry=render.par.geometry.val
                render.par.geometry=occluder.path+' '+geo.path if kind=='shadow' else geo.path
                render.par.lights='' if kind=='none' else env.path if kind=='environment' else back.path+' '+second.path if kind=='two' else back.path
                try:
                    geo.par.material=shader.op('material');render.cook(force=True);actual=render.numpyArray(delayed=False).copy()
                    assert not render.errors(),render.errors()
                    assert not shader.op('material').errors(),shader.op('material').errors()
                    geo.par.material=reference;render.cook(force=True);expected=render.numpyArray(delayed=False).copy()
                    info=shader.create(infoDAT,'reference_info');info.par.op=reference;info.cook(force=True)
                    assert 'ERROR:' not in info.text,info.text
                    a=actual[100:-100,100:-100];b=expected[100:-100,100:-100]
                    assert a.size>0 and np.min(a[:,:,3])>.9,'Empty comparison geometry'
                    assert np.isfinite(a).all() and np.isfinite(b).all()
                    error=float(np.max(np.abs(a-b)));assert error<.00005,(label,error,a[0,0],b[0,0])
                    black=label in ('unlit','front','environment-only','zero-distance','negative-distance','zero-strength','negative-strength','zero-normal')
                    if black:assert np.max(np.abs(a[:,:,:3]))<1e-6,(label,'expected black')
                    elif kind!='shadow':assert np.max(a[:,:,:3])>1e-6,(label,'unexpected black')
                    images[label]=a[:,:,:3].copy()
                    checks.append(dict(case=label,maxError=error,maxRGB=float(np.max(a[:,:,:3]))))
                finally:render.par.geometry=original_geometry
        finally:shader.destroy()
    (GRAPE_TEST_OUTPUT/'partial-results.json').write_text(json.dumps(checks,indent=2))
    assert np.mean(images['shadow-on']) < np.mean(images['shadow-off'])*.5,('Occluder did not cast a visible shadow',float(np.mean(images['shadow-on'])),float(np.mean(images['shadow-off'])))
    assert np.allclose(images['shadow-half'],(images['shadow-on']+images['shadow-off'])*.5,atol=.00005)
    assert np.allclose(images['shadow-negative'],images['shadow-off'],atol=.00005)
    assert np.allclose(images['shadow-above-one'],images['shadow-on'],atol=.00005)
    assert np.mean(images['thick'])<np.mean(images['back'])<np.mean(images['long-distance'])
    assert np.mean(images['attenuated'])<np.mean(images['back'])
    assert np.allclose(images['negative-thickness'],images['zero-thickness'],atol=.00005)
    # Color contribution is compatible with both materials; alpha passes through.
    back.par.shadowtype='off';back.par.attenuated=False;back.par.lighttype='point';back.par.tz=-2
    for model in ('phong','pbr'):
        g=fixture.subsurface_graph(dict(thickness=0,color=[.8,.3,.1]),material=model)
        material=next(n for n in g['stages']['pixel']['nodes'] if n['id']=='material')
        material['inputValues']={'baseColor':[0,0,0],'specularColor':[0,0,0],'alpha':.37,'ambient':0,'ambientStrength':0}
        # Only declared ports are valid inputValues.
        material['inputValues'].pop('ambient' if model=='pbr' else 'ambientStrength')
        shader=r.create_shader(area,'combined',g,'mat')
        try:
            with r.validation_scene(shader) as render:
                render.par.format='rgba32float';render.par.dither=False;render.par.lights=back.path
                geo=render.parent().op('geometry');geo.par.material=shader.op('material');render.cook(force=True)
                a=render.numpyArray(delayed=False)[100:-100,100:-100]
                assert not shader.op('material').errors(),shader.op('material').errors()
                assert np.isfinite(a).all() and np.max(a[:,:,:3])>.001
                assert np.max(np.abs(a[:,:,3]-.37))<1e-5,(model,'alpha changed')
                checks.append(dict(material=model,emission=True,alphaPreserved=True))
        finally:shader.destroy()
    assert before=={path:{key:op(path).op(key).text for key in values} for path,values in before.items()}
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(dict(passed=True,build=str(app.build),checks=checks,shadersPreserved=len(before)),indent=2),encoding='utf-8')
finally:
    sys.path[:]=old_path
    area.destroy()
