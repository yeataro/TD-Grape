"""python tools/test_editor_launch.py [path to src/editor_launch.py]"""
from pathlib import Path
from unittest.mock import patch
import importlib.util,json,sys,unittest

source=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[2]/'src/td/runtime/editor_launch.py'
spec=importlib.util.spec_from_file_location('editor_launch',source);launch=importlib.util.module_from_spec(spec);spec.loader.exec_module(launch)
URL='http://127.0.0.1:8123/shader/abc/#session-with-%20-symbols'

class LaunchTests(unittest.TestCase):
    def setUp(self):self.opened=[];self.queue=[];self.calls=[]
    def schedule(self,fn,ms):self.queue.append(fn)
    def run_queue(self):
        while self.queue:self.queue.pop(0)()
    def start(self,code=None,detect=None,spawn_error=False,schedule=True):
        class Process:
            def poll(self):return code
        def spawn(command,**kwargs):
            if spawn_error:raise OSError('Cannot launch')
            self.calls.append((command,kwargs));return Process()
        with patch.object(launch,'app_command',return_value=['browser','--app='+URL]):
            return launch.open_editor(URL,self.opened.append,self.schedule if schedule else None,detect=detect or (lambda scheme:{}),spawn=spawn)
    def test_unknown_browser_does_not_spawn(self):
        result=launch.open_editor(URL,self.opened.append,self.schedule,detect=lambda scheme:{'system':'Windows','browser':'unknown'},spawn=lambda *a,**k:self.fail())
        self.assertEqual(self.opened,[URL]);self.assertEqual(result['mode'],'browser')
    def test_detection_failure_falls_back(self):
        self.start(detect=lambda scheme:(_ for _ in ()).throw(OSError('No association')));self.assertEqual(self.opened,[URL])
    def test_spawn_failure_falls_back(self):
        self.start(spawn_error=True);self.assertEqual(self.opened,[URL])
    def test_nonzero_exit_falls_back_once(self):
        result=self.start(code=1);self.run_queue();self.assertEqual(self.opened,[URL]);self.assertTrue(result['finished'])
    def test_handoff_zero_does_not_duplicate_browser(self):
        self.start(code=0);self.run_queue();self.assertEqual(self.opened,[])
    def test_running_browser_is_nonblocking(self):
        result=self.start();self.assertFalse(result['finished']);self.run_queue();self.assertTrue(result['finished']);self.assertEqual(self.opened,[])
    def test_no_scheduler_uses_normal_browser(self):
        self.start(schedule=False);self.assertEqual(self.opened,[URL]);self.assertEqual(self.calls,[])
    def test_url_is_one_argument_without_shell(self):
        self.start(code=0);command,kwargs=self.calls[0];self.assertEqual(command,['browser','--app='+URL]);self.assertIs(kwargs['shell'],False)
    def test_mac_unverified_browsers_fall_back(self):
        for browser in ['chrome','safari','unknown']:
            self.assertIsNone(launch.app_command({'system':'Darwin','browser':browser},URL))
    def test_executable_must_exist(self):
        self.assertIsNone(launch.app_command({'system':'Windows','browser':'chrome','executable':'Z:/missing-chrome.exe'},URL))
    def test_unknown_chromium_forks_not_assumed_supported(self):
        self.assertIsNone(launch.app_command({'system':'Windows','browser':'brave','executable':__file__},URL))
    def test_invalid_scheme_never_launches(self):
        with self.assertRaises(ValueError):launch.open_editor('file:///unsafe',self.opened.append,self.schedule)
        self.assertEqual(self.opened,[])
    def test_late_startup_failure_falls_back(self):
        class Process:
            count=0
            def poll(self):self.count+=1;return None if self.count==1 else 1
        with patch.object(launch,'app_command',return_value=['browser','--app='+URL]):
            launch.open_editor(URL,self.opened.append,self.schedule,detect=lambda scheme:{},spawn=lambda *a,**k:Process())
        self.run_queue();self.assertEqual(self.opened,[URL])
    def test_normal_opener_error_is_not_silenced(self):
        with self.assertRaises(OSError):
            launch.open_editor(URL,lambda url:(_ for _ in ()).throw(OSError('Default browser unavailable')),self.schedule,detect=lambda scheme:{})

if __name__=='__main__':
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(LaunchTests)
    result=unittest.TextTestRunner(verbosity=1).run(suite)
    print(json.dumps({'passed':result.wasSuccessful(),'count':result.testsRun}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
