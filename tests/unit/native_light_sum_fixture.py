"""Connected geometry inputs for native light-sum regression tests."""
def light_sum_graph(c,key,output='diffuse'):
    g=c.demo_graph('color','mat');g['declarations']=[]
    v=g['stages']['vertex'];p=g['stages']['pixel']
    boundary=v['nodes'][-1]
    boundary['params']['outputs']=[dict(id=k,name=k,type=t,interpolation='flat' if t=='int' else 'smooth') for k,t in [('world','vec3'),('normal','vec3'),('camera','int')]]
    v['nodes'] += [c.node('swizzle','world',type='vec4',mask='xyz'),c.node('builtin_source','normal_source',source='TDNormal'),c.node('td_deform_normal','normal'),c.node('builtin_source','camera',source='TDCameraIndex')]
    v['edges'] += [c.edge('deform','world','value'),c.edge('normal_source','normal','value'),c.edge('world','vertex','world'),c.edge('normal','vertex','normal'),c.edge('camera','vertex','camera')]
    p['nodes']=[c.node('vertex_input','inputs'),c.node('builtin_source','matrices',source='uTDMats'),c.node('array_get','camera_matrix',type='TDMatrix[TD_NUM_CAMERAS]'),c.node('struct_field','inverse',type='TDMatrix',field='camInverse'),c.node('matrix_get','camera_position4',type='mat4'),c.node('swizzle','camera_position',type='vec4',mask='xyz'),c.node('subtract','to_camera',type='vec3'),c.node('normalize','view',type='vec3'),c.node('normalize','normal',type='vec3'),c.node(key,'lights'),c.node('pixel_out','pixel')]
    p['nodes'][4]['inputValues']={'column':3}
    p['edges']=[c.edge('matrices','camera_matrix','Array'),c.edge('inputs','camera_matrix','i','camera'),c.edge('camera_matrix','inverse','value'),c.edge('inverse','camera_position4','value'),c.edge('camera_position4','camera_position','value'),c.edge('camera_position','to_camera','a'),c.edge('inputs','to_camera','b','world'),c.edge('to_camera','view','value'),c.edge('inputs','normal','value','normal'),c.edge('normal','lights','normal'),c.edge('view','lights','view'),c.edge('lights','pixel','color',output)]
    if key!='td_env_lighting_pbr_all':p['edges'].append(c.edge('inputs','lights','position','world'))
    p['nodes'].append(c.node('combine','rgba',type='vec4',groups={'x':'vec3'},components=[0,0,0,1]))
    p['edges']=[e for e in p['edges'] if e['to']!=['pixel','color']]+[c.edge('lights','rgba','x',output),c.edge('rgba','pixel','color')]
    return g
