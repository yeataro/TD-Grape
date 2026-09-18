"""Typed native values are revalidated before Undo, binding or history writes."""
import copy
from contextlib import contextmanager
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import sgrape_core as core
import sgrape_history as history
import sgrape_parameter_links as links
import sgrape_parameters as parameters
import sgrape_sources as sources
import sgrape_runtime as runtime_module
import test_history as history_fixtures

Par=history_fixtures.Par


class TypedUndo(unittest.TestCase):
    def setUp(self):
        self.fixture=history_fixtures.History('test_value_undo_redo_and_unrelated_external_value')
        self.fixture.setUp();self.addCleanup(self.fixture.doCleanups)
        self.f=self.fixture
        self.f.runtime.shader_kind=lambda comp:'top'

    def declaration(self,ty):
        declaration=next(d for d in self.f.current['graph']['declarations'] if d['id']=='A')
        declaration.update(type=ty,value=core.filled_value(ty))
        return declaration

    def context_required(self):
        active=[];f=self.f
        @contextmanager
        def context(comp):
            active.append(comp)
            try:yield
            finally:active.pop()
        def state():
            self.assertEqual(active,[f.comp], 'TD Undo must restore the original Shader context')
            return copy.deepcopy(f.current)
        f.runtime.shader_context=context;f.runtime.state=state

    def test_native_source_undo_checks_current_type_in_original_shader_context(self):
        f=self.f;f.runtime.core=lambda:core
        p=f.par('A');p.val=.5;item=sources.component(p);callbacks=[]
        seen={'revision':1,'graph':f.current['graph'],'uniforms':[dict(id='A',kind='uniform',type='float',missing=False,components=[item])]}
        def commit(par,value,validate=None):callbacks.append(validate);par.val=value
        f.runtime.set_parameter_with_undo=commit
        with patch.object(sources,'snapshot',return_value=seen):
            sources.write_value(f.runtime,dict(revision=1,id='A',component=0,expected=item,value=1.0))
        self.declaration('int');self.context_required()
        with self.assertRaisesRegex(RuntimeError,'whole int'):callbacks[0](.5)
        callbacks[0](2.0)  # Native TD numeric snapshots are floats, even for ints.
        self.declaration('bool');callbacks[0](0.0);callbacks[0](1.0)
        with self.assertRaisesRegex(RuntimeError,'boolean'):callbacks[0](2.0)
        self.assertEqual(p.val,1.0)

    def test_editor_history_rejects_unsafe_bound_master_without_writes(self):
        f=self.f;self.declaration('int')
        master=Par(f.comp,'Amount',1.5);f.comp.par.Amount=master
        links.bind(f.comp,'A',[master]);f.par('A').mode='BIND'
        before=f.token();master.val=2;after=f.token();state=copy.deepcopy(f.current)
        with self.assertRaisesRegex(RuntimeError,'whole int'):
            history.restore(f.runtime,f.request(before,after))
        self.assertEqual(master.val,2);self.assertEqual(f.current,state)

    def test_editor_history_rejects_unsafe_legacy_exposed_value(self):
        f=self.f;self.declaration('int')['expose']=True
        master=Par(f.comp,'Amount',16777217);f.comp.par.Amount=master
        f.storage['sgrapePublicUniforms']={'A':{'type':'int','parameters':['Amount']}}
        before=f.token();master.val=2;after=f.token();state=copy.deepcopy(f.current)
        request=f.request(before,after,ids=());request['valueIds']=['A']
        with self.assertRaisesRegex(RuntimeError,'float32'):history.restore(f.runtime,request)
        self.assertEqual(master.val,2);self.assertEqual(f.current,state)

    def test_editor_history_accepts_native_boolean_master_values(self):
        f=self.f;self.declaration('bool')
        master=Par(f.comp,'Enabled',0.0);f.comp.par.Enabled=master
        links.bind(f.comp,'A',[master]);f.par('A').mode='BIND'
        before=f.token();master.val=1.0;after=f.token()
        self.assertTrue(history.restore(f.runtime,f.request(before,after))['ok'])
        self.assertEqual(master.val,0.0)

    def test_custom_control_native_undo_validates_its_current_bound_source(self):
        f=self.f;f.runtime.core=lambda:core
        master=Par(f.comp,'Amount',1);master.isNumber=True;f.comp.par.Amount=master
        f.comp.parGroup=SimpleNamespace(Amount=[master])
        links.bind(f.comp,'A',[master]);f.par('A').mode='BIND'
        row=dict(name='Amount',expected='row',components=[dict(writable=True,value=1)])
        seen=dict(enabled=True,revision=1,controls=[row]);callbacks=[]
        def commit(par,value,validate=None):callbacks.append(validate);par.val=value
        f.runtime.set_parameter_with_undo=commit
        with patch.object(parameters,'snapshot',return_value=seen):
            parameters.edit(f.runtime,dict(action='value',revision=1,name='Amount',expected='row',component=0,expectedValue=row['components'][0],value=2))
        self.declaration('int');self.context_required()
        with self.assertRaisesRegex(RuntimeError,'whole int'):callbacks[0](.5)
        callbacks[0](1.0);self.assertEqual(master.val,2)

    def test_binding_rejects_invalid_native_value_before_creating_integer_control(self):
        f=self.f;f.runtime.core=lambda:core;self.declaration('int');f.par('A').val=1.5
        f.comp.customPages=[SimpleNamespace(name='Controls')]
        seen=dict(enabled=True,revision=1,expectedPages='pages')
        native=dict(uniforms=[dict(id='A',name='uA',type='int',missing=False,expected='source',default=0)])
        with patch.object(parameters,'snapshot',return_value=seen), patch.object(sources,'snapshot',return_value=native), patch.object(parameters,'create_group') as create:
            with self.assertRaisesRegex(RuntimeError,'whole int'):
                parameters.edit(f.runtime,dict(action='bind',revision=1,expectedPages='pages',page='Controls',id='A',sourceExpected='source'))
            create.assert_not_called()
        self.assertEqual(f.par('A').val,1.5)

    def test_legacy_exposed_native_undo_checks_value_transport(self):
        f=self.f;f.runtime.core=lambda:core;self.declaration('int')['expose']=True
        master=Par(f.comp,'Amount',16777217);f.comp.par.Amount=master
        f.storage['sgrapePublicUniforms']={'A':{'type':'int','parameters':['Amount']}}
        item=dict(parameter='Amount',value=16777217,mode='CONSTANT',writable=True)
        seen=dict(revision=1,textures={},uniforms={'A':dict(type='int',components=[item])});callbacks=[]
        def commit(par,value,validate=None):callbacks.append(validate);par.val=value
        owner=SimpleNamespace(op=lambda name:SimpleNamespace(module=f.runtime))
        with patch.object(runtime_module,'target',lambda:f.comp), patch.multiple(runtime_module,state=lambda:f.current,checked_state=lambda:f.current,
                core=lambda:core,source_module=lambda:sources,shader_kind=lambda comp:'top',uniform_snapshot=lambda:seen,
                ensure_supported_shader=lambda comp:None,set_parameter_with_undo=commit,_owner=owner):
            runtime_module.set_uniform_value(dict(declarationId='A',component=0,revision=1,expected=item,value=2))
            self.context_required()
            with self.assertRaisesRegex(RuntimeError,'float32'):callbacks[0](16777217.0)
            callbacks[0](16777218.0)
        self.assertEqual(master.val,2)


if __name__=='__main__':unittest.main()
