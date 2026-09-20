import copy,unittest
from types import SimpleNamespace
from unittest.mock import patch
import sgrape_core as core
import sgrape_sources as sources
import sgrape_runtime as runtime
import test_history as fixtures

class ColorValues(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.History();self.f.setUp();self.addCleanup(self.f.doCleanups);f=self.f
        f.runtime.core=lambda:core;f.runtime.shader_kind=lambda _: 'top'
        f.operator.seq.color.blocks[0]['name'].val='uColor'
        for i,key in enumerate(sources.CHANNELS['color']):f.operator.seq.color.blocks[0][key].val=(i+1)/10
        f.storage[sources.STORE]['C']={'sequence':'color','index':0,'name':'uColor'}
        f.current['graph']['declarations'].append({'id':'C','kind':'uniform','name':'uColor','type':'vec4','nativeSequence':'color','value':[.1,.2,.3,.4]})
        self.commits=[]
        f.runtime.set_parameters_with_undo=lambda plans:self.commits.append(plans)
    def payload(self):
        snap=sources.snapshot(self.f.runtime);row=next(r for r in snap['uniforms'] if r['id']=='C')
        return dict(revision=snap['revision'],id='C',components=[dict(component=i,value=.7,expected=row['components'][i]) for i in range(3)])
    def test_all_components_checked_before_any_write(self):
        body=self.payload();body['components'][2]['expected']['value']=99
        with self.assertRaises(sources.SourceError):sources.write_value(self.f.runtime,body)
        self.assertEqual(self.commits,[])
        body=self.payload();sources.write_value(self.f.runtime,body);self.assertEqual(len(self.commits[0]),3)
        self.assertEqual(self.f.operator.par.color0alpha.val,.4)
    def test_driven_and_undeclared_channels_are_rejected(self):
        self.f.operator.par.color0rgbg.mode='EXPRESSION';body=self.payload()
        with self.assertRaises(sources.SourceError):sources.write_value(self.f.runtime,body)
        self.assertEqual(self.commits,[])
        self.f.operator.par.color0rgbg.mode='CONSTANT';self.f.current['graph']['declarations'][-1]['type']='float'
        body=self.payload()
        with self.assertRaises(sources.SourceError):sources.write_value(self.f.runtime,body)
        self.assertEqual(self.commits,[])
    def test_batch_rolls_back_partial_failure_and_rejects_shared_control_conflict(self):
        class Par:
            def __init__(self,value):self.val=value
            def isSamePar(self,other):return self is other
        a,b=Par(.1),Par(.2);calls=[]
        def write(p,v):
            calls.append((p,v))
            if p is b and v==.8:raise RuntimeError('failure')
            p.val=v
        with patch.object(runtime,'ui',SimpleNamespace(undo=SimpleNamespace(globalState=False)),create=True),patch.object(runtime,'_set_parameter_without_native_capture',side_effect=write):
            with self.assertRaises(RuntimeError):runtime.set_parameters_with_undo([(a,.7,lambda v:None),(b,.8,lambda v:None)])
            self.assertEqual((a.val,b.val),(.1,.2));calls.clear()
            with self.assertRaises(RuntimeError):runtime.set_parameters_with_undo([(a,.7,lambda v:None),(a,.8,lambda v:None)])
            self.assertEqual(calls,[])

if __name__=='__main__':unittest.main()
