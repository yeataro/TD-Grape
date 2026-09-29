"""Disposable native TOP/MAT probes against independent CPU cellular noise.

Never deploys to a user's Shader or changes the interactive preview.
"""
import itertools
import json
import re
import uuid
import numpy as np

fixture = {}
exec((GRAPE_ROOT/'tests/unit/voronoi_fixture.py').read_text(encoding='utf-8'), fixture)
owners = [n for n in op('/').findChildren() if n.storage.get('sgrapeManager', False)]
live = owners[0].op('runtime').module
def snapshot():
    return {s.path: {name:s.op(name).text for name in ('graph','state','manifest','pixel_shader','vertex_shader') if s.op(name)}
            for s in live._shaders.values() if s and s.valid}
before = snapshot()
area = op('/').create(baseCOMP, 'grape_voronoi_'+uuid.uuid4().hex[:8])
records = []
try:
    mapping = json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text('utf-8'))
    for name in ('sgrape_voronoi','sgrape_legacy_nodes','source_catalog','sgrape_source_catalog','node_catalog','sgrape_composites','core'):
        area.create(textDAT,name).text = source_path(mapping[name]).read_text(encoding='utf-8')
    c = area.op('core').module
    top = area.create(glslTOP,'probe'); code = area.create(textDAT,'pixel'); top.par.pixeldat = code
    top.par.outputresolution='custom'; top.par.resolutionw=4; top.par.resolutionh=1; top.par.format='rgba32float'
    top.par.compilebehavior='stalluntildone'
    info = area.create(infoDAT,'info');info.par.op=top
    cases = [dict(dim=dim,feature=feature,metric=metric) for dim,feature,metric in itertools.product(
        range(1,5), c._voronoi.FEATURES, c._voronoi.METRICS)
        if (dim != 1 and feature in ('f1','f2','smooth_f1')) or metric=='euclidean']
    cases += [dict(dim=dim,feature=feature,metric='euclidean',normalize=True,detail=1.5,roughness=.63,lacunarity=1.7)
              for dim,feature in itertools.product(range(1,5), ['f1','f2','smooth_f1','distance_to_edge'])]
    cases += [dict(dim=dim,feature=feature,metric='euclidean',randomness=0)
              for dim,feature in itertools.product(range(1,5),c._voronoi.FEATURES)]
    cases += [dict(dim=3,feature='smooth_f1',smoothness=0), dict(dim=4,feature='f1',scale=0),
              dict(dim=2,feature='f1',scale=-3.2),dict(dim=2,feature='f1',metric='minkowski',exponent=32),
              dict(dim=2,feature='f1',metric='minkowski',exponent=.125),
              dict(dim=2,feature='f1',detail=15,roughness=0),dict(dim=2,feature='f1',detail=2.5,lacunarity=0)]
    cases += [dict(dim=4,feature=feature,detail=15,roughness=.7) for feature in ('f1','f2','smooth_f1','distance_to_edge')]
    for settings in cases:
        params=dict(dim=3,feature='f1',metric='euclidean',normalize=False,vector=[.19,-.36,.72],w=.83,scale=2.3,**{})
        params.update(settings)
        dim,feature,metric,normalize = (params.pop(key) for key in ('dim','feature','metric','normalize'))
        expected = fixture['reference'](dim,feature,metric,normalize,**params)
        graph = fixture['graph'](c,dim,feature,metric,**params)
        graph['stages']['pixel']['nodes'][0]['params']['normalize']=normalize
        compiled = c.compile_graph(graph)
        # Read every result component in one 4-pixel render. The expression is
        # graph-generated; only readback packing is substituted by the probe.
        value='sg_voronoi_result_cells'
        outputs=[value+'.distance','vec4('+value+'.color, 1.0)','vec4('+value+'.position.xyz, 0.0)',value+('.position.x' if dim==1 else '.position.w')]
        packing='\n'.join('    if (int(gl_FragCoord.x) == '+str(i)+') sg_color = vec4('+expr+');' for i,expr in enumerate(outputs))
        code.text=compiled['pixel'].replace('    fragColor =',packing+'\n    fragColor =')
        top.cook(force=True);info.cook(force=True)
        assert not top.errors() and 'ERROR:' not in info.text, (settings,top.errors(),info.text)
        pixels=top.numpyArray(delayed=False)[0]
        actual={'radius' if feature=='n_sphere_radius' else 'distance':float(pixels[0,0])}
        if feature in ('f1','f2','smooth_f1'):
            actual['color']=pixels[1].tolist()
            if dim!=1:actual['position']=pixels[2,:3].tolist()
            if dim in (1,4):actual['w']=float(pixels[3,0])
        errors={key:float(np.max(np.abs(np.asarray(actual[key])-value))) for key,value in expected.items()}
        assert all(error<2e-4+2e-6*float(np.max(np.abs(expected[key]))) for key,error in errors.items()), (settings,actual,expected,errors)
        records.append(dict(settings=settings,actual=actual,maxError=max(errors.values())))
        (GRAPE_TEST_OUTPUT/'progress.json').write_text(json.dumps(dict(completed=len(records),total=len(cases))),encoding='utf-8')
    # Real Uniform updates change the result while retaining exactly the same
    # generated program (including a stored default overridden by the wire).
    graph=fixture['graph'](c,3,vector=[9,9,9],scale=2.3,detail=1.5)
    graph['declarations'].append(dict(id='coords',name='uCoordinates',kind='uniform',type='vec3',value=[0,0,0]))
    graph['stages']['pixel']['nodes'].append(c.node('uniform','coords',declarationId='coords'))
    graph['stages']['pixel']['edges'].append(c.edge('coords','cells','vector'))
    code.text=c.compile_graph(graph)['pixel'];program=code.text
    top.par.vec0name='uCoordinates'
    for coordinate in ([.19,-.36,.72],[-.41,.78,1.36],[1.1,2.2,-3.3]):
        for axis,value in zip('xyz',coordinate):getattr(top.par,'vec0value'+axis).val=value
        top.cook(force=True)
        actual=float(top.numpyArray(delayed=False)[0,0,0])
        expected=fixture['reference'](3,vector=coordinate,scale=2.3,detail=1.5)['distance']
        assert abs(actual-expected)<2e-4 and code.text==program,(actual,expected)
        records.append(dict(uniform=coordinate,actual=actual,maxError=abs(actual-expected),programUnchanged=True))
    # Native MAT compilation and numerical readback from both Vertex and Pixel.
    mat=area.create(glslMAT,'material');vp=area.create(textDAT,'vertex');pp=area.create(textDAT,'mat_pixel');mat.par.vdat=vp;mat.par.pdat=pp;mat.par.compilebehavior='stalluntildone'
    geometry=area.create(geometryCOMP,'geometry');rect=geometry.create(rectangleSOP,'rectangle')
    for child in geometry.children:
        if child.family in ('SOP','POP'):child.render=child==rect;child.display=child==rect
    geometry.par.material=mat;geometry.par.sx=2;geometry.par.sy=2
    camera=area.create(cameraCOMP,'camera');camera.par.tz=2;camera.par.projection='ortho';camera.par.orthowidth=1.12
    render=area.create(renderTOP,'render');render.par.camera=camera;render.par.geometry=geometry;render.par.resolutionw=4;render.par.resolutionh=4;render.par.format='rgba32float';render.par.antialias='aaoff'
    matinfo=area.create(infoDAT,'mat_info');matinfo.par.op=mat
    for stage,dim,feature in itertools.product(['vertex','pixel'],[1,4],c._voronoi.FEATURES):
        values=dict(vector=[.19,-.36,.72],w=.83,scale=2.3)
        graph=fixture['graph'](c,dim,feature,target='mat',stage=stage,**values)
        compiled=c.compile_graph(graph)
        if stage=='vertex':
            vp.text='flat out vec4 vProbe;\n'+re.sub(r'gl_Position = ([^;]+);',r'vProbe = \1; gl_Position = TDWorldToProj(TDDeform(TDPos()));',compiled['vertex'])
            pp.text='flat in vec4 vProbe;layout(location=0) out vec4 fragColor;void main(){fragColor=TDOutputSwizzle(vProbe);}'
        else:
            vp.text=compiled['vertex'];pp.text=compiled['pixel'].replace('TDDither(sg_color)','sg_color')
        render.cook(force=True);matinfo.cook(force=True)
        assert not mat.errors() and 'ERROR:' not in matinfo.text,(stage,dim,feature,mat.errors(),matinfo.text)
        actual=float(render.numpyArray(delayed=False)[2,2,0]);expected=next(iter(fixture['reference'](dim,feature,**values).values()))
        assert abs(actual-expected)<2e-4,(stage,dim,feature,actual,expected)
        records.append(dict(target='mat',stage=stage,dim=dim,feature=feature,actual=actual,maxError=abs(actual-expected)))
    result=dict(passed=True,build=str(app.build),checks=len(records),maxError=max(row['maxError'] for row in records))
finally:
    area.destroy()
    assert snapshot()==before, 'Existing Shader data changed'
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(dict(records=records,shadersPreserved=len(before)),indent=2),encoding='utf-8')
