"""Native Math pixels, including noncommutative rows and native matrix operations."""
import json,uuid
from pathlib import Path
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
owner=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False));r=owner.op('runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in r.shaders()}
area=op('/').create(baseCOMP,'math_probe_'+uuid.uuid4().hex[:8]);records=[]
try:
    mapping=json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat in ('sgrape_legacy_nodes','source_catalog','sgrape_source_catalog','node_catalog','sgrape_composites','core'):
        area.create(textDAT,dat).text=source_path(mapping[dat]).read_text(encoding='utf-8')
    c=area.op('core').module
    text=(GRAPE_ROOT/'tests/unit/test_math.py').read_text(encoding='utf-8');ns={'c':c};exec(text[text.index('def fixture('):text.index('class MathTests')],ns);fixture=ns['fixture']
    top=area.create(glslTOP,'probe');pixel=area.create(textDAT,'pixel');top.par.pixeldat=pixel;top.par.outputresolution='custom';top.par.resolutionw=8;top.par.resolutionh=8;top.par.format='rgba32float';info=area.create(infoDAT,'info');info.par.op=top
    def check(graph,label):
        pixel.text=c.compile_graph(graph)['pixel'];top.cook(force=True);a=top.numpyArray(delayed=False)
        assert not top.errors() and 'ERROR:' not in info.text,(label,top.errors(),info.text)
        assert a is not None and all(abs(float(v)-1)<1e-5 for v in a[4,4]),(label,None if a is None else a[4,4].tolist())
        records.append(label)
    for ty in c.NUMERIC_TYPES:
        for operator,expected in [('add',15),('subtract',5),('multiply',60),('divide',4)]:
            g=fixture(ty,operator,expected)
            if operator=='divide':g['stages']['pixel']['nodes'][0]['inputValues']['input0']=c.filled_value(ty,24)
            check(g,ty+'/'+operator)
    for ty in c.MATRIX_TYPES:
        shape=c.TYPE_DESCRIPTORS[ty]
        for operator,expected in [('add',15),('subtract',5),('multiply',60*shape['columns']**2),('divide',4)]:
            if c.arithmetic_result(operator,ty,ty)!=ty:continue
            g=fixture(ty,operator,expected)
            if operator=='divide':g['stages']['pixel']['nodes'][0]['inputValues']['input0']=c.filled_value(ty,24)
            check(g,ty+'/'+operator)
    g=fixture(expected=21);g['stages']['pixel']['nodes'][0]['params'].update(mode='steps',steps=[{'operator':'subtract','input':1},{'operator':'multiply','input':1}]);check(g,'repeated operand / ordered rows')
    mat=area.create(glslMAT,'mat');info.par.op=mat
    for stage in ('pixel','vertex'):
        g=fixture('vec4');g['target']='mat';g['stages']['vertex']=c.demo_graph('color')['stages']['vertex']
        if stage=='vertex':
            data=g['stages']['pixel'];data['nodes'][-1]=c.node('vertex_out','pixel');data['edges'][-1]['to'][1]='position';g['stages']['vertex']=data;g['stages']['pixel']={'nodes':[c.node('pixel_out','pixel')],'edges':[]}
        code=c.compile_graph(g);mat.par.pdat.eval().text=code['pixel'];mat.par.vdat.eval().text=code['vertex'];mat.cook(force=True)
        assert not mat.errors() and 'ERROR:' not in info.text,(stage,mat.errors(),info.text);records.append('mat/'+stage)
    assert before=={s.path:{n:s.op(n).text for n in before[s.path]} for s in r.shaders()}
    (w/'result.json').write_text(json.dumps({'passed':True,'build':str(app.build),'records':records,'count':len(records),'existingShadersPreserved':True}),encoding='utf-8')
finally:area.destroy()
