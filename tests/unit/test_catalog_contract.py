"""Version provenance, shipped-data validation and unchanged graph behavior."""
import copy
import json
from pathlib import Path
import unittest
import sgrape_core as c

SOURCE=Path(__file__).resolve().parents[2]/'src'
DOCUMENT=json.loads((SOURCE/'library/node_catalog.json').read_text(encoding='utf-8'))

class CatalogTests(unittest.TestCase):
    def test_contract_is_deterministic_and_detached(self):
        a=c.catalog_contract();b=c.catalog_contract()
        self.assertEqual(a,b)
        before=copy.deepcopy(a);fingerprint=a.pop('hash')
        self.assertEqual(c.digest(a),fingerprint)
        b['definitions'][0]['emitter']['version']=99;b['history'].clear()
        self.assertEqual(c.catalog_contract(),before)
        self.assertEqual(len(a['definitions']),len(c.CATALOG))
        self.assertEqual(len(a['history']),18)

    def test_known_history_keeps_original_reference_and_compiled_result(self):
        graph=c.demo_graph('tint');normal=c.compile_graph(graph)
        historical={row['definition']['definitionUuid']:row['definition']['revisionHash'] for row in DOCUMENT['history']}
        for data in graph['stages'].values():
            for n in data['nodes']:n['revisionHash']=historical[n['definitionUuid']]
        before=copy.deepcopy(graph)
        review=c.inspect_graph_definitions(graph)
        self.assertFalse(review['hasUnresolved'])
        self.assertTrue(all(row['status']=='compatible_history' for row in review['entries']))
        self.assertEqual(c.compile_graph(graph),normal)
        self.assertEqual(graph,before)

    def test_provenance_includes_unused_functions_and_duplicate_local_ids(self):
        g=c.demo_graph('color');fn=c.function_library()[0];g['functions']=[fn]
        fn['graph']['nodes'][1]['revisionHash']='not-a-shipped-revision'
        before=copy.deepcopy(g);report=c.inspect_graph_definitions(g)
        self.assertTrue(report['hasUnresolved'])
        unknown=[r for r in report['entries'] if r['status']=='unresolved_revision']
        self.assertEqual([(r['node'],r['functionId']) for r in unknown],[('multiply',fn['id'])])
        self.assertEqual(g,before)

    def test_unknown_revision_never_uses_graph_archive_as_authority(self):
        g=c.demo_graph('color');node=g['stages']['pixel']['nodes'][0]
        node['revisionHash']='foreign';g['archive']={'foreign':{'emit':'#error not executable'}}
        before=copy.deepcopy(g);report=c.inspect_graph_definitions(g)
        self.assertTrue(report['hasUnresolved'])
        self.assertEqual(next(r for r in report['entries'] if r['node']=='color')['status'],'unresolved_revision')
        self.assertEqual(g,before)
        # Audit is not a deployment policy. The existing compiler behavior is
        # intentionally unchanged until the user chooses the upgrade policy.
        self.assertNotIn('#error',c.compile_graph(g)['pixel'])

    def test_missing_and_malformed_revisions_remain_distinct(self):
        node=c.node('float','f');del node['revisionHash']
        self.assertEqual(c.inspect_definition_reference(node)['status'],'unversioned')
        for value in (None,[],{},'',False,'unknown'):
            node['revisionHash']=value
            self.assertEqual(c.inspect_definition_reference(node)['status'],'unresolved_revision')
        node['definitionUuid']='missing.node'
        self.assertEqual(c.inspect_definition_reference(node)['status'],'unresolved_definition')
        node['definitionUuid']='sgrape.internal.relay'
        self.assertEqual(c.inspect_definition_reference(node)['status'],'unresolved_definition')

    def test_import_review_exposes_provenance_without_selecting_upgrade(self):
        import sgrape_document
        graph=c.demo_graph('color');graph['stages']['pixel']['nodes'][0]['revisionHash']='unrecognized'
        report=sgrape_document.inspect_document(graph,c,'mat')
        self.assertEqual(report['status'],'valid')
        self.assertTrue(report['definitionReview']['hasUnresolved'])
        self.assertEqual(report['candidate'],graph)

    def test_catalog_rejects_unsupported_emitters_versions_and_duplicates(self):
        cases=[]
        for key,value in (('schemaVersion',2),('emitterAbiVersion',2),('targetShellVersion',3),('catalogVersion','latest')):
            d=copy.deepcopy(DOCUMENT);d[key]=value;cases.append(d)
        d=copy.deepcopy(DOCUMENT);d['definitions'][0]['emitter']['id']='execute';cases.append(d)
        d=copy.deepcopy(DOCUMENT);d['definitions'][0]['emitter']['version']=2;cases.append(d)
        d=copy.deepcopy(DOCUMENT);d['definitions'].append(copy.deepcopy(d['definitions'][0]));cases.append(d)
        d=copy.deepcopy(DOCUMENT);d['definitions'][0]['definition']['defaults']['value']=42;cases.append(d)
        for d in cases:
            before=copy.deepcopy(d)
            with self.assertRaises(c.GraphError):c.validate_catalog(d)
            self.assertEqual(d,before)

    def test_changed_historical_semantics_cannot_alias_current_emitter(self):
        d=copy.deepcopy(DOCUMENT);old=d['history'][0]['definition'];old['defaults']['value']=17
        old['revisionHash']=c.digest({k:v for k,v in old.items() if k!='revisionHash'})
        with self.assertRaisesRegex(c.GraphError,'Historical behavior'):c.validate_catalog(d)

    def test_reordered_catalog_preserves_content_contract(self):
        d=copy.deepcopy(DOCUMENT);d['definitions'].reverse();d['history'].reverse()
        validated=c.validate_catalog(d)
        self.assertEqual({r['definition']['definitionUuid']:r for r in validated['definitions']},
                         {r['definition']['definitionUuid']:r for r in DOCUMENT['definitions']})

    def test_core_loads_from_embedded_dat_without_disk_dependency(self):
        class Dat:
            text=json.dumps(DOCUMENT)
        class Parent:
            def op(self,name):
                if name=='node_catalog':return Dat()
                if name=='sgrape_composites':
                    class Module:
                        module=c._composites
                    return Module()
                if name=='sgrape_source_catalog':
                    class Module:
                        module=c._source_catalog
                    return Module()
                if name=='sgrape_legacy_nodes':
                    class Module:
                        module=c._legacy_nodes
                    return Module()
                return None
        class Me:
            def parent(self):return Parent()
        ns={'me':Me(),'__file__':'nonexistent/core'}
        exec(compile((SOURCE/'core/sgrape_core.py').read_text(encoding='utf-8'),'embedded-core','exec'),ns)
        self.assertEqual(ns['catalog_contract'](),c.catalog_contract())
        self.assertEqual(ns['compile_graph'](c.demo_graph()),c.compile_graph(c.demo_graph()))

if __name__=='__main__':unittest.main(verbosity=2)
