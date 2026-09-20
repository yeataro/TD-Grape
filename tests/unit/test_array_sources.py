"""CHOP Uniform Arrays preserve native ownership and do not poll samples."""
import copy
import re
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import sgrape_sources as sources
import test_history as fixtures


class ArraySequence(fixtures.Sequence):
    def new(self):
        block = {}
        defaults = dict(name='', type='float', chop='', arraytype='uniformarray')
        for suffix, value in defaults.items():
            block[suffix] = fixtures.Par(self.owner, suffix, value, block)
        return block


class ArrayPars(fixtures.NativePars):
    def __getattr__(self, name):
        match = re.fullmatch(r'array([0-9]+)([a-z]+)', name)
        if match:
            index, suffix = match.groups()
            try: return self.owner.sequences['array'].blocks[int(index)][suffix]
            except (IndexError, KeyError): pass
        return super().__getattr__(name)


class ArraySources(unittest.TestCase):
    def fixture(self):
        f = fixtures.History('test_value_undo_redo_and_unrelated_external_value')
        f.setUp(); self.addCleanup(f.doCleanups)
        sequence = ArraySequence(f.operator, 'array')
        f.operator.sequences['array'] = sequence; f.operator.seq.array = sequence
        f.operator.par = ArrayPars(f.operator)
        block = sequence.blocks[0]
        block['name'].val = 'uPoints'; block['type'].val = 'vec3'; block['chop'].val = '../points'
        block['chop'].eval = Mock(side_effect=AssertionError('No CHOP evaluation in snapshot'))
        declaration = dict(id='arr', kind='uniform', name='uPoints', type='vec3[3]',
                           nativeSequence='array', value=[[0.,0.,0.] for _ in range(3)])
        f.current['graph']['declarations'].append(declaration)
        f.storage[sources.STORE]['arr'] = dict(sequence='array', index=0, name='uPoints')
        return f, declaration, block

    def test_shape_restricts_native_carrier_not_all_graph_arrays(self):
        for ty in ('float[1]', 'vec2[12]', 'vec3[3]', 'vec4[5]'):
            self.assertIsNotNone(sources.array_shape(ty))
        for ty in ('int[4]', 'dvec3[2]', 'mat3[4]', 'float[0]', 'float[-1]', 'float[x]', 'float[2][2]'):
            self.assertIsNone(sources.array_shape(ty))
        self.assertEqual(sources.source_components({'type':'vec3[3]'}),9)

    def test_default_validation_is_nested_elements(self):
        decl = dict(type='vec2[2]', name='uPoints')
        sources.validate_uniform_native(decl, None)
        sources.validate_uniform_native(decl, [[1.,2.],[3.,4.]])
        for values in ([1.,2.,3.,4.], [[1.],[2.]], [[1.,2.],[3.,float('inf')]]):
            with self.assertRaises(RuntimeError): sources.validate_uniform_native(decl,values)

    def test_snapshot_reports_binding_and_does_not_evaluate_chop(self):
        f, declaration, block = self.fixture()
        seen = sources.snapshot(f.runtime)
        row = next(r for r in seen['uniforms'] if r['id']=='arr')
        self.assertEqual(row['components'],[])
        self.assertEqual(row['arrayBinding']['length'],3)
        self.assertEqual(row['arrayBinding']['elementType'],'vec3')
        before = row['arrayBinding']['expected']; f.operator.animation = 9999
        self.assertEqual(before,next(r for r in sources.snapshot(f.runtime)['uniforms'] if r['id']=='arr')['arrayBinding']['expected'])
        block['chop'].eval.assert_not_called()

    def test_native_import_inspects_only_length_and_never_samples(self):
        f, declaration, block = self.fixture()
        block['chop'].eval = Mock(return_value=SimpleNamespace(family='CHOP',numSamples=7))
        row = next(r for r in sources.native_rows(f.operator) if r['sequence']=='array')
        declarations, registry, issues = sources.reconcile([],{},[row],f.operator)
        self.assertEqual(issues,[]); self.assertEqual(declarations[0]['type'],'vec3[7]')
        self.assertIsNone(declarations[0]['value'])
        self.assertEqual(next(iter(registry.values()))['sequence'],'array')
        block['chop'].eval.assert_called_once()

    def test_unreadable_empty_and_out_of_range_native_sources_stay_diagnostic(self):
        f, declaration, block = self.fixture()
        for source in (None, SimpleNamespace(family='TOP'), SimpleNamespace(family='CHOP',numSamples=0), SimpleNamespace(family='CHOP',numSamples=2147483648)):
            block['chop'].eval=Mock(return_value=source)
            row=next(r for r in sources.native_rows(f.operator) if r['sequence']=='array')
            declarations,registry,issues=sources.reconcile([],{},[row],f.operator)
            self.assertEqual((declarations,registry),([],{}));self.assertEqual(len(issues),1)
            self.assertEqual(issues[0]['name'],'uPoints')

    def test_large_native_array_import_keeps_only_type_and_binding(self):
        f, _, block=self.fixture()
        for length in (1025,10000,1000000):
            block['chop'].eval=Mock(return_value=SimpleNamespace(family='CHOP',numSamples=length))
            row=next(r for r in sources.native_rows(f.operator) if r['sequence']=='array')
            declarations,registry,issues=sources.reconcile([],{},[row],f.operator)
            self.assertEqual(issues,[]);self.assertEqual(declarations[0]['type'],'vec3['+str(length)+']')
            self.assertIsNone(declarations[0]['value'])
            self.assertEqual(sources.array_shape(declarations[0]['type']),('vec3',length))
            block['chop'].eval.assert_called_once()

    def test_texture_buffer_is_not_imported_as_a_replaceable_value_array(self):
        f, declaration, block = self.fixture(); block['arraytype'].val = 'texturebuffer'
        row = next(r for r in sources.native_rows(f.operator) if r['sequence']=='array')
        declarations, registry, issues = sources.reconcile([],{},[row],f.operator)
        self.assertEqual(len(declarations),1); self.assertEqual(declarations[0]['type'],'samplerBuffer')
        self.assertIsNone(declarations[0]['value']); self.assertEqual(issues,[]); self.assertIn(declarations[0]['id'],registry)
        block['chop'].eval.assert_not_called()
        declarations, _, _ = sources.reconcile([declaration],f.storage[sources.STORE],[row],f.operator)
        self.assertTrue(declarations[0]['sourceMissing'])

    def test_configure_preserves_expression_and_rejects_short_source(self):
        f, declaration, block = self.fixture(); p = block['chop']
        declaration['value']=None
        p.mode='EXPRESSION'; p.expr="op('../animated_points')"
        p.evalExpression=Mock(return_value=SimpleNamespace(family='CHOP',numSamples=9))
        original=(p.val,p.expr,p.mode)
        sources.configure(f.runtime,f.comp,f.current['graph'],{})
        self.assertEqual(original,(p.val,p.expr,p.mode)); p.eval.assert_not_called()
        p.evalExpression.return_value.numSamples=2
        with self.assertRaisesRegex(RuntimeError,'fewer samples'):
            sources.configure(f.runtime,f.comp,f.current['graph'],{})
        self.assertEqual(original,(p.val,p.expr,p.mode))

    def test_binding_tokens_detect_changed_carrier_and_restore_failed_edit(self):
        f, declaration, block = self.fixture(); p=block['chop']
        original=(p.val,p.mode,p.expr,p.bindExpr)
        seen=sources.snapshot(f.runtime); binding=next(r for r in seen['uniforms'] if r['id']=='arr')['arrayBinding']
        request=dict(action='arrayBinding',id='arr',revision=seen['revision'],expected=binding['expected'],mode='CONSTANT',value='../missing')
        p.eval=Mock(return_value=None)
        with patch.object(sources,'ParMode',SimpleNamespace(CONSTANT='CONSTANT'),create=True):
            with self.assertRaisesRegex(RuntimeError,'existing CHOP'): sources.edit(f.runtime,request)
        self.assertEqual(original,(p.val,p.mode,p.expr,p.bindExpr))
        block['type'].val='vec4'
        self.assertNotEqual(binding['expected'],sources.array_binding(f.operator,0)['expected'])

    def test_bind_and_export_are_readonly_and_numeric_driver_cannot_take_over(self):
        f, declaration, block=self.fixture()
        for mode in ('BIND','EXPORT'):
            block['chop'].mode=mode
            row=next(r for r in sources.snapshot(f.runtime)['uniforms'] if r['id']=='arr')
            self.assertFalse(row['arrayBinding']['writable'])
            with self.assertRaisesRegex(RuntimeError,'Bind / Export'):
                sources.edit(f.runtime,dict(action='arrayBinding',id='arr',revision=f.current['revision'],expected=row['arrayBinding']['expected'],mode='CONSTANT',value='../other'))
        with self.assertRaisesRegex(RuntimeError,'source binding'):
            sources.edit(f.runtime,dict(action='driver',id='arr',revision=f.current['revision']))
        block['chop'].eval.assert_not_called()

    def test_configuration_failure_restores_native_array_parameters(self):
        f, declaration, block=self.fixture()
        before=sources.capture_configuration(f.runtime,f.comp)
        expected={key:(p.val,p.mode,p.expr,p.bindExpr) for key,p in block.items()}
        block['type'].val='vec4';block['chop'].expr='unexpected';block['arraytype'].val='texturebuffer'
        f.operator.seq.array.numBlocks=2
        sources.restore_configuration(f.runtime,f.comp,before)
        self.assertEqual(f.operator.seq.array.numBlocks,1)
        self.assertEqual(expected,{key:(p.val,p.mode,p.expr,p.bindExpr) for key,p in block.items()})

    def test_relative_candidate_path_uses_original_operator_context(self):
        source=object();resolve=Mock(return_value=source)
        p=SimpleNamespace(mode='EXPRESSION',evalExpression=Mock(return_value='../data'),owner=SimpleNamespace(parent=lambda:SimpleNamespace(op=resolve)))
        self.assertIs(sources.array_driver_value(p),source)
        resolve.assert_called_once_with('../data')


if __name__=='__main__':unittest.main()
