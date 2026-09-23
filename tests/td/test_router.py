"""Verify Router transparency in native TOP/MAT without touching user graphs."""
import json,uuid,copy
from pathlib import Path
w=Path(GRAPE_TEST_OUTPUT);w.mkdir(parents=True,exist_ok=True)
owner=next(n for n in op('/').findChildren() if n.storage.get('sgrapeManager',False));r=owner.op('runtime').module
before={s.path:{n:s.op(n).text for n in ('state','graph','manifest','pixel_shader','vertex_shader') if s.op(n)} for s in r.shaders()}
area=op('/').create(baseCOMP,'router_probe_'+uuid.uuid4().hex[:8]);records=[]
try:
    mapping=json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8'))
    for dat in ('sgrape_legacy_nodes','source_catalog','sgrape_source_catalog','node_catalog','sgrape_composites','core'):
        area.create(textDAT,dat).text=source_path(mapping[dat]).read_text(encoding='utf-8')
    c=area.op('core').module
    text=(GRAPE_ROOT/'tests/unit/test_router.py').read_text(encoding='utf-8');ns={'c':c,'copy':copy};exec(text[text.index('def route_edges('):text.index('class RouterTests')],ns);route=ns['route_edges']
    top=area.create(glslTOP,'probe');pixel=area.create(textDAT,'pixel');top.par.pixeldat=pixel;top.par.outputresolution='custom';top.par.resolutionw=8;top.par.resolutionh=8;top.par.format='rgba32float';info=area.create(infoDAT,'info');info.par.op=top
    for value in ([.15,.4,.8,1],[-1,2,3,.5]):
        graph=c.demo_graph('color',target='top');graph['stages']['pixel']['nodes'][0]['params']['value']=value
        original=c.compile_graph(graph)['pixel'];routed=c.compile_graph(route(graph))['pixel'];assert original==routed
        pixel.text=original;top.cook(force=True);expected=top.numpyArray(delayed=False).copy()
        pixel.text=routed;top.cook(force=True);actual=top.numpyArray(delayed=False)
        assert not top.errors() and 'ERROR:' not in info.text,(top.errors(),info.text)
        assert actual is not None and (expected==actual).all()
        records.append('TOP exact pixels / '+str(value))
    mat=area.create(glslMAT,'mat');info.par.op=mat
    graph=c.demo_graph('color',target='mat');baseline=c.compile_graph(graph);routed=c.compile_graph(route(graph))
    for stage in ('vertex','pixel'):assert baseline[stage]==routed[stage]
    mat.par.pdat.eval().text=routed['pixel'];mat.par.vdat.eval().text=routed['vertex'];mat.cook(force=True)
    assert not mat.errors() and 'ERROR:' not in info.text,(mat.errors(),info.text)
    records.append('MAT vertex/pixel native compile with identical generated code')
    assert before=={s.path:{n:s.op(n).text for n in before[s.path]} for s in r.shaders()}
    (w/'result.json').write_text(json.dumps({'passed':True,'build':str(app.build),'records':records,'count':len(records),'existingShadersPreserved':True}),encoding='utf-8')
finally:area.destroy()
