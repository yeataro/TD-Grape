"""Render helper graphs against independent CPU values and camera transforms."""
import importlib.util
import json
import math
import sys
import uuid
import numpy as np

live=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False))
before={n.path:{key:n.op(key).text for key in ('graph','state','pixel_shader','vertex_shader') if n.op(key)}
        for n in live.op('runtime').module._shaders.values() if n and n.valid}
area=op('/').create(baseCOMP,'grape_view_helpers_'+uuid.uuid4().hex[:8]);old_path=list(sys.path);checks=[]


def unit(v):
    v=np.array(v,dtype=float);length=np.linalg.norm(v)
    return v/length if length>1e-10 else v*0


def oracle(key,values):
    if key=='mapping':
        p=np.array(values.get('vector',[0,0,0]),dtype=float)*values.get('scale',[1,1,1])
        for axis,degrees in enumerate(values.get('rotation',[0,0,0])):
            a=math.radians(degrees);co=math.cos(a);si=math.sin(a)
            # Rodrigues' formula, independent of TD's matrix helpers.
            direction=np.eye(3)[axis]
            p=p*co+np.cross(direction,p)*si+direction*np.dot(direction,p)*(1-co)
        return [*list(p+values.get('translation',[0,0,0])),1]
    cosine=min(1.0,abs(float(np.dot(unit(values.get('normal',[0,0,1])),unit(values.get('viewDirection',[0,0,1]))))))
    if key=='facing':return [1-cosine]*4
    eta=max(float(values.get('ior',1.45)),1e-6)
    if eta==1:return [0]*4
    if cosine==1:return [((eta-1)/(eta+1))**2]*4
    theta=math.acos(cosine);sine_t=math.sin(theta)/eta
    if sine_t>=1:return [1]*4
    theta_t=math.asin(sine_t)
    rs=(math.sin(theta-theta_t)/math.sin(theta+theta_t))**2
    rp=(math.tan(theta-theta_t)/math.tan(theta+theta_t))**2
    return [min(1.0,max(0.0,(rs+rp)*.5))]*4


def glsl(value):return 'vec'+str(len(value))+'('+','.join(format(float(x),'.12g')+('.0' if float(x).is_integer() else '') for x in value)+')'


try:
    sys.path[:0]=[str(GRAPE_ROOT/'src/core'),str(GRAPE_ROOT/'tests/unit')]
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(GRAPE_TEST_OUTPUT/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager
    spec=importlib.util.spec_from_file_location('view_helper_fixture',GRAPE_ROOT/'tests/unit/test_view_material_helpers.py')
    fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture);fixture.c=r.core()
    fixture.builtin=lambda key:next(f for f in r.core().function_library() if f['source']['id']=='sgrape.library.'+key)
    cases=[('mapping',{},'identity'),('mapping',dict(vector=[.2,.4,.8],scale=[2,-3,.5],rotation=[23,41,-67],translation=[.1,-.2,.3]),'combined'),
           ('mapping',dict(vector=[1,2,3],rotation=[90,0,0]),'rotate-x'),('mapping',dict(vector=[1,2,3],rotation=[0,90,0]),'rotate-y'),
           ('mapping',dict(vector=[1,2,3],rotation=[0,0,90]),'rotate-z'),('mapping',dict(vector=[1,2,3],scale=[0,0,0],translation=[2,3,4]),'zero-scale')]
    for key in ('facing','fresnel'):
        for label,values in [('normal',{}),('grazing',dict(viewDirection=[1,0,0])),('back',dict(viewDirection=[0,0,-3])),
                             ('oblique',dict(normal=[0,0,7],viewDirection=[1,0,1])),('zero-normal',dict(normal=[0,0,0]))]:cases.append((key,values,label))
    for label,values in [('same-medium',dict(ior=1)),('same-grazing',dict(ior=1,viewDirection=[1,0,0])),
                         ('tir',dict(ior=.6666667,viewDirection=[1,0,.3])),('exit',dict(ior=.6666667,viewDirection=[.1,0,1])),
                         ('invalid-ior',dict(ior=0)),('glass',dict(ior=1.5)),('brewster',dict(ior=1.5,viewDirection=[1.5,0,1]))]:cases.append(('fresnel',values,label))
    for key,values,label in cases:
        for stage in ('pixel','vertex'):
            graph=fixture.helper_graph(key,values,stage=stage);shader=r.create_shader(area,'helper',graph,'mat')
            try:
                reference=shader.copy(shader.op('material'),name='reference')
                dat=shader.create(textDAT,'reference_pixel');reference.par.pdat=dat
                header=shader.op('pixel_shader').text.split('void main()',1)[0]
                expected_value=oracle(key,values)
                with r.validation_scene(shader) as render:
                    render.par.format='rgba32float';render.par.dither=False
                    geo=render.parent().op('geometry')
                    dat.text=header+'void main(){fragColor[0]=vec4(1.0);}'
                    geo.par.material=reference;render.cook(force=True);mask=render.numpyArray(delayed=False)[:,:,3]>.5
                    assert int(mask.sum())>100,'Empty comparison geometry'
                    geo.par.material=shader.op('material');render.cook(force=True);actual=render.numpyArray(delayed=False).copy()
                    assert not shader.op('material').errors(),shader.op('material').errors()
                    assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
                    assert np.isfinite(actual).all(),(key,label,'nonfinite')
                    error=float(np.max(np.abs(actual[mask]-expected_value)))
                    assert error<.00004,(key,label,stage,error,actual[mask][0].tolist(),expected_value)
                    checks.append(dict(helper=key,case=label,stage=stage,maxError=error))
            finally:shader.destroy()
    for projection in ('persp','ortho'):
        for stage in ('pixel','vertex'):
            for position,live_position in [([.3,.4,0],False),([0,0,0],True)]:
                graph=fixture.helper_graph('view_direction',dict(position=position,camera=99),stage=stage,live_camera=live_position)
                shader=r.create_shader(area,'view',graph,'mat')
                try:
                    reference=shader.copy(shader.op('material'),name='reference')
                    pixel=shader.create(textDAT,'reference_pixel');reference.par.pdat=pixel
                    ph=shader.op('pixel_shader').text.split('void main()',1)[0]
                    with r.validation_scene(shader) as render:
                        render.par.format='rgba32float';render.par.dither=False
                        geo=render.parent().op('geometry');camera=render.par.camera.eval()
                        saved={p.name:p.val for p in camera.pars('projection','tx','ty','tz','rx','ry','rz','orthowidth')}
                        try:
                            camera.par.projection=projection;camera.par.orthowidth=2
                            camera.par.tx=.2;camera.par.ty=.1;camera.par.tz=2;camera.par.rx=-3;camera.par.ry=5
                            transform=camera.worldTransform
                            origin=[transform[i,3] for i in range(3)];axis=[transform[i,2] for i in range(3)]
                            pos=('world.xyz' if stage=='vertex' else 'sg_v_world_0') if live_position else glsl(position)
                            expr=glsl(unit(axis)) if projection=='ortho' else 'normalize('+glsl(origin)+'-('+pos+'))'
                            if stage=='vertex':
                                vd=shader.create(textDAT,'reference_vertex');reference.par.vdat=vd
                                vh=shader.op('vertex_shader').text.split('void main()',1)[0]
                                vd.text=vh+'void main(){vec4 world=TDDeform(TDPos());sg_uv=TDTexCoord(0u).xy;gl_Position=TDWorldToProj(world);sg_v_value_0=vec4('+expr+',1.0);}'
                                expr='sg_v_value_0.xyz'
                            pixel.text=ph+'void main(){fragColor[0]=vec4('+expr+',1.0);}'
                            geo.par.material=shader.op('material');render.cook(force=True);actual=render.numpyArray(delayed=False).copy()
                            assert not shader.op('material').errors(),shader.op('material').errors()
                            geo.par.material=reference;render.cook(force=True);expected=render.numpyArray(delayed=False).copy()
                            info=shader.create(infoDAT,'reference_info');info.par.op=reference;info.cook(force=True)
                            assert 'ERROR:' not in info.text,info.text
                            assert np.isfinite(actual).all() and np.isfinite(expected).all()
                            assert np.count_nonzero(expected[:,:,3]>.5)>100,'Empty camera comparison'
                            error=float(np.max(np.abs(actual-expected)))
                            if error>=.00004:
                                (GRAPE_TEST_OUTPUT/'view-failure.json').write_text(json.dumps(dict(projection=projection,stage=stage,livePosition=live_position,
                                    origin=origin,axis=axis,actual=actual[actual.shape[0]//2,actual.shape[1]//2].tolist(),expected=expected[expected.shape[0]//2,expected.shape[1]//2].tolist(),
                                    coverage=[int(np.count_nonzero(a[:,:,3]>.5)) for a in (actual,expected)],maxError=error),indent=2))
                                (GRAPE_TEST_OUTPUT/'view-failure.glsl').write_text(shader.op('pixel_shader').text)
                            assert error<.00004,(projection,stage,live_position,error)
                            checks.append(dict(helper='view_direction',projection=projection,stage=stage,livePosition=live_position,maxError=error))
                        finally:
                            for name,value in saved.items():getattr(camera.par,name).val=value
                finally:shader.destroy()
    assert before=={path:{key:op(path).op(key).text for key in values} for path,values in before.items()}
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(dict(passed=True,build=str(app.build),checks=checks,shadersPreserved=len(before)),indent=2),encoding='utf-8')
finally:
    sys.path[:]=old_path
    area.destroy()
