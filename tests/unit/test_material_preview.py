"""MAT capture waits for TD drawing without blocking the request pump."""
import importlib.util
from pathlib import Path
import threading
import types
import unittest
from unittest.mock import Mock


class MaterialPreviewTests(unittest.TestCase):
    def setUp(self):
        spec=importlib.util.spec_from_file_location('preview_runtime',Path(__file__).resolve().parents[2]/'src/td/runtime/sgrape_runtime.py')
        self.r=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.r)
        self.r.service_network=Mock();self.r.service_family_startup=Mock()
        self.r.absTime=types.SimpleNamespace(frame=10)
        self.comp=types.SimpleNamespace(valid=True)
        self.top=types.SimpleNamespace(valid=True)
        self.r.material_preview=Mock(return_value=self.top)
        self.r.png=Mock(return_value=b'png')

    def job(self,path='preview'):
        value={'args':('GET','/api/test/'+path,{}),'done':threading.Event(),'lock':threading.Lock()}
        self.r._queue.put_nowait(value)
        return value

    def defer(self,*args):
        raise self.r._PreviewFramePending(self.comp,self.top,self.r.absTime.frame)

    def test_waits_for_viewer_drawing_and_leaves_other_requests_running(self):
        self.r.process_request=Mock(side_effect=lambda method,path,body:self.defer() if path.endswith('preview') else {'ok':True})
        image=self.job();state=self.job('state')
        self.r.tick()
        self.assertFalse(image['done'].is_set());self.assertTrue(state['done'].is_set())
        self.r.tick();self.r.png.assert_not_called()
        self.r.absTime.frame=11;self.r.tick();self.r.png.assert_not_called()
        self.r.absTime.frame=12;self.r.tick()
        self.assertEqual(image['result'],b'png');self.assertTrue(image['done'].is_set())
        self.r.png.assert_called_once_with(self.comp)

    def test_canceled_capture_does_not_read_gpu(self):
        self.r.process_request=self.defer
        image=self.job();self.r.tick();image['canceled']=True
        self.r.absTime.frame=12;self.r.tick()
        self.r.png.assert_not_called();self.assertTrue(self.r._queue.empty())

    def test_removed_shader_returns_an_error_instead_of_capturing_another(self):
        self.r.process_request=self.defer
        image=self.job();self.r.tick();self.comp.valid=False
        self.r.absTime.frame=12;self.r.tick()
        self.assertIn('no longer exists',image['error']['error'])
        self.assertTrue(image['done'].is_set());self.r.png.assert_not_called()

    def test_capture_error_completes_the_job(self):
        self.r.process_request=self.defer
        image=self.job();self.r.tick();self.r.png.side_effect=RuntimeError('capture failed')
        self.r.absTime.frame=12;self.r.tick()
        self.assertEqual(image['error']['error'],'capture failed')
        self.assertTrue(image['done'].is_set())

    def test_missing_target_keeps_the_empty_preview_response(self):
        self.r.target=lambda:None
        self.assertEqual(self.r.process_shader_request('GET','/api/preview',{}),b'')

    def test_top_and_normal_requests_are_still_immediate(self):
        self.r.process_request=Mock(return_value=b'top')
        image=self.job();self.r.tick()
        self.assertEqual(image['result'],b'top');self.assertTrue(image['done'].is_set())

    def test_replaced_capture_is_not_used_for_pending_request(self):
        self.r.process_request=self.defer
        image=self.job();self.r.tick();self.r.material_preview.return_value=object()
        self.r.absTime.frame=12;self.r.tick()
        self.assertIn('changed',image['error']['error']);self.r.png.assert_not_called()


if __name__=='__main__':unittest.main()
