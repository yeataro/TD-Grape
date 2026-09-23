"""Router stores real edges but never inserts a GLSL temporary or conversion."""
import copy
import unittest
import sgrape_core as c


def route_edges(graph):
    graph=copy.deepcopy(graph)
    units=list(graph['stages'].values())+[f['graph'] for f in graph.get('functions',[])]
    for data in units:
        edges=[]
        for index,edge in enumerate(data['edges']):
            ident='router_'+str(index)
            router=c.node('router',ident)
            router['ui'].update(label='UI only',comment='UI note')
            data['nodes'].append(router)
            edges.extend([{'from':edge['from'],'to':[ident,'value']},{**edge,'from':[ident,'out']}])
        data['edges']=edges
    return graph


class RouterTests(unittest.TestCase):
    def test_existing_shaders_unchanged_through_routers(self):
        for target in ('top','mat'):
            for example in ('color','banana','tint'):
                graph=c.demo_graph(example,target=target)
                routed=route_edges(graph);snapshot=copy.deepcopy(routed)
                before=c.compile_graph(graph);after=c.compile_graph(routed)
                for stage in graph['stages']:self.assertEqual(before[stage],after[stage],(target,example,stage))
                self.assertEqual(snapshot,routed)

    def test_all_numeric_types_follow_source_without_cast_or_temporary(self):
        for ty in c.TYPES:
            graph=c.demo_graph('color',target='top')
            source=c.node('glsl_code','source',functionName='sourceValue',inputs=[],outputs=[{'id':'out','name':'value','type':ty}],code='value = '+c.literal(c.filled_value(ty,1),ty)+';')
            probe=c.node('glsl_code','probe',functionName='testValue',inputs=[{'id':'value','name':'value','type':ty}],outputs=[{'id':'out','name':'color','type':'vec4'}],code='color = vec4(1.0);')
            graph['stages']['pixel']={'nodes':[source,probe,c.node('pixel_out','pixel')],'edges':[c.edge('source','probe','value'),c.edge('probe','pixel','color')]}
            self.assertEqual(c.compile_graph(graph)['pixel'],c.compile_graph(route_edges(graph))['pixel'],ty)

    def test_chains_fanout_and_disconnected_router(self):
        graph=c.demo_graph('color',target='top');before=c.compile_graph(graph)['pixel']
        graph=c.demo_graph('color',target='top');data=graph['stages']['pixel'];data['edges']=[]
        previous='color'
        for i in range(12):
            ident='r'+str(i);data['nodes'].append(c.node('router',ident));data['edges'].append(c.edge(previous,ident,'value'));previous=ident
        data['edges'].append(c.edge(previous,'pixel','color'))
        for i in range(20):
            ident='unused'+str(i);data['nodes'].append(c.node('router',ident));data['edges'].append(c.edge('r0',ident,'value'))
        data['nodes'].append(c.node('router','empty'))
        self.assertEqual(before,c.compile_graph(graph)['pixel'])

    def test_live_empty_router_and_cycles_rejected(self):
        graph=c.demo_graph('color',target='top');data=graph['stages']['pixel'];data['nodes'].append(c.node('router','r'));data['edges']=[c.edge('r','pixel','color')]
        with self.assertRaisesRegex(c.GraphError,'Connect a source'):c.compile_graph(graph)
        data['edges'].append(c.edge('r','r','value'))
        with self.assertRaisesRegex(c.GraphError,'Cycle'):c.compile_graph(graph)

    def test_specialization_value_keeps_constant_contract(self):
        graph=c.demo_graph('color',target='top');graph['declarations']=[{'id':'size','kind':'spec_constant','name':'uSize','type':'int','constantId':0,'value':4}]
        data=graph['stages']['pixel'];data['nodes']=[c.node('spec_constant','size',declarationId='size'),c.node('array_create','array',elementType='float',length=4),c.node('array_length','length',type='float[4]'),c.node('pixel_out','pixel')]
        data['edges']=[c.edge('size','array','length'),c.edge('array','length','Array'),c.edge('length','pixel','color')]
        self.assertEqual(c.compile_graph(graph)['pixel'],c.compile_graph(route_edges(graph))['pixel'])

    def test_arrays_structs_and_sampler_keep_source_identity(self):
        from test_array_structures import graph as compound_graph,SAMPLE
        fixtures=[compound_graph([c.node('array','source',elementType='vec3',length=3),c.node('array_get','get')],[c.edge('source','get','Array')],ty='vec3'),
                  compound_graph([c.node('struct_create','source',type='struct:sample'),c.node('struct_field','get',type='struct:sample',field='weight')],[c.edge('source','get','value')],definitions=[SAMPLE])]
        graph=c.demo_graph('banana',target='top')
        texture=next(n for n in graph['stages']['pixel']['nodes'] if n['definitionUuid']=='sgrape.builtin.texture')
        source=c.node('sampler','sampler',declarationId=texture['params']['declarationId'])
        graph['stages']['pixel']['nodes'].append(source)
        texture.update(definitionUuid=c.CATALOG['texture_sample']['definitionUuid'],params={})
        graph['stages']['pixel']['edges'].append(c.edge('sampler',texture['id'],'sampler'));fixtures.append(graph)
        for graph in fixtures:self.assertEqual(c.compile_graph(graph)['pixel'],c.compile_graph(route_edges(graph))['pixel'])

    def test_subgraph_boundaries_and_router_chains(self):
        from test_functions import graph as subgraph
        graph=subgraph()
        for fn in graph['functions']:fn['scope']='local'
        before=c.compile_graph(graph)
        after=c.compile_graph(route_edges(graph))
        for stage in graph['stages']:self.assertEqual(before[stage],after[stage])

if __name__=='__main__':unittest.main()
