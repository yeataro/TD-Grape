"""Symbolic array extents retain provenance without evaluating host state."""
import copy
import unittest

import sgrape_core as c
import sgrape_sources as sources
from test_array_structures import graph


def length_decl(kind='spec_constant',ident='count',name='arrayCount',ty='int'):
    return dict(id=ident,kind=kind,name=name,type=ty,value=4,**({'constantId':3} if kind=='spec_constant' else {}))


class SymbolicArrays(unittest.TestCase):
    def test_symbolic_zero_replace_get_does_not_require_cpu_length(self):
        for ty in ('float','vec3','mat2','float[2]'):
            with self.subTest(ty=ty):
                g=graph([c.node('array','a',elementType=ty,length='sg_len_count'),c.node('array_replace','replace'),c.node('array_get','get')],
                        [c.edge('a','replace','Array'),c.edge('replace','get','Array')],ty=ty)
                g['declarations']=[length_decl()];before=copy.deepcopy(g)
                result=c.compile_graph(g);text=result['pixel']
                self.assertEqual(g,before)
                self.assertIn('layout(constant_id = 3) const int arrayCount = 4;',text)
                self.assertIn('sg_init_0 < arrayCount',text)
                self.assertIn('sg_copy_i < arrayCount',text)
                self.assertIn('clamp(0, 0, arrayCount - 1)',text)
                self.assertNotIn('#if arrayCount',text)
                self.assertNotIn('sg_len_count',text)
                self.assertEqual([d['id'] for d in result['bindings']],['count'])

    def test_length_only_emits_dependency_without_array_data(self):
        g=graph([c.node('array','a',length='sg_len_count'),c.node('array_length','get')],[c.edge('a','get','Array')],ty='int')
        g['declarations']=[length_decl(ty='uint')]
        text=c.compile_graph(g)['pixel']
        self.assertIn(' = int(arrayCount);',text)
        self.assertNotIn('sg_n_a',text)
        g['stages']['pixel']['nodes'][1]['params']['requireConstant']=True
        with self.assertRaisesRegex(c.GraphError,'Specialization length'):c.compile_graph(g)

    def test_constant_length_dependency_precedes_uniform(self):
        g=graph([c.node('uniform','a',declarationId='aFirst'),c.node('array_get','get')],[c.edge('a','get','Array')])
        g['declarations']=[length_decl('constant'),dict(id='aFirst',kind='uniform',name='weights',type='float[sg_len_count]',value=None,nativeSequence='array',arraySource='/project1/values')]
        text=c.compile_graph(g)['pixel']
        self.assertLess(text.index('const int arrayCount'),text.index('uniform float weights[arrayCount]'))
        g['declarations'][0]['name']='renamedCount'
        self.assertIn('weights[renamedCount]',c.compile_graph(g)['pixel'])

    def test_symbol_identity_not_numeric_default_or_display_N(self):
        g={'declarations':[length_decl(),dict(length_decl(ident='second'),constantId=4)]}
        with c.type_context(g):
            self.assertTrue(c.valid_port_type('vec3[sg_len_count]'))
            self.assertIsNone(c.conversion_kind('vec3[sg_len_count]','vec3[sg_len_second]'))
            self.assertIsNone(c.conversion_kind('vec3[sg_len_count]','vec3[4]'))
            self.assertFalse(c.valid_port_type('vec3[sg_len_missing]'))
            self.assertFalse(c.valid_port_type('float[2][sg_len_count]'))
            self.assertTrue(c.valid_port_type('float[sg_len_count][2]'))
        self.assertFalse(c.valid_port_type('vec3[sg_len_count]'))

    def test_runtime_uniform_cannot_be_declaration_length(self):
        with c.type_context({'declarations':[length_decl('uniform')]}):
            self.assertFalse(c.valid_port_type('float[sg_len_count]'))

    def test_native_shape_keeps_symbol_and_never_invents_component_count(self):
        self.assertEqual(sources.array_shape('vec3[sg_len_count]'),('vec3','sg_len_count'))
        self.assertEqual(sources.source_components({'type':'vec3[sg_len_count]'}),0)
        self.assertIsNone(sources.array_shape('vec3[UNTRUSTED]'))
        sources.validate_uniform_native({'type':'vec3[sg_len_count]'},None)

    def test_native_carrier_rejects_unverified_specialization_without_substituting_default(self):
        decl=dict(type='float[sg_len_count]')
        self.assertEqual(sources.native_array_length(decl,{'count':length_decl('constant')}),4)
        with self.assertRaisesRegex(RuntimeError,'specialization-sized'):
            sources.native_array_length(decl,{'count':length_decl()})
        with self.assertRaisesRegex(RuntimeError,'missing'):
            sources.native_array_length(decl,{})
        with self.assertRaisesRegex(RuntimeError,'positive'):
            sources.native_array_length(decl,{'count':dict(length_decl('constant'),value=0)})

    def test_native_carrier_rejects_unimplemented_host_macro_binding_clearly(self):
        g=graph([c.node('uniform','a',declarationId='values'),c.node('array_get','get')],[c.edge('a','get','Array')])
        g['declarations']=[dict(id='values',kind='uniform',name='weights',type='float[TD_NUM_2D_INPUTS]',nativeSequence='array',value=None)]
        with self.assertRaisesRegex(c.GraphError,'Native CHOP Uniform Array length'):c.compile_graph(g)

    def test_length_dependencies_count_as_references_and_missing_sources_stay_visible(self):
        g=graph([c.node('array','a',length='sg_len_count'),c.node('array_get','get')],[c.edge('a','get','Array')])
        g['declarations']=[dict(length_decl(),sourceMissing=True)]
        self.assertEqual([n['id'] for n in sources.source_references(g,'count')],['a'])
        self.assertTrue(c.compile_graph(g)['bindings'][0]['sourceMissing'])
        # Host deployment already rejects any used sourceMissing binding.

    def test_malformed_length_is_a_graph_error(self):
        for length in ({},[],True,None):
            g=graph([c.node('array','a',length=length),c.node('array_get','get')],[c.edge('a','get','Array')])
            with self.subTest(length=length),self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_symbolic_array_crosses_subgraph_and_glsl_code_boundaries(self):
        ty='float[sg_len_count]'
        code=c.node('glsl_code','code',functionName='passArray',inputs=[dict(id='data',name='data',type=ty)],outputs=[dict(id='out',name='result',type=ty)],code='for (int i=0; i<data.length(); ++i) result[i]=data[i];')
        call=dict(id='call',definitionUuid=c.CALL,params={'functionId':'pass'})
        g=graph([c.node('array','a',length='sg_len_count'),call,code,c.node('array_get','get')],
                [c.edge('a','call','array'),c.edge('call','code','data','array'),c.edge('code','get','Array')])
        g['declarations']=[length_decl()]
        g['functions']=[dict(id='pass',name='Pass',scope='local',stages=['pixel','vertex'],inputs=[dict(id='array',name='array',type=ty)],outputs=[dict(id='array',name='array',type=ty)],graph=dict(nodes=[dict(id='in',definitionUuid=c.FUNCTION_INPUT,params={}),dict(id='out',definitionUuid=c.FUNCTION_OUTPUT,params={})],edges=[c.edge('in','out','array','array')]))]
        text=c.compile_graph(g)['pixel']
        self.assertIn('data[arrayCount]',text)
        self.assertIn('result[arrayCount]',text)
        self.assertNotIn('sg_len_count',text)
        self.assertLess(text.index('const int arrayCount'),text.index('data[arrayCount]'))


if __name__=='__main__':unittest.main()
