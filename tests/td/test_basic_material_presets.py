"""Editable basic material presets against native MATs; disposable render context."""
import json,copy,uuid
from pathlib import Path
import numpy as np
area=op('/').create(baseCOMP,'grape_presets_'+uuid.uuid4().hex[:8]);checks=[]
try:
 manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
 page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
 for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
 r=manager.op('runtime').module;r._owner=manager;c=r.core()
 presets=json.loads(manager.op('material_presets').text)
 models=['phong','pbr']
 lights=[]
 for name,x in [('left',-.7),('right',.7)]:
  light=area.create(lightCOMP,name);light.par.tx=x;light.par.tz=2;lights.append(light)
 image=area.create(constantTOP,'environment');image.par.resolutionw=64;image.par.resolutionh=32;image.par.colorr=.5;image.par.colorg=.25;image.par.colorb=.125;image.par.format='rgba32float'
 env=area.create(environmentlightCOMP,'environment_light');env.par.envlightmap=image
 for model in models:
  for case in ('default','custom','unlit','back','sphere','pop')+ (('environment',) if model=='pbr' else ()):
   graph=copy.deepcopy(presets[model]);native=area.create(phongMAT if model=='phong' else pbrMAT,'reference')
   if case=='custom':
    values=({'diffuse':[.2,.5,.8],'ambient':[.1,.2,.3],'specular':[.8,.3,.1],'specular2':[.1,.3,.6],'shininess':16,'shininess2':64,'alpha':.6} if model=='phong' else {'baseColor':[.2,.5,.8],'metallic':.25,'roughness':.35,'specularLevel':.7,'ao':.5,'alpha':.6})
    for d in graph['declarations']:
     if d['id'] in values:d['value']=values[d['id']]
    native.par.alphafront=.6
    if model=='phong':
     native.par.ambdiff=False;native.par.shininess=16;native.par.shininess2=64
     for name,prefix in [('diffuse','diff'),('ambient','amb'),('specular','spec'),('specular2','spec2')]:
      for channel,value in zip('rgb',values[name]):getattr(native.par,prefix+channel).val=value
    else:
     for channel,value in zip('rgb',values['baseColor']):getattr(native.par,'basecolor'+channel).val=value
     native.par.metallic=.25;native.par.roughness=.35;native.par.specularlevel=.7;native.par.ambientocclusion=.5
   shader=r.create_shader(area,'Material',graph,'mat')
   try:
    with r.validation_scene(shader) as render:
     render.par.format='rgba32float';render.par.dither=False;render.par.lights='' if case=='unlit' else env.path if case=='environment' else ' '.join(light.path for light in lights)
     geo=render.parent().op('geometry');rect=geo.op('rectangle');extra=None
     try:
      if case in ('sphere','pop'):
       extra=geo.create(sphereSOP if case=='sphere' else gridPOP,'test_geometry');rect.render=rect.display=False;extra.render=extra.display=True
      if case=='back':geo.par.ry=180
      geo.par.material=shader.op('material');render.cook(force=True);actual=render.numpyArray(delayed=False).copy()
      assert not shader.op('material').errors(),shader.op('material').errors();assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
      geo.par.material=native;render.cook(force=True);expected=render.numpyArray(delayed=False).copy();assert not native.errors(),native.errors()
      a=actual[80:-80,80:-80];b=expected[80:-80,80:-80];assert np.isfinite(a).all() and np.isfinite(b).all()
      if case!='unlit':assert np.max(b[:,:,:3])>.0001,(model,case,'empty reference')
      error=float(np.max(np.abs(a-b)));assert error<.001,(model,case,error,a[100,100].tolist(),b[100,100].tolist())
      checks.append(dict(model=model,case=case,maxError=error))
     finally:
      geo.par.ry=0;rect.render=rect.display=True
      if extra:extra.destroy()
   finally:shader.destroy();native.destroy()
 result=dict(passed=True,build=str(app.build),checks=checks)
 (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:area.destroy()
