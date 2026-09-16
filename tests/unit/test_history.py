import copy
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import sgrape_history as h
import sgrape_sources as sources
import sgrape_parameter_links as links


class Par:
    def __init__(self, owner, suffix, val=0, block=None):
        self.owner = owner; self.suffix = suffix; self.block = block; self.val = val; self.index = id(self)
        self.expr = ''; self.bindExpr = ''; self.mode = 'CONSTANT'
        self.valid = True; self.enable = True; self.readOnly = False
        self.exportSource = None; self.bindReferences = []
    @property
    def name(self):
        if self.block is None: return self.suffix
        for seq in self.owner.sequences.values():
            if self.block in seq.blocks: return seq.name + str(seq.blocks.index(self.block)) + self.suffix
        return 'deleted' + self.suffix
    def eval(self):
        if self.mode == 'BIND': return self.bindMaster.eval()
        if self.mode == 'EXPRESSION': return self.owner.animation
        return self.val
    @property
    def bindMaster(self):
        if not self.bindExpr: return None
        return getattr(self.owner.parent().par, self.bindExpr.split('.')[-1], None)
    def isSamePar(self, other): return self is other
    @property
    def isDefault(self): return self.val == 0


class Sequence:
    def __init__(self, owner, name): self.owner = owner; self.name = name; self.blocks = []; self.numBlocks = 1
    @property
    def numBlocks(self): return len(self.blocks)
    @numBlocks.setter
    def numBlocks(self, count):
        while len(self.blocks) < count: self.blocks.append(self.new())
        while len(self.blocks) > count: self.destroyBlock(len(self.blocks)-1)
    def new(self):
        block = {}
        for suffix in ('name',) + sources.CHANNELS[self.name]:
            block[suffix] = Par(self.owner, suffix, '' if suffix == 'name' else 0, block)
        return block
    def insertBlock(self, index):
        self.blocks.insert(index, self.new())
        if self.owner.simulate_insert_reset:
            for block in self.blocks[index+1:]:
                for suffix, par in block.items():
                    if suffix != 'name': par.val = 1
    def destroyBlock(self, index):
        removed = self.blocks.pop(index)
        for par in removed.values(): par.valid = False


class NativePars:
    def __init__(self, owner): self.owner = owner
    def __getattr__(self, name):
        import re
        match = re.fullmatch(r'(vec|color)([0-9]+)([a-z]+)', name)
        if match:
            seq, index, suffix = match.groups()
            try: return self.owner.sequences[seq].blocks[int(index)][suffix]
            except (IndexError, KeyError): pass
        raise AttributeError(name)


class History(unittest.TestCase):
    def setUp(self):
        h._checkpoints.clear(); h._requests.clear(); h._sentinels.clear(); links._handles.clear(); links._busy = False
        self.storage = {'sgrapeShaderId': 'shader', sources.STORE: {}, links.STORE: {}}
        self.comp = SimpleNamespace(id=1, path='/test', par=SimpleNamespace(), valid=True,
            fetch=lambda key, default=None: self.storage.get(key, default), store=lambda key, value: self.storage.__setitem__(key, value),
            unstore=lambda key: self.storage.pop(key, None))
        self.operator = SimpleNamespace(id=2, path='/test/shader', parent=lambda: self.comp, animation=2.5, simulate_insert_reset=False)
        self.operator.sequences = {name: Sequence(self.operator, name) for name in sources.CHANNELS}
        self.operator.seq = SimpleNamespace(**self.operator.sequences); self.operator.par = NativePars(self.operator)
        self.comp.op = lambda name: self.operator if name == 'shader' else SimpleNamespace(module=links) if name == 'parameter_links' else None
        self.current = {'revision': 1, 'sourceChanged': False, 'graph': {'declarations': [], 'stages': {'pixel': {'nodes': [], 'edges': []}}, 'functions': []}}
        self.fail_write = False
        def compile_graph(graph):
            if graph.get('invalid'): raise ValueError('Incomplete graph')
        self.runtime = SimpleNamespace(target=lambda: self.comp, shader_operator=lambda comp: self.operator,
            source_module=lambda: sources, state=lambda: copy.deepcopy(self.current), checked_state=lambda: copy.deepcopy(self.current),
            write_state=self.write, core=lambda: SimpleNamespace(compile_graph=compile_graph, number=lambda value: float(value)))
        self.mode_patch = patch.object(links, 'ParMode', SimpleNamespace(CONSTANT='CONSTANT'), create=True)
        self.mode_patch.start(); self.addCleanup(self.mode_patch.stop)
        self.add('A', 3)
        self.add('B', 7)

    def write(self, state):
        self.current = copy.deepcopy(state)
        if self.fail_write:
            self.fail_write = False; raise RuntimeError('Injected write failure')

    def add(self, ident, value, name=None):
        seq = self.operator.seq.vec; index = len(self.storage[sources.STORE]); seq.numBlocks = max(1, index+1)
        row = seq.blocks[index]; row['name'].val = name or 'u'+ident
        for i, suffix in enumerate(sources.CHANNELS['vec']): row[suffix].val = value+i
        self.storage[sources.STORE][ident] = {'sequence': 'vec', 'index': index, 'name': row['name'].val}
        self.current['graph']['declarations'].append({'id': ident, 'kind': 'uniform', 'name': row['name'].val, 'type': 'float', 'value': value})

    def par(self, ident, suffix='valuex'):
        row = sources.locate(self.operator, self.storage[sources.STORE][ident])
        return sources.parameter(self.operator, row['sequence'], row['index'], suffix)

    def token(self): return h.capture(self.runtime)['token']
    def request(self, before, after, ids=('A',), graph=None, current=None, request_id='request'):
        return {'requestId': request_id, 'revision': self.current['revision'], 'fromToken': after, 'toToken': before,
                'sourceIds': list(ids), 'graph': copy.deepcopy(graph or self.current['graph']),
                'currentGraph': copy.deepcopy(current or self.current['graph'])}

    def test_value_undo_redo_and_unrelated_external_value(self):
        before = self.token(); self.par('A').val = 6; after = self.token()
        self.par('A', 'valuez').val = 81; self.par('B').val = 94
        result = h.restore(self.runtime, self.request(before, after))
        self.assertEqual(self.par('A').val, 3); self.assertEqual(self.par('A', 'valuez').val, 81); self.assertEqual(self.par('B').val, 94)
        h.restore(self.runtime, self.request(after, result['history']['token'], request_id='redo'))
        self.assertEqual(self.par('A').val, 6)

    def test_rebased_redo_retains_original_component_scope(self):
        before = self.token(); self.par('A').val = 6; after = self.token(); self.par('A', 'valuez').val = 81
        request = self.request(before, after); request.update(deltaFromToken=after, deltaToToken=before)
        undone = h.restore(self.runtime, request)
        redo = self.request(after, undone['history']['token'], request_id='redo')
        redo.update(deltaFromToken=before, deltaToToken=after)
        redone = h.restore(self.runtime, redo)
        self.assertEqual(self.par('A').val, 6); self.assertEqual(self.par('A', 'valuez').val, 81)
        undo = self.request(undone['history']['token'], redone['history']['token'], request_id='undo_again')
        undo.update(deltaFromToken=after, deltaToToken=before)
        h.restore(self.runtime, undo)
        self.assertEqual(self.par('A').val, 3); self.assertEqual(self.par('A', 'valuez').val, 81)

    def test_conflict_is_noop(self):
        before = self.token(); self.par('A').val = 6; after = self.token(); self.par('A').val = 99
        original = copy.deepcopy(self.current)
        with self.assertRaisesRegex(RuntimeError, 'Conflict'): h.restore(self.runtime, self.request(before, after))
        self.assertEqual(self.par('A').val, 99); self.assertEqual(self.current, original)

    def test_optional_functions_field(self):
        self.current['graph'].pop('functions'); before = self.token(); self.par('A').val = 6; after = self.token()
        h.restore(self.runtime, self.request(before, after)); self.assertEqual(self.par('A').val, 3)

    def test_animation_is_not_history_and_noop_dedupes(self):
        par = self.par('A'); par.mode = 'EXPRESSION'; par.expr = 'absTime.seconds'
        before = self.token(); self.operator.animation = 999
        self.assertEqual(before, self.token())
        par.expr = 'absTime.seconds * 2'; self.assertNotEqual(before, self.token())

    def test_delete_restore_reindexes_and_repairs_td_insert_side_effect(self):
        graph = copy.deepcopy(self.current['graph']); before = self.token()
        self.operator.seq.vec.destroyBlock(0); self.storage[sources.STORE].pop('A')
        self.current['graph']['declarations'] = [d for d in graph['declarations'] if d['id'] != 'A']
        sources.sync(self.runtime); after = self.token(); self.par('B').val = 88
        self.operator.simulate_insert_reset = True
        h.restore(self.runtime, self.request(before, after, graph=graph))
        self.assertEqual(self.par('A').val, 3); self.assertEqual(self.par('B').val, 88)
        self.assertEqual(self.storage[sources.STORE]['B']['index'], 1)

    def test_missing_record_and_same_id_round_trip(self):
        graph = copy.deepcopy(self.current['graph']); before = self.token()
        self.operator.seq.vec.destroyBlock(0); self.storage[sources.STORE]['A']['missing'] = True
        sources.sync(self.runtime); after = self.token(); missing = copy.deepcopy(self.current['graph'])
        restored = h.restore(self.runtime, self.request(before, after, graph=graph))
        self.assertFalse(self.storage[sources.STORE]['A'].get('missing'))
        h.restore(self.runtime, self.request(after, restored['history']['token'], graph=missing, request_id='redo'))
        self.assertTrue(self.storage[sources.STORE]['A']['missing']); self.assertIsNone(sources.locate(self.operator, self.storage[sources.STORE]['A']))

    def test_pending_intermediate_projection(self):
        self.current['graph']['declarations'] = [d for d in self.current['graph']['declarations'] if d['id'] != 'A']
        self.operator.seq.vec.destroyBlock(0); self.storage[sources.STORE].pop('A'); sources.sync(self.runtime)
        before = self.token(); self.add('A', 4, 'uFinal'); after = self.token()
        desired = copy.deepcopy(self.current['graph']); declaration = next(d for d in desired['declarations'] if d['id']=='A')
        declaration.update(name='uIntermediate', type='vec2', value=[2, 5])
        h.restore(self.runtime, self.request(before, after, graph=desired))
        self.assertEqual(self.storage[sources.STORE]['A']['name'], 'uIntermediate')
        self.assertEqual(self.par('A').val, 4); self.assertEqual(self.par('A', 'valuey').val, 5)
        self.assertEqual(next(d for d in self.current['graph']['declarations'] if d['id']=='A')['value'], [2, 5])

    def test_bound_value_restores_master_without_detaching(self):
        master = Par(self.comp, 'Gain', 0.25); self.comp.par.Gain = master
        links.bind(self.comp, 'A', [master]); self.par('A').mode = 'BIND'; before = self.token(); master.val = 0.8; after = self.token()
        h.restore(self.runtime, self.request(before, after))
        self.assertEqual(master.val, .25); self.assertEqual(self.par('A').mode, 'BIND'); self.assertTrue(self.par('A').bindMaster.isSamePar(master))

    def test_same_path_replacement_master_rejected(self):
        master = Par(self.comp, 'Gain', .25); self.comp.par.Gain = master; links.bind(self.comp, 'A', [master]); self.par('A').mode = 'BIND'
        before = self.token(); master.val = .8; after = self.token(); self.comp.par.Gain = Par(self.comp, 'Gain', .8)
        with self.assertRaisesRegex(RuntimeError, 'Conflict'): h.restore(self.runtime, self.request(before, after))
        self.assertEqual(self.comp.par.Gain.val, .8)

    def test_aliased_recreated_custom_master_index_is_rejected(self):
        master = Par(self.comp, 'Gain', .25); self.comp.par.Gain = master
        links.bind(self.comp, 'A', [master]); self.par('A').mode = 'BIND'
        before = self.token(); master.val = .8; after = self.token()
        replacement = Par(self.comp, 'Gain', .8); self.comp.par.Gain = replacement
        master.isSamePar = lambda other: True; replacement.isSamePar = lambda other: True
        with self.assertRaisesRegex(RuntimeError, 'Conflict'): h.restore(self.runtime, self.request(before, after))
        self.assertEqual(replacement.val, .8)

    def test_invalid_draft_never_written_to_authoritative_state(self):
        before = self.token(); self.par('A').val = 9; after = self.token()
        desired = copy.deepcopy(self.current['graph']); desired['invalid'] = True
        result = h.restore(self.runtime, self.request(before, after, graph=desired))
        self.assertEqual(result['workingGraph'], desired); self.assertNotIn('invalid', self.current['graph']); self.assertEqual(self.par('A').val, 3)

    def test_failure_rolls_back_values_and_state(self):
        before = self.token(); self.par('A').val = 9; after = self.token(); state = copy.deepcopy(self.current)
        self.fail_write = True
        with self.assertRaisesRegex(RuntimeError, 'previous source state'): h.restore(self.runtime, self.request(before, after))
        self.assertEqual(self.par('A').val, 9); self.assertEqual(self.current, state)

    def test_request_id_is_idempotent(self):
        before = self.token(); self.par('A').val = 9; after = self.token(); request = self.request(before, after)
        first = h.restore(self.runtime, request); revision = self.current['revision']; self.par('A').val = 12
        self.assertEqual(h.restore(self.runtime, request), first); self.assertEqual(self.current['revision'], revision); self.assertEqual(self.par('A').val, 12)
        with self.assertRaisesRegex(RuntimeError, 'reused'): h.restore(self.runtime, {**request, 'sourceIds': ['B']})

    def test_expired_and_cross_shader_tokens(self):
        before = self.token(); h._checkpoints.clear()
        with self.assertRaisesRegex(RuntimeError, 'expired'): h.restore(self.runtime, self.request(before, before))
        before = self.token(); self.comp.id = 55
        with self.assertRaisesRegex(RuntimeError, 'another Shader'): h.restore(self.runtime, self.request(before, before))

    def test_scope_validation(self):
        before = self.token(); desired = copy.deepcopy(self.current['graph']); desired['declarations'][1]['name'] = 'uOther'
        with self.assertRaisesRegex(RuntimeError, 'outside'): h.restore(self.runtime, self.request(before, before, graph=desired))

    def test_invalid_draft_restores_original_id_in_canonical_inventory(self):
        graph = copy.deepcopy(self.current['graph']); before = self.token()
        self.operator.seq.vec.destroyBlock(0); self.storage[sources.STORE].pop('A')
        self.current['graph']['declarations'] = [d for d in graph['declarations'] if d['id'] != 'A']
        sources.sync(self.runtime); after = self.token(); graph['invalid'] = True
        result = h.restore(self.runtime, self.request(before, after, graph=graph))
        self.assertEqual({d['id'] for d in result['graph']['declarations']}, {'A', 'B'})
        self.assertEqual(self.storage[sources.STORE]['A']['name'], 'uA')
        self.assertTrue(result['workingGraph']['invalid'])

    def test_structural_failure_repairs_neighbours_and_rolls_back_inventory(self):
        original = copy.deepcopy(self.current['graph']); before = self.token()
        self.operator.seq.vec.destroyBlock(0); self.storage[sources.STORE].pop('A')
        self.current['graph']['declarations'] = [d for d in original['declarations'] if d['id'] != 'A']
        sources.sync(self.runtime); after = self.token(); state = copy.deepcopy(self.current); registry = copy.deepcopy(self.storage[sources.STORE])
        self.operator.simulate_insert_reset = True; self.fail_write = True
        with self.assertRaisesRegex(RuntimeError, 'previous source state'):
            h.restore(self.runtime, self.request(before, after, graph=original))
        self.assertEqual(self.current, state); self.assertEqual(self.storage[sources.STORE], registry)
        self.assertEqual(self.par('B').val, 7); self.assertEqual(self.operator.seq.vec.numBlocks, 1)

    def test_sampler_value_history_guards_top_identity(self):
        top_a = SimpleNamespace(id=50, valid=True); top_b = SimpleNamespace(id=51, valid=True)
        tops = {'/a': top_a, '/b': top_b}; self.comp.parent = lambda: SimpleNamespace(op=lambda path: tops.get(path))
        self.runtime.texture_key = lambda declaration: declaration['id']
        par = Par(self.comp, 'Texture', '/a'); self.comp.par.Texture = par
        self.storage['sgrapePublicTextures'] = {'texture': {'parameter': 'Texture'}}
        self.current['graph']['declarations'].append({'id': 'texture', 'kind': 'sampler', 'name': 'uTexture', 'expose': True})
        previous_op = self.comp.op
        self.comp.op = lambda name: SimpleNamespace(module=SimpleNamespace(_external_allowed=lambda comp, op: True)) if name == 'texture_sources' else previous_op(name)
        before = self.token(); par.val = '/b'; after = self.token()
        request = self.request(before, after, ids=()); request['valueIds'] = ['texture']
        result = h.restore(self.runtime, request); self.assertEqual(par.val, '/a')
        tops['/b'] = SimpleNamespace(id=99, valid=True)
        redo = self.request(after, result['history']['token'], ids=(), request_id='redo'); redo['valueIds'] = ['texture']
        with self.assertRaisesRegex(RuntimeError, 'Conflict'): h.restore(self.runtime, redo)
        self.assertEqual(par.val, '/a')

    def test_final_row_restore_does_not_add_blank_rows(self):
        self.operator.seq.vec.destroyBlock(1); self.storage[sources.STORE].pop('B'); self.current['graph']['declarations'].pop()
        graph = copy.deepcopy(self.current['graph']); before = self.token()
        self.par('A', 'name').val = ''; self.storage[sources.STORE].pop('A'); self.current['graph']['declarations'] = []
        h.note_edit(self.runtime, {'action': 'remove', 'id': 'A'}, before)
        after = self.token(); result = h.restore(self.runtime, self.request(before, after, graph=graph))
        self.assertEqual(self.operator.seq.vec.numBlocks, 1); self.assertEqual(self.par('A').val, 3)
        h.restore(self.runtime, self.request(after, result['history']['token'], graph={'declarations': [], 'stages': {'pixel': {'nodes': [], 'edges': []}}, 'functions': []}, request_id='redo'))
        self.assertEqual(self.operator.seq.vec.numBlocks, 1); self.assertEqual(self.operator.seq.vec.blocks[0]['name'].val, '')

    def test_edited_empty_native_row_is_not_reused(self):
        graph = copy.deepcopy(self.current['graph']); before = self.token()
        self.operator.seq.vec.numBlocks = 1; self.operator.seq.vec.blocks[0]['name'].val = ''
        self.operator.seq.vec.blocks[0]['valuez'].val = 123
        self.operator.simulate_insert_reset = True
        self.storage[sources.STORE] = {}; self.current['graph']['declarations'] = []
        after = self.token(); desired = copy.deepcopy(graph); desired['declarations'] = [desired['declarations'][0]]
        h.restore(self.runtime, self.request(before, after, graph=desired))
        self.assertEqual(self.operator.seq.vec.numBlocks, 2)
        self.assertEqual(self.operator.seq.vec.blocks[1]['name'].val, '')
        self.assertEqual(self.operator.seq.vec.blocks[1]['valuez'].val, 123)

    def test_remove_preflight_blocks_export_on_shifted_neighbour(self):
        self.par('B').mode = 'EXPORT'
        with self.assertRaisesRegex(RuntimeError, 'Export'): h.preflight_edit(self.runtime, {'action': 'remove', 'id': 'A'})
        self.assertEqual(len(self.operator.seq.vec.blocks), 2)


if __name__ == '__main__': unittest.main()
