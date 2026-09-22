"""Connected projection-map calls for compiler and host-render checks."""
def projection_graph(c, mode, light=0, lod=0):
    graph=c.demo_graph('color','mat');graph['declarations']=[]
    pixel=graph['stages']['pixel']
    call=c.node('td_projtexture_'+mode,'projection')
    call['inputValues']={'light':light}
    pixel['nodes']=[call,c.node('pixel_out','pixel')]
    if mode=='lod':
        call['inputValues']['lod']=lod
        pixel['nodes'].append(c.node('builtin_source','uv',source='TDScreenSpaceCoord'))
        pixel['edges']=[c.edge('uv','projection','uv'),c.edge('projection','pixel','color')]
    elif mode=='size':
        pixel['nodes'] += [c.node('convert','cast',fromType='ivec3',toType='vec3'),
                          c.node('combine','rgba',type='vec4',groups={'x':'vec3'},components=[0,0,0,1])]
        pixel['edges']=[c.edge('projection','cast','value'),c.edge('cast','rgba','x'),c.edge('rgba','pixel','color')]
    else:raise ValueError(mode)
    return graph
