"""Native matrix configuration, explicit edits and ownership history."""
import copy
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import sgrape_core as core
import sgrape_history as history
import sgrape_sources as sources
import sgrape_parameter_links as links
import test_history as fixtures


class MatrixSources(unittest.TestCase):
    def fixture(self, ty='mat2x3', literal=True):
        f = fixtures.History('test_value_undo_redo_and_unrelated_external_value')
        f.setUp(); self.addCleanup(f.doCleanups)
        fixture_core = f.runtime.core()
        fixture_core.literal = core.literal
        declaration = {'id':'M', 'kind':'uniform', 'name':'uMatrix', 'type':ty,
                       'nativeSequence':'matrix', 'value':[float(i+.25) for i in range(sources.TYPES[ty])]}
        f.current['graph']['declarations'].append(declaration)
        f.storage[sources.STORE]['M'] = {'sequence':'matrix', 'index':0, 'name':'uMatrix'}
        row = f.operator.seq.matrix.blocks[0]; row['name'].val = 'uMatrix'
        p = row['value']; p.val = ''; p.mode = 'EXPRESSION'
        p.expr = sources.matrix_expression(declaration,declaration['value']) if literal else "op('animated_matrix')"
        p.eval = Mock(side_effect=AssertionError('Snapshot/history must not evaluate Matrix drivers'))
        return f, declaration, p

    def request(self, f, **kwargs):
        seen = sources.snapshot(f.runtime)
        row = next(r for r in seen['uniforms'] if r['id'] == 'M')
        return dict(action='matrixValue', id='M', revision=seen['revision'], expected=row['matrixBinding']['expected'], **kwargs)

    def test_all_matrix_shapes_flat_column_major_and_unused_carrier_preserved(self):
        for ty, (columns, rows) in sources.MATRIX_SHAPES.items():
            with self.subTest(type=ty):
                declaration = {'type':ty}; values = [float(i+.25) for i in range(columns*rows)]
                carrier = list(range(100,116))
                result = sources.matrix_literal(sources.matrix_expression(declaration, values, carrier))
                binding = {'literalValues':result,'parameter':'matrix0value','mode':'EXPRESSION'}
                self.assertEqual([c['value'] for c in sources.matrix_components(binding,ty)],values)
                for c in range(4):
                    for r in range(4):
                        self.assertEqual(result[c*4+r],values[c*rows+r] if c<columns and r<rows else carrier[c*4+r])

    def test_literal_parser_does_not_evaluate_arbitrary_expressions(self):
        self.assertEqual(sources.matrix_literal('tdu.Matrix('+repr(list(range(16)))+')'),list(range(16)))
        for expression in ("op('matrix')", 'tdu.Matrix([absTime.seconds]*16)', 'tdu.Matrix(list(range(16)))',
                           '__import__("os").getcwd()', 'tdu.Matrix([1e999]*16)', 'tdu.Matrix([1,2,3])'):
            self.assertIsNone(sources.matrix_literal(expression))

    def test_snapshot_dynamic_and_history_do_not_evaluate_matrix(self):
        f, declaration, p = self.fixture(literal=False)
        before = f.token(); seen = sources.snapshot(f.runtime)
        row = next(r for r in seen['uniforms'] if r['id']=='M')
        self.assertEqual(row['components'],[])
        self.assertEqual(row['matrixBinding']['expression'],p.expr)
        self.assertIsNone(row['matrixBinding']['literalValues'])
        f.operator.animation = 987654
        self.assertEqual(before,f.token())
        self.assertEqual(row['matrixBinding']['expected'],next(r for r in sources.snapshot(f.runtime)['uniforms'] if r['id']=='M')['matrixBinding']['expected'])
        p.eval.assert_not_called()

    def test_literal_edit_is_whole_matrix_and_one_history_change(self):
        f, declaration, p = self.fixture()
        before = f.token(); original = p.expr
        value = [3.,4.,5.,6.,7.,8.]
        seen = sources.edit(f.runtime,self.request(f,value=value))
        self.assertEqual([c['value'] for c in next(r for r in seen['uniforms'] if r['id']=='M')['components']],value)
        after = f.token(); self.assertNotEqual(before,after)
        undone = history.restore(f.runtime,f.request(before,after,ids=('M',)))
        self.assertEqual(p.expr,original)
        history.restore(f.runtime,f.request(after,undone['history']['token'],ids=('M',),request_id='redo_matrix'))
        self.assertEqual([c['value'] for c in sources.matrix_components(sources.matrix_binding(p),declaration['type'])],value)
        p.eval.assert_not_called()

    def test_binding_edits_preserve_history_and_do_not_sample_dynamic_source(self):
        f, declaration, p = self.fixture()
        before = f.token(); request = self.request(f)
        request.update(action='matrixBinding',mode='EXPRESSION',expression="op('external_dat')")
        sources.edit(f.runtime,request); after = f.token()
        self.assertEqual(p.expr,"op('external_dat')")
        history.restore(f.runtime,f.request(before,after,ids=('M',)))
        self.assertIsNotNone(sources.matrix_literal(p.expr)); p.eval.assert_not_called()

    def test_dynamic_matrix_cannot_be_overwritten_by_numeric_component_or_stale_editor(self):
        f, declaration, p = self.fixture()
        request = self.request(f,value=[1.,2.,3.,4.,5.,6.])
        p.expr = "op('new_source')"
        with self.assertRaisesRegex(RuntimeError,'changed'):sources.edit(f.runtime,request)
        request = self.request(f,value=[1.,2.,3.,4.,5.,6.])
        with self.assertRaisesRegex(RuntimeError,'driven by TD'):sources.edit(f.runtime,request)
        with self.assertRaises(RuntimeError):sources.write_value(f.runtime,dict(revision=f.current['revision'],id='M',component=0,value=99,expected={}))
        self.assertEqual(p.expr,"op('new_source')")

    def test_bind_export_readonly_and_invalid_count_preserve_configuration(self):
        f, declaration, p = self.fixture()
        for mode in ('BIND','EXPORT'):
            p.mode=mode; request=self.request(f,value=[1.]*6)
            with self.assertRaisesRegex(RuntimeError,'Bind / Export'):sources.edit(f.runtime,request)
        p.mode='EXPRESSION';original=p.expr
        for value in ([1.]*4,[1.]*5+[float('inf')]):
            with self.assertRaises((RuntimeError,core.GraphError)):sources.edit(f.runtime,self.request(f,value=value))
        self.assertEqual(p.expr,original)

    def test_matrix_import_has_identity_default_without_sampling(self):
        f, declaration, p = self.fixture(literal=False)
        row = next(r for r in sources.native_rows(f.operator) if r['sequence']=='matrix')
        declarations, registry, issues = sources.reconcile([],{},[row])
        self.assertEqual(issues,[]); self.assertEqual(declarations[0]['type'],'mat4')
        self.assertEqual(declarations[0]['nativeSequence'],'matrix')
        self.assertEqual(declarations[0]['value'],[float(c==r) for c in range(4) for r in range(4)])
        p.eval.assert_not_called()

    def test_configure_preserves_existing_dynamic_source_without_evaluation(self):
        f, declaration, p = self.fixture(literal=False)
        before=(p.val,p.mode,p.expr)
        sources.configure(f.runtime,f.comp,f.current['graph'],{})
        self.assertEqual((p.val,p.mode,p.expr),before)
        p.eval.assert_not_called()

    def test_shape_change_retains_full_native_carrier(self):
        f, declaration, p = self.fixture()
        original=p.expr; declaration.update(type='mat4',value=[float(i) for i in range(16)])
        sources.configure(f.runtime,f.comp,f.current['graph'],{})
        self.assertEqual(p.expr,original)
        seen=sources.snapshot(f.runtime)
        self.assertEqual(len(next(r for r in seen['uniforms'] if r['id']=='M')['components']),16)
        p.eval.assert_not_called()

    def test_failed_configuration_can_restore_external_matrix_driver(self):
        f, declaration, p = self.fixture(literal=False)
        before=sources.capture_configuration(f.runtime,f.comp)
        original=(p.val,p.mode,p.expr,p.bindExpr)
        p.expr=sources.matrix_control_expression(declaration,['A','B','C','D','E','F'])
        f.operator.seq.matrix.numBlocks+=1
        sources.restore_configuration(f.runtime,f.comp,before)
        self.assertEqual((p.val,p.mode,p.expr,p.bindExpr),original)
        self.assertEqual(f.operator.seq.matrix.numBlocks,1)
        p.eval.assert_not_called()

    def test_candidate_forwarding_keeps_matrix_python_result_and_original_relative_paths(self):
        matrix=object(); resolved=object(); resolve=Mock(return_value=resolved)
        p=SimpleNamespace(mode='EXPRESSION',evalExpression=Mock(return_value=matrix),
                          eval=Mock(side_effect=AssertionError('OP eval loses tdu.Matrix')),
                          owner=SimpleNamespace(parent=lambda:SimpleNamespace(op=resolve)))
        self.assertIs(sources.matrix_driver_value(p),matrix);p.eval.assert_not_called()
        p.evalExpression.return_value='../matrix_dat'
        self.assertIs(sources.matrix_driver_value(p),resolved);resolve.assert_called_once_with('../matrix_dat')
        p.mode='CONSTANT';p.eval=Mock(return_value=resolved);p.evalExpression.reset_mock()
        self.assertIs(sources.matrix_driver_value(p),resolved);p.evalExpression.assert_not_called()

    def test_exposed_matrix_expression_is_native_dependencies_not_a_python_monitor(self):
        declaration = {'type':'mat2x3'}
        expression = sources.matrix_control_expression(declaration,['A','B','C','D','E','F'])
        self.assertEqual(expression,'tdu.Matrix([parent().par.A.eval(), parent().par.B.eval(), parent().par.C.eval(), 0.0, parent().par.D.eval(), parent().par.E.eval(), parent().par.F.eval(), 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0])')
        f,_,_ = self.fixture()
        self.assertEqual(links.source_pars(f.comp,'M'),[])


if __name__ == '__main__':unittest.main()
