"""Eight independent finishing combinations versus handwritten native GLSL."""
from pathlib import Path
import itertools,json,uuid
import numpy as np

area=op('/').create(baseCOMP,'grape_finishing_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    runtime=manager.op('runtime').module;runtime._owner=manager;core=runtime.core()
    reference=area.create(glslMAT,'reference');vertex=area.create(textDAT,'reference_vertex');pixel=area.create(textDAT,'reference_pixel')
    vertex.text='void main(){gl_Position=TDWorldToProj(TDDeform(TDPos()));}'
    reference.par.vdat=vertex;reference.par.pdat=pixel
    for bits in itertools.product((False,True),repeat=3):
        flags=dict(zip(core.PIXEL_FINISHING_DEFAULTS,bits));g=core.demo_graph('color','mat');g['declarations']=[]
        g['stages']['pixel']={'nodes':[core.node('vec4','color',value=[.2,.4,.6,.25]),core.node('pixel_out','pixel',**flags)],'edges':[core.edge('color','pixel','color')]}
        shader=runtime.create_shader(area,'Material',g,'mat');material=shader.op('material')
        try:
            statements=['#include <TDColorSpace>' if bits[2] else '',
                        'layout(location=0) out vec4 fragColor[TD_NUM_COLOR_BUFFERS];',
                        'void main(){ TDCheckDiscard(); vec4 color=vec4(.2,.4,.6,.25);']
            if bits[0]:statements.append('color=TDDither(color);')
            if bits[1]:statements.append('TDAlphaTest(color.a);')
            if bits[2]:statements.append('color=TDConvertColorSpace(color);')
            statements.append('fragColor[0]=TDOutputSwizzle(color); }');pixel.text='\n'.join(statements)
            for mat in (material,reference):mat.par.alphatest=True;mat.par.alphafunc='greater';mat.par.alphathreshold=.5
            with runtime.validation_scene(shader) as render:
                render.par.format='rgba32float';render.par.dither=True;geo=render.parent().op('geometry')
                geo.par.material=material;render.cook(force=True);actual=render.numpyArray(delayed=False).copy()
                assert not material.errors(),material.errors()
                assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
                geo.par.material=reference;render.cook(force=True);expected=render.numpyArray(delayed=False).copy()
                assert not reference.errors(),reference.errors()
                error=float(np.max(np.abs(actual-expected)));assert np.isfinite(actual).all() and error<.0001,(flags,error)
                center=actual[256,256].tolist();assert (center[3]<.001 if bits[1] else abs(center[3]-.25)<.001),(flags,center)
                checks.append(dict(flags=flags,maxError=error,center=center))
                if bits[1]:
                    # The call follows the native setting; it does not enable Alpha Test itself.
                    material.par.alphatest=False;geo.par.material=material;render.cook(force=True)
                    alpha=float(render.numpyArray(delayed=False)[256,256,3]);assert abs(alpha-.25)<.001,(flags,alpha)
        finally:runtime._shaders.pop(shader.fetch('sgrapeShaderId'),None);shader.destroy()
    result=dict(passed=True,build=str(app.build),checks=checks)
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),'utf-8')
finally:area.destroy()
