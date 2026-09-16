import unittest
import copy
from types import SimpleNamespace
from unittest.mock import Mock, patch
import sgrape_sources as s


class SourceMatching(unittest.TestCase):
    def setUp(self):
        self.decls=[{'id':name,'kind':'uniform','name':'u'+name,'type':'float','value':0} for name in ('A','B')]
        self.registry={d['id']:{'sequence':'vec','index':i,'name':d['name']} for i,d in enumerate(self.decls)}

    def rows(self,*names):
        return [{'sequence':'vec','index':i,'name':name,'nameMode':'CONSTANT','components':[{'value':0}]*4} for i,name in enumerate(names)]

    def test_reorder(self):
        decls,registry,issues=s.reconcile(self.decls,self.registry,self.rows('uB','uA'))
        self.assertEqual(issues,[]);self.assertEqual(decls,self.decls);self.assertEqual(registry['A']['index'],1)

    def test_unique_native_rename(self):
        decls,registry,issues=s.reconcile(self.decls,self.registry,self.rows('uA','uNew'))
        self.assertEqual(issues,[]);self.assertEqual(decls[1]['id'],'B');self.assertEqual(decls[1]['name'],'uNew')

    def test_ambiguous_edits_not_guessed(self):
        decls,registry,issues=s.reconcile(self.decls,self.registry,self.rows('uX','uY'))
        self.assertTrue(decls[0]['sourceMissing']);self.assertTrue(decls[1]['sourceMissing']);self.assertEqual(len(issues),2)
        self.assertEqual(len(decls),4)

    def test_delete_then_restore_same_owner(self):
        decls,registry,issues=s.reconcile(self.decls,self.registry,self.rows('uB'))
        self.assertTrue(decls[0]['sourceMissing']);self.assertNotIn('sourceMissing',decls[1])
        recovered,_,issues=s.reconcile(decls,registry,self.rows('uA','uB'))
        self.assertEqual(issues,[]);self.assertNotIn('sourceMissing',recovered[0]);self.assertEqual(recovered[0]['id'],'A')

    def test_duplicate_native_names(self):
        decls,registry,issues=s.reconcile(self.decls,self.registry,self.rows('uA','uA'))
        self.assertTrue(all(d.get('sourceMissing') for d in decls));self.assertTrue(issues)

    def test_namespace_collision_and_invalid_name(self):
        decls=self.decls+[{'id':'tex','kind':'sampler','name':'uTexture'}]
        after,_,issues=s.reconcile(decls,self.registry,self.rows('uA','uB','uTexture','not legal','gl_Reserved'))
        self.assertEqual(after,decls);self.assertEqual(len(issues),3)

    def test_color_import_has_vec4_metadata(self):
        rows=self.rows('uColor');rows[0]['sequence']='color'
        decls,_,_=s.reconcile([],{},rows)
        self.assertEqual(decls[0]['type'],'vec4');self.assertEqual(decls[0]['value'],[0]*4)

    def test_edit_token_ignores_animated_value_but_not_identity(self):
        row=self.rows('uA')[0];before=s.edit_token(row);row['components']=[{'value':4}]*4
        self.assertEqual(before,s.edit_token(row));row['name']='uOther';self.assertNotEqual(before,s.edit_token(row))



class SourceRemoval(unittest.TestCase):
    def setUp(self):
        self.decls = [{'id': ident, 'kind': 'uniform', 'name': 'u'+ident, 'type': 'float', 'value': 0}
                      for ident in ('A', 'B')]
        self.rows = [{'sequence': 'vec', 'index': i, 'name': d['name'], 'nameMode': 'CONSTANT',
                      'components': [{'value': i+.25, 'mode': 'BIND', 'binding': 'parent().par.Keep'}] * 4}
                     for i, d in enumerate(self.decls)]
        self.storage = {s.STORE: {d['id']: {'sequence': 'vec', 'index': i, 'name': d['name']}
                                 for i, d in enumerate(self.decls)}, 'grapeSourceIssues': []}
        self.current = {'revision': 1, 'graph': {'declarations': copy.deepcopy(self.decls),
                        'stages': {'pixel': {'nodes': [], 'edges': []}}, 'functions': []},
                        'appliedHash': 'unchanged', 'sourceChanged': False}
        self.fail_write = False
        self.comp = SimpleNamespace(fetch=lambda key, default=None: self.storage.get(key, default),
                                    store=lambda key, value: self.storage.__setitem__(key, value), op=lambda name: None)
        def remove_block(index): self.rows.pop(index)
        class Sequence:
            @property
            def numBlocks(inner): return len(self.rows)
            def destroyBlock(inner, index): remove_block(index)
        self.operator = SimpleNamespace(seq=SimpleNamespace(vec=Sequence()), path='/test/shader')
        self.runtime = SimpleNamespace(target=lambda: self.comp, shader_operator=lambda comp: self.operator,
            state=lambda: copy.deepcopy(self.current), checked_state=lambda: copy.deepcopy(self.current),
            write_state=self.write_state, deploy=Mock(side_effect=AssertionError('Removal must not deploy')))
        def native_rows(operator):
            return [{**copy.deepcopy(row), 'index': i} for i, row in enumerate(self.rows) if row['name']]
        self.native_patch = patch.object(s, 'native_rows', native_rows); self.native_patch.start();self.addCleanup(self.native_patch.stop)
        class NameParameter:
            mode = 'CONSTANT'
            def __init__(inner, index): inner.index = index
            @property
            def val(inner): return self.rows[inner.index]['name']
            @val.setter
            def val(inner, value): self.rows[inner.index]['name'] = value
        self.parameter_patch = patch.object(s, 'parameter', lambda op, seq, index, suffix: NameParameter(index))
        self.parameter_patch.start();self.addCleanup(self.parameter_patch.stop)
        self.mode_patch = patch.object(s, 'ParMode', SimpleNamespace(CONSTANT='CONSTANT'), create=True)
        self.mode_patch.start();self.addCleanup(self.mode_patch.stop)

    def write_state(self, value):
        self.current = copy.deepcopy(value)
        if self.fail_write:
            self.fail_write = False
            raise RuntimeError('Injected state write failure')

    def request(self, ident='A'):
        seen = s.snapshot(self.runtime);row = next(r for r in seen['uniforms'] if r['id'] == ident)
        return {'action': 'remove', 'id': ident, 'revision': seen['revision'], 'expected': row['expected']}

    def test_missing_unused_purge_ignores_another_used_missing_source(self):
        self.rows.clear()
        self.current['graph']['stages']['pixel']['nodes'] = [{'id': 'used', 'params': {'declarationId': 'B'}}]
        request = self.request();before = copy.deepcopy(self.current)
        result = s.edit(self.runtime, request)
        self.assertEqual([r['id'] for r in result['uniforms']], ['B'])
        self.assertEqual(set(self.storage[s.STORE]), {'B'})
        self.assertEqual([issue['id'] for issue in result['issues']], ['B'])
        self.assertEqual(result['graph']['stages'], before['graph']['stages'])
        self.assertEqual(self.current['appliedHash'], 'unchanged');self.assertTrue(result['sourceChanged'])
        self.assertEqual(s.snapshot(self.runtime)['graph'], result['graph'])
        self.runtime.deploy.assert_not_called()

    def test_missing_reference_in_any_stage_or_function_blocks_purge(self):
        initial = copy.deepcopy(self.current); storage = copy.deepcopy(self.storage)
        for kind in ('pixel', 'vertex', 'function'):
            with self.subTest(kind=kind):
                self.current = copy.deepcopy(initial); self.storage = copy.deepcopy(storage)
                self.rows.clear();part = {'nodes': [{'id': 'unused_ref', 'params': {'declarationId': 'A'}}], 'edges': []}
                if kind == 'function':self.current['graph']['functions'] = [{'id': 'unused_function', 'graph': part}]
                else:self.current['graph']['stages'][kind] = part
                request = self.request();before = copy.deepcopy(self.current)
                with self.assertRaisesRegex(RuntimeError, 'graph references'):s.edit(self.runtime, request)
                self.assertEqual(self.current, before)

    def test_missing_removal_checks_revision_and_expected_identity(self):
        self.rows.clear();request = self.request();before = copy.deepcopy(self.current)
        for bad in ({**request, 'revision': request['revision']-1}, {**request, 'expected': 'formerly-live-token'}):
            with self.assertRaises(RuntimeError):s.edit(self.runtime, bad)
        self.assertEqual(self.current, before)

    def test_live_unused_removal_purges_and_preserves_neighbour_components(self):
        request = self.request();neighbour = copy.deepcopy(self.rows[1]['components'])
        result = s.edit(self.runtime, request)
        self.assertEqual([r['id'] for r in result['uniforms']], ['B'])
        self.assertEqual(len(self.rows), 1);self.assertEqual(self.rows[0]['components'], neighbour)
        self.assertEqual(self.storage[s.STORE]['B']['index'], 0)
        self.assertEqual(s.snapshot(self.runtime)['graph'], result['graph'])

    def test_live_used_removal_retains_graph_and_missing_record(self):
        self.current['graph']['stages']['pixel'] = {'nodes': [{'id': 'ref', 'params': {'declarationId': 'A'}}],
                                                   'edges': [{'from': ['ref', 'out'], 'to': ['consumer', 'value']}]}
        request = self.request();before = copy.deepcopy(self.current['graph']['stages'])
        result = s.edit(self.runtime, request)
        self.assertTrue(next(r for r in result['uniforms'] if r['id']=='A')['missing'])
        self.assertEqual(result['graph']['stages'], before)

    def test_last_native_block_is_cleared_without_adding_empty_blocks(self):
        self.rows.pop();self.current['graph']['declarations'].pop();self.storage[s.STORE].pop('B')
        result = s.edit(self.runtime, self.request())
        self.assertEqual(result['uniforms'], []);self.assertEqual(len(self.rows), 1)
        self.assertEqual(self.rows[0]['name'], '');self.assertEqual(self.storage[s.STORE], {})

    def test_metadata_failure_retains_missing_state_for_retry(self):
        self.rows.clear();request = self.request();before = copy.deepcopy(self.current);storage = copy.deepcopy(self.storage)
        self.fail_write = True
        with self.assertRaisesRegex(RuntimeError, 'missing record was retained'):s.edit(self.runtime, request)
        self.assertEqual(self.current, before);self.assertEqual(self.storage, storage)
        self.assertEqual([r['id'] for r in s.edit(self.runtime, request)['uniforms']], ['B'])

    def test_live_purge_failure_does_not_claim_native_rollback(self):
        request = self.request();real_purge = s.purge_missing_source
        def failing_purge(runtime, ident):
            self.fail_write = True
            return real_purge(runtime, ident)
        with patch.object(s, 'purge_missing_source', failing_purge):
            with self.assertRaisesRegex(RuntimeError, 'missing record was retained'):s.edit(self.runtime, request)
        self.assertEqual([r['name'] for r in self.rows], ['uB'])
        missing = next(d for d in self.current['graph']['declarations'] if d['id']=='A')
        self.assertTrue(missing['sourceMissing']);self.assertTrue(self.storage[s.STORE]['A']['missing'])
        self.assertEqual([r['id'] for r in s.edit(self.runtime, self.request())['uniforms']], ['B'])


if __name__=='__main__':unittest.main()
