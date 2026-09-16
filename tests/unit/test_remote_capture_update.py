"""Source edits must settle before capture, without losing preview ownership."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import unittest


class Parameter:
    def __init__(self, value):
        self.value = value

    def eval(self):
        return self.value


class Parameters:
    def __init__(self, **values):
        for name, value in values.items():
            object.__setattr__(self, name, Parameter(value))

    def __setattr__(self, name, value):
        parameter = getattr(self, name, None)
        if isinstance(parameter, Parameter):
            parameter.value = value
        else:
            object.__setattr__(self, name, value)


class Capture:
    valid = True

    def __init__(self):
        self._locked = False
        self.fail_lock = False
        self.cook = Mock()

    @property
    def lock(self):
        return self._locked

    @lock.setter
    def lock(self, value):
        if self.fail_lock:
            self.fail_lock = False
            raise RuntimeError('Native lock failed')
        self._locked = value


class RemoteCaptureUpdateTests(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).resolve().parents[2] / 'src/remote_panel/runtime.py'
        spec = importlib.util.spec_from_file_location('remote_capture_test', path)
        self.r = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.r)
        self.target = SimpleNamespace(valid=True, path='/material')
        self.other = SimpleNamespace(valid=True, path='/other')
        self.image = Capture()
        self.video = SimpleNamespace(valid=True, par=Parameters(active=True, webrtcconnection='peer'), cook=Mock())
        self.rtc = Mock()
        self.rtc.getConnectionState.return_value = 'connected'
        self.server = Mock()
        self.nodes = {'panel_image': self.image, 'video_out': self.video,
                      'webrtc': self.rtc, 'web_server': self.server}
        self.owner = SimpleNamespace(par=Parameters(Source='viewer', Targetop=self.target,
                                                    Framerate=30, Active=True), op=self.nodes.get)
        self.r.owner = lambda: self.owner
        self.r._panel = SimpleNamespace(valid=True)
        self.r.source_panel = lambda: self.r._panel
        self.r.metadata = lambda: {}
        self.r.send = Mock()
        self.r._connection = 'peer'
        self.r._client = 'browser'
        self.r._started = True
        self.r._last_seen = self.r._last_tick = 100
        # Deliberately frozen: release must follow TD callbacks, not elapsed time.
        self.r.time = SimpleNamespace(monotonic=lambda: 100)

    def test_exact_source_hold_releases_after_draw_callbacks_without_reconnecting(self):
        self.assertIsNone(self.r.begin_source_update(self.other))
        self.assertFalse(self.image.lock)
        token = self.r.begin_source_update(self.target)
        self.assertTrue(self.image.lock)
        self.assertFalse(self.video.par.active.eval())
        for _ in range(4):
            self.r.tick()
        self.image.cook.assert_not_called()
        self.video.cook.assert_not_called()
        self.r.end_source_update(token)
        self.r.tick()
        self.r.tick()
        self.r.tick()
        self.assertTrue(self.image.lock)
        self.image.cook.assert_not_called()
        self.r.tick()
        self.assertFalse(self.image.lock)
        self.assertTrue(self.video.par.active.eval())
        self.image.cook.assert_called_once_with(force=True)
        self.video.cook.assert_called_once_with(force=True)
        self.assertEqual(self.r._connection, 'peer')
        self.rtc.openConnection.assert_not_called()
        self.rtc.closeConnection.assert_not_called()

    def test_resize_during_hold_does_not_restart_stream(self):
        token = self.r.begin_source_update(self.target)
        self.r.refresh_source()
        self.assertTrue(self.image.lock)
        self.assertFalse(self.video.par.active.eval())
        self.r.end_source_update(token)
        for _ in range(4):
            self.r.tick()
        self.assertTrue(self.video.par.active.eval())
        self.assertEqual(self.r._connection, 'peer')

    def test_overlapping_updates_wait_for_final_completion_and_ignore_old_tokens(self):
        first = self.r.begin_source_update(self.target)
        self.r.end_source_update(first)
        self.r.tick()
        second = self.r.begin_source_update(self.target)
        for _ in range(5):
            self.r.tick()
        self.assertTrue(self.image.lock)
        self.r.end_source_update(first)
        self.r.end_source_update(second)
        for _ in range(4):
            self.r.tick()
        self.assertFalse(self.image.lock)
        self.image.cook.assert_called_once()

    def test_source_takeover_restores_lock_and_old_token_cannot_release_new_hold(self):
        old = self.r.begin_source_update(self.target)
        self.owner.par.Targetop = self.other
        self.r.refresh_source()
        self.assertFalse(self.image.lock)
        self.assertTrue(self.video.par.active.eval())
        new = self.r.begin_source_update(self.other)
        self.r.end_source_update(old)
        for _ in range(4):
            self.r.tick()
        self.assertTrue(self.image.lock)
        self.r.end_source_update(new)
        for _ in range(4):
            self.r.tick()
        self.assertFalse(self.image.lock)

    def test_disconnect_and_stop_restore_lock_without_reviving_peer(self):
        for method in ('disconnect', 'stop', 'restart'):
            with self.subTest(method=method):
                self.setUp()
                token = self.r.begin_source_update(self.target)
                getattr(self.r, method)()
                self.assertFalse(self.image.lock)
                self.assertFalse(self.video.par.active.eval())
                self.assertIsNone(self.r._connection)
                self.r.end_source_update(token)
                self.r._started = True
                for _ in range(3):
                    self.r.tick()
                self.assertFalse(self.video.par.active.eval())
                self.image.cook.assert_not_called()
                self.rtc.closeConnection.assert_called_once_with('peer')

    def test_existing_lock_and_inactive_stream_are_preserved(self):
        self.r._connection = self.r._client = None
        self.image.lock = True
        self.video.par.active = False
        token = self.r.begin_source_update(self.target)
        self.r.end_source_update(token)
        for _ in range(4):
            self.r.tick()
        self.assertTrue(self.image.lock)
        self.assertFalse(self.video.par.active.eval())
        self.image.cook.assert_not_called()

    def test_disconnect_still_closes_peer_when_native_unlock_raises(self):
        self.r.begin_source_update(self.target)
        self.image.fail_lock = True
        with self.assertRaisesRegex(RuntimeError, 'Native lock failed'):
            self.r.disconnect()
        self.assertIsNone(self.r._connection)
        self.assertFalse(self.video.par.active.eval())
        self.assertEqual(self.video.par.webrtcconnection.eval(), '')
        self.rtc.closeConnection.assert_called_once_with('peer')
        self.server.webSocketClose.assert_called_once_with('browser')

    def test_stop_still_disables_services_when_native_unlock_raises(self):
        self.r.begin_source_update(self.target)
        self.image.fail_lock = True
        with self.assertRaisesRegex(RuntimeError, 'Native lock failed'):
            self.r.stop()
        self.assertFalse(self.server.par.active)
        self.assertFalse(self.rtc.par.active)
        self.assertFalse(self.video.par.active.eval())
        self.assertEqual(self.r._status, 'Stopped')

    def test_native_lock_error_restores_stream_and_leaves_no_hold(self):
        self.image.fail_lock = True
        with self.assertRaisesRegex(RuntimeError, 'Native lock failed'):
            self.r.begin_source_update(self.target)
        self.assertFalse(self.image.lock)
        self.assertTrue(self.video.par.active.eval())
        self.assertIsNone(self.r._source_update)
        self.r.tick()
        self.image.cook.assert_called_once()

    def test_failed_mutation_can_settle_in_finally_and_capture_original_source(self):
        token = self.r.begin_source_update(self.target)
        try:
            raise ValueError('Validation rejected source')
        except ValueError:
            pass
        finally:
            self.r.end_source_update(token)
        for _ in range(4):
            self.r.tick()
        self.assertIs(self.owner.par.Targetop.eval(), self.target)
        self.assertFalse(self.image.lock)
        self.image.cook.assert_called_once()


if __name__ == '__main__':
    unittest.main()
