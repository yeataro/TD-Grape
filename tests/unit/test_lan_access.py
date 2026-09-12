"""Real HTTP listener tests, independent of TouchDesigner and firewall changes."""
import copy
import http.client
import importlib.util
import json
from pathlib import Path
import queue
import socket
import threading
import time
import types
import unittest
from unittest.mock import patch

class Parameter:
    def __init__(self,value=False):self.val=value
    def eval(self):return self.val

class Owner:
    def __init__(self):self.par=types.SimpleNamespace(Allowlan=Parameter());self.storage={}
    def fetch(self,key,default=None):return True if key=='sgrapeManager' else self.storage.get(key,default)
    def store(self,key,value):self.storage[key]=value

class LanTests(unittest.TestCase):
    def setUp(self):
        spec=importlib.util.spec_from_file_location('isolated_lan',Path(__file__).resolve().parents[2]/'src/td/runtime/sgrape_runtime.py')
        self.r=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.r)
        self.owner=Owner();self.state={'revision':7,'value':.25};self.original=copy.deepcopy(self.state)
        self.r.ensure_network_controls=lambda owner:None
        self.r.shaders=lambda:[];self.r.request_family_registration=lambda **kwargs:None
        self.r.update_network_links=lambda:None
        self.r.refresh_assets=lambda owner:setattr(self.r,'_assets',{'/':(b'editor','text/html')})
        self.r.start(self.owner)
        self.running=True
        def pump():
            while self.running:
                self.r._last_tick=time.monotonic()
                try:job=self.r._queue.get(timeout=.02)
                except queue.Empty:continue
                if job.get('canceled'):continue
                method,path,body=job['args']
                if method=='POST':self.state.update(body)
                job['result']=dict(self.state);job['done'].set()
        self.pump=threading.Thread(target=pump,daemon=True);self.pump.start()
    def tearDown(self):
        self.running=False;self.r.stop();self.pump.join(1)
    def request(self,address='127.0.0.1',path='/api/test/state',body=None,headers=None):
        conn=http.client.HTTPConnection(address,self.r._port,timeout=3)
        data=None if body is None else json.dumps(body)
        values={'X-Sgrape-Token':self.r._token}
        if body is not None:values['Content-Type']='application/json'
        values.update(headers or {})
        try:
            conn.request('GET' if body is None else 'POST',path,body=data,headers=values)
            response=conn.getresponse();return response.status,response.read()
        finally:conn.close()
    def test_default_is_loopback_and_requires_token(self):
        self.assertEqual(self.r._server.server_address[0],'127.0.0.1')
        self.assertEqual(self.request(path='/',headers={'X-Sgrape-Token':''})[0],200)
        self.assertEqual(self.request(headers={'X-Sgrape-Token':''})[0],401)
        self.assertEqual(self.request(headers={'X-Sgrape-Token':'\xe9'})[0],401)
        self.assertEqual(json.loads(self.request()[1]),self.original)
    def test_switch_keeps_port_session_queue_and_values(self):
        r=self.r;port,token,work=r._port,r._token,r._queue
        for enabled in (True,False,True,False):
            r.set_lan_enabled(enabled)
            self.assertEqual(r._server.server_address[0],'0.0.0.0' if enabled else '127.0.0.1')
            self.assertEqual((r._port,r._token),(port,token));self.assertIs(r._queue,work)
            self.assertEqual(json.loads(self.request()[1]),self.original)
            self.assertEqual(self.owner.par.Allowlan.eval(),enabled)
        self.assertEqual(r.PRODUCT_VERSION,'0.8.5')
    def test_wildcard_accepts_actual_destination_and_shared_writes(self):
        self.r.set_lan_enabled(True)
        self.assertEqual(self.request('127.0.0.2',body={'value':.75})[0],200)
        self.assertEqual(json.loads(self.request()[1])['value'],.75)
        self.assertEqual(self.request('127.0.0.2',headers={'Origin':'http://127.0.0.2:'+str(self.r._port)})[0],200)
        self.r.set_lan_enabled(False)
        with self.assertRaises(OSError):self.request('127.0.0.2')
        self.assertEqual(json.loads(self.request()[1])['value'],.75)
    def test_host_origin_and_cross_site_guards_in_both_modes(self):
        for enabled in (False,True):
            self.r.set_lan_enabled(enabled)
            for headers in ({'Host':'evil.invalid'},{'Origin':'http://evil.invalid'},{'Origin':'null'},{'Sec-Fetch-Site':'cross-site'},{'Host':'127.0.0.1:1'}):
                self.assertEqual(self.request(headers=headers)[0],403,headers)
            self.assertEqual(self.request(headers={'Transfer-Encoding':'chunked'})[0],400)
    def test_failed_bind_restores_previous_mode_without_port_drift(self):
        original_socket=socket.socket;first=[True]
        class FailingSocket(original_socket):
            def bind(sock,address):
                if address[0]=='0.0.0.0' and first[0]:
                    first[0]=False;raise OSError('Simulated bind failure')
                return super(FailingSocket,sock).bind(address)
        port,token=self.r._port,self.r._token
        self.owner.par.Allowlan.val=True
        with patch.object(socket,'socket',FailingSocket):
            with self.assertRaises(OSError):self.r.set_lan_enabled(True)
        self.assertFalse(self.owner.par.Allowlan.eval());self.assertFalse(self.r._lan_enabled)
        self.assertEqual((self.r._port,self.r._token),(port,token))
        self.assertEqual(self.request()[0],200)
    def test_queued_work_survives_rebind(self):
        self.running=False;self.pump.join(1)
        work={'args':('POST','/api/test/value',{'value':.5}),'done':threading.Event(),'lock':threading.Lock()}
        self.r._queue.put(work);self.r.set_lan_enabled(True)
        self.assertIs(self.r._queue.get_nowait(),work)
    def test_link_generation_has_real_address_and_preserves_shader(self):
        shader=types.SimpleNamespace(fetch=lambda key:'a'*32)
        expected='http://192.168.1.2:'+str(self.r._port)+'/shader/'+'a'*32+'/#'+self.r._token
        self.assertEqual(self.r.url(shader,address='192.168.1.2'),expected)
        self.assertIn('127.0.0.1',self.r.url(shader))

if __name__=='__main__':unittest.main()
