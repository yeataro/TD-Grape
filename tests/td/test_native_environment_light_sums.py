"""PBR environment sums agree with native materials for an actual environment map."""
from pathlib import Path
import json,uuid
import numpy as np
fixture={};exec((GRAPE_ROOT/'tests/unit/native_light_sum_fixture.py').read_text(),fixture)
area=op('/').create(baseCOMP,'grape_env_sum_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();document=manager.op('document').module
    shader=r.create_shader(area,'Material',c.demo_graph('color','mat'),'mat')
    image=area.create(constantTOP,'environment');image.par.resolutionw=64;image.par.resolutionh=32
    image.par.colorr=.5;image.par.colorg=.25;image.par.colorb=.125;image.par.format='rgba32float'
    lights=[]
    for index in range(2):
        light=area.create(environmentlightCOMP,'environment_light'+str(index));light.par.envlightmap=image;lights.append(light)
    native=area.create(pbrMAT,'reference');native.par.metallic=0;native.par.roughness=1
    with r.shader_context(shader):
        for output in ('diffuse','specular'):
            graph=fixture['light_sum_graph'](c,'td_env_lighting_pbr_all',output)
            lighting=next(n for n in graph['stages']['pixel']['nodes'] if n['id']=='lights')
            lighting['inputValues']={'diffuseColor':[1 if output=='diffuse' else 0]*3,'specularColor':[.08 if output=='specular' else 0]*3,'roughness':1,'ambientOcclusion':1}
            result=r.deploy(document.stamp_catalog(graph,c),r.state()['revision']);assert result['ok'],result
            native.par.specularlevel=1 if output=='specular' else 0
            for channel in 'rgb':getattr(native.par,'basecolor'+channel).val=1 if output=='diffuse' else 0
            with r.validation_scene(shader) as render:
                render.par.format='rgba32float';render.par.dither=False;geometry=render.parent().op('geometry')
                for count in (1,2):
                    render.par.lights=' '.join(light.path for light in lights[:count])
                    geometry.par.material=shader.op('material');render.cook(force=True)
                    assert not render.errors(),render.errors()
                    actual=render.numpyArray(delayed=False).copy()[80:-80,80:-80,:3]
                    geometry.par.material=native;render.cook(force=True)
                    assert not render.errors(),render.errors()
                    expected=render.numpyArray(delayed=False).copy()[80:-80,80:-80,:3]
                    assert np.isfinite(actual).all() and np.isfinite(expected).all()
                    assert float(np.max(expected))>.0001,('Environment light did not render',output,count)
                    difference=float(np.max(np.abs(actual-expected)))
                    assert difference<.0005,(output,count,difference)
                    checks.append(dict(output=output,lights=count,maxError=difference))
    result={'passed':True,'checks':checks};(Path(GRAPE_TEST_OUTPUT)/'results.json').write_text(json.dumps(result,indent=2))
finally:area.destroy()
