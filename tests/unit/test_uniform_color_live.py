"""Atomic live Color sessions share scalar fencing and keep one popup receipt."""
import copy
import json
import subprocess
import unittest
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import sgrape_live as live_module
import sgrape_sources as sources
import test_history as fixtures


class UniformColorLive(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.History();self.f.setUp();self.addCleanup(self.f.doCleanups)
        f=self.f;f.operator.valid=True;f.runtime.shader_context=lambda _:nullcontext()
        self.counts={'write':0,'scalar_undo':0};self.callbacks=[]
        def write(p,value):self.counts['write']+=1;p.val=value
        f.runtime._set_parameter_without_native_capture=write
        f.runtime.record_parameter_undo=lambda *a,**k:self.counts.__setitem__('scalar_undo',self.counts['scalar_undo']+1)
        undo=SimpleNamespace(globalState=True,startBlock=lambda *a:None,endBlock=lambda:None,addCallback=lambda fn,data:self.callbacks.append((fn,data)))
        self.ui=SimpleNamespace(undo=undo)
        self.patch=patch.object(live_module,'ui',self.ui,create=True);self.patch.start();self.addCleanup(self.patch.stop)
        block=f.operator.seq.color.blocks[0];block['name'].val='uColor'
        for i,suffix in enumerate(sources.CHANNELS['color']):block[suffix].val=(i+1)/10
        f.storage[sources.STORE]['C']={'sequence':'color','index':0,'name':'uColor'}
        f.current['graph']['declarations'].append(dict(id='C',kind='uniform',name='uColor',type='vec4',nativeSequence='color',value=None))
        for seq in f.operator.sequences.values():
            for row in seq.blocks:
                for p in row.values():p.min=0;p.max=1;p.clampMin=False;p.clampMax=False
        self.messages=[]
        server=SimpleNamespace(webSocketSendText=lambda client,text:self.messages.append(json.loads(text)))
        self.live=live_module.Live(f.runtime,server,False)
        self.source=live_module.Source(self.live,f.comp,'C')
        self.live.clients['one']=self.session()

    def session(self):return dict(comp=self.f.comp,identity=self.f.comp.id,gesture=None,sources={'C':self.source},source=self.source,seen=0,last={})
    def send(self,kind,client='one',**body):
        self.live.message(client,json.dumps(dict(type=kind,request=len(self.messages),**body)))
        return self.messages[-1]
    def begin(self,**kw):return self.send('begin',source='C',components=[0,1,2,3],expected=self.source.values(),**kw)
    def values(self):return [p.val for p in self.source.pars]

    def test_many_previews_one_receipt_and_atomic_browser_native_history(self):
        initial=self.values();before=copy.deepcopy(self.f.current);self.assertNotIn('error',self.begin())
        for n in range(100):self.assertNotIn('error',self.send('update',sequence=n,value=[n/100,.4,.5,.6]))
        self.assertEqual(self.callbacks,[])
        reply=self.send('commit',sequence=100,value=[.91,.42,.53,.64]);self.assertNotIn('error',reply)
        self.assertEqual(len(self.callbacks),1);self.assertEqual(self.counts['scalar_undo'],0)
        self.assertEqual(self.f.current,before)
        receipt=reply['receipt'];self.live.restore(self.f.comp,dict(receipt=receipt,undo=True));self.assertEqual(self.values(),initial)
        self.live.restore(self.f.comp,dict(receipt=receipt,undo=False));self.assertEqual(self.values(),[.91,.42,.53,.64])
        fn,data=self.callbacks[0];fn(True,data);self.assertEqual(self.values(),initial)
        fn(False,data);self.assertEqual(self.values(),[.91,.42,.53,.64])

    def test_cancel_restores_opening_color_without_history(self):
        initial=self.values();self.begin();self.send('update',sequence=0,value=[.8,.7,.6,.5])
        reply=self.send('cancel');self.assertIsNone(reply['receipt']);self.assertEqual(self.values(),initial);self.assertEqual(self.callbacks,[])
        self.assertTrue(reply['cancelled']);self.assertEqual(reply['value'],initial)
        self.assertEqual([item['value'] for item in reply['components']],initial)
        self.assertNotIn('cancelConflict',reply)

    def test_cancel_without_local_edits_reports_already_broadcast_external_color(self):
        initial=self.values();self.assertNotIn('error',self.begin())
        # TD changed independently after the popup opened. The subscription has
        # already published it, so it need not send the same value again later.
        self.source.pars[1].val=.876543210987
        outside=self.values();self.assertNotEqual(outside,initial)
        self.live.clients['one']['last']['C']=self.source.values()
        published=copy.deepcopy(self.live.clients['one']['last']['C'])
        writes=self.counts['write'];reply=self.send('cancel')
        self.assertNotIn('error',reply)
        self.assertFalse(reply['cancelled'])
        self.assertIn('outside this gesture',reply['cancelConflict'])
        self.assertIsNone(reply['receipt'],'No local change must not create an Undo step')
        self.assertEqual(self.values(),outside)
        self.assertEqual(self.counts['write'],writes,'Failed CAS must not restore any channel')
        self.assertEqual(reply['value'],outside)
        self.assertEqual(reply['components'],published,'Cancel returns actual TD state, not its opening value')
        self.assertEqual(self.callbacks,[])
        self.assertEqual(self.counts['scalar_undo'],0)
        self.assertIsNone(self.live.clients['one']['gesture'])

    def test_external_component_edit_prevents_every_cancel_write(self):
        self.begin();self.send('update',sequence=0,value=[.8,.7,.6,.5]);self.source.pars[3].val=.25
        before=self.values();writes=self.counts['write'];reply=self.send('cancel')
        self.assertEqual(self.values(),before);self.assertEqual(self.counts['write'],writes)
        self.assertFalse(reply['cancelled']);self.assertEqual(reply['value'],before)
        self.assertEqual([item['value'] for item in reply['components']],before)
        self.assertIn('cancelConflict',reply)
        with self.assertRaises(RuntimeError):self.live.restore(self.f.comp,dict(receipt=reply['receipt'],undo=True))
        fn,data=self.callbacks[0];fn(True,data);self.assertTrue(data['blocked']);self.assertEqual(self.values(),before)

    def test_preflight_stale_alpha_driven_alpha_and_nan_write_nothing(self):
        stale=self.source.values();stale[3]['value']=42
        reply=self.send('begin',source='C',components=[0,1,2,3],expected=stale);self.assertIn('error',reply)
        self.source.pars[3].readOnly=True;self.assertIn('error',self.begin());self.source.pars[3].readOnly=False
        self.begin();before=self.values();reply=self.send('update',sequence=0,value=[.8,.7,.6,float('nan')])
        self.assertIn('error',reply);self.assertEqual(self.values(),before);self.assertEqual(self.counts['write'],0)

    def test_partial_set_failure_rolls_back_every_channel(self):
        initial=self.values();self.begin();original=self.f.runtime._set_parameter_without_native_capture
        def fail(p,v):
            if p is self.source.pars[2] and v==.9:raise RuntimeError('injected failure')
            original(p,v)
        self.f.runtime._set_parameter_without_native_capture=fail
        self.assertIn('error',self.send('update',sequence=0,value=[.9,.9,.9,.9]))
        self.assertEqual(self.values(),initial);self.assertEqual(self.callbacks,[])

    def test_shared_bind_master_conflicting_color_channels_write_nothing(self):
        master=fixtures.Par(self.f.comp,'Shared',.2)
        master.min=0;master.max=1;master.clampMin=False;master.clampMax=False
        self.f.comp.par.Shared=master
        for p in self.source.pars[:2]:p.bindExpr='parent().par.Shared';p.mode='BIND'
        self.assertNotIn('error',self.begin());writes=self.counts['write']
        reply=self.send('update',sequence=0,value=[.3,.4,.5,.6])
        self.assertIn('error',reply);self.assertEqual(master.val,.2);self.assertEqual(self.counts['write'],writes)

    def test_scalar_and_group_writers_fence_each_other(self):
        self.live.clients['two']=self.session();self.assertNotIn('error',self.begin())
        reply=self.send('begin',client='two',source='C',component=3,expected=self.source.values()[3]);self.assertIn('error',reply)
        self.send('cancel');self.assertNotIn('error',self.send('begin',client='two',source='C',component=3,expected=self.source.values()[3]))
        self.assertIn('error',self.begin());self.send('commit',client='two',sequence=0,value=.75)
        self.assertEqual(self.counts['scalar_undo'],1)

    def test_duplicate_component_and_out_of_order_rejected(self):
        reply=self.send('begin',source='C',components=[0,0],expected=self.source.values()[:2]);self.assertIn('error',reply)
        self.begin();self.send('update',sequence=4,value=[.8,.7,.6,.5]);before=self.values()
        self.assertIn('error',self.send('update',sequence=4,value=[.1,.2,.3,.4]));self.assertEqual(self.values(),before)

    def test_disconnect_seal_recovery_and_restore_idempotency(self):
        initial=self.values();ident='color-popup-disconnect-test'
        self.begin(gesture=ident);self.send('update',sequence=0,value=[.8,.7,.6,.5]);self.live.close('one')
        self.assertEqual(self.values(),[.8,.7,.6,.5]);self.assertEqual(len(self.callbacks),1)
        self.assertEqual(self.live.seal(self.f.comp,dict(gesture=ident)),{'receipt':ident})
        request=dict(receipt=ident,undo=True,requestId='restore-once')
        self.live.restore(self.f.comp,request);writes=self.counts['write'];self.live.restore(self.f.comp,request)
        self.assertEqual(self.counts['write'],writes);self.assertEqual(self.values(),initial)

    def test_binding_replacement_rejects_whole_group_and_restore_fences_writer(self):
        self.begin();reply=self.send('commit',sequence=0,value=[.8,.7,.6,.5]);receipt=reply['receipt']
        self.live.clients['two']=self.session()
        self.send('begin',client='two',source='C',component=0,expected=self.source.values()[0])
        with self.assertRaisesRegex(RuntimeError,'Another editor'):self.live.restore(self.f.comp,dict(receipt=receipt,undo=True))
        self.send('cancel',client='two');self.begin()
        self.source.pars[2].bindExpr='parent().par.Replaced'
        before=self.values();self.assertIn('error',self.send('update',sequence=0,value=[.1,.2,.3,.4]));self.assertEqual(self.values(),before)


if __name__=='__main__':unittest.main()
