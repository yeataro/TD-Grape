"""Disposable GPU probes for graph arrays, native sources and structure fields.

Uses current core-generated node statements, compares each value on GPU, and
changes only the final output sink to remove MAT dithering / observe vertices.
User shader state, selected shader and manager registry must remain unchanged.
"""
from pathlib import Path
import copy
import json
import re
import uuid


def build_cases(c):
    cases=[]
    def add(label,nodes,edges,outputs,**kwargs):
        cases.append(dict(label=label,nodes=nodes,edges=edges,outputs=outputs,**kwargs))
    def out(ty,expected,node='operation',port='out',expression=None):
        return dict(type=ty,expected=expected,node=node,port=port,expression=expression)
    def values(ty,contents):
        base=ty.split('[')[0]
        literals=[c.literal(value,base) for value in contents]
        return c.node('glsl_code','values',functionName='arrayValues',inputs=[],outputs=[dict(id='out',name='result',type=ty)],code='result = '+ty+'('+', '.join(literals)+');')
    indices=[-9,0,1,2,9]
    declaration=dict(id='index',kind='uniform',name='uArrayIndex',type='int',value=0)
    for element,initial in [('float',[2.,4.,8.]),('vec3',[[1.,2.,3.],[4.,5.,6.],[7.,8.,9.]]),('int',[-7,11,23]),('bool',[False,True,False]),('double',[1.,2.,3.]),('mat2x3',[[float(j+i*6) for j in range(6)] for i in range(3)])]:
        ty=element+'[3]';width=c.type_components(element)
        flattened=lambda v:[v] if width==1 else v
        for index_type in ('int','uint'):
            decl=dict(declaration,type=index_type)
            # TD TOP's numeric uniform carrier does not preserve UINT_MAX on
            # this build. Test dynamic range handling with exactly transported
            # values; exercise the full uint bound separately as GLSL literal.
            updates=[dict(index=i,expected=flattened(initial[min(2,max(0,i))])) for i in (indices if index_type=='int' else [0,1,2,9])]
            add('read/'+ty+'/'+index_type,[values(ty,initial),c.node('uniform','index',declarationId='index'),c.node('array_get','operation',type=ty,indexType=index_type)],
                [c.edge('values','operation','Array'),c.edge('index','operation','i')],[out(element,flattened(initial[0]))],declarations=[decl],updates=updates)
        maximum=c.node('array_get','operation',type=ty,indexType='uint');maximum['inputValues']={'i':4294967295}
        add('read/uint-max-literal/'+ty,[values(ty,initial),maximum],
            [c.edge('values','operation','Array')],[out(element,flattened(initial[2]))])
        zero=c.filled_value(element)
        if element in c.MATRIX_TYPES:zero=[0.]*width
        add('zero/'+ty,[c.node('array','values',elementType=element,length=3),c.node('array_get','operation',type=ty)],
            [c.edge('values','operation','Array')],[out(element,flattened(zero))])
    for index_type in ('int','uint'):
        for index in (indices if index_type=='int' else [0,1,2,4294967295]):
            replace=c.node('array_replace','replace',type='float[3]',indexType=index_type)
            replace['inputValues']={'i':index,'replacement':17.}
            nodes=[values('float[3]',[2.,4.,8.]),replace]
            edges=[c.edge('values','replace','Array')];outputs=[]
            for i in range(3):
                for tag,parent in (('old','values'),('new','replace')):
                    name=tag+str(i);get=c.node('array_get',name,type='float[3]');get['inputValues']={'i':i}
                    nodes.append(get);edges.append(c.edge(parent,name,'Array'))
                    outputs.append(out('float',[17. if tag=='new' and index==i else [2.,4.,8.][i]],node=name))
            add('replace/copy-and-range/'+index_type+'/'+str(index),nodes,edges,outputs)
    add('length/fixed',[c.node('array','values',elementType='vec4',length=7),c.node('array_length','operation',type='vec4[7]')],
        [c.edge('values','operation','Array')],[out('int',[7])])
    precise=c.node('array_get','operation',type='double[2]');precise['inputValues']={'i':1}
    add('read/double-literal-precision',[values('double[2]',[1.+2**-40,2.+2**-40]),precise],
        [c.edge('values','operation','Array')],[out('double',[2.+2**-40])])
    custom=dict(id='sample',name='Sample',provider='generated',fields=[dict(id='offset',name='offset',type='vec2'),dict(id='weight',name='weight',type='float')])
    generator=c.node('glsl_code','values',functionName='makeSamples',inputs=[],outputs=[dict(id='out',name='result',type='struct:sample[2]')],
        code='result[0].offset = vec2(1.0,2.0); result[0].weight = 3.0; result[1].offset = vec2(4.0,5.0); result[1].weight = 6.0;')
    get=c.node('array_get','get',type='struct:sample[2]');get['inputValues']={'i':8}
    add('struct/generated-array-fields',[generator,get,c.node('struct_field','offset',type='struct:sample',field='offset'),c.node('struct_field','weight',type='struct:sample',field='weight')],
        [c.edge('values','get','Array'),c.edge('get','offset','value'),c.edge('get','weight','value')],
        [out('vec2',[4.,5.],node='offset'),out('float',[6.],node='weight')],typeDefinitions=[custom])
    for ty in ('TDTexInfo','TDMatrix','TDCameraInfo','TDLight'):
        definition=c.type_registry().structs[ty]
        nodes=[c.node('array','values',elementType=ty,length=2),c.node('array_get','get',type=ty+'[2]')]
        edges=[c.edge('values','get','Array')];outputs=[]
        for member in definition['fields']:
            field=member['id'];field_type=member['type'];name='field_'+field
            nodes.append(c.node('struct_field',name,type=ty,field=field));edges.append(c.edge('get',name,'value'))
            outputs.append(out(field_type,[0]*c.type_components(field_type),node=name))
        add('zero/external-struct/'+ty,nodes,edges,outputs,targets=definition['targets'])
    # Native CHOP arrays use TD's legal float/vector carrier; values update
    # without changing graph literals or regenerating either shader stage.
    for element in ('float','vec2','vec3','vec4'):
        width=c.type_components(element);initial=[[float(1+i*4+j) for j in range(4)] for i in range(3)]
        updated=[[float(20+i*4+j) for j in range(4)] for i in range(3)]
        ty=element+'[3]';get=c.node('array_get','operation',type=ty)
        add('native-chop/'+ty,[c.node('uniform','values',declarationId='values'),c.node('uniform','index',declarationId='index'),get],
            [c.edge('values','operation','Array'),c.edge('index','operation','i')],[out(element,initial[0][:width])],
            declarations=[declaration,dict(id='values',kind='uniform',name='uProbeArray',type=ty,nativeSequence='array',value=[0. if width==1 else [0.]*width for _ in range(3)])],
            arrayElement=element,updates=[dict(index=-1,expected=initial[0][:width],samples=initial),dict(index=9,expected=updated[2][:width],samples=updated)])
    for source,ty in [('uTDMats','TDMatrix'),('uTDCamInfos','TDCameraInfo'),('uTDLights','TDLight')]:
        array_type=ty+'['+('TD_NUM_LIGHTS' if source=='uTDLights' else 'TD_NUM_CAMERAS')+']'
        get=c.node('array_get','get',type=array_type);get['inputValues']={'i':99}
        nodes=[c.node('builtin_source','values',source=source),get];edges=[c.edge('values','get','Array')];outputs=[]
        for member in c.type_registry().structs[ty]['fields']:
            field=member['id'];field_type=member['type'];name='field_'+field
            nodes.append(c.node('struct_field',name,type=ty,field=field));edges.append(c.edge('get',name,'value'))
            outputs.append(out(field_type,[0.]*c.type_components(field_type),node=name,expression=source+'[0].'+field))
        add('builtin/'+source,nodes,edges,outputs,targets=['mat'])
    get=c.node('array_get','get',type='TDTexInfo[TD_NUM_2D_INPUTS]');get['inputValues']={'i':99}
    add('builtin/TOP-info',[c.node('builtin_source','values',source='uTD2DInfos'),get,c.node('struct_field','operation',type='TDTexInfo',field='res')],
        [c.edge('values','get','Array'),c.edge('get','operation','value')],[out('vec4',[.125,.25,8.,4.])],targets=['top'],topInputs=True)
    get=c.node('array_get','get',type='sampler2D[TD_NUM_2D_INPUTS]');get['inputValues']={'i':99}
    add('builtin/TOP-sampler',[c.node('builtin_source','values',source='sTD2DInputs'),get,c.node('texture_sample','operation')],
        [c.edge('values','get','Array'),c.edge('get','operation','sampler')],[out('vec4',[.25,.5,.75,1.])],targets=['top'],topInputs=True)
    # The diagnostic observer uses the product's ordinary GLSL Code interface,
    # which intentionally allows at most 16 ports. Cover larger host structures
    # in batches; never widen the product's interface limit for a test fixture.
    bounded=[]
    for case in cases:
        if len(case['outputs'])<=16:
            bounded.append(case);continue
        for start in range(0,len(case['outputs']),16):
            bounded.append(dict(case,label=case['label']+'/fields-'+str(start//16+1),outputs=case['outputs'][start:start+16]))
    return bounded


def scalar_text(value,family):
    if family=='bool':return 'true' if value else 'false'
    if family in ('int','uint'):return str(int(value))+('u' if family=='uint' else '')
    text=format(float(value),'.17g')
    if '.' not in text and 'e' not in text.lower():text+='.0'
    return text+('LF' if family=='double' else '')


def probe_graph(c,case,kind,stage):
    graph=c.normalize_top_sources(c.demo_graph('color',kind))[0]
    if kind=='top':graph['topInputs']=[dict(id='slot'+str(i),name='Input '+str(i),defaultSource='builtin:white') for i in range(2)] if case.get('topInputs') else []
    graph['declarations']=copy.deepcopy(case.get('declarations',[]));graph['typeDefinitions']=copy.deepcopy(case.get('typeDefinitions',[]))
    inputs=[];edges=copy.deepcopy(case['edges']);checks=[];n=0
    for j,output in enumerate(case['outputs']):
        name='value'+str(j);ty=output['type'];d=c.TYPE_DESCRIPTORS[ty]
        inputs.append(dict(id=name,name=name,type=ty));edges.append(c.edge(output['node'],'observe',name,output['port']))
        suffixes=['['+str(col)+']['+str(row)+']' for col in range(d['columns']) for row in range(d['rows'])] if ty in c.MATRIX_TYPES else ['['+str(i)+']' for i in range(d['components'])] if d['components']>1 else ['']
        for suffix,value in zip(suffixes,output['expected']):
            wanted='('+output['expression']+')'+suffix if output.get('expression') else d['family']+'(uExpected'+str(n)+')' if case.get('updates') else scalar_text(value,d['family'])
            checks.append('('+name+suffix+' == '+wanted+')');n+=1
    observer=c.node('glsl_code','observe',functionName='arrayProbe',inputs=inputs,outputs=[dict(id='color',name='color',type='vec4')],code='color = vec4(0.25, ('+' && '.join(checks)+') ? 1.0 : 0.0, 0.5, 1.0);')
    graph['stages'][stage]=dict(nodes=copy.deepcopy(case['nodes'])+[observer,c.node(stage+'_out','result')],edges=edges+[c.edge('observe','result','color' if stage=='pixel' else 'position','color')])
    return graph,n


def run_native():
    output=Path(GRAPE_TEST_OUTPUT);output.mkdir(parents=True,exist_ok=True)
    owners=[n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False)]
    assert len(owners)==1
    runtime=owners[0].op('runtime').module
    def saved():
        return {s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in runtime._shaders.values() if s and s.valid}
    before=saved();selected=runtime._shader;registry={k:s.path for k,s in runtime._shaders.items() if s and s.valid}
    name='grape_array_nodes_'+uuid.uuid4().hex[:8];area=op('/').create(baseCOMP,name)
    report=dict(build=str(app.build),records=[])
    try:
        for dat,file in [('node_catalog','node_catalog.json'),('sgrape_composites','sgrape_composites.py'),('core','sgrape_core.py')]:area.create(textDAT,dat).text=source_path(file).read_text(encoding='utf-8')
        c=area.op('core').module
        top=area.create(glslTOP,'top_probe');top_pixel=area.create(textDAT,'top_pixel');top.par.pixeldat=top_pixel
        top.par.outputresolution='custom';top.par.resolutionw=32;top.par.resolutionh=16;top.par.format='rgba32float'
        mat=area.create(glslMAT,'mat_probe');mat_pixel=mat.par.pdat.eval();mat_vertex=mat.par.vdat.eval()
        geometry=area.create(geometryCOMP,'geometry');rectangle=geometry.create(rectangleSOP,'rectangle')
        for child in geometry.children:
            if child.family in ('SOP','POP'):child.render=child==rectangle;child.display=child==rectangle
        geometry.par.material=mat;geometry.par.sx=2;geometry.par.sy=2
        camera=area.create(cameraCOMP,'camera');camera.par.tz=2;camera.par.projection='ortho';camera.par.orthowidth=1.12
        light=area.create(lightCOMP,'light');light.par.tx=1;light.par.ty=2;light.par.tz=3
        render=area.create(renderTOP,'render');render.par.camera=camera;render.par.geometry=geometry;render.par.lights=light
        render.par.resolutionw=32;render.par.resolutionh=16;render.par.format='rgba32float';render.par.antialias='aaoff'
        textures=[]
        for i in range(2):
            texture=area.create(constantTOP,'texture'+str(i));texture.par.resolutionw=4*(i+1);texture.par.resolutionh=2*(i+1)
            texture.par.colorr=.25 if i else 0.;texture.par.colorg=.5 if i else 0.;texture.par.colorb=.75 if i else 0.;texture.par.alpha=1.;texture.par.format='rgba32float';textures.append(texture)
        callbacks=area.create(textDAT,'array_callbacks');callbacks.text="import numpy as np\ndef onCook(scriptOp):\n    scriptOp.copyNumpyArray(np.ascontiguousarray(np.asarray(scriptOp.fetch('samples'), dtype=np.float32).T))\n"
        data=area.create(scriptCHOP,'samples');data.par.callbacks=callbacks
        infos={}
        for native in (top,mat):
            native.par.glslversion='glsl450';native.par.compilebehavior='stalluntildone'
            info=area.create(infoDAT,native.name+'_info');info.par.op=native;infos[native.path]=info
        for case in build_cases(c):
            for kind,stage in (('top','pixel'),('mat','pixel'),('mat','vertex')):
                if kind not in case.get('targets',['top','mat']):continue
                native,target=(top,top) if kind=='top' else (mat,render)
                graph=None;pixel='';vertex=''
                try:
                    graph,count=probe_graph(c,case,kind,stage);compiled=c.compile_graph(graph)
                    pixel,vertex=compiled['pixel'],compiled['vertex']
                    extra=''.join('uniform float uExpected'+str(i)+';\n' for i in range(count)) if case.get('updates') else ''
                    if stage=='vertex':
                        vertex,changes=re.subn(r'gl_Position = ([^;]+);',r'vArrayProbe = \1; gl_Position = TDWorldToProj(TDDeform(TDPos()));',vertex);assert changes==1
                        vertex=extra+'flat out vec4 vArrayProbe;\n'+vertex
                        pixel='flat in vec4 vArrayProbe;\nlayout(location=0) out vec4 fragColor;\nvoid main(){fragColor=vArrayProbe;}'
                    else:
                        if kind=='mat':pixel=pixel.replace('TDOutputSwizzle(TDDither(sg_color))','TDOutputSwizzle(sg_color)')
                        pixel=extra+pixel
                    if kind=='top':top.par.tops=' '.join(t.path for t in textures) if case.get('topInputs') else '';top_pixel.text=pixel
                    else:mat_pixel.text=pixel;mat_vertex.text=vertex
                    native.seq.vec.numBlocks=count+1 if case.get('updates') else 1
                    for i in range(native.seq.vec.numBlocks):getattr(native.par,'vec'+str(i)+'name').val=''
                    if case.get('updates'):
                        native.par.vec0name='uArrayIndex'
                        for i in range(count):getattr(native.par,'vec'+str(i+1)+'name').val='uExpected'+str(i)
                    native.seq.array.numBlocks=1;native.par.array0name=''
                    native.seq.const.numBlocks=1;native.par.const0name=''
                    if case.get('specialization'):
                        native.par.const0name='arrayCount';native.par.const0value=case['specialization']
                    if case.get('arrayElement'):
                        native.par.array0name='uProbeArray';native.par.array0type=case['arrayElement'];native.par.array0arraytype='uniformarray';native.par.array0chop=data
                    program=(pixel,vertex)
                    for update in case.get('updates',[{}]):
                        record=dict(label=case['label'],target=kind,stage=stage,index=update.get('index'))
                        if case.get('updates'):
                            native.par.vec0valuex=update['index']
                            for i,value in enumerate(update['expected']):getattr(native.par,'vec'+str(i+1)+'valuex').val=value
                        if update.get('samples'):data.store('samples',update['samples']);data.cook(force=True)
                        if update.get('specialization'):native.par.const0value=update['specialization']
                        native.cook(force=True);target.cook(force=True);pixels=target.numpyArray(delayed=False)
                        record['errors']=str(native.errors() or '')+str(target.errors() or '');record['compileInfo']=infos[native.path].text
                        assert pixels is not None,'GPU readback unavailable'
                        record['actual']=pixels[pixels.shape[0]//2,pixels.shape[1]//2].tolist()
                        record['programUnchanged']=(top_pixel.text,vertex)==program if kind=='top' else (mat_pixel.text,mat_vertex.text)==program
                        record['passed']=not record['errors'] and 'ERROR:' not in record['compileInfo'] and record['programUnchanged'] and all(abs(a-b)<1e-5 for a,b in zip(record['actual'],[.25,1.,.5,1.]))
                        report['records'].append(record)
                except Exception as exc:report['records'].append(dict(label=case['label'],target=kind,stage=stage,passed=False,error=str(exc)))
                if not report['records'][-1]['passed']:
                    stem=output/('failure_'+str(len(report['records'])))
                    stem.with_suffix('.pixel.glsl').write_text(pixel,encoding='utf-8');stem.with_suffix('.vertex.glsl').write_text(vertex,encoding='utf-8')
                    stem.with_suffix('.graph.json').write_text(json.dumps(graph,indent=2),encoding='utf-8')
        report['completed']=True
    finally:
        area.destroy();report['existingShadersPreserved']=saved()==before
        report['registryPreserved']=registry=={k:s.path for k,s in runtime._shaders.items() if s and s.valid} and runtime._shader==selected
        report['fixtureRemoved']=op('/'+name) is None
        report['passed']=bool(report.get('completed') and report['records']) and all(row['passed'] for row in report['records']) and all(report[k] for k in ('existingShadersPreserved','registryPreserved','fixtureRemoved'))
        (output/'array-nodes-result.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    assert report['passed'],{k:v for k,v in report.items() if k!='records'}
    return dict(passed=True,records=len(report['records']),existingShadersPreserved=True,registryPreserved=True,fixtureRemoved=True)


if 'op' in globals():result=run_native()
