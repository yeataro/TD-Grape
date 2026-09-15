"""Source reservations must not disturb the shared peer until a valid takeover."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import unittest

class RemotePreviewTicketTests(unittest.TestCase):
    def setUp(self):
        spec=importlib.util.spec_from_file_location('remote_preview_test',Path(__file__).resolve().parents[2]/'src/remote_panel/runtime.py')
        self.r=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.r)
        self.current=SimpleNamespace(valid=True,path='/material')
        self.next=SimpleNamespace(valid=True,path='/other')
        self.nodes={name:Mock() for name in ('web_server','controls','webrtc','video_out')}
        self.nodes['webrtc'].openConnection.return_value='new-peer'
        self.owner=SimpleNamespace(par=SimpleNamespace(Source='viewer',Targetop=self.current),op=self.nodes.get)
        self.r.owner=lambda:self.owner
        self.r.allowed=lambda client:True
        self.r._client='old-browser';self.r._connection='old-peer'
        self.r.send=Mock()
        self.r.refresh_source=Mock()
        self.r.disconnect=Mock()
        self.r.time=SimpleNamespace(monotonic=lambda:100)

    def test_preparing_does_not_change_source_or_connection(self):
        self.r.prepare_viewer(self.next)
        self.assertIs(self.owner.par.Targetop,self.current)
        self.assertEqual(self.r._connection,'old-peer')
        self.r.disconnect.assert_not_called();self.r.refresh_source.assert_not_called()

    def test_new_connection_consumes_ticket_then_selects_source(self):
        token=self.r.prepare_viewer(self.next)
        self.r.ws_open('new-browser','/signal?ticket='+token)
        self.assertIs(self.owner.par.Targetop,self.next)
        self.assertEqual(self.r._client,'new-browser')
        self.assertEqual(self.r._connection,'new-peer')
        self.assertNotIn(token,self.r._launches)
        self.r.disconnect.assert_called_once()
        self.r.refresh_source.assert_called_once()
        self.r.ws_open('replay','/signal?ticket='+token)
        self.assertEqual(self.r._client,'new-browser')
        self.r.disconnect.assert_called_once()

    def test_expired_invalid_duplicate_or_removed_target_cannot_kick_peer(self):
        expired=self.r.prepare_viewer(self.next)
        removed=SimpleNamespace(valid=True)
        deleted=self.r.prepare_viewer(removed);removed.valid=False
        self.r.time=SimpleNamespace(monotonic=lambda:131)
        for query in ('ticket=wrong','ticket=','ticket='+expired,'ticket='+deleted,'ticket=a&ticket=b'):
            self.r.ws_open('intruder','/signal?'+query)
            self.assertEqual(self.r._client,'old-browser')
            self.assertIs(self.owner.par.Targetop,self.current)
        self.r.disconnect.assert_not_called();self.r.refresh_source.assert_not_called()

    def test_standalone_connect_preserves_selected_source(self):
        self.r.ws_open('standalone','/signal')
        self.assertIs(self.owner.par.Targetop,self.current)
        self.assertEqual(self.r._client,'standalone')

    def test_reservation_storage_is_bounded(self):
        for _ in range(80):self.r.prepare_viewer(self.next)
        self.assertEqual(len(self.r._launches),32)
        self.r.time=SimpleNamespace(monotonic=lambda:131)
        self.r.prepare_viewer(self.current)
        self.assertEqual(len(self.r._launches),1)

if __name__=='__main__':unittest.main()
