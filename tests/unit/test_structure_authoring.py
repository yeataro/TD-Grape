import copy,unittest
import sgrape_core as c
import sgrape_document as document
from test_array_structures import graph,SAMPLE

class StructureAuthoring(unittest.TestCase):
    def test_complete_and_field_outputs_share_one_constructed_value(self):
        make=c.node('struct_create','make',type='struct:sample');make['inputValues']={'f_offset':[1,2],'f_weight':.375}
        g=graph([make,c.node('array_create','array',elementType='struct:sample',length=3),c.node('array_get','get'),c.node('struct_field','field',type='struct:sample',field='weight')],
            [c.edge('make','array','value'),c.edge('array','get','Array'),c.edge('get','field','value')],result='field',definitions=[SAMPLE])
        result=c.compile_graph(g)
        self.assertEqual(result['stages']['pixel']['ports']['make']['out'],{'out':'struct:sample','f_offset':'vec2','f_weight':'float'})
        self.assertEqual(result['stages']['pixel']['ports']['get']['out']['out'],'struct:sample')
        self.assertIn('sg_type_sample(vec2(1.0, 2.0), 0.375)',result['pixel'])
        direct=graph([make],result='make',definitions=[SAMPLE]);direct['stages']['pixel']['edges'][0]['from'][1]='f_weight'
        self.assertIn('sg_n_make.weight',c.compile_graph(direct)['pixel'])
        for source in (g,direct):
            inspected=document.inspect_document(source,c,'top')
            self.assertEqual(inspected['status'],'valid',inspected)
            self.assertEqual(inspected['candidate']['stages'],source['stages'])

    def test_nested_definition_and_notes_do_not_change_semantics(self):
        parent={'id':'parent','name':'Parent','fields':[{'id':'child','name':'child','type':'struct:sample'}]}
        g=graph([c.node('struct_create','get',type='struct:parent')],ty='struct:parent',definitions=[SAMPLE,parent])
        result=c.compile_graph(g)
        self.assertLess(result['pixel'].index('struct sg_type_sample'),result['pixel'].index('struct sg_type_parent'))
        notes=copy.deepcopy(g);notes['typeDefinitions'][0].update(name='Sample renamed',description='Notes only')
        self.assertEqual(c.clean_semantic(g),c.clean_semantic(notes))
        self.assertEqual(result['pixel'],c.compile_graph(notes)['pixel'])
        parent['fields'][0]['type']='struct:parent'
        with self.assertRaisesRegex(c.GraphError,'Recursive'):c.type_contract({'typeDefinitions':[parent]})

    def test_builtin_struct_exposes_existing_fields_without_copy(self):
        source=c.node('builtin_source','get',source='uTDOutputInfo');g=graph([source],ty='vec4')
        g['stages']['pixel']['edges'][0]['from'][1]='f_res'
        result=c.compile_graph(g)['pixel'];self.assertIn('(uTDOutputInfo).res',result);self.assertNotIn('struct TDTexInfo',result)
        self.assertEqual(document.inspect_document(g,c,'top')['status'],'valid')

    def test_field_identity_survives_name_change_and_removed_port_fails(self):
        d=copy.deepcopy(SAMPLE);node=c.node('struct_create','get',type='struct:sample');g=graph([node],definitions=[d]);g['stages']['pixel']['edges'][0]['from'][1]='f_weight'
        d['fields'][1]['name']='mass';g['typeDefinitions']=[d];self.assertIn('sg_n_get.mass',c.compile_graph(g)['pixel'])
        d['fields'].pop()
        with self.assertRaises(c.GraphError):c.compile_graph(g)

if __name__=='__main__':unittest.main()
