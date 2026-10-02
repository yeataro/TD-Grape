"""Transient Preview lifetime against real deploy orchestration and fake TD IO.

The fake surface observes graph/manifest/shader persistence and native binding
changes; it does not claim real GPU compilation or TOE callback qualification.
"""
import copy
import json
import unittest
from contextlib import ExitStack, nullcontext
from types import SimpleNamespace
from unittest.mock import patch

import sgrape_core as c
import sgrape_document as document
import sgrape_runtime as r


class FakeScene:
    def __init__(self, ident, name):
        self.id=ident;self.name=name;self.path='/test/'+name;self.valid=True
        self.par=SimpleNamespace(Version='old')
        self.storage={};self.parts={};self.live_values={};self.native_bindings=[]
        for key in ('graph','manifest','pixel_shader','vertex_shader','state'):
            self.parts[key]=SimpleNamespace(text='')
    def op(self,name):return self.parts.get(name)
    def store(self,key,value):self.storage[key]=copy.deepcopy(value)
    def fetch(self,key,default=None):return self.storage.get(key,default)
    def unstore(self,key):self.storage.pop(key,None)
    def destroy(self):self.valid=False


class PreviewLifecycle(unittest.TestCase):
    SESSION='preview-session-A'

    def setUp(self):
        self.stack=ExitStack();self.addCleanup(self.stack.close)
        self.now=100.0;self.created=[];self.fail_validation=None;self.configures=[]
        self.comp=FakeScene(101,'shader');self.owner=FakeScene(100,'manager')
        self.owner.parts.update(document=SimpleNamespace(module=document),
            parameters=SimpleNamespace(module=SimpleNamespace(shape_plans=lambda *_:[])),
            runtime=SimpleNamespace(module=r))
        self.owner.parent=lambda:self.owner
        self.checks=document.GraphChecks(c)
        self.graph=c.demo_graph('color','top')
        self.graph['declarations'].append(dict(id='debug',kind='uniform',name='uDebug',type='float',value=.25))
        self.graph['stages']['pixel']['nodes'].append(c.node('uniform','debugSource',declarationId='debug'))
        self.formal=document.stamp_catalog(self.graph,c)
        compiled=c.compile_graph(self.formal)
        self.current=dict(graph=copy.deepcopy(self.formal),revision=1,appliedHash=compiled['hash'],lastError='',sourceChanged=False)
        self.configure(self.comp,compiled,self.formal,{'external':9})
        self.comp.op('state').text=json.dumps(self.current)
        self.configures.clear()
        patches={
            '_owner':self.owner,'_shader':self.comp,'_pixel_previews':{},
            '_pixel_preview_closed':set(),'_pixel_preview_save_depth':0,
            'core':lambda:c,'target':lambda:self.comp,'shader_kind':lambda comp:'top',
            'source_module':lambda:None,'graph_checks':lambda:self.checks,
            'checked_state':lambda:copy.deepcopy(self.current),
            'saved_state_source':lambda:self.comp.op('state').text,
            'write_state':self.write_state,'ensure_supported_shader':lambda comp:None,
            'upgrade_review':lambda graph=None:{'required':False,'blocked':False},
            'compiled_is_current':lambda *args:False,
            'make_scene':self.make_scene,'configure':self.configure,
            'existing_values':lambda comp,graph:copy.deepcopy(comp.live_values),
            'validate_material':self.validate,
            'cleanup_top_sources':lambda *args:None,
            'begin_material_preview_update':lambda comp:(None,None),
            'ensure_pixel_preview_lifecycle':lambda comp:None,
            'capture_pixel_preview_output':self.capture_output,
            'restore_pixel_preview_output':self.restore_output,
            'shader_context':lambda comp:nullcontext(),
        }
        for key,value in patches.items():self.stack.enter_context(patch.object(r,key,value,create=True))
        self.stack.enter_context(patch.object(r.time,'monotonic',lambda:self.now))

    def make_scene(self,owner,name,kind):
        comp=FakeScene(200+len(self.created),name);self.created.append(comp)
        return comp

    def configure(self,comp,compiled,graph,preserve=None,input_owner=None,persist_compiled=None):
        persisted=persist_compiled or compiled
        self.configures.append((comp.id,copy.deepcopy(compiled),copy.deepcopy(graph)))
        comp.op('pixel_shader').text=compiled['pixel']
        comp.op('vertex_shader').text=compiled['vertex']
        comp.op('graph').text=json.dumps(graph)
        comp.op('manifest').text=json.dumps({'hash':persisted['hash'],'bindings':persisted['bindings'],
            'compiledFingerprint':c.digest({key:persisted[key] for key in ('vertex','pixel','bindings')}),'compilerBuild':r.PRODUCT_VERSION})
        comp.native_bindings=[b['id'] for b in compiled['bindings']]
        if preserve is not None:comp.live_values=copy.deepcopy(preserve)

    def validate(self,comp,compiled=None):
        if self.fail_validation==comp.name:raise RuntimeError('Injected native validation failure')
        if self.fail_validation=='active_'+comp.name and compiled and 'sg_preview_color' in compiled['pixel']:
            raise RuntimeError('Injected active native validation failure')
        return 'fake native validation'

    def capture_output(self,comp):
        return {'manifest':comp.op('manifest').text,'pixel':comp.op('pixel_shader').text,
            'vertex':comp.op('vertex_shader').text,'bindings':list(comp.native_bindings)}

    def restore_output(self,comp):
        pending=comp.fetch(r.PIXEL_PREVIEW_RECOVERY,None)
        if not pending:return
        output=pending['output']
        comp.op('manifest').text=output['manifest']
        comp.op('pixel_shader').text=output['pixel']
        comp.op('vertex_shader').text=output['vertex']
        comp.native_bindings=list(output['bindings'])
        comp.unstore(r.PIXEL_PREVIEW_RECOVERY)

    def write_state(self,value):
        self.current=copy.deepcopy(value)
        self.comp.op('state').text=json.dumps(value)

    def working_graph(self):
        graph=copy.deepcopy(self.formal);data=graph['stages']['pixel']
        data['nodes'].append(c.node('preview','preview'))
        data['edges'].append(c.edge('debugSource','preview','value'))
        return graph

    def apply(self,session=None,sequence=1):
        return r.deploy(self.working_graph(),self.current['revision'],
                        pixel_preview={'sessionId':session or self.SESSION,'sequence':sequence})

    def session(self,action,session=None,sequence=1):
        return r.pixel_preview_session({'action':action,'sessionId':session or self.SESSION,
            'sequence':sequence,'revision':self.current['revision']})

    def assert_formal(self):
        graph=json.loads(self.comp.op('graph').text)
        self.assertEqual(graph,c.without_preview(graph))
        self.assertEqual(self.current['graph'],graph)
        expected=c.compile_graph(graph)
        manifest=json.loads(self.comp.op('manifest').text)
        self.assertEqual(manifest['hash'],expected['hash'])
        self.assertEqual(self.current['appliedHash'],expected['hash'])
        self.assertNotIn('sg_preview_color',self.comp.op('pixel_shader').text)
        self.assertEqual(self.comp.op('pixel_shader').text,expected['pixel'])
        self.assertEqual(self.comp.native_bindings,[b['id'] for b in expected['bindings']])

    def test_apply_persists_formal_graph_hash_and_manifest_while_rendering_preview(self):
        result=self.apply()
        self.assertTrue(result['ok'])
        self.assertEqual(result['state']['graph'],c.without_preview(result['state']['graph']))
        graph=json.loads(self.comp.op('graph').text);expected=c.compile_graph(graph)
        self.assertEqual(self.current['graph'],graph)
        self.assertEqual(self.current['appliedHash'],expected['hash'])
        self.assertEqual(json.loads(self.comp.op('manifest').text)['hash'],expected['hash'])
        self.assertIn('sg_preview_color',self.comp.op('pixel_shader').text)
        self.assertIn('debug',self.comp.native_bindings)
        self.assertNotIn('debug',[b['id'] for b in expected['bindings']])

    def test_leave_restores_code_and_binding_layout_without_rewinding_live_values(self):
        self.apply();self.comp.live_values['external']=94
        state_before=copy.deepcopy(self.current)
        self.session('end')
        self.assert_formal()
        self.assertEqual(self.comp.live_values['external'],94)
        self.assertEqual(self.current,state_before)

    def test_second_editor_cannot_take_over_active_preview(self):
        self.apply();before=(self.comp.op('pixel_shader').text,copy.deepcopy(self.current))
        with self.assertRaisesRegex(RuntimeError,'[Cc]onflict|[Pp]review|session|owner'):
            self.apply('preview-session-B')
        self.assertEqual((self.comp.op('pixel_shader').text,self.current),before)

    def test_end_before_apply_tombstones_session_and_rejects_late_apply(self):
        self.session('end',sequence=8);before=copy.deepcopy(self.current)
        with self.assertRaisesRegex(RuntimeError,'[Cc]onflict|[Pp]review|session|expired'):
            self.apply(sequence=1)
        self.assertEqual(self.current,before)
        self.assert_formal()

    def test_old_apply_rejected_and_end_closes_entire_workspace_lifetime(self):
        self.apply(sequence=2);before=copy.deepcopy(self.current)
        with self.assertRaisesRegex(RuntimeError,'[Cc]onflict|sequence|[Pp]review'):
            self.apply(sequence=1)
        self.assertEqual(self.current,before)
        self.session('end',sequence=1)
        self.assert_formal()
        with self.assertRaisesRegex(RuntimeError,'session has ended'):self.apply(sequence=3)

    def test_old_workspace_end_cannot_terminate_new_workspace_preview(self):
        self.apply();self.session('end')
        self.apply('preview-session-B');active=self.comp.op('pixel_shader').text
        self.session('end',session=self.SESSION,sequence=99)
        self.assertEqual(self.comp.op('pixel_shader').text,active)
        self.assertTrue(self.session('heartbeat',session='preview-session-B')['active'])
        self.session('end',session='preview-session-B');self.assert_formal()

    def test_heartbeat_extends_lease_and_expiry_physically_restores(self):
        self.apply();self.now+=10;self.session('heartbeat')
        self.now+=10;r.service_pixel_previews()
        self.assertIn('sg_preview_color',self.comp.op('pixel_shader').text)
        self.now+=16;r.service_pixel_previews();self.assert_formal()

    def test_apply_cannot_revive_expired_lifetime_before_next_service_tick(self):
        self.apply();self.now+=16
        with self.assertRaisesRegex(RuntimeError,'session has ended|expired'):
            self.apply(sequence=2)
        self.assert_formal()

    def test_save_suspension_restores_formal_then_resumes_same_active_preview(self):
        self.apply();active=self.comp.op('pixel_shader').text
        r.suspend_pixel_previews();self.assert_formal()
        self.comp.live_values['external']=88
        r.resume_pixel_previews()
        self.assertEqual(self.comp.op('pixel_shader').text,active)
        self.assertEqual(self.comp.live_values['external'],88)
        self.session('end');self.assert_formal()

    def test_save_resume_does_not_reapply_stale_preview_after_source_structure_change(self):
        self.apply()
        formal_output=self.comp.fetch(r.PIXEL_PREVIEW_RECOVERY)['output']
        # Native source edit/history restoration can commit a newer document
        # before the browser has applied new generated output. The old Preview
        # lease must not rewrite that document or resume its stale bindings.
        newer=copy.deepcopy(self.current)
        next(d for d in newer['graph']['declarations'] if d['id']=='debug')['name']='uRenamed'
        newer['revision']+=1;newer['sourceChanged']=True
        self.write_state(newer)
        graph_dat_before=self.comp.op('graph').text
        self.comp.live_values['external']=123
        r.suspend_pixel_previews();r.resume_pixel_previews()
        self.assertEqual(self.current,newer)
        self.assertEqual(self.comp.op('graph').text,graph_dat_before)
        self.assertEqual(self.comp.op('pixel_shader').text,formal_output['pixel'])
        self.assertEqual(self.comp.op('manifest').text,formal_output['manifest'])
        self.assertEqual(self.comp.live_values['external'],123)
        self.assertFalse(self.session('heartbeat')['active'])

    def test_source_structure_change_invalidates_preview_at_heartbeat_or_service(self):
        for trigger in ('heartbeat','service'):
            with self.subTest(trigger=trigger):
                session='preview-structure-'+trigger
                self.apply(session=session)
                formal_output=self.comp.fetch(r.PIXEL_PREVIEW_RECOVERY)['output']
                newer=copy.deepcopy(self.current);newer['revision']+=1;newer['sourceChanged']=True
                next(d for d in newer['graph']['declarations'] if d['id']=='debug')['name']='u_'+trigger
                self.write_state(newer)
                if trigger=='heartbeat':self.assertFalse(self.session('heartbeat',session=session)['active'])
                else:r.service_pixel_previews()
                self.assertEqual(self.current,newer)
                self.assertEqual(self.comp.op('pixel_shader').text,formal_output['pixel'])
                self.assertFalse(self.session('heartbeat',session=session)['active'])

    def test_nested_save_and_expired_suspension_never_resume_too_early(self):
        self.apply()
        r.suspend_pixel_previews();r.suspend_pixel_previews();self.assert_formal()
        r.resume_pixel_previews();self.assert_formal()
        self.now+=16;r.resume_pixel_previews();self.assert_formal()
        self.assertFalse(self.session('heartbeat')['active'])

    def test_restore_retries_after_native_failure_instead_of_declaring_success(self):
        self.apply();self.now+=16
        restore=self.restore_output;attempts=[]
        def flaky(comp):
            attempts.append(comp.id)
            if len(attempts)==1:raise RuntimeError('Temporary native restore failure')
            restore(comp)
        with patch.object(r,'restore_pixel_preview_output',flaky):
            r.service_pixel_previews()
            self.assertIn('sg_preview_color',self.comp.op('pixel_shader').text)
            r.service_pixel_previews()
        self.assertEqual(attempts,[self.comp.id,self.comp.id]);self.assert_formal()

    def test_failed_save_preparation_does_not_strand_suspend_depth(self):
        self.apply()
        with patch.object(r,'restore_pixel_preview_output',side_effect=RuntimeError('Restore blocked')):
            with self.assertRaisesRegex(RuntimeError,'Restore blocked'):r.suspend_pixel_previews()
        self.assertEqual(r._pixel_preview_save_depth,0)
        r.suspend_pixel_previews();self.assert_formal()
        r.resume_pixel_previews()
        self.assertIn('sg_preview_color',self.comp.op('pixel_shader').text)

    def test_shader_local_recovery_survives_loss_of_manager_session_registry(self):
        self.apply();self.comp.live_values['external']=107
        r._pixel_previews.clear()  # Simulate manager module reload, native storage survives.
        r.restore_pixel_preview(self.comp)
        self.assert_formal();self.assertEqual(self.comp.live_values['external'],107)

    def test_manager_stop_restores_formal_output_before_return(self):
        self.apply()
        with patch.object(r,'_server',None),patch.object(r,'_worker',None),patch.object(r,'_live',None):r.stop()
        self.assert_formal()
        self.assertFalse(self.session('heartbeat')['active'])

    def test_failed_candidate_does_not_persist_graph_or_activate_preview(self):
        self.fail_validation='active_candidate';before=copy.deepcopy(self.current)
        with self.assertRaisesRegex(RuntimeError,'Injected active native validation failure'):self.apply()
        self.assertEqual(self.current,before);self.assert_formal()
        self.assertTrue(self.created and all(not scene.valid for scene in self.created))

    def test_failed_active_destination_restores_previous_formal_shader_and_state(self):
        self.fail_validation='active_shader';before=copy.deepcopy(self.current)
        with self.assertRaisesRegex(RuntimeError,'Injected active native validation failure'):self.apply()
        self.assertEqual(self.current,before);self.assert_formal()
        self.assertEqual(self.comp.live_values['external'],9)
        self.assertFalse(self.session('heartbeat')['active'])


if __name__=='__main__':unittest.main()
