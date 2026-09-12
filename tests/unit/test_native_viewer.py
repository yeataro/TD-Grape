"""Native windows are opt-in actions scoped to a local editor request."""
import json
import types
from unittest.mock import Mock, patch
import test_lan_access

class NativeViewerTests(test_lan_access.LanTests):
    def test_local_post_requires_both_transport_and_browser_origin(self):
        origin='http://127.0.0.1:'+str(self.r._port)
        endpoint='/api/'+'a'*32+'/native-viewer'
        for body,headers in (({},{}),({'editorOrigin':origin},{}),({}, {'Origin':origin}),({'editorOrigin':'http://100.64.0.2:8765'},{'Origin':origin}),({'editorOrigin':origin},{'Origin':origin,'Forwarded':'for=192.168.1.4'})):
            self.assertEqual(self.request(path=endpoint,body=body,headers=headers)[0],403)
            self.assertEqual(self.state,self.original)
        self.assertEqual(self.request(path=endpoint,body={'editorOrigin':origin},headers={'Origin':origin})[0],200)
        self.assertEqual(self.request(path=endpoint,headers={'Origin':origin})[0],403)

    def test_remote_peer_or_destination_is_rejected(self):
        origin='http://127.0.0.1:1234';headers={'Origin':origin};body={'editorOrigin':origin}
        self.assertTrue(self.r.local_viewer_request('127.0.0.1','127.0.0.1','127.0.0.1:1234',headers,body))
        for peer,destination in [('192.168.1.2','127.0.0.1'),('127.0.0.1','192.168.1.2'),('100.64.0.2','100.64.0.2'),('unknown','127.0.0.1')]:
            self.assertFalse(self.r.local_viewer_request(peer,destination,'127.0.0.1:1234',headers,body))
        for name in ('Forwarded','X-Forwarded-For','X-Forwarded-Host','X-Forwarded-Proto'):
            self.assertFalse(self.r.local_viewer_request('127.0.0.1','127.0.0.1','127.0.0.1:1234',{**headers,name:''},body))

    def test_opens_requested_comp_and_reuses_viewer_without_applying_graph(self):
        comp=types.SimpleNamespace(path='/test/Grape_TOP1',openViewer=Mock())
        self.r._owner=self.owner;previous=self.r._shader
        with patch.object(self.r,'resolve_shader',return_value=comp) as resolve, patch.object(self.r,'deploy',side_effect=AssertionError('Must not compile')):
            for unused in range(2):
                reply=self.r.process_request('POST','/api/'+'a'*32+'/native-viewer',{})
                self.assertEqual(reply,{'opened':True,'target':comp.path})
                self.assertIs(self.r._shader,previous)
            resolve.assert_called_with('a'*32)
            self.assertEqual(comp.openViewer.call_count,2)
            comp.openViewer.assert_called_with(unique=False,borders=True)
