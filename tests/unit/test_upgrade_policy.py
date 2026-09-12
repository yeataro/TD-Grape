"""Version review must preserve evidence and bind consent to one candidate."""
import copy
import json
import unittest
from unittest.mock import patch
import sgrape_core as c
import sgrape_document as d
import sgrape_runtime as r


class UpgradePolicyTests(unittest.TestCase):
    def graph(self):
        return d.stamp_catalog(c.demo_graph('color'), c)

    def test_snapshot_detached_and_metadata_not_semantic(self):
        graph=c.demo_graph('color');before=copy.deepcopy(graph)
        stamped=d.stamp_catalog(graph,c)
        self.assertEqual(c.compile_graph(stamped),c.compile_graph(graph))
        stamped['catalogSnapshot']['definitions'].clear()
        self.assertTrue(d.catalog_snapshot(c)['definitions'])
        self.assertEqual(graph,before)

    def test_exact_and_proven_legacy_baselines_need_no_acceptance(self):
        for kind in ('mat','top'):
            graph=c.demo_graph('color',target=kind)
            report=d.inspect_upgrade(graph,c,kind,baseline={'catalogHash':c.catalog_contract()['hash']})
            self.assertFalse(report['required']);self.assertFalse(report['blocked'])
            self.assertIn('catalogSnapshot',report['candidate'])

    def test_missing_or_damaged_baseline_requires_explicit_review(self):
        for baseline in (None,{}, {'catalogHash':'old'}, {'schemaVersion':1,'hash':'forged'}):
            report=d.inspect_upgrade(c.demo_graph('color'),c,'mat',baseline=baseline)
            self.assertTrue(report['required']);self.assertFalse(report['blocked'])
            self.assertEqual(report['changes'][0]['code'],'unknownBaseline')

    def test_known_presentation_history_is_compatible(self):
        graph=self.graph()
        for data in graph['stages'].values():
            for node in data['nodes']:
                history=next((rev for uid,rev in c._HISTORY if uid==node['definitionUuid']),None)
                if history:node['revisionHash']=history
        before=copy.deepcopy(graph)
        report=d.inspect_upgrade(graph,c,'mat')
        self.assertFalse(report['required']);self.assertFalse(report['blocked'])
        self.assertEqual(graph,before)

    def test_unknown_revision_is_listed_without_mutating_original(self):
        graph=self.graph();graph['stages']['pixel']['nodes'][0]['revisionHash']='unknown'
        before=copy.deepcopy(graph);report=d.inspect_upgrade(graph,c,'mat')
        self.assertTrue(report['required']);self.assertFalse(report['blocked'])
        self.assertEqual(report['changes'][0]['reasons'],['unknownRevision'])
        self.assertNotEqual(report['candidate']['stages']['pixel']['nodes'][0]['revisionHash'],'unknown')
        self.assertEqual(graph,before)

    def test_changed_emitter_even_with_same_revision_requires_review(self):
        graph=self.graph();snapshot=graph['catalogSnapshot'];uid=graph['stages']['pixel']['nodes'][0]['definitionUuid']
        snapshot['definitions'][uid]['emitter']['version']=999
        snapshot['hash']=c.digest({k:v for k,v in snapshot.items() if k!='hash'})
        report=d.inspect_upgrade(graph,c,'mat')
        self.assertEqual(report['changes'][0]['code'],'node')
        self.assertIn('behavior',report['changes'][0]['reasons'])
        self.assertFalse(report['blocked'])

    def test_unused_definition_change_does_not_force_upgrade(self):
        graph=self.graph();snapshot=graph['catalogSnapshot']
        snapshot['definitions']['sgrape.builtin.sin']['emitter']['version']=7
        snapshot['hash']=c.digest({k:v for k,v in snapshot.items() if k!='hash'})
        self.assertFalse(d.inspect_upgrade(graph,c,'mat')['required'])

    def test_shell_change_is_explicit(self):
        graph=self.graph();snapshot=graph['catalogSnapshot'];snapshot['targetShellVersion']=8
        snapshot['hash']=c.digest({k:v for k,v in snapshot.items() if k!='hash'})
        report=d.inspect_upgrade(graph,c,'mat')
        self.assertEqual(report['changes'][0],{'code':'targetShellVersion','old':8,'new':c.catalog_contract()['targetShellVersion']})

    def test_missing_definition_and_changed_port_do_not_drop_evidence(self):
        for missing in (True,False):
            graph=self.graph();n=graph['stages']['pixel']['nodes'][0]
            if missing:n['definitionUuid']='missing.definition'
            else:
                n['revisionHash']='old-interface'
                graph['stages']['pixel']['edges'][0]['from'][1]='old-port'
            before=copy.deepcopy(graph);report=d.inspect_upgrade(graph,c,'mat')
            self.assertTrue(report['blocked']);self.assertIsNone(report['candidate'])
            self.assertEqual(graph,before)

    def test_source_and_readonly_callers_localize_without_upstream_mutation(self):
        graph=self.graph();source=copy.deepcopy(c.function_library()[0]);source['graph']['nodes'][1]['revisionHash']='unknown'
        caller=copy.deepcopy(source);caller['id']='outer';caller['name']='Outer';caller['graph']['nodes'][1]={'id':'nested','definitionUuid':c.CALL,'params':{'functionId':source['id']},'ui':{'x':10,'y':10}};caller['graph']['edges']=[]
        graph['functions']=[source,caller];before=copy.deepcopy(graph)
        report=d.inspect_upgrade(graph,c,'mat')
        self.assertFalse(report['blocked'],report);self.assertEqual(len(report['localizedFunctions']),2)
        self.assertTrue(all(fn['scope']=='local' for fn in report['candidate']['functions']))
        self.assertEqual(graph,before)
        self.assertEqual(report,d.inspect_upgrade(graph,c,'mat'))
        c.compile_graph(report['candidate'])

    def test_archive_is_data_and_saved_envelope_is_strict(self):
        graph=self.graph();graph['archive']={'emit':'#error forbidden'}
        report=d.inspect_upgrade(graph,c,'mat')
        self.assertNotIn('#error',c.compile_graph(report['candidate'])['pixel'])
        for raw in ('{"revision":1,"revision":2,"graph":{}}','{"revision":1,"graph":{},"x":NaN}','{"revision":-1,"graph":{}}'):
            with self.assertRaises(ValueError):d.saved_envelope(raw)

    def test_unrecognized_import_ports_are_not_proposed_as_disposable_edges(self):
        graph=self.graph();graph['stages']['pixel']['nodes'][0]['revisionHash']='unknown-old'
        graph['stages']['pixel']['edges'][0]['from'][1]='old-port'
        report=d.inspect_document(graph,c,'mat')
        self.assertEqual(report['status'],'blocked');self.assertIsNone(report['candidate'])
        self.assertFalse(any(row['code']=='edge' for row in report['repairs']))

    def test_incomplete_snapshot_does_not_prove_a_used_definition(self):
        graph=self.graph();snapshot=graph['catalogSnapshot'];snapshot['definitions'].clear()
        snapshot['hash']=c.digest({k:v for k,v in snapshot.items() if k!='hash'})
        self.assertTrue(d.inspect_upgrade(graph,c,'mat')['required'])

    def test_tickets_are_exact_single_use_and_bounded(self):
        graph=self.graph();report=d.inspect_upgrade(graph,c,'mat');report.update(revision=1,target='/test')
        binding={'opId':10,'stateHash':'a'}
        r._upgrade_tickets.clear()
        with patch.object(r,'ensure_supported_shader'),patch.object(r,'target',return_value=object()),patch.object(r,'core',return_value=c),patch.object(r,'upgrade_review',return_value=report),patch.object(r,'_upgrade_binding',side_effect=lambda:copy.deepcopy(binding)):
            tickets=[r.prepare_upgrade_review()['token'] for _ in range(10)]
            self.assertEqual(len(r._upgrade_tickets),8)
            with self.assertRaisesRegex(RuntimeError,'Conflict:'):r.accept_upgrade_ticket(tickets[0],report['candidate'])
            r.accept_upgrade_ticket(tickets[-1],report['candidate'])
            with self.assertRaisesRegex(RuntimeError,'Conflict:'):r.accept_upgrade_ticket(tickets[-1],report['candidate'])
            binding['opId']=11
            with self.assertRaisesRegex(RuntimeError,'Conflict:'):r.accept_upgrade_ticket(tickets[-2],report['candidate'])

    def test_candidate_changes_and_expiry_reject_acceptance(self):
        graph=self.graph();report=d.inspect_upgrade(graph,c,'mat');report.update(revision=1,target='/test')
        with patch.object(r,'ensure_supported_shader'),patch.object(r,'target',return_value=object()),patch.object(r,'core',return_value=c),patch.object(r,'upgrade_review',return_value=report),patch.object(r,'_upgrade_binding',return_value={'opId':10}):
            ticket=r.prepare_upgrade_review()['token'];other=copy.deepcopy(report['candidate']);other['stages']['pixel']['nodes'][0]['ui']['x']+=1
            with self.assertRaisesRegex(RuntimeError,'Conflict:'):r.accept_upgrade_ticket(ticket,other)
            ticket=r.prepare_upgrade_review()['token'];r._upgrade_tickets[ticket]['expires']=0
            with self.assertRaisesRegex(RuntimeError,'Conflict:'):r.accept_upgrade_ticket(ticket,report['candidate'])


if __name__=='__main__':unittest.main(verbosity=2)
