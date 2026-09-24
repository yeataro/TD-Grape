"""Compare actual node graphs to independent sampling calls in TOP/MAT Pixel.
Disposable shaders and images; existing user graphs are never deployed.
"""
from pathlib import Path
import json,uuid
import numpy as np
fixture={};exec((GRAPE_ROOT/'tests/unit/texture_offset_fixture.py').read_text(encoding='utf-8'),fixture)
area=op('/').create(baseCOMP,'grape_offsets_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(GRAPE_TEST_OUTPUT/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();document=manager.op('document').module
    image=area.create(glslTOP,'pattern');pattern=area.create(textDAT,'pattern_code');image.par.pixeldat=pattern
    image.par.outputresolution='custom';image.par.resolutionw=32;image.par.resolutionh=24;image.par.format='rgba32float'
    pattern.text='layout(location=0) out vec4 fragColor;void main(){vec2 p=vUV.st;fragColor=TDOutputSwizzle(vec4(p,fract(p.x*7.0+p.y*3.0),0.35+0.5*p.x));}'
    image.cook(force=True);assert not image.errors(),image.errors()
    def filters(node):
        for p in node.pars('*filter*'):
            if 'mipmaplinear' in p.menuNames:p.val='mipmaplinear'
    for kind in ('top','mat'):
        initial=c.demo_graph('color',kind)
        if kind=='top':initial=c.normalize_top_sources(initial)[0]
        shader=r.create_shader(area,'test_'+kind,initial,kind)
        reference=area.create(glslTOP if kind=='top' else glslMAT,'reference_'+kind)
        code=area.create(textDAT,'reference_pixel_'+kind)
        if kind=='top':
            reference.par.pixeldat=code;reference.inputConnectors[0].connect(image)
            reference.par.outputresolution='custom';reference.par.resolutionw=64;reference.par.resolutionh=64;reference.par.format='rgba32float'
            resource='sTD2DInputs[0]'
        else:
            reference.par.pdat=code;vertex=area.create(textDAT,'reference_vertex');reference.par.vdat=vertex
            vertex.text='void main(){gl_Position=TDWorldToProj(TDDeform(TDPos()));}'
            reference.par.sampler0name='uTexture';reference.par.sampler0top=image;resource='uTexture'
        filters(reference)
        with r.shader_context(shader):
            if kind=='top':shader.par.Pixelformat='rgba32float'
            for key in fixture['KEYS']:
                for variant in (0,1):
                    graph=fixture['sampling_graph'](c,key,kind,source='op:'+image.path,component=variant+1)
                    sample=next(n for n in graph['stages']['pixel']['nodes'] if n['id']=='sample')
                    offset=[1,-1] if variant==0 else [-2,2]
                    if 'offsets' not in key:sample['inputValues']['offset']=offset
                    args=resource+', '+('vec4(0.63,0.87,0.2,1.5)' if 'proj' in key else 'vec2(0.42,0.58)')
                    if 'lod' in key:args+=', 2.0'
                    if 'grad' in key:args+=', vec2(0.08,0.01), vec2(0.01,0.09)'
                    args+=', '+('ivec2[4](ivec2(-1,0),ivec2(0,1),ivec2(1,0),ivec2(0,-1))' if 'offsets' in key else 'ivec2('+str(offset[0])+','+str(offset[1])+')')
                    if 'gather' in key:args+=', '+str(variant+1)
                    expression=c._legacy_nodes.CALLS[key]['function']+'('+args+')'
                    prefix='' if kind=='top' else 'uniform sampler2D uTexture;'
                    output='fragColor' if kind=='top' else 'fragColor[0]'
                    code.text=prefix+'layout(location=0) out vec4 fragColor'+('' if kind=='top' else '[TD_NUM_COLOR_BUFFERS]')+';void main(){'+output+'=TDOutputSwizzle('+expression+');}'
                    deployed=r.deploy(document.stamp_catalog(graph,c),r.state()['revision']);assert deployed['ok'],deployed
                    actual_node=shader.op('shader' if kind=='top' else 'material');filters(actual_node)
                    if kind=='top':
                        actual_node.cook(force=True);reference.cook(force=True)
                        assert not actual_node.errors() and not reference.errors(),(actual_node.errors(),reference.errors())
                        actual=actual_node.numpyArray(delayed=False).copy();expected=reference.numpyArray(delayed=False).copy()
                        # Constant coordinates make the output independent of resolution.
                        actual=actual[actual.shape[0]//2,actual.shape[1]//2];expected=expected[32,32]
                    else:
                        with r.validation_scene(shader) as render:
                            render.par.format='rgba32float';render.par.dither=False
                            geometry=render.parent().op('geometry');geometry.par.material=actual_node;render.cook(force=True)
                            assert not actual_node.errors(),actual_node.errors()
                            actual=render.numpyArray(delayed=False).copy()[100:-100,100:-100]
                            geometry.par.material=reference;render.cook(force=True)
                            assert not reference.errors(),reference.errors()
                            expected=render.numpyArray(delayed=False).copy()[100:-100,100:-100]
                    assert np.isfinite(actual).all() and np.isfinite(expected).all()
                    assert float(np.max(expected))>.05,'Empty reference'
                    error=float(np.max(np.abs(actual-expected)));assert error<.00002,(kind,key,variant,error,actual.flatten()[:4],expected.flatten()[:4])
                    checks.append(dict(target=kind,key=key,variant=variant,maxError=error,value=actual.reshape(-1,4)[0].tolist()))
            # Probe graph-generated const chains and dynamic single offsets, not only literals.
            for mode in ('constant-chain','dynamic-offset'):
                key='texture_gather_offsets_2d' if mode=='constant-chain' else 'texture_gather_offset_2d'
                graph=fixture['sampling_graph'](c,key,kind,source='op:'+image.path);p=graph['stages']['pixel']
                if mode=='constant-chain':
                    p['nodes']=[n for n in p['nodes'] if n['id']!='offsets']+[c.node('array','offsets',elementType='ivec2',length=4),c.node('add','component',type='int')]
                    p['edges'].append(c.edge('component','sample','component'))
                else:
                    graph['declarations'].append(dict(id='shift',kind='uniform',name='uShift',type='ivec2',value=[1,-1]))
                    p['nodes'].append(c.node('uniform','shift',declarationId='shift'));p['edges'].append(c.edge('shift','sample','offset'))
                assert r.deploy(document.stamp_catalog(graph,c),r.state()['revision'])['ok']
                r.validate_material(shader);checks.append(dict(target=kind,mode=mode,compiled=True))
            # Native invalid component must fail without replacing the last good graph.
            before={n:shader.op(n).text for n in ('state','graph','manifest','pixel_shader')}
            bad=fixture['sampling_graph'](c,'texture_gather_offset_2d',kind,source='op:'+image.path,component=4)
            try:r.deploy(document.stamp_catalog(bad,c),r.state()['revision']);raise AssertionError('Invalid component accepted')
            except RuntimeError as exc:assert not isinstance(exc,AssertionError)
            assert before=={n:shader.op(n).text for n in before};checks.append(dict(target=kind,invalidComponentPreserved=True))
    result=dict(passed=True,build=str(app.build),checks=checks)
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:area.destroy()
