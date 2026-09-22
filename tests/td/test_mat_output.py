"""Native MAT outlet and author-created outlet preservation."""
from pathlib import Path
import json,uuid
area=op('/').create(baseCOMP,'grape_mat_output_'+uuid.uuid4().hex[:8])
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager
    shader=r.create_shader(area,'Material',r.core().demo_graph('color','mat'),'mat')
    outlet=shader.op('out1');assert outlet.family=='MAT' and outlet.type=='out' and outlet.inputs==[shader.op('material')]
    downstream=area.create(nullMAT,'downstream');downstream.inputConnectors[0].connect(shader.outputConnectors[0])
    connected=list(downstream.inputs);assert connected,(downstream.inputs,shader.outputConnectors)
    outlet.name='author_output';identity=outlet.id;outlet.nodeX=123;outlet.nodeY=456
    r.ensure_mat_output(shader)
    assert shader.op('author_output').id==identity and not shader.op('out1')
    assert outlet.nodeX==123 and outlet.nodeY==456 and list(downstream.inputs)==connected
    result={'passed':True,'nativeMatConnection':True,'authorOutputPreserved':True}
finally:area.destroy()
