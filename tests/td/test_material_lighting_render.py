"""Integrated materials produce finite pixels and include every regular light."""
from pathlib import Path
import json,uuid
import numpy as np
root=op('/').create(baseCOMP,'grape_lighting_pixels_'+uuid.uuid4().hex[:8])
checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();document=manager.op('document').module
    shader=r.create_shader(root,'Material',c.demo_graph('color','mat'),'mat')
    red=root.create(lightCOMP,'red');green=root.create(lightCOMP,'green')
    for light,rgb in [(red,(1,0,0)),(green,(0,1,0))]:
        light.par.tz=2
        for par,value in zip((light.par.cr,light.par.cg,light.par.cb),rgb):par.val=value
    with r.shader_context(shader):
        for model in ('phong','pbr'):
            g=c.demo_graph('color','mat');g['stages']['pixel']['nodes'].append(c.node('material_'+model,'lighting'));g['stages']['pixel']['edges']=[c.edge('lighting','pixel','color')]
            applied=r.deploy(document.stamp_catalog(g,c),r.state()['revision']);assert applied['ok'],applied
            with r.validation_scene(shader) as render:
                values=[]
                for lights in ('',red.path,red.path+' '+green.path):
                    render.par.lights=lights;render.cook(force=True)
                    assert not render.errors(),render.errors()
                    assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
                    data=render.numpyArray(delayed=False);assert data is not None and np.isfinite(data).all()
                    values.append(data[data.shape[0]//2,data.shape[1]//2,:3].tolist())
                assert max(values[0])<.01,(model,values)
                assert values[1][0]>.01 and values[1][1]<.01,(model,values)
                assert values[2][1]>.01 and abs(values[2][0]-values[1][0])<.02,(model,values)
                checks.append({'model':model,'zeroOneTwoLightPixels':values})
    result={'passed':True,'checks':checks}
    (Path(GRAPE_TEST_OUTPUT)/'results.json').write_text(json.dumps(result,indent=2))
finally:root.destroy()
