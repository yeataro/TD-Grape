"""PBR ambient is a connectable scalar, off by default including old graphs."""
import copy,unittest
import sgrape_core as c
import sgrape_document as document


def graph():
    g=c.demo_graph('color','mat')
    g['stages']['pixel']['nodes'].append(c.node('material_pbr','pbr'))
    g['stages']['pixel']['edges']=[c.edge('pbr','pixel','color')]
    return document.stamp_catalog(g,c)


class PBRAmbient(unittest.TestCase):
    def test_zero_default_and_scalar_contract(self):
        self.assertEqual(c.resolved_ports(c.CATALOG['material_pbr'],{})['inputs']['ambientStrength'],'float')
        self.assertEqual(c.input_default('material_pbr','ambientStrength','float'),0)
        code=c.compile_graph(graph())['pixel']
        self.assertIn('uTDGeneral.ambientColor.rgb * sg_light_pbr_base * 1.0 * 0.0;',code)
        self.assertIn('TDLightingPBR(',code);self.assertIn('TDEnvLightingPBR(',code)

    def test_value_connection_and_disconnect(self):
        g=graph();p=g['stages']['pixel'];node=next(n for n in p['nodes'] if n['id']=='pbr')
        node['inputValues']={'ambientStrength':.25}
        self.assertIn('* 1.0 * 0.25;',c.compile_graph(g)['pixel'])
        g['declarations'].append(dict(id='strength',kind='uniform',name='uAmbientStrength',type='float',value=.75))
        p['nodes'].append(c.node('uniform','strength',declarationId='strength'))
        p['edges'].append(c.edge('strength','pbr','ambientStrength'))
        code=c.compile_graph(g)['pixel'];self.assertIn('uniform float uAmbientStrength;',code)
        self.assertIn('* 1.0 * sg_n_strength;',code)
        p['edges'].pop();self.assertIn('* 1.0 * 0.25;',c.compile_graph(g)['pixel'])

    def test_old_node_upgrade_uses_zero_without_compatibility_value(self):
        g=graph();uid='sgrape.builtin.material_pbr';old='715e548b6fd7f28b304f34dcb9e5da04f4769d66e837391792c7124ce358003b'
        node=next(n for n in g['stages']['pixel']['nodes'] if n['id']=='pbr');node['revisionHash']=old
        row=g['catalogSnapshot']['definitions'][uid];row['revisionHash']=old
        row['signature']['inputs'].pop('ambientStrength');row['signature']['inputDefaults'].pop('ambientStrength')
        snapshot=g['catalogSnapshot'];snapshot['hash']=c.digest({k:v for k,v in snapshot.items() if k!='hash'})
        before=copy.deepcopy(g);review=document.inspect_upgrade(g,c,'mat')
        self.assertTrue(review['required']);self.assertFalse(review['blocked'],review)
        self.assertEqual(g,before)
        updated=next(n for n in review['candidate']['stages']['pixel']['nodes'] if n['id']=='pbr')
        self.assertNotIn('ambientStrength',updated.get('inputValues',{}))
        self.assertIn('* 1.0 * 0.0;',c.compile_graph(review['candidate'])['pixel'])
        self.assertEqual(review['candidate']['stages']['pixel']['edges'],g['stages']['pixel']['edges'])

    def test_phong_ambient_remains_one(self):
        self.assertEqual(c.input_default('material_phong','ambient','float'),1)
        self.assertNotIn('ambientStrength',c.resolved_ports(c.CATALOG['material_phong'],{})['inputs'])


if __name__=='__main__':unittest.main()
