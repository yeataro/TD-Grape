"""Small connected graphs for the native MAT functions discovered by export."""
def accessor_graph(c, mode):
    g=c.demo_graph('color','mat');g['declarations']=[]
    v=g['stages']['vertex'];p=g['stages']['pixel']
    p['nodes']=[c.node('pixel_out','pixel')];p['edges']=[]
    if mode=='screen':
        p['nodes'] += [c.node('builtin_source','screen',source='TDScreenSpaceCoord'),
                       c.node('combine','rgba',type='vec4',groups={'x':'vec2'},components=[0,0,0,1])]
        p['edges']=[c.edge('screen','rgba','x'),c.edge('rgba','pixel','color')]
    elif mode=='convert':
        p['nodes'].append(c.node('td_convert_color_space','convert'))
        p['nodes'][-1]['inputValues']={'color':[.2,.4,.8,.75]}
        p['edges']=[c.edge('convert','pixel','color')]
    elif mode in ('color_vertex','color_pixel','color_source'):
        boundary=next(n for n in v['nodes'] if n['definitionUuid']=='sgrape.builtin.vertex_out')
        entry=dict(id='data',name='data',type='int' if mode=='color_pixel' else 'vec4',interpolation='flat' if mode=='color_pixel' else 'smooth')
        boundary['params']['outputs']=[entry]
        p['nodes'].append(c.node('vertex_input','inputs'))
        if mode=='color_source':
            v['nodes'].append(c.node('builtin_source','geometry_color',source='TDColor'))
            v['edges'].append(c.edge('geometry_color','vertex','data'))
            p['edges']=[c.edge('inputs','pixel','color','data')]
        elif mode=='color_vertex':
            v['nodes'].append(c.node('td_instance_color_current','instance_color'))
            v['nodes'][-1]['inputValues']={'color':[.8,.6,.4,1]}
            v['edges'].append(c.edge('instance_color','vertex','data'))
            p['edges']=[c.edge('inputs','pixel','color','data')]
        else:
            v['nodes'].append(c.node('builtin_source','instance',source='TDInstanceIndex'))
            v['edges'].append(c.edge('instance','vertex','data'))
            p['nodes'].append(c.node('td_instance_color_pixel','instance_color'))
            p['nodes'][-1]['inputValues']={'color':[.8,.6,.4,1]}
            p['edges']=[c.edge('inputs','instance_color','instance','data'),c.edge('instance_color','pixel','color')]
    else:raise ValueError(mode)
    return g
