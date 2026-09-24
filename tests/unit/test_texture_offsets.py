import copy,unittest
import sgrape_core as c
from texture_offset_fixture import KEYS,sampling_graph

class TextureOffsets(unittest.TestCase):
    def test_five_functions_in_top_and_mat_pixel(self):
        for key in KEYS:
            for target,stage in [('top','pixel'),('mat','pixel')]:
                with self.subTest(key=key,target=target,stage=stage):
                    g=sampling_graph(c,key,target,stage);before=copy.deepcopy(g)
                    compiled=c.compile_graph(g)
                    self.assertIn(c._legacy_nodes.CALLS[key]['function']+'(',compiled[stage])
                    self.assertEqual(g,before)

    def test_constant_array_and_computed_component_emit_const(self):
        g=sampling_graph(c,'texture_gather_offsets_2d');p=g['stages']['pixel']
        p['nodes']=[n for n in p['nodes'] if n['id']!='offsets']+[c.node('array','offsets',elementType='ivec2',length=4),c.node('add','comp',type='int')]
        p['edges'].append(c.edge('comp','sample','component'))
        code=c.compile_graph(g)['pixel']
        self.assertRegex(code,r'const ivec2 [^;]+\[4\] =')
        self.assertRegex(code,r'const int [^;]+ =')

    def test_dynamic_gather_offset_allowed(self):
        g=sampling_graph(c,'texture_gather_offset_2d');p=g['stages']['pixel']
        g['declarations'].append(dict(id='move',kind='uniform',name='uOffset',type='ivec2',value=[1,-1]))
        p['nodes'].append(c.node('uniform','move',declarationId='move'));p['edges'].append(c.edge('move','sample','offset'))
        self.assertIn('textureGatherOffset(',c.compile_graph(g)['pixel'])

    def test_runtime_and_specialization_constant_operands_rejected(self):
        for key,port,ty,value in [('texture_proj_offset_2d','offset','ivec2',[0,0]),('texture_gather_offsets_2d','offsets','ivec2[4]',[[0,0]]*4),('texture_gather_offset_2d','component','int',1)]:
            g=sampling_graph(c,key);p=g['stages']['pixel'];p['edges']=[e for e in p['edges'] if e['to']!=['sample',port]]
            g['declarations'].append(dict(id='bad',kind='uniform',name='uBad',type='ivec2' if '[' in ty else ty,value=[0,0] if '[' in ty else value))
            p['nodes'].append(c.node('uniform','bad',declarationId='bad'))
            if '[' in ty:
                p['nodes'].append(c.node('array_replace','runtimeArray',type='ivec2[4]'))
                p['edges'] += [c.edge('offsets','runtimeArray','Array'),c.edge('bad','runtimeArray','replacement'),c.edge('runtimeArray','sample',port)]
            else:p['edges'].append(c.edge('bad','sample',port))
            with self.subTest(key=key),self.assertRaisesRegex(c.GraphError,'constant '+port):c.compile_graph(g)
        g=sampling_graph(c,'texture_gather_offset_2d');p=g['stages']['pixel']
        g['declarations'].append(dict(id='special',kind='spec_constant',name='componentId',type='int',value=1,constantId=1))
        p['nodes'].append(c.node('spec_constant','special',declarationId='special'));p['edges'].append(c.edge('special','sample','component'))
        with self.assertRaisesRegex(c.GraphError,'constant component'):c.compile_graph(g)

    def test_exact_array_length_and_element_type(self):
        for ty,value in [('ivec2[3]',[[0,0]]*3),('ivec3[4]',[[0,0,0]]*4)]:
            g=sampling_graph(c,'texture_gather_offsets_2d');d=g['declarations'][1];d.update(type=ty,value=value)
            with self.subTest(ty=ty),self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_resource_required_and_no_cube_gather_offset(self):
        g=sampling_graph(c,'texture_proj_offset_2d');g['stages']['pixel']['edges'].pop(0)
        with self.assertRaises(c.GraphError):c.compile_graph(g)
        self.assertNotIn('texture_gather_offset_cube',c.CATALOG)
        self.assertNotIn('texture_gather_offsets_cube',c.CATALOG)
        variants=c.type_contract()['definitions'][c.CATALOG['texture_gather_offsets_2d']['definitionUuid']]['variants']
        self.assertEqual(variants[0]['inputs']['offsets'],'ivec2[4]')

if __name__=='__main__':unittest.main()
