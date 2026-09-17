import copy
import unittest
from types import SimpleNamespace
import sgrape_core as c
import sgrape_sources as sources
import sgrape_history as history
import test_history as history_fixtures


def graph(ty='int', value=2):
    result=c.demo_graph('color',target='top')
    result['declarations']=[{'id':'mode','kind':'spec_constant','name':'sMode','type':ty,
                             'value':value,'constantId':7,'nativeSequence':'const'}]
    result['stages']['pixel']={'nodes':[c.node('spec_constant','mode',declarationId='mode'),c.node('pixel_out','output')],
                               'edges':[{'from':['mode','out'],'to':['output','color']}]}
    return result


class CompileSpecConstants(unittest.TestCase):
    def test_scalar_types_emit_typed_stable_layout_and_explicit_cast(self):
        for ty,value,text in [('int',2,'2'),('uint',2,'2u'),('bool',True,'true'),('float',.5,'0.5')]:
            with self.subTest(type=ty):
                compiled=c.compile_graph(graph(ty,value))
                self.assertIn('layout(constant_id = 7) const '+ty+' sMode = '+text+';',compiled['pixel'])
                self.assertIn('vec4(sMode)',compiled['pixel'])
                self.assertNotIn('uniform '+ty+' sMode',compiled['pixel'])

    def test_id_is_not_assigned_from_position_or_node_count(self):
        g=graph();g['declarations'].insert(0,{'id':'other','kind':'spec_constant','name':'sOther','type':'int','value':0,'constantId':1})
        g['stages']['pixel']['nodes'].insert(0,c.node('spec_constant','second',declarationId='mode'))
        code=c.compile_graph(g)['pixel']
        self.assertEqual(code.count('layout(constant_id = 7)'),1)
        g['declarations'][1]['name']='sRenamed'
        self.assertIn('layout(constant_id = 7) const int sRenamed',c.compile_graph(g)['pixel'])

    def test_reject_invalid_ids_and_non_scalar_types(self):
        for field,value in [('constantId',-1),('constantId',True),('type','vec2'),('value',.5),('value',2147483648)]:
            g=graph();g['declarations'][0][field]=value
            with self.subTest(field=field,value=value),self.assertRaises(c.GraphError):c.compile_graph(g)
        g=graph();g['declarations'].append(dict(g['declarations'][0],id='copy',name='sCopy'))
        with self.assertRaises(c.GraphError):c.compile_graph(g)

    def test_specialization_not_promised_as_ordinary_constant_expression(self):
        g=graph();g['stages']['pixel']['nodes'][0]['params']['requireConstant']=True
        with self.assertRaises(c.GraphError):c.compile_graph(g)
        self.assertEqual(c.type_contract()['specConstantTypes'],['int','uint','bool','float'])

    def test_bool_unconnected_input_and_signed_minimum_literals(self):
        self.assertEqual(c.literal(c.filled_value('bool'),'bool'),'false')
        self.assertEqual(c.literal(-2147483648,'int'),'(-2147483647 - 1)')
        self.assertEqual(c.literal(4294967295,'uint'),'4294967295u')

    def test_native_reconcile_preserves_declared_type_default_id(self):
        declaration=graph('bool',False)['declarations'][0]
        registry={'mode':{'sequence':'const','name':'sMode','index':0}}
        rows=[{'sequence':'const','index':1,'name':'sMode','nameMode':'CONSTANT','components':[{'value':1}]}]
        declarations,mapping,issues=sources.reconcile([declaration],registry,rows)
        self.assertEqual(declarations,[declaration]);self.assertEqual(mapping['mode']['index'],1);self.assertFalse(issues)
        rows[0].update(index=1,name='sOther')
        declarations,mapping,issues=sources.reconcile(declarations,mapping,rows)
        self.assertEqual(declarations[0]['name'],'sOther');self.assertEqual(declarations[0]['constantId'],7)

    def test_new_native_constant_allocates_unique_id_in_same_inventory(self):
        existing=graph()['declarations']
        rows=[{'sequence':'const','index':0,'name':'sMode','nameMode':'CONSTANT','components':[{'value':2}]},
              {'sequence':'const','index':1,'name':'sNew','nameMode':'CONSTANT','components':[{'value':4}]}]
        declarations,mapping,issues=sources.reconcile(existing,{'mode':{'sequence':'const','index':0,'name':'sMode'}},rows)
        self.assertFalse(issues);self.assertEqual(declarations[1]['kind'],'spec_constant')
        self.assertEqual(declarations[1]['constantId'],0);self.assertEqual(declarations[1]['value'],4)


class NativeSpecHistory(unittest.TestCase):
    def setUp(self):
        self.fixture=history_fixtures.History('test_value_undo_redo_and_unrelated_external_value');self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        f=self.fixture
        f.runtime.core=lambda: SimpleNamespace(compile_graph=lambda g:None,number=c.number,literal=c.literal)
        self.decl={'id':'spec','kind':'spec_constant','name':'sMode','type':'int','value':2,'constantId':5,'nativeSequence':'const'}
        f.current['graph']['declarations'].append(copy.deepcopy(self.decl))
        f.storage[sources.STORE]['spec']={'sequence':'const','index':0,'name':'sMode'}
        f.operator.par.const0name.val='sMode';f.operator.par.const0value.val=2

    def restore(self,current,target,graph):
        f=self.fixture
        return history.restore(f.runtime,{'requestId':'spec'+str(f.current['revision']), 'revision':f.current['revision'],
            'fromToken':current,'toToken':target,'sourceIds':['spec'],'graph':copy.deepcopy(graph),
            'currentGraph':copy.deepcopy(f.current['graph'])})

    def test_value_undo_keeps_native_par_and_uniform_external_value(self):
        f=self.fixture;g=copy.deepcopy(f.current['graph']);before=f.token();par=f.operator.par.const0value
        par.val=9;after=f.token();f.par('A').val=54
        self.restore(after,before,g)
        self.assertIs(par,f.operator.par.const0value);self.assertEqual(par.eval(),2);self.assertEqual(f.par('A').eval(),54)
        self.assertEqual(f.current['graph']['declarations'][-1],self.decl)

    def test_delete_restore_keeps_original_spec_and_constant_ids(self):
        f=self.fixture;g=copy.deepcopy(f.current['graph']);before=f.token()
        f.operator.par.const0name.val='';f.storage[sources.STORE].pop('spec')
        f.current['graph']['declarations']=[d for d in f.current['graph']['declarations'] if d['id']!='spec']
        after=f.token();self.restore(after,before,g)
        self.assertEqual(f.current['graph']['declarations'][-1],self.decl)
        self.assertEqual(sources.locate(f.operator,f.storage[sources.STORE]['spec'])['name'],'sMode')

    def test_configure_cannot_rebind_spec_identity_to_uniform_row(self):
        f=self.fixture;g=copy.deepcopy(f.current['graph']);d=next(d for d in g['declarations'] if d['id']=='A')
        d.update(kind='spec_constant',type='int',constantId=0,nativeSequence='const')
        before=copy.deepcopy(f.storage)
        with self.assertRaisesRegex(RuntimeError,'source kind differs'):
            sources.configure(f.runtime,f.comp,g,{})
        self.assertEqual(f.storage,before)

    def test_negative_native_default_rejected_before_any_write(self):
        f=self.fixture;g=copy.deepcopy(f.current['graph']);g['declarations'][-1]['value']=-1
        before=copy.deepcopy(f.storage)
        with self.assertRaisesRegex(RuntimeError,'Negative int overrides'):
            sources.configure(f.runtime,f.comp,g,{})
        self.assertEqual(f.storage,before);self.assertEqual(f.operator.par.const0value.eval(),2)

    def test_invalid_current_value_api_is_noop_and_external_value_has_issue(self):
        f=self.fixture;seen=sources.snapshot(f.runtime);component=seen['specConstants'][0]['components'][0]
        with self.assertRaisesRegex(RuntimeError,'Negative int overrides'):
            sources.write_value(f.runtime,{'revision':seen['revision'],'id':'spec','component':0,'value':-1,'expected':component})
        self.assertEqual(f.operator.par.const0value.eval(),2)
        f.operator.par.const0value.val=-1
        seen=sources.snapshot(f.runtime)
        self.assertEqual(seen['specConstants'][0]['components'][0]['value'],-1)
        self.assertTrue(any(issue.get('code')=='spec-native-value' for issue in seen['issues']))

    def test_history_rejects_return_to_unsafe_external_native_value(self):
        f=self.fixture;g=copy.deepcopy(f.current['graph']);f.operator.par.const0value.val=-1;unsafe=f.token()
        f.operator.par.const0value.val=2;safe=f.token()
        with self.assertRaisesRegex(RuntimeError,'Negative int overrides'):self.restore(safe,unsafe,g)
        self.assertEqual(f.operator.par.const0value.eval(),2)

    def test_type_undo_returns_invalid_spec_draft_without_changing_native_value(self):
        f=self.fixture;f.current['graph']['declarations'][-1].update(type='float',value=0.0)
        par=f.operator.par.const0value;par.val=.75;applied=copy.deepcopy(f.current['graph']);token=f.token()
        draft=copy.deepcopy(applied);draft['declarations'][-1].update(type='int',value=0)
        result=self.restore(token,token,draft)
        self.assertEqual(result['workingGraph'],draft)
        self.assertEqual(f.current['graph'],applied);self.assertIs(par,f.operator.par.const0value);self.assertEqual(par.eval(),.75)
        result=history.restore(f.runtime,{'requestId':'spec-redo-type','revision':f.current['revision'],
            'fromToken':result['history']['token'],'toToken':token,'sourceIds':['spec'],
            'graph':applied,'currentGraph':draft})
        self.assertNotIn('workingGraph',result);self.assertEqual(f.current['graph'],applied);self.assertEqual(par.eval(),.75)

    def test_default_undo_keeps_invalid_native_default_in_working_graph(self):
        f=self.fixture;applied=copy.deepcopy(f.current['graph']);token=f.token()
        draft=copy.deepcopy(applied);draft['declarations'][-1]['value']=-1
        result=self.restore(token,token,draft)
        self.assertEqual(result['workingGraph'],draft);self.assertEqual(f.current['graph'],applied)
        self.assertEqual(f.operator.par.const0value.eval(),2)

    def test_spec_draft_exception_rejects_native_delta_or_identity_change(self):
        f=self.fixture;applied=copy.deepcopy(f.current['graph']);before=f.token()
        f.operator.par.const0value.val=3;after=f.token()
        draft=copy.deepcopy(applied);draft['declarations'][-1]['value']=-1
        with self.assertRaisesRegex(RuntimeError,'Negative int overrides'):self.restore(after,before,draft)
        self.assertEqual(f.operator.par.const0value.eval(),3);self.assertEqual(f.current['graph'],applied)
        draft['declarations'][-1]['constantId']=6
        with self.assertRaisesRegex(RuntimeError,'Negative int overrides'):self.restore(after,after,draft)
        self.assertEqual(f.operator.par.const0value.eval(),3);self.assertEqual(f.current['graph'],applied)

    def test_spec_draft_exception_rejects_mixed_native_write_before_mutation(self):
        f=self.fixture;before=f.token();f.par('A').val=6;after=f.token()
        applied=copy.deepcopy(f.current['graph']);draft=copy.deepcopy(applied);draft['declarations'][-1]['value']=-1
        with self.assertRaisesRegex(RuntimeError,'Negative int overrides'):
            history.restore(f.runtime,{'requestId':'spec-mixed-draft','revision':f.current['revision'],
                'fromToken':after,'toToken':before,'sourceIds':['spec','A'],'graph':draft,'currentGraph':applied})
        self.assertEqual(f.par('A').eval(),6);self.assertEqual(f.operator.par.const0value.eval(),2)
        self.assertEqual(f.current['graph'],applied)


class NativeIntegerLimits(unittest.TestCase):
    def test_top_and_mat_bounds_differ_from_glsl_literal_range(self):
        for kind in ('top','mat'):
            with self.assertRaises(RuntimeError):sources.validate_spec_native({'type':'int'},-1,kind)
            sources.validate_spec_native({'type':'int'},2**30,kind)
            sources.validate_spec_native({'type':'float'},-.5,kind)
            self.assertEqual(c.literal(-1,'int'),'-1')
        for ty,value in [('int',16777217),('int',2147483647),('uint',4294967295)]:
            sources.validate_spec_native({'type':ty},value,'top')
            with self.assertRaisesRegex(RuntimeError,'exactly representable'):
                sources.validate_spec_native({'type':ty},value,'mat')
        sources.validate_spec_native({'type':'uint'},4294967040,'mat')

    def test_fractional_or_out_of_range_external_integers_are_rejected(self):
        for ty,value in [('int',.5),('uint',-1),('uint',4294967296),('int',2147483648),('int',float('inf'))]:
            with self.subTest(type=ty,value=value),self.assertRaises(RuntimeError):
                sources.validate_spec_native({'type':ty},value,'top')


if __name__=='__main__':unittest.main()
