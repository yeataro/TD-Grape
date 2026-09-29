"""Render the bundled helpers against independent GLSL in temporary MATs."""
import importlib.util
import json
import sys
import uuid
import numpy as np

area=op('/').create(baseCOMP,'grape_subgraph_test_'+uuid.uuid4().hex[:8]);checks=[];old_path=list(sys.path)
try:
    sys.path.insert(0,str(GRAPE_ROOT/'src/core'))
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(GRAPE_TEST_OUTPUT/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():
        manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager
    spec=importlib.util.spec_from_file_location('material_helper_fixture',GRAPE_ROOT/'tests/unit/test_material_subgraphs.py')
    fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture);fixture.c=r.core()

    def compare(graph,expression,case,back=False,tangents=False):
        shader=r.create_shader(area,'helper',graph,'mat')
        try:
            reference=shader.copy(shader.op('material'),name='reference')
            dat=shader.create(textDAT,'reference_pixel');reference.par.pdat=dat
            header=shader.op('pixel_shader').text.split('void main()',1)[0]
            dat.text=header+'void main() { TDCheckDiscard(); '+expression+' fragColor[0]=TDOutputSwizzle(result); }'
            with r.validation_scene(shader) as render:
                render.par.format='rgba32float';render.par.dither=False
                geo=render.parent().op('geometry');geo.par.ry=180 if back else 0
                rect=geo.op('rectangle')
                if tangents:
                    uv=geo.op('with_uv') or geo.create(textureSOP,'with_uv');uv.inputConnectors[0].connect(rect)
                    basis=geo.op('with_tangents') or geo.create(attributecreateSOP,'with_tangents')
                    basis.inputConnectors[0].connect(uv);basis.par.comptang=True
                    uv.render=uv.display=False;rect.render=rect.display=False;basis.render=basis.display=True
                geo.par.material=shader.op('material');render.cook(force=True)
                actual=render.numpyArray(delayed=False).copy()[80:-80,80:-80]
                assert not shader.op('material').errors(),shader.op('material').errors()
                assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
                geo.par.material=reference;render.cook(force=True)
                expected=render.numpyArray(delayed=False).copy()[80:-80,80:-80]
                info=shader.create(infoDAT,'reference_info');info.par.op=reference;info.cook(force=True)
                assert 'ERROR:' not in info.text,info.text
                assert np.isfinite(actual).all() and np.isfinite(expected).all()
                if case!='color-hdr-zero-alpha-alpha':assert np.max(np.abs(expected))>.0001,'Empty reference image: '+case
                error=float(np.max(np.abs(actual-expected)));assert error<.00001,(case,error)
                checks.append(dict(case=case,maxError=error))
                geo.par.ry=0
                if tangents:basis.render=basis.display=False;rect.render=rect.display=True
        finally:
            shader.destroy()

    for color,multiplier,label in [([.2,.4,.8,.3],[2,.5,0],'tint'),([2,-.5,.8,0],[1,2,.5],'hdr-zero-alpha'),([.2,.4,.8,.6],[1,1,1],'identity')]:
        for output in ('color','rgb','alpha'):
            rgba='vec4('+','.join(str(float(x)) for x in color)+')'
            rgb='vec3('+','.join(str(float(x)) for x in multiplier)+')'
            expression='vec4 inputColor='+rgba+'; vec3 product=inputColor.rgb*'+rgb+'; vec4 result='+({'color':'vec4(product,inputColor.a)','rgb':'vec4(product,1.0)','alpha':'vec4(inputColor.a)'}[output])+';'
            compare(fixture.color_graph(output,color,multiplier),expression,'color-'+label+'-'+output)

    for color,strength,back,label in [([.5,.5,1,.2],1,False,'flat'),([.8,.3,.9,.7],1,False,'tilted'),
                                     ([.8,.3,.9,.1],0,False,'zero-strength'),([.8,.3,.9,1],.35,False,'partial-strength'),
                                     ([.8,.3,.9,.8],1,True,'back-face')]:
        image=area.op('normal_texture') or area.create(constantTOP,'normal_texture')
        image.par.format='rgba32float';image.par.resolutionw=4;image.par.resolutionh=4
        for channel,value in zip('rgb',color):getattr(image.par,'color'+channel).val=value
        image.par.alpha=color[3]
        graph=fixture.normal_graph(strength=strength,sampled=True)
        next(d for d in graph['declarations'] if d['id']=='normalMap')['source']='op:'+image.path
        expression='vec3 n=(texture(sNormalMap,sg_v_uv_0.xy).rgb-0.5)*2.0; n.xy*='+str(float(strength))+'; n=normalize(sg_v_tbn_0*n); if(!TDFrontFacing(sg_v_world_0,sg_v_normal_0)) n=-n; vec4 result=vec4(n,1.0);'
        compare(graph,expression,'normal-'+label,back=back,tangents=True)
    (GRAPE_TEST_OUTPUT/'results.json').write_text(json.dumps(dict(passed=True,build=str(app.build),checks=checks),indent=2),encoding='utf-8')
finally:
    sys.path[:]=old_path
    area.destroy()
