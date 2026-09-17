"""Canvas comments persist as ordinary graph nodes without shader semantics."""
import copy
import json
import unittest

import sgrape_core as c
import sgrape_document
import sgrape_library


def comment(ident='note'):
    n=c.node('comment',ident,200,300)
    n['ui'].update(comment='Design note\n<img src=x onerror=alert(1)>\n#error is plain text',width=320,height=260)
    n['name']='Design_note'
    return n


class CommentNodes(unittest.TestCase):
    def test_catalog_addition_does_not_upgrade_existing_graphs(self):
        snapshot=sgrape_document.catalog_snapshot(c)
        del snapshot['definitions']['sgrape.builtin.comment']
        old_contract=c.catalog_contract();old_contract.pop('hash')
        old_contract['definitions']=[d for d in old_contract['definitions'] if d['definitionUuid']!='sgrape.builtin.comment']
        snapshot['catalogHash']=c.digest(old_contract)
        snapshot['hash']=c.digest({key:value for key,value in snapshot.items() if key!='hash'})
        for target in ('mat','top'):
            g=c.demo_graph('color',target=target)
            if target=='top':g=c.normalize_top_sources(g)[0]
            g['catalogSnapshot']=copy.deepcopy(snapshot);original=copy.deepcopy(g)
            report=sgrape_document.inspect_upgrade(g,c,target)
            self.assertFalse(report['required']);self.assertFalse(report['blocked']);self.assertEqual(report['changes'],[])
            self.assertEqual(g,original)
            # GET /api/state returns this proven candidate without rewriting the
            # saved DAT, so a newly inserted Comment already has current evidence.
            candidate=report['candidate'];candidate['stages']['pixel']['nodes'].append(comment())
            self.assertFalse(sgrape_document.inspect_upgrade(candidate,c,target)['required'])
            # An import claiming an old baseline for a new definition still
            # requires review; the feature does not weaken version evidence.
            g['stages']['pixel']['nodes'].append(comment())
            self.assertTrue(sgrape_document.inspect_upgrade(g,c,target)['required'])

    def test_catalog_and_ports(self):
        n=comment();d=c.CATALOG['comment']
        self.assertEqual(c.resolved_ports(d,n['params']),{'inputs':{},'outputs':{}})
        self.assertEqual(c.inspect_definition_reference(n)['status'],'exact')
        self.assertEqual(c.type_contract()['definitions'][d['definitionUuid']]['variants'],[{'type':None,'inputs':{},'outputs':{}}])

    def test_comment_add_edit_remove_preserves_complete_compiled_result(self):
        for target in ('mat','top'):
            g=c.demo_graph('color',target=target);before=c.compile_graph(g)
            n=comment();g['stages']['pixel']['nodes'].append(n)
            result=c.compile_graph(g)
            for key in ('vertex','pixel','hash','sourceMap','bindings','diagnostics'):self.assertEqual(result[key],before[key])
            n['ui'].update(comment='New text',collapsed=True,width=460,height=390,x=-50)
            n['name']='Renamed_note'
            result=c.compile_graph(g)
            for key in ('vertex','pixel','hash','sourceMap','bindings','diagnostics'):self.assertEqual(result[key],before[key])

    def test_nested_and_unused_functions_persist_without_emission(self):
        g=c.demo_graph('color');g['functions']=c.function_library()
        inner=g['functions'][0]
        outer=copy.deepcopy(inner);outer.update(id='outer',name='Outer',scope='local');outer.pop('source',None)
        outer['graph']['nodes'][1]={'id':'multiply','definitionUuid':c.CALL,'params':{'functionId':inner['id']},'ui':{'x':200,'y':100}}
        outer['graph']['edges']=[c.edge('input','multiply','color','color'),c.edge('input','multiply','tint','tint'),c.edge('multiply','output','color','color')]
        g['functions'].append(outer)
        g['stages']['pixel']={'nodes':[{'id':'call','definitionUuid':c.CALL,'params':{'functionId':'outer'},'ui':{'x':100,'y':100}},c.node('pixel_out','pixel')],'edges':[c.edge('call','pixel','color','color')]}
        before=c.compile_graph(g)
        for i,f in enumerate(g['functions']):f['graph']['nodes'].append(comment('note'+str(i)))
        original=copy.deepcopy(g)
        result=c.compile_graph(g)
        for key in ('vertex','pixel','hash','sourceMap','bindings','diagnostics'):self.assertEqual(result[key],before[key])
        self.assertEqual(g,original)
        roundtrip=json.loads(json.dumps(g))
        report=sgrape_document.inspect_document(roundtrip,c,'mat')
        self.assertEqual(report['status'],'valid')
        self.assertEqual(report['candidate'],g)
        packet=sgrape_library.build(c,g,'outer')
        imported=sgrape_library.entry(c,json.loads(json.dumps(packet)))
        notes=[node for fn in [imported,*imported['dependencies']] for node in fn['graph']['nodes'] if node['definitionUuid']=='sgrape.builtin.comment']
        self.assertEqual(len(notes),2)
        self.assertTrue(all(node['ui']['comment']==comment()['ui']['comment'] and node['ui']['width']==320 and node['ui']['height']==260 for node in notes))

    def test_invalid_comment_and_fabricated_connections_are_rejected(self):
        for text in (42,None,'x'*2001,'invalid\x00text'):
            g=c.demo_graph('color');n=comment();n['ui']['comment']=text;g['stages']['pixel']['nodes'].append(n)
            with self.assertRaisesRegex(c.GraphError,'Comment must be plain text'):c.compile_graph(g)
        for reverse in (False,True):
            g=c.demo_graph('color');g['stages']['pixel']['nodes'].append(comment())
            g['stages']['pixel']['edges'].append(c.edge('note','pixel','color') if not reverse else c.edge('color','note','value'))
            with self.assertRaisesRegex(c.GraphError,'Connection endpoint'):c.compile_graph(g)


if __name__=='__main__':unittest.main(verbosity=2)
