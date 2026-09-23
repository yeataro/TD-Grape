import copy,unittest
import sgrape_core as c
import sgrape_document as document

class PickingShell(unittest.TestCase):
    def test_upgrade_is_explicit_and_preserves_graph(self):
        graph=document.stamp_catalog(c.demo_graph('color'),c)
        graph['catalogSnapshot']['targetShellVersion']=2
        snapshot=graph['catalogSnapshot'];snapshot['hash']=c.digest({k:v for k,v in snapshot.items() if k!='hash'})
        original=copy.deepcopy(graph)
        report=document.inspect_upgrade(graph,c,'mat')
        self.assertTrue(report['required'])
        self.assertFalse(report['blocked'])
        self.assertIn({'code':'targetShellVersion','old':2,'new':3},report['changes'])
        self.assertEqual(graph,original)
        self.assertEqual(report['candidate']['stages'],graph['stages'])

    def test_only_mat_vertex_adds_picking_and_node_locations_stay_valid(self):
        for target in ('mat','top'):
            graph=c.demo_graph('color',target)
            compiled=c.compile_graph(graph)
            self.assertNotIn('TD_PICKING_ACTIVE',compiled['pixel'])
            if target=='top':self.assertEqual(compiled['vertex'],'');continue
            lines=compiled['vertex'].splitlines()
            picking=lines.index('#ifdef TD_PICKING_ACTIVE')
            self.assertGreater(picking,next(i for i,line in enumerate(lines) if 'gl_Position =' in line))
            for row in compiled['sourceMap']['vertex']:
                self.assertLess(row['line'],picking+1)
                self.assertTrue(lines[row['line']-1].strip())

if __name__=='__main__':unittest.main()
