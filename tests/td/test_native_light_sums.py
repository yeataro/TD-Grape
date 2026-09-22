"""Compare individual summed lighting contributions with native MAT renders."""
from pathlib import Path
import json,uuid
import numpy as np
fixture={};exec((GRAPE_ROOT/'tests/unit/native_light_sum_fixture.py').read_text(),fixture)
area=op('/').create(baseCOMP,'grape_light_sum_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();document=manager.op('document').module
    shader=r.create_shader(area,'Material',c.demo_graph('color','mat'),'mat')
    lights=[]
    for name,x in [('left',-.4),('right',.4)]:
        light=area.create(lightCOMP,name);light.par.tx=x;light.par.tz=2;lights.append(light)
    with r.shader_context(shader):
        for model,outputs in [('phong',('diffuse','specular','specular2')),('pbr',('diffuse','specular'))]:
            for output in outputs:
                graph=fixture['light_sum_graph'](c,'td_lighting_all' if model=='phong' else 'td_lighting_pbr_all',output)
                lighting=next(n for n in graph['stages']['pixel']['nodes'] if n['id']=='lights')
                lighting['inputValues']={'shininess':100,'shininess2':50} if model=='phong' else {'diffuseColor':[1,1,1],'specularColor':[.08,.08,.08],'roughness':1}
                result=r.deploy(document.stamp_catalog(graph,c),r.state()['revision']);assert result['ok'],result
                native=area.create(phongMAT if model=='phong' else pbrMAT,'reference')
                try:
                    if model=='phong':
                        native.par.ambdiff=False
                        for channel in 'rgb':
                            getattr(native.par,'diff'+channel).val=1 if output=='diffuse' else 0
                            getattr(native.par,'spec'+channel).val=1 if output=='specular' else 0
                            getattr(native.par,'spec2'+channel).val=1 if output=='specular2' else 0
                            getattr(native.par,'amb'+channel).val=0
                        native.par.shininess=100;native.par.shininess2=50
                    else:
                        native.par.metallic=0;native.par.roughness=1
                        native.par.specularlevel=1 if output=='specular' else 0
                        for channel in 'rgb':getattr(native.par,'basecolor'+channel).val=1 if output=='diffuse' else 0
                        # Match only the selected native lobe; TD's diffuse includes
                        # Fresnel coupling, so the zeroed lobe must match as an input.
                        lighting['inputValues']['specularColor']=[.08]*3 if output=='specular' else [0]*3
                        lighting['inputValues']['diffuseColor']=[0]*3 if output=='specular' else [1]*3
                        result=r.deploy(document.stamp_catalog(graph,c),r.state()['revision']);assert result['ok'],result
                    with r.validation_scene(shader) as render:
                        render.par.format='rgba32float';render.par.dither=False;geometry=render.parent().op('geometry')
                        for count in (0,1,2):
                            render.par.lights=' '.join(light.path for light in lights[:count])
                            geometry.par.material=shader.op('material');render.cook(force=True)
                            assert not render.errors(),render.errors()
                            actual=render.numpyArray(delayed=False).copy()
                            assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
                            geometry.par.material=native;render.cook(force=True)
                            assert not render.errors(),render.errors()
                            expected=render.numpyArray(delayed=False).copy()
                            # Avoid the raster edge; compare the full interior, not
                            # just one pixel or merely a successful compilation.
                            actual=actual[80:-80,80:-80,:3];expected=expected[80:-80,80:-80,:3]
                            assert np.isfinite(actual).all() and np.isfinite(expected).all()
                            if count:assert float(np.max(expected))>.0001,('Reference lobe did not render',model,output,count)
                            else:assert float(np.max(np.abs(expected)))<.0001,(model,output,'unexpected unlit reference',float(np.max(expected)),actual[100,100].tolist(),expected[100,100].tolist())
                            difference=float(np.max(np.abs(actual-expected)))
                            assert difference<.0005,(model,output,count,difference,actual[100,100].tolist(),expected[100,100].tolist())
                            checks.append(dict(model=model,output=output,lights=count,maxError=difference))
                finally:native.destroy()
        for output in ('diffuse','specular'):
            graph=fixture['light_sum_graph'](c,'td_env_lighting_pbr_all',output)
            result=r.deploy(document.stamp_catalog(graph,c),r.state()['revision']);assert result['ok'],result
            checks.append(dict(model='environment',output=output,compile=True,environmentLightRender=False))
    result={'passed':True,'checks':checks}
    (Path(GRAPE_TEST_OUTPUT)/'results.json').write_text(json.dumps(result,indent=2))
finally:area.destroy()
