"""Isolated fragment terminal rendering against handwritten TD GLSL."""
from pathlib import Path
import json,uuid
import numpy as np

area=op('/').create(baseCOMP,'grape_fragments_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    # Use local TD core directly; avoid importing a separate Python runtime.
    def graph(key,values=None,target='mat'):
        g=c.demo_graph('color',target);g['declarations']=[]
        effect=c.node(key,'effect')
        if values is not None:effect['inputValues']=values
        g['stages']['pixel']={'nodes':[c.node('vec4','color',value=[.2,.4,.6,1]),effect,c.node('pixel_out','pixel')],
                              'edges':[c.edge('color','pixel','color')]}
        if key=='td_dither':g['stages']['pixel']['edges']=[c.edge('color','effect','color'),c.edge('effect','pixel','color')]
        return g
    reference=area.create(glslMAT,'reference');v=area.create(textDAT,'ref_vertex');p=area.create(textDAT,'ref_pixel')
    v.text='void main(){gl_Position=TDWorldToProj(TDDeform(TDPos()));}'
    reference.par.vdat=v;reference.par.pdat=p
    for key,values in [('discard',{'condition':False}),('discard',{'condition':True}),('td_alpha_test',{'alpha':.25}),('td_alpha_test',{'alpha':.75}),('td_dither',None),('depth_out',{'depth':.25}),('depth_out',{'depth':.75}),('depth_out',None)]:
        g=graph(key,values);shader=r.create_shader(area,'Material',g,'mat');mat=shader.op('material')
        try:
            statement={'discard':'if ('+('true' if values and values.get('condition') else 'false')+') discard;',
                       'td_alpha_test':'TDAlphaTest('+str((values or {}).get('alpha',1))+');',
                       'td_dither':'', 'depth_out':'gl_FragDepth = '+str((values or {}).get('depth','gl_FragCoord.z'))+';'}[key]
            color='TDDither(vec4(.2,.4,.6,1))' if key=='td_dither' else 'vec4(.2,.4,.6,1)'
            p.text='layout(location=0) out vec4 fragColor[TD_NUM_COLOR_BUFFERS];void main(){TDCheckDiscard();'+statement+'vec4 color='+color+';TDAlphaTest(color.a);fragColor[0]=TDOutputSwizzle(TDDither(color));}'
            for m in (mat,reference):
                m.par.alphatest=key=='td_alpha_test';m.par.alphafunc='greater';m.par.alphathreshold=.5
            with r.validation_scene(shader) as render:
                render.par.format='rgba32float';render.par.dither=key=='td_dither';geo=render.parent().op('geometry')
                geo.par.material=mat;render.cook(force=True);actual=render.numpyArray(delayed=False).copy()
                assert not mat.errors(),mat.errors()
                assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
                geo.par.material=reference;render.cook(force=True);expected=render.numpyArray(delayed=False).copy()
                assert not reference.errors(),reference.errors()
                assert np.isfinite(actual).all()
                error=float(np.max(np.abs(actual-expected)));assert error<.0001,(key,values,error)
                center=actual[256,256].tolist();rejected=key=='discard' and values['condition'] or key=='td_alpha_test' and values['alpha']<.5
                assert (center[3]<.001 if rejected else center[3]>.99),(key,values,center)
                if key=='td_alpha_test' and values['alpha']<.5:
                    mat.par.alphatest=False;geo.par.material=mat;render.cook(force=True)
                    assert render.numpyArray(delayed=False)[256,256,3]>.99,'Disabled native Alpha Test must pass'
                if key=='depth_out' and values:
                    # A second rectangle at depth .5 proves that custom depth changes occlusion.
                    blocker=render.parent().create(geometryCOMP,'blocker');rect=blocker.create(rectangleSOP,'rectangle')
                    for child in blocker.children:
                        if child.family=='SOP':child.render=child.display=child==rect
                    old_geometry=render.par.geometry.val
                    try:
                        p.text='layout(location=0) out vec4 fragColor[TD_NUM_COLOR_BUFFERS];void main(){TDCheckDiscard();gl_FragDepth=.5;fragColor[0]=TDOutputSwizzle(vec4(1,0,0,1));}'
                        blocker.par.material=reference;geo.par.material=mat;render.par.geometry=geo.path+' '+blocker.path
                        render.cook(force=True);sample=render.numpyArray(delayed=False)[256,256]
                        desired=[.2,.4,.6,1] if values['depth']<.5 else [1,0,0,1]
                        assert np.max(np.abs(sample-desired))<.0001,(values,sample.tolist())
                    finally:render.par.geometry=old_geometry;blocker.destroy()
            checks.append(dict(node=key,values=values,maxError=error,center=center))
        finally:shader.destroy()
    # Discard is also valid in TOP, with no color connection from the terminal.
    for condition in (False,True):
        result=c.compile_graph(graph('discard',{'condition':condition},'top'))
        dat=area.create(textDAT,'top_pixel');dat.text=result['pixel'];top=area.create(glslTOP,'top');top.par.pixeldat=dat
        try:
            top.cook(force=True);assert not top.errors(),top.errors();sample=top.numpyArray(delayed=False)[0,0]
            # Discard reveals the TOP's configured clear color, not necessarily transparent black.
            dat.text='layout(location=0) out vec4 fragColor;void main(){'+('discard;' if condition else 'fragColor=TDOutputSwizzle(vec4(.2,.4,.6,1));')+'}'
            top.cook(force=True);expected=top.numpyArray(delayed=False)[0,0]
            assert np.max(np.abs(sample-expected))<.0001,(condition,sample.tolist(),expected.tolist())
            checks.append(dict(node='discard_top',condition=condition,center=sample.tolist()))
        finally:top.destroy();dat.destroy()
    result=dict(passed=True,build=str(app.build),checks=checks)
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),'utf-8')
finally:area.destroy()
