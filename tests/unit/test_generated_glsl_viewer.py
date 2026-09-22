import copy
import unittest
import sgrape_core as c
import sgrape_document as document

class GeneratedGLSLViewer(unittest.TestCase):
    def test_viewer_is_persistent_but_not_shader_content(self):
        for target in ('mat','top'):
            graph=c.demo_graph('color',target=target);before=c.compile_graph(graph)
            for stage in graph['stages']:
                viewer=c.node('generated_glsl','viewer_'+stage)
                viewer['ui'].update(width=480,height=300,noteColor='#8899aa',noteFontScale=1.5)
                graph['stages'][stage]['nodes'].append(viewer)
            graph=document.stamp_catalog(graph,c)
            checked=document.inspect_document(copy.deepcopy(graph),c,target)
            self.assertEqual(checked['status'],'valid')
            after=c.compile_graph(graph)
            for field in ('vertex','pixel','hash','sourceMap','bindings','diagnostics'):
                self.assertEqual(before[field],after[field],field)
            self.assertEqual(c.resolved_ports(c.CATALOG['generated_glsl'],{}),{'inputs':{},'outputs':{}})

    def test_duplicate_import_is_rejected(self):
        graph=c.demo_graph('color')
        graph['stages']['pixel']['nodes'] += [c.node('generated_glsl','viewer_a'),c.node('generated_glsl','viewer_b')]
        with self.assertRaisesRegex(c.GraphError,'one Generated GLSL'):c.compile_graph(graph)
        self.assertNotEqual(document.inspect_document(graph,c,'top')['status'],'valid')

    def test_one_viewer_per_function_not_per_call(self):
        graph=c.demo_graph('color');graph['functions']=c.function_library()
        for ident in ('first_call','second_call'):
            graph['stages']['pixel']['nodes'].append({'id':ident,'definitionUuid':c.CALL,'params':{'functionId':graph['functions'][0]['id']}})
        before=c.compile_graph(graph)
        for i,fn in enumerate(graph['functions']):fn['graph']['nodes'].append(c.node('generated_glsl','viewer'+str(i)))
        result=c.compile_graph(graph)
        for field in ('vertex','pixel','hash','sourceMap','bindings','diagnostics'):self.assertEqual(before[field],result[field],field)
        graph['functions'][0]['graph']['nodes'].append(c.node('generated_glsl','duplicate'))
        with self.assertRaisesRegex(c.GraphError,'one Generated GLSL'):c.compile_graph(graph)

    def test_catalog_addition_preserves_old_graph_upgrade_status(self):
        graph=c.normalize_top_sources(c.demo_graph('color',target='top'))[0];snapshot=document.catalog_snapshot(c)
        del snapshot['definitions']['sgrape.builtin.generated_glsl']
        contract=c.catalog_contract();contract.pop('hash');contract['definitions']=[d for d in contract['definitions'] if d['definitionUuid']!='sgrape.builtin.generated_glsl']
        snapshot['catalogHash']=c.digest(contract);snapshot['hash']=c.digest({k:v for k,v in snapshot.items() if k!='hash'})
        graph['catalogSnapshot']=snapshot
        report=document.inspect_upgrade(graph,c,'top');self.assertFalse(report['required']);self.assertFalse(report['blocked'])

if __name__=='__main__':unittest.main()
