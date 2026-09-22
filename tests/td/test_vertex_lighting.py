"""Real MAT compilation of dynamic stage payloads and complete light traversal."""
from pathlib import Path
import json,uuid,copy
root=op('/').create(baseCOMP,'grape_vertex_light_'+uuid.uuid4().hex[:8]);checks=[]
try:
    manager=root.create(baseCOMP,'manager');manager.store('sgrapeManager',True);manager.store('sgrapeManagerId',uuid.uuid4().hex)
    page=manager.appendCustomPage('Test');page.appendStr('Updatestatus');page.appendFolder('Personalfolder');manager.par.Personalfolder=str(Path(GRAPE_TEST_OUTPUT)/'empty')
    for dat,name in json.loads((GRAPE_ROOT/'src/td/embedded_sources.json').read_text(encoding='utf-8')).items():manager.create(textDAT,dat).text=source_path(name).read_text(encoding='utf-8')
    r=manager.op('runtime').module;r._owner=manager;c=r.core();document=manager.op('document').module
    shader=r.create_shader(root,'Material',c.demo_graph('color','mat'),'mat')
    with r.shader_context(shader):
        for model in ('phong','pbr'):
            g=c.demo_graph('color','mat');p=g['stages']['pixel'];p['nodes'].append(c.node('material_'+model,'lighting'));p['edges']=[c.edge('lighting','pixel','color')]
            deployment=r.deploy(document.stamp_catalog(g,c),r.state()['revision']);assert deployment['ok'],deployment;r.validate_material(shader)
            checks.append(model+' material with automatic world position, normal, camera and light traversal compiles')
        g=c.demo_graph('color','mat');v=g['stages']['vertex'];p=g['stages']['pixel']
        boundary=v['nodes'][-1]
        g['typeDefinitions']=[{'id':'payload','name':'Payload','provider':'generated','fields':[{'id':'weight','name':'weight','type':'float'},{'id':'flags','name':'flags','type':'bvec2'}]}]
        boundary['params']['outputs']=[dict(id=key,name=key,type=ty) for key,ty in [('weight','float'),('index','int'),('flags','bvec2'),('matrix','mat3'),('array','float[3]'),('structure','struct:payload')]]
        v['nodes'].append(c.node('builtin_source','index',source='gl_VertexIndex'));v['edges'].append(c.edge('index','vertex','index'))
        # Consume every payload in the pixel shader, including the reconstructed structure.
        p['nodes']=[c.node('vertex_input','input'),c.node('glsl_code','read',functionName='readPayload',inputs=[{'id':e['id'],'name':e['id'],'type':e['type']} for e in boundary['params']['outputs']],outputs=[{'id':'out','name':'color','type':'vec4'}],code='color = vec4(weight + float(index) + float(flags.x) + matrix[0][0] + array[0] + structure.weight);'),c.node('pixel_out','pixel')]
        p['edges']=[c.edge('input','read',e['id'],e['id']) for e in boundary['params']['outputs']]+[c.edge('read','pixel','color')]
        deployment=r.deploy(document.stamp_catalog(g,c),r.state()['revision']);assert deployment['ok'],deployment;r.validate_material(shader)
        checks.append('Vertex Index and scalar, int, bool vector, matrix, array and structure payloads compile across real MAT stages')
    result={'passed':True,'checks':checks}
    (Path(GRAPE_TEST_OUTPUT)/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
finally:root.destroy()
