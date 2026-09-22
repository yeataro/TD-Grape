"""Render explicit texture attributes on SOP, POP and instanced geometry."""
from pathlib import Path
import json,uuid
import numpy as np
fixture={};exec((GRAPE_ROOT/'tests/unit/texture_attribute_fixture.py').read_text(),fixture)
area=op('/').create(baseCOMP,'grape_texattr_'+uuid.uuid4().hex[:8]);checks=[]
original=op('/TD_Grape/runtime').module
before={s.path:s.op('graph').text for s in original._shaders.values() if s and s.valid}
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();document=manager.op('document').module
    shader=r.create_shader(area,'TextureAttribute',c.demo_graph('color','mat'),'mat')
    reference=area.create(glslMAT,'reference');vert=area.create(textDAT,'reference_vertex');pixel=area.create(textDAT,'reference_pixel')
    reference.par.vdat=vert;reference.par.pdat=pixel;reference.par.attr0name='Tex';reference.par.attr0type='float3'
    pixel.text='in vec3 tex; layout(location=0) out vec4 fragColor; void main(){TDCheckDiscard();fragColor=TDOutputSwizzle(vec4(tex,1.0));}'
    with r.shader_context(shader):
      for name in ('Tex','AlternateUV'):
        graph=fixture['texture_graph'](c,name)
        result=r.deploy(document.stamp_catalog(graph,c),r.state()['revision']);assert result['ok'],result
        reference.par.attr0name=name
        vert.text='out vec3 tex; void main(){tex=TDInstanceTexCoord(TDTexAttrib_'+name+'(0u));gl_Position=TDWorldToProj(TDDeform(TDPos()));}'
        with r.validation_scene(shader) as render:
            render.par.format='rgba32float';render.par.dither=False
            geo=render.parent().op('geometry');sop=geo.op('rectangle');grid=geo.create(gridPOP,'uv_grid');custom=geo.create(attributePOP,'uv_custom');custom.inputConnectors[0].connect(grid)
            custom.par.attr0name='custom';custom.par.attr0customname=name;custom.par.attr0type='float';custom.par.attr0numcomps='3'
            custom.par.attr0value0=.25;custom.par.attr0value1=.75;custom.par.attr0value2=.125
            instance=area.create(constantCHOP,'instance_data')
            instance.par.const0name='u';instance.par.const0value=.2
            instance.par.const1name='v';instance.par.const1value=.6
            instance.par.const2name='w';instance.par.const2value=.4
            try:
              for mode,target,instanced in [('sop',sop,False),('pop',grid,False),('pop_named',custom,False),('pop_instance',custom,True)]:
                if mode=='pop' and name!='Tex':continue
                for child in geo.children:
                    if child.family in ('SOP','POP'):child.render=child==target;child.display=child==target
                geo.par.instancing=instanced
                if instanced:
                    geo.par.instancecountmode='manual';geo.par.numinstances=1;geo.par.instancetexcoordop=instance;geo.par.instanceu='u';geo.par.instancev='v';geo.par.instancew='w';geo.par.instancetexmode='replace'
                    instance.cook(force=True);geo.cook(force=True)
                geo.par.material=shader.op('material');render.cook(force=True);actual=render.numpyArray(delayed=False).copy()
                assert not render.errors(),render.errors();assert not shader.op('material').errors(),shader.op('material').errors()
                geo.par.material=reference;render.cook(force=True);expected=render.numpyArray(delayed=False).copy()
                assert not reference.errors(),reference.errors()
                a=actual[100:-100,100:-100,:3];b=expected[100:-100,100:-100,:3]
                assert np.isfinite(a).all() and np.isfinite(b).all()
                error=float(np.max(np.abs(a-b)));assert error<.0001,(name,mode,error)
                if mode=='pop_named':assert np.max(np.abs(b-np.array([.25,.75,.125])))<.0001,('named reference',b[0,0].tolist())
                elif instanced:assert np.max(np.abs(b-np.array([.2,.6,.4])))<.0001,('instance reference',b[0,0].tolist())
                else:assert float(np.ptp(b[:,:,0]))>.2 and float(np.ptp(b[:,:,1]))>.2,('no UV gradient',mode,b[0,0].tolist())
                checks.append(dict(name=name,geometry=mode,maxError=error))
                if name=='Tex' and mode=='pop':
                    source=vert.text;vert.text=source.replace('TDTexAttrib_Tex(0u)','TDTexCoord(0u)')
                    render.cook(force=True);legacy=render.numpyArray(delayed=False)[100:-100,100:-100,:3].copy()
                    assert float(np.max(np.abs(legacy-b)))>.2,'Legacy UV unexpectedly matches POP Tex'
                    checks.append(dict(legacyPopUVMax=float(np.max(np.abs(legacy))),legacyDifference=float(np.max(np.abs(legacy-b)))))
                    vert.text=source
            finally:
                geo.par.instancing=False;sop.render=sop.display=True;custom.destroy();grid.destroy();instance.destroy()
    assert before=={s.path:s.op('graph').text for s in original._shaders.values() if s and s.valid}
    result={'passed':True,'checks':checks,'userGraphsPreserved':True}
    (Path(GRAPE_TEST_OUTPUT)/'results.json').write_text(json.dumps(result,indent=2))
finally:area.destroy()
