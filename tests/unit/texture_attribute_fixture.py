"""Explicit geometry texture coordinates passed through the shared stage interface."""
def texture_graph(c,name='Tex',layer=0,instance=True):
    g=c.demo_graph('color','mat')
    g['declarations']=[dict(id='tex',kind='attribute',name=name,type='vec3',value=None,nativeSequence='attr',arraySize=1)]
    v=g['stages']['vertex'];boundary=v['nodes'][-1]
    boundary['params']['outputs']=[dict(id='uv',name='UV',type='vec3',interpolation='smooth')]
    tex=c.node('tex_attribute','tex',declarationId='tex');tex['inputValues']={'layer':layer};v['nodes'].append(tex)
    if instance:
        v['nodes'].append(c.node('td_instance_texcoord_current','instance_uv'))
        v['edges'].append(c.edge('tex','instance_uv','uv'))
    v['edges'].append(c.edge('instance_uv' if instance else 'tex','vertex','uv'))
    g['stages']['pixel']={'nodes':[c.node('vertex_input','input'),c.node('combine','color',type='vec4',groups={'x':'vec3'},components=[0,0,0,1]),c.node('pixel_out','pixel')],
                        'edges':[c.edge('input','color','x','uv'),c.edge('color','pixel','color')]}
    return g
