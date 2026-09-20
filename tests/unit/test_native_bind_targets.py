import unittest
from types import SimpleNamespace
import sgrape_sources as sources


class Parameter:
    def __init__(self, path, name='value', mode='CONSTANT', master=None):
        self.owner=SimpleNamespace(path=path)
        self.name,self.mode,self.bindMaster=name,mode,master
        self.valid=self.enable=True
        self.readOnly=False
        self.expr=''
        self.bindExpr='op("master").par.value' if mode=='BIND' else ''
        self.val=.5

    def isSamePar(self, other):return self is other
    def eval(self):return self.val


class NativeBindTargets(unittest.TestCase):
    def test_external_parameter_and_chain_resolve_without_ownership_registry(self):
        master=Parameter('/external')
        intermediate=Parameter('/middle',mode='BIND',master=master)
        native=Parameter('/shader',mode='BIND',master=intermediate)
        self.assertIs(sources.editable_parameter(native),master)
        item=sources.component(native)
        self.assertTrue(item['writable'])
        self.assertEqual(item['mode'],'BIND')
        self.assertEqual(item['controlPath'],'/external.par.value')
        self.assertEqual(native.mode,'BIND')
        self.assertEqual(intermediate.mode,'BIND')

    def test_master_expression_export_and_disabled_parameters_are_preserved(self):
        master=Parameter('/external');native=Parameter('/shader',mode='BIND',master=master)
        for mode in ['EXPRESSION','EXPORT']:
            master.mode=mode
            self.assertIsNone(sources.editable_parameter(native))
            self.assertFalse(sources.component(native)['writable'])
            self.assertEqual(master.mode,mode)
        master.mode='CONSTANT'
        for parameter in [native,master]:
            for field,value in [('enable',False),('readOnly',True),('valid',False)]:
                before=getattr(parameter,field);setattr(parameter,field,value)
                self.assertIsNone(sources.editable_parameter(native))
                setattr(parameter,field,before)

    def test_invalid_nonparameter_and_cyclic_bindings_are_not_writable(self):
        native=Parameter('/shader',mode='BIND')
        for master in [None,object(),native]:
            native.bindMaster=master
            self.assertIsNone(sources.editable_parameter(native))
        other=Parameter('/other',mode='BIND',master=native);native.bindMaster=other
        self.assertIsNone(sources.editable_parameter(native))

    def test_retargeting_same_named_master_changes_expected_snapshot(self):
        native=Parameter('/shader',mode='BIND',master=Parameter('/first'))
        before=sources.component(native)
        native.bindMaster=Parameter('/second')
        self.assertNotEqual(sources.component(native),before)

    def test_master_with_references_keeps_own_constant_presentation(self):
        master=Parameter('/master');master.bindReferences=[Parameter('/reference',mode='BIND',master=master)]
        item=sources.component(master)
        self.assertEqual(item['mode'],'CONSTANT')
        self.assertTrue(item['hasBindReferences'])
        self.assertTrue(item['writable'])
        self.assertNotIn('controlPath',item)


if __name__=='__main__':unittest.main()
