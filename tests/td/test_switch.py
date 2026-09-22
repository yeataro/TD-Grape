"""Disposable native Switch probes; no writes to existing Shader graphs."""
import json,uuid
from pathlib import Path
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
owner=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False));r=owner.op('runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in r.shaders()}
area=op('/').create(baseCOMP,'switch_probe_'+uuid.uuid4().hex[:8]);records=[]
try:
    mapping=json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat in ('sgrape_legacy_nodes','source_catalog','sgrape_source_catalog','node_catalog','sgrape_composites','core'):
        area.create(textDAT,dat).text=source_path(mapping[dat]).read_text(encoding='utf-8')
    c=area.op('core').module
    text=(GRAPE_ROOT/'tests/unit/test_switch.py').read_text(encoding='utf-8-sig');ns={'c':c};exec(text[text.index('def fixture('):text.index('class SwitchTests')],ns);fixture=ns['fixture']
    top=area.create(glslTOP,'probe');pixel=area.create(textDAT,'pixel');top.par.pixeldat=pixel;top.par.outputresolution='custom';top.par.resolutionw=8;top.par.resolutionh=8;top.par.format='rgba32float'
    info=area.create(infoDAT,'info');info.par.op=top
    def check(label):
        top.cook(force=True);a=top.numpyArray(delayed=False);errors=str(top.errors() or '');assert not errors and 'ERROR:' not in info.text,(label,errors,info.text)
        assert a is not None and all(abs(float(v)-1)<1e-5 for v in a[4,4]),(label,None if a is None else a[4,4].tolist())
        records.append(label)
    for ty in c.TYPES:
        for index in (-1,0,1,2):
            graph=fixture(ty,index);compiled=c.compile_graph(graph);pixel.text=compiled['pixel'];check(ty+'/'+str(index))
    # One actual int-valued node selects at runtime; change only the native uniform.
    graph=fixture();n=graph['stages']['pixel']['nodes'];n.append(c.node('glsl_code','selector',functionName='selector',inputs=[],outputs=[{'id':'index','name':'index','type':'int'}],code='index = int(uIndex);'))
    graph['stages']['pixel']['edges'].append(c.edge('selector','choice','index','index'))
    probe=next(x for x in n if x['id']=='probe');probe['params']['code']='color = (value == uExpected) ? vec4(1.0) : vec4(0.0);'
    pixel.text='uniform float uIndex;\nuniform float uExpected;\n'+c.compile_graph(graph)['pixel'];program=pixel.text
    top.seq.vec.numBlocks=2;top.par.vec0name='uIndex';top.par.vec1name='uExpected'
    for index,expected in [(-8,0),(0,1),(1,2),(2,0),(1000,0)]:
        top.par.vec0valuex=index;top.par.vec1valuex=expected;check('runtime/'+str(index));assert pixel.text==program
    mat=area.create(glslMAT,'mat');matinfo=area.create(infoDAT,'matinfo');matinfo.par.op=mat
    for stage in ('pixel','vertex'):
        graph=fixture('vec4',1);graph['target']='mat';graph['stages']['vertex']=c.demo_graph('color')['stages']['vertex']
        if stage=='vertex':
            data=graph['stages']['pixel'];data['nodes'][-1]=c.node('vertex_out','pixel');graph['stages']['vertex']=data
            data['edges'][-1]['to'][1]='position';graph['stages']['pixel']={'nodes':[c.node('pixel_out','pixel')],'edges':[]}
        compiled=c.compile_graph(graph);mat.par.pdat.eval().text=compiled['pixel'];mat.par.vdat.eval().text=compiled['vertex'];mat.cook(force=True)
        assert not mat.errors() and 'ERROR:' not in matinfo.text,(stage,mat.errors(),matinfo.text);records.append('mat/'+stage)
    assert before=={s.path:{n:s.op(n).text for n in before[s.path]} for s in r.shaders()}
    result={'passed':True,'build':str(app.build),'count':len(records),'records':records,'existingShadersPreserved':True}
    (w/'result.json').write_text(json.dumps(result),encoding='utf-8')
finally:area.destroy()
