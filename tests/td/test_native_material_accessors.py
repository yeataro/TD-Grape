"""Rendered graph paths versus independent native function expressions."""
from pathlib import Path
import json,uuid
import numpy as np

fixture={};exec((GRAPE_ROOT/'tests/unit/native_material_accessor_fixture.py').read_text(encoding='utf-8'),fixture)
area=op('/').create(baseCOMP,'grape_accessors_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();document=manager.op('document').module
    shader=r.create_shader(area,'Material',c.demo_graph('color','mat'),'mat')
    reference=area.create(glslMAT,'reference');vertex=area.create(textDAT,'reference_vertex');pixel=area.create(textDAT,'reference_pixel')
    reference.par.vdat=vertex;reference.par.pdat=pixel
    instance=area.create(scriptCHOP,'instance')
    callback=area.create(textDAT,'instance_callbacks')
    callback.text="def onCook(scriptOp):\n    scriptOp.clear()\n    scriptOp.numSamples=2\n    for name,values in {'tx':[-.28,.28],'r':[.2,.8],'g':[.7,.3],'b':[.4,.9],'a':[1,1]}.items():\n        scriptOp.appendChan(name).vals=values\n"
    instance.par.callbacks=callback;instance.cook(force=True)
    with r.shader_context(shader):
        for mode in ('screen','convert','color_vertex','color_pixel','color_source'):
            result=r.deploy(document.stamp_catalog(fixture['accessor_graph'](c,mode),c),r.state()['revision']);assert result['ok'],result
            vertex.text='out vec4 color; flat out int instanceIndex; void main(){gl_Position=TDWorldToProj(TDDeform(TDPos()));color=TDInstanceColor(vec4(.8,.6,.4,1));instanceIndex=TDInstanceIndex();}'
            if mode=='color_source':vertex.text=vertex.text.replace('TDInstanceColor(vec4(.8,.6,.4,1))','TDColor()')
            expression={'screen':'vec4(TDScreenSpaceCoord().st,0,1)','convert':'TDConvertColorSpace(vec4(.2,.4,.8,.75))','color_vertex':'color','color_source':'color','color_pixel':'TDInstanceColor(instanceIndex,vec4(.8,.6,.4,1))'}[mode]
            pixel.text=('#include <TDColorSpace>\n' if mode=='convert' else '')+'in vec4 color; flat in int instanceIndex; layout(location=0) out vec4 fragColor[TD_NUM_COLOR_BUFFERS]; void main(){TDCheckDiscard();fragColor[0]=TDOutputSwizzle('+expression+');}'
            with r.validation_scene(shader) as render:
                render.par.format='rgba32float';render.par.dither=False;geometry=render.parent().op('geometry')
                saved={name:getattr(geometry.par,name).val for name in ('instancing','instanceop','instancetx','instancer','instanceg','instanceb','instancea','sx','sy')}
                try:
                    if mode in ('color_vertex','color_pixel'):
                        geometry.par.instancing=True;geometry.par.instanceop=instance
                        geometry.par.instancetx='tx';geometry.par.instancer='r';geometry.par.instanceg='g';geometry.par.instanceb='b';geometry.par.instancea='a'
                        geometry.par.sx=.4;geometry.par.sy=.7
                        geometry.cook(force=True)
                    geometry.par.material=shader.op('material');render.cook(force=True)
                    assert not shader.op('material').errors(),shader.op('material').errors()
                    assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
                    actual=render.numpyArray(delayed=False).copy()
                    geometry.par.material=reference;render.cook(force=True)
                    assert not reference.errors(),reference.errors()
                    expected=render.numpyArray(delayed=False).copy()
                    mask=expected[:,:,3]>.1
                    assert mask.sum()>100,(mode,'empty reference')
                    if mode in ('color_vertex','color_pixel'):
                        assert np.ptp(expected[:,:,0][mask])>.05,(mode,'instance colors not distinct')
                    error=float(np.max(np.abs(actual[mask]-expected[mask])))
                    if error>=.00001:
                        print(mode, 'actual alpha pixels', int((actual[:,:,3]>.1).sum()), 'reference alpha pixels', int(mask.sum()),
                              'actual max',actual.max(axis=(0,1)).tolist(),'reference max',expected.max(axis=(0,1)).tolist(),
                              'center',actual[256,256].tolist(),expected[256,256].tolist())
                        np.save(Path(GRAPE_TEST_OUTPUT)/(mode+'-actual.npy'),actual)
                        np.save(Path(GRAPE_TEST_OUTPUT)/(mode+'-expected.npy'),expected)
                        (Path(GRAPE_TEST_OUTPUT)/(mode+'-vertex.glsl')).write_text(shader.op('vertex_shader').text,encoding='utf-8')
                        (Path(GRAPE_TEST_OUTPUT)/(mode+'-pixel.glsl')).write_text(shader.op('pixel_shader').text,encoding='utf-8')
                    assert np.isfinite(actual).all() and error<.00001,(mode,error)
                    checks.append(dict(mode=mode,maxError=error,pixels=int(mask.sum())))
                finally:
                    for name,value in saved.items():getattr(geometry.par,name).val=value
    result=dict(passed=True,checks=checks)
    (Path(GRAPE_TEST_OUTPUT)/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:area.destroy()
