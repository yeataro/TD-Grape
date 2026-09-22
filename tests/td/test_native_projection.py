"""Compare connected projection-map graphs to native calls with actual light maps.

Disposable context, two resource sizes, two light indices and different LODs.
No user graph, light, material or project is saved or modified.
"""
from pathlib import Path
import json,uuid
import numpy as np

fixture={};exec((GRAPE_ROOT/'tests/unit/native_projection_fixture.py').read_text(encoding='utf-8'),fixture)
area=op('/').create(baseCOMP,'grape_projection_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();document=manager.op('document').module
    shader=r.create_shader(area,'Material',c.demo_graph('color','mat'),'mat')
    reference=area.create(glslMAT,'reference');vertex=area.create(textDAT,'reference_vertex');pixel=area.create(textDAT,'reference_pixel')
    reference.par.vdat=vertex;reference.par.pdat=pixel
    vertex.text='void main(){gl_Position=TDWorldToProj(TDDeform(TDPos()));}'
    lights=[]
    for index,(width,height) in enumerate(((32,16),(64,32))):
        image=area.create(noiseTOP,'map'+str(index));image.par.resolutionw=width;image.par.resolutionh=height
        light=area.create(lightCOMP,'light'+str(index));light.par.tz=2;light.par.projmap=image;light.par.projmapfilter='mipmaplinear'
        image.cook(force=True);assert (image.width,image.height)==(width,height)
        lights.append(light)
    images={}
    with r.shader_context(shader):
        for mode,index,lod in [('size',0,0),('size',1,0),('lod',0,0),('lod',0,3),('lod',1,0),('lod',1,3)]:
            graph=fixture['projection_graph'](c,mode,index,lod)
            result=r.deploy(document.stamp_catalog(graph,c),r.state()['revision']);assert result['ok'],result
            expr=('vec4(vec3(TDProjTextureSize('+str(index)+')),1)' if mode=='size' else
                  'TDProjTextureLod('+str(index)+',TDScreenSpaceCoord().st,'+str(float(lod))+')')
            pixel.text='layout(location=0) out vec4 fragColor[TD_NUM_COLOR_BUFFERS];void main(){TDCheckDiscard();fragColor[0]=TDOutputSwizzle('+expr+');}'
            with r.validation_scene(shader) as render:
                render.par.format='rgba32float';render.par.dither=False;render.par.lights=' '.join(light.path for light in lights)
                geometry=render.parent().op('geometry')
                geometry.par.material=shader.op('material');render.cook(force=True)
                assert not shader.op('material').errors(),shader.op('material').errors()
                assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
                actual=render.numpyArray(delayed=False).copy()[80:-80,80:-80]
                geometry.par.material=reference;render.cook(force=True)
                assert not reference.errors(),reference.errors()
                expected=render.numpyArray(delayed=False).copy()[80:-80,80:-80]
                assert np.isfinite(actual).all() and np.isfinite(expected).all()
                assert np.max(expected[:,:,:3])>.1,(mode,index,lod,'empty reference')
                error=float(np.max(np.abs(actual-expected)))
                assert error<.00001,(mode,index,lod,error)
                center=expected[100,100].tolist()
                if mode=='size':assert center[:2]==([32,16] if index==0 else [64,32]),center
                else:images[index,lod]=expected
                checks.append(dict(mode=mode,light=index,lod=lod,maxError=error,referencePixel=center))
    for index in (0,1):assert np.max(np.abs(images[index,0]-images[index,3]))>.001,('LOD had no observable effect',index)
    result=dict(passed=True,build=str(app.build),checks=checks)
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:area.destroy()
