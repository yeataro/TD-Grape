"""Graphs for the five offset sampling functions; no TD dependency."""
KEYS = ('texture_proj_offset_2d', 'texture_proj_lod_offset_2d', 'texture_proj_grad_offset_2d',
        'texture_gather_offset_2d', 'texture_gather_offsets_2d')
OFFSETS = [[-1, 0], [0, 1], [1, 0], [0, -1]]

def sampling_graph(c, key, target='mat', stage='pixel', source='builtin:banana', component=2):
    g=c.demo_graph('banana',target)
    g['declarations']=[dict(id='texture_main',kind='sampler',name='uTexture',type='sampler2D',source=source)]
    sample=c.node(key,'sample');sample['ui']={'x':320,'y':120}
    sample['inputValues']={'uv':[.63,.87,.2,1.5] if 'proj' in key else [.42,.58]}
    if 'grad' in key:sample['inputValues'].update(dx=[.08,.01],dy=[.01,.09])
    if 'lod' in key:sample['inputValues']['lod']=2.
    if 'gather' in key:sample['inputValues']['component']=component
    if 'offsets' not in key:sample['inputValues']['offset']=[1,-1]
    nodes=[c.node('sampler','resource',declarationId='texture_main'),sample,c.node(stage+'_out','output')]
    edges=[c.edge('resource','sample','sampler'),c.edge('sample','output','color' if stage=='pixel' else 'position')]
    if 'offsets' in key:
        g['declarations'].append(dict(id='offsets',kind='constant',name='tapOffsets',type='ivec2[4]',value=OFFSETS))
        nodes.append(c.node('constant','offsets',declarationId='offsets'));edges.append(c.edge('offsets','sample','offsets'))
    g['stages'][stage]={'nodes':nodes,'edges':edges}
    if target=='top':g=c.normalize_top_sources(g)[0]
    return g
