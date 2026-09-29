"""Render integrated textured presets against independently written GLSL.

Shares native bindings and the vertex transform, not the graph's material code.
Temporary fixtures only; leaves existing shaders and masters untouched.
"""
from pathlib import Path
import copy,json,uuid
import numpy as np

area=op('/').create(baseCOMP,'grape_texture_materials_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(GRAPE_TEST_OUTPUT/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    presets=json.loads(manager.op('material_presets').text)
    light=area.create(lightCOMP,'light');light.par.tz=2;light.par.tx=.7
    image=area.create(constantTOP,'environment');image.par.colorr=.4;image.par.colorg=.3;image.par.colorb=.2
    env=area.create(environmentlightCOMP,'environment_light');env.par.envlightmap=image
    for model in ('phong','pbr'):
        base=presets[model+'_textured'];shader=None
        for case in ('default','mapped','tilted-normal','zero-normal-strength','unlit','emission','back')+(('zero-roughness','environment') if model=='pbr' else ()):
            graph=copy.deepcopy(base)
            for d in graph['declarations']:
                if d['kind']=='uniform':
                    if d['id']=='normalStrength' and case=='zero-normal-strength':d['value']=0
                    if d['id']=='metallic' and case=='mapped':d['value']=.45
                    if d['id']=='roughness' and case=='zero-roughness':d['value']=0
                    if d['id']=='emission' and case in ('mapped','emission'):d['value']=[.2,.1,.3]
                elif d['kind']=='sampler' and (case=='mapped' or d['id']=='normalMap' and case in ('tilted-normal','zero-normal-strength')):
                    name=d['id'];image=area.op(name) or area.create(constantTOP,name)
                    rgb=([.5,.5,1] if name=='normalMap' else [.31,.53,.79])
                    if name=='normalMap' and case in ('tilted-normal','zero-normal-strength'):rgb=[.8,.5,.9]
                    for channel,value in zip('rgb',rgb):getattr(image.par,'color'+channel).val=value
                    image.par.alpha=1 if name=='normalMap' else .4;image.par.format='rgba32float';image.par.resolutionw=4;image.par.resolutionh=4
                    d['source']='op:'+image.path
            shader=r.create_shader(area,'Material',graph,'mat')
            reference=shader.copy(shader.op('material'),name='reference')
            dat=shader.create(textDAT,'reference_pixel');reference.par.pdat=dat
            header=shader.op('pixel_shader').text.split('void main()',1)[0]
            # Every scalar map uses red, color maps use RGB. Normal is raw data.
            body='''
void main() {
 TDCheckDiscard();
 vec2 uv=sg_v_uv_0.xy;
 vec3 pos=sg_v_world_0;
 vec3 n=(texture(sNormalMap,uv).xyz-0.5)*2.0;
 n.xy*=uNormalStrength;
 n=normalize(sg_v_tbn_0*n);
 if(!TDFrontFacing(pos,sg_v_normal_0)) n=-n;
 vec3 view=normalize(uTDMats[sg_v_camera_0].camInverse[3].xyz-pos);
 vec4 pointColor=TDPixelColor(sg_v_color_0);
 float a=uAlpha*texture(sAlphaMap,uv).r;
 vec3 base=uBaseColor*texture(sBaseColorMap,uv).rgb;
 vec3 emission=uEmission*texture(sEmissionMap,uv).rgb;
 float shadow=uShadowStrength*texture(sShadowStrengthMap,uv).r;
 vec3 shadowColor=uShadowColor*texture(sShadowColorMap,uv).rgb;
 vec3 d=vec3(0),s=vec3(0);
'''
            if model=='pbr':
                body+='''
 base*=a*pointColor.rgb;
 float metal=uMetallic*texture(sMetallicMap,uv).r;
 float rough=max(uRoughness*texture(sRoughnessMap,uv).r,0.0001);
 float ao=uAmbientOcclusion*texture(sAmbientOcclusionMap,uv).r;
 vec3 kd=base*(1-metal);
 vec3 f0=mix(vec3(0.08*uSpecularLevel*texture(sSpecularLevelMap,uv).r),base,metal);
 for(int i=0;i<TD_NUM_LIGHTS;++i){TDPBRResult t=TDLightingPBR(i,kd,f0,pos,n,shadow,shadowColor,view,rough);d+=t.diffuse;s+=t.specular;}
 for(int i=0;i<TD_NUM_ENV_LIGHTS;++i){TDPBRResult t=TDEnvLightingPBR(i,kd,f0,n,view,rough,ao);d+=t.diffuse;s+=t.specular;}
 d+=uTDGeneral.ambientColor.rgb*kd*ao;
 vec4 result=vec4(d+s+emission,a*pointColor.a);
'''
            else:
                body+='''
 float shine=uShininess*texture(sShininessMap,uv).r;
 for(int i=0;i<TD_NUM_LIGHTS;++i){TDPhongResult t=TDLighting(i,pos,n,shadow,shadowColor,view,shine,shine);d+=t.diffuse;s+=t.specular;}
 d=(d+uTDGeneral.ambientColor.rgb*uAmbient*texture(sAmbientMap,uv).r)*base;
 s*=uSpecularColor*texture(sSpecularColorMap,uv).rgb;
 vec4 result=vec4((d+s+emission)*a*pointColor.rgb,a*pointColor.a);
'''
            body+='''
 result=TDFog(result,pos,sg_v_camera_0);
 result=TDDither(result); TDAlphaTest(result.a);
 result=TDConvertColorSpace(result);
 fragColor[0]=TDOutputSwizzle(result);
}
'''
            dat.text=header+body
            try:
                with r.validation_scene(shader) as render:
                    render.par.format='rgba32float';render.par.dither=False
                    render.par.lights='' if case in ('unlit','emission') else env.path if case=='environment' else light.path
                    geo=render.parent().op('geometry');geo.par.ry=180 if case=='back' else 0
                    # The fixture supplies tangents as required by TD native
                    # normal mapping. Production shaders never generate them.
                    rect=geo.op('rectangle')
                    coordinates=geo.op('with_uv') or geo.create(textureSOP,'with_uv')
                    coordinates.inputConnectors[0].connect(rect);coordinates.render=coordinates.display=False
                    tangents=geo.op('with_tangents') or geo.create(attributecreateSOP,'with_tangents')
                    tangents.inputConnectors[0].connect(coordinates);tangents.par.comptang=True
                    rect.render=rect.display=False;tangents.render=tangents.display=True
                    geo.par.material=shader.op('material');render.cook(force=True);actual=render.numpyArray(delayed=False).copy()[80:-80,80:-80]
                    assert not shader.op('material').errors(),shader.op('material').errors()
                    assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
                    geo.par.material=reference;render.cook(force=True);expected=render.numpyArray(delayed=False).copy()[80:-80,80:-80]
                    assert not reference.errors(),reference.errors()
                    info=shader.create(infoDAT,'reference_info');info.par.op=reference;info.cook(force=True)
                    assert 'ERROR:' not in info.text,info.text
                    assert np.isfinite(actual).all() and np.isfinite(expected).all(),(model,case,'nonfinite')
                    error=float(np.max(np.abs(actual-expected)))
                    assert error<.0001,(model,case,error)
                    if case=='unlit':assert np.max(actual[:,:,:3])<.0001
                    elif case not in ('back',):assert np.max(actual[:,:,:3])>.0001,(model,case,'empty render')
                    if case=='default':
                        normal_source=shader.op('texture_sources').module.effective('normalMap')['source']
                        normal_pixels=normal_source.numpyArray(delayed=False)
                        assert np.max(np.abs(normal_pixels[0,0,:3]-[.5,.5,1]))<.000001
                        default=actual.copy()
                    if case=='tilted-normal':assert np.max(np.abs(actual-default))>.001
                    if case=='zero-normal-strength':assert np.max(np.abs(actual-default))<.0001
                    checks.append(dict(model=model,case=case,maxError=error))
                    geo.par.ry=0
                    tangents.render=tangents.display=False;rect.render=rect.display=True
            finally:
                shader.destroy();shader=None
    result=dict(passed=True,build=str(app.build),checks=checks)
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:
    area.destroy()
