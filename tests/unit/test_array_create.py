"""Array creation keeps length provenance separate from runtime fill values."""
import copy
import unittest
import sgrape_core as c
from sgrape_composites import expression_length
from test_array_structures import graph, SAMPLE
from test_symbolic_arrays import length_decl


class ArrayCreate(unittest.TestCase):
    def build(self, length=None, fill=None, element='float'):
        create=c.node('array_create','a',elementType=element)
        create['inputValues']={'length':length if length is not None else 4}
        if fill is not None:create['inputValues']['value']=fill
        return graph([create,c.node('array_get','get')],[c.edge('a','get','Array')],ty=element)

    def test_fill_all_value_types_and_structure(self):
        for ty in list(c.TYPES)+['struct:sample','float[2]']:
            with self.subTest(type=ty):
                g=self.build(element=ty);g['typeDefinitions']=[SAMPLE]
                before=copy.deepcopy(g);text=c.compile_graph(g)['pixel']
                self.assertEqual(g,before);self.assertIn('sg_fill_i < 4',text)
                self.assertIn('sg_n_a[sg_fill_i] = ',text)

    def test_runtime_uniform_fills_but_cannot_size(self):
        g=self.build();g['declarations']=[dict(id='live',kind='uniform',name='uLive',type='int',value=3)]
        g['stages']['pixel']['nodes'].append(c.node('uniform','live',declarationId='live'))
        edge=c.edge('live','a','value');g['stages']['pixel']['edges'].append(edge)
        text=c.compile_graph(g)['pixel'];self.assertIn('float(sg_n_live)',text)
        edge['to'][1]='length'
        with self.assertRaisesRegex(c.GraphError,'integral constant'):c.compile_graph(g)

    def test_direct_integer_and_constant_references(self):
        for kind in ('scalar','constant','spec_constant'):
            g=self.build();g['declarations']=[length_decl('constant' if kind=='constant' else 'spec_constant')]
            source=c.node(kind,'size',**({'type':'uint','value':6} if kind=='scalar' else {'declarationId':'count'}))
            g['stages']['pixel']['nodes'].append(source);g['stages']['pixel']['edges'].append(c.edge('size','a','length'))
            text=c.compile_graph(g)['pixel'];self.assertIn('sg_fill_i < '+('6' if kind=='scalar' else 'arrayCount'),text)

    def test_expression_length_is_emitted_not_evaluated_and_has_source_map(self):
        g=self.build();source=c.node('add','size',type='int');source['inputValues']={'a':2,'b':3}
        g['stages']['pixel']['nodes'].append(source);g['stages']['pixel']['edges'].append(c.edge('size','a','length'))
        before=copy.deepcopy(g);result=c.compile_graph(g);text=result['pixel'];token=expression_length('pixel',('size','out'))
        self.assertEqual(g,before);self.assertIn('const int sg_n_size = (2 + 3)',text)
        self.assertIn('sg_n_a['+token+']',text);self.assertLess(text.index('const int '+token),text.index('void main'))
        for item in result['sourceMap']['pixel']:
            if 'const int sg_n_size' in text.splitlines()[item['line']-1]:self.assertEqual(item['node'],'size');break
        else:self.fail('Length expression lost its source mapping')

    def test_length_only_does_not_fill_or_read_uniform(self):
        g=self.build();g['stages']['pixel']['nodes'][1]=c.node('array_length','get')
        g['stages']['pixel']['nodes'][2]['params']['inputs'][0]['type']='int'
        source=c.node('add','size',type='int');source['inputValues']={'a':2,'b':3}
        g['stages']['pixel']['nodes'].extend([source,c.node('uniform','live',declarationId='live')])
        g['declarations']=[dict(id='live',kind='uniform',name='uLive',type='float',value=.5)]
        g['stages']['pixel']['edges'].extend([c.edge('size','a','length'),c.edge('live','a','value')])
        text=c.compile_graph(g)['pixel'];self.assertIn('(2 + 3)',text);self.assertNotIn('sg_fill_i',text);self.assertNotIn('uLive',text)

    def test_spec_expression_reuses_symbol_and_replace_copies_elements(self):
        g=self.build();g['declarations']=[length_decl()]
        g['stages']['pixel']['nodes'].extend([c.node('spec_constant','spec',declarationId='count'),c.node('add','size',type='int'),c.node('array_replace','replace')])
        edges=g['stages']['pixel']['edges'];edges[0]=c.edge('a','replace','Array')
        edges.extend([c.edge('replace','get','Array'),c.edge('spec','size','a'),c.edge('size','a','length')])
        text=c.compile_graph(g)['pixel'];self.assertIn('const int sg_n_size = (arrayCount + 0)',text);self.assertIn('sg_copy_i',text)
        self.assertLess(text.index('const int arrayCount'),text.index('const int sg_n_size'))

    def test_invalid_sizes_and_resource_fill_are_rejected(self):
        for length in (0,-1,1.5,1025):
            with self.subTest(length=length),self.assertRaises(c.GraphError):c.compile_graph(self.build(length))
        with self.assertRaises(c.GraphError):c.compile_graph(self.build(element='sampler2D'))
        g=self.build();g['stages']['pixel']['nodes'].append(c.node('scalar','size',type='float',value=4))
        g['stages']['pixel']['edges'].append(c.edge('size','a','length'))
        with self.assertRaisesRegex(c.GraphError,'int or uint'):c.compile_graph(g)

    def test_expression_array_through_subgraph_and_code(self):
        token=expression_length('pixel',('size','out'));ty='float['+token+']'
        code=c.node('glsl_code','code',functionName='passArray',inputs=[dict(id='data',name='data',type=ty)],outputs=[dict(id='out',name='result',type=ty)],code='for (int i=0; i<data.length(); ++i) result[i]=data[i];')
        source=c.node('add','size',type='int');source['inputValues']={'a':2,'b':3}
        g=self.build();g['stages']['pixel']['nodes'].extend([source,code,dict(id='call',definitionUuid=c.CALL,params={'functionId':'pass'})])
        g['stages']['pixel']['edges'][0]=c.edge('a','call','array')
        g['stages']['pixel']['edges'].extend([c.edge('size','a','length'),c.edge('call','code','data','array'),c.edge('code','get','Array')])
        g['functions']=[dict(id='pass',name='Pass',scope='local',stages=['pixel'],inputs=[dict(id='array',name='array',type=ty)],outputs=[dict(id='array',name='array',type=ty)],graph=dict(nodes=[dict(id='in',definitionUuid=c.FUNCTION_INPUT,params={}),dict(id='out',definitionUuid=c.FUNCTION_OUTPUT,params={})],edges=[c.edge('in','out','array','array')]))]
        text=c.compile_graph(g)['pixel'];self.assertLess(text.index('const int '+token),text.index('data['+token+']'))

    def test_function_instances_do_not_share_different_lengths(self):
        ty='float['+expression_length('fn_make',('input','length'))+']'
        f=dict(id='make',name='Make',scope='local',stages=['pixel'],inputs=[dict(id='length',name='length',type='int',default=4)],outputs=[dict(id='array',name='array',type=ty)],
            graph=dict(nodes=[dict(id='input',definitionUuid=c.FUNCTION_INPUT,params={}),c.node('array_create','values'),dict(id='output',definitionUuid=c.FUNCTION_OUTPUT,params={})],
                       edges=[c.edge('input','values','length','length'),c.edge('values','output','array')]))
        g=self.build();g['functions']=[f];data=g['stages']['pixel'];data['nodes']=data['nodes'][1:]
        data['nodes'].extend([dict(id=id,definitionUuid=c.CALL,params={'functionId':'make'}) for id in ('one','two')])
        data['nodes'].extend([c.node('scalar','size',type='int',value=4),c.node('scalar','other',type='int',value=5)])
        data['edges'][0]=c.edge('one','get','Array','array')
        data['edges'].extend([c.edge('size','one','length'),c.edge('size','two','length')])
        self.assertIn('sg_fill_i',c.compile_graph(g)['pixel'])
        data['edges'][-1]=c.edge('other','two','length')
        with self.assertRaisesRegex(c.GraphError,'same array length source'):c.compile_graph(g)


if __name__=='__main__':unittest.main()
