"""Native picking values and unchanged normal renders in an isolated scene."""
from pathlib import Path
import json,uuid
import numpy as np
out=Path(GRAPE_TEST_OUTPUT);out.mkdir(parents=True,exist_ok=True)
area=op('/').create(baseCOMP,'grape_picking_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=area.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(out/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text()).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core()
    geo=area.create(geometryCOMP,'geometry');rect=geo.create(rectangleSOP,'rectangle')
    for child in geo.children:
        if child.family in ('SOP','POP'):child.render=child==rect;child.display=child==rect
    camera=area.create(cameraCOMP,'camera');camera.par.tz=2;camera.par.projection='ortho';camera.par.orthowidth=1.3
    render=area.create(renderTOP,'render');render.par.geometry=geo.path;render.par.camera=camera.path;render.par.resolutionw=128;render.par.resolutionh=128;render.par.antialias='aaoff';render.par.format='rgba32float';render.par.dither=False
    light=area.create(lightCOMP,'light');light.par.tz=3;render.par.lights=light.path
    reference=area.create(phongMAT,'reference')
    locations=area.create(tableDAT,'locations');locations.clear();locations.appendRow(['select','u','v']);locations.appendRow([1,.5,.5]);locations.appendRow([1,.001,.001]);locations.appendRow([1,.6,.55])
    picker=area.create(renderpickDAT,'pick');picker.inputConnectors[0].connect(locations)
    picker.par.rendertop=render.path;picker.par.strategy='always';picker.par.responsetime='thiscook';picker.par.usepickableflags=False;picker.par.pickradius=0
    picker.par.uv=True;picker.par.color=True;picker.par.instanceid=True
    def pick(material,space):
        geo.par.material=material;picker.par.position=space;picker.par.normal=space
        render.cook(force=True);picker.cook(force=True)
        assert not render.errors(),render.errors();assert not picker.errors(),picker.errors()
        names=[x.val for x in picker.row(0)]
        return [dict(zip(names,[x.val for x in row])) for row in picker.rows()[1:]]
    graphs={'color':c.demo_graph('color','mat'),'banana':c.demo_graph('banana','mat'),**json.loads((GRAPE_ROOT/'src/library/material_presets.json').read_text())}
    guard='#ifdef TD_PICKING_ACTIVE\n    TDWritePickingValues();\n#endif // TD_PICKING_ACTIVE\n'
    for label,graph in graphs.items():
        shader=r.create_shader(area,'Material_'+label,graph,'mat');code=shader.op('vertex_shader').text
        assert code.count(guard)==1 and code.endswith(guard+'}\n')
        assert 'TDWritePickingValues' not in shader.op('pixel_shader').text
        for position in ((0,0,0),(.1,0,.2)):
            geo.par.tx,geo.par.ty,geo.par.tz=position
            geo.par.ry=20 if position[0] else 0
            for space in ('sopspace','worldspace','cameraspace'):
                expected=pick(reference,space);actual=pick(shader.op('material'),space)
                (out/(label+'-'+space+'.json')).write_text(json.dumps({'actual':actual,'expected':expected},indent=2))
                assert actual and actual[0]['path'] in (geo.path,rect.path),actual
                assert not actual[1]['path'],actual
                for a,b in zip(actual,expected):
                    assert a['path']==b['path']
                    if not a['path']:continue
                    for key in tuple(prefix+str(i) for prefix,count in [('P_',3),('N_',3),('Tex_',3),('Color_',4)] for i in range(count))+('instance',):
                        assert key in a,(key,a)
                        assert abs(float(a[key])-float(b[key]))<.0001,(label,space,key,a[key],b[key])
                assert 'ERROR:' not in shader.op('compile_info').text,shader.op('compile_info').text
        geo.par.material=shader.op('material');render.cook(force=True);with_picking=render.numpyArray(delayed=False).copy()
        shader.op('vertex_shader').text=code.replace(guard,'');render.cook(force=True);without=render.numpyArray(delayed=False).copy()
        assert np.isfinite(with_picking).all() and np.max(np.abs(with_picking-without))==0,label
        shader.op('vertex_shader').text=code
        checks.append(label+': hit/miss, positions/normals in three spaces, UV/color/instance match native Phong; normal render unchanged')
    result={'passed':True,'checks':checks,'customVertexDeformation':'known limitation; no custom payload overrides'}
    (out/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
finally:area.destroy()
