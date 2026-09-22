import copy,unittest
import sgrape_core as c
from texture_attribute_fixture import texture_graph

class TextureAttribute(unittest.TestCase):
    def test_named_source_layer_instance_and_stage_transport(self):
        for name in ('Tex','AlternateUV'):
            g=texture_graph(c,name,1);before=copy.deepcopy(g);result=c.compile_graph(g)
            self.assertIn('TDTexAttrib_'+name+'(1u)',result['vertex'])
            self.assertIn('TDInstanceTexCoord(sg_n_tex)',result['vertex'])
            self.assertNotIn('TDTexAttrib_',result['pixel']);self.assertEqual(before,g)
            self.assertNotIn('tex_attribute',c.CONSTANT_EXPRESSIONS)
    def test_invalid_declaration_and_stage_rejected(self):
        for update in ({'type':'vec2'},{'type':'vec4'},{'arraySize':2},{'kind':'uniform','value':[0,0,0]}):
            g=texture_graph(c);g['declarations'][0].update(update)
            with self.assertRaises(c.GraphError):c.compile_graph(g)
        g=texture_graph(c);g['stages']['pixel']['nodes'].append(c.node('tex_attribute','bad',declarationId='tex'))
        with self.assertRaises(c.GraphError):c.compile_graph(g)
    def test_missing_declaration_rejected(self):
        g=texture_graph(c);g['declarations']=[]
        with self.assertRaises(c.GraphError):c.compile_graph(g)
