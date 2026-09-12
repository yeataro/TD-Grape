import copy,unittest
import sgrape_core as c

class SamplerExpose(unittest.TestCase):
    def test_exposed_defaults_change_binding_not_shader_code(self):
        for kind in ('mat','top'):
            g=c.demo_graph(target=kind);old=c.compile_graph(g)
            g['declarations'][0].update(expose=True,exposeName='Image')
            if kind=='top':g['declarations'][0]['defaultSource']='builtin:jellybeans'
            before=copy.deepcopy(g);new=c.compile_graph(g)
            self.assertEqual(g,before)
            self.assertEqual((new['vertex'],new['pixel']),(old['vertex'],old['pixel']))
            self.assertNotEqual(old['hash'],new['hash'])
            self.assertTrue(new['bindings'][0]['expose'])

    def test_invalid_texture_settings_rejected(self):
        for fields in ({'expose':'true'},{'exposeName':'bad\nlabel'},{'exposeName':None},
                       {'defaultSource':'input:0'},{'defaultSource':'op:'},{'source':'op:/'},
                       {'source':'op:/bad\npath'},{'source':'/project1/top'},
                       {'source':'op:/'+'x'*2048}):
            g=c.demo_graph(target='top');g['declarations'][0].update(fields)
            with self.subTest(fields=fields),self.assertRaises(c.GraphError):c.compile_graph(g)
        g=c.demo_graph();g['declarations'][0]['defaultSource']='builtin:white'
        with self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_shared_input_settings_must_agree(self):
        g=c.demo_graph(target='top')
        g['declarations'].append(dict(g['declarations'][0],id='texture_copy',name='uCopy'))
        c.compile_graph(g) # Legacy declarations with the same native input stay valid.
        g['declarations'][0].update(expose=True,defaultSource='builtin:white',exposeName='Source')
        with self.assertRaises(c.GraphError):c.compile_graph(g)
        g['declarations'][1].update(expose=True,defaultSource='builtin:white',exposeName='Source')
        c.compile_graph(g)
        g['declarations'][1]['exposeName']='Other'
        with self.assertRaises(c.GraphError):c.compile_graph(g)

if __name__=='__main__':unittest.main()
