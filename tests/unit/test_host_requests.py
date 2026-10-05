import concurrent.futures
import http.client
import json
import threading
import time
import unittest

from host_requests import HostRequests
from test_editor_service import service, bundle


class HostRequestsTests(unittest.TestCase):
    def wait_pending(self, queue):
        deadline = time.monotonic() + 1
        while time.monotonic() < deadline:
            with queue._lock:
                if queue._pending:
                    return
            time.sleep(.001)
        self.fail('worker did not enqueue')

    def test_idle_does_not_enter_host_and_worker_only_receives_main_thread_result(self):
        queue = HostRequests()
        main = threading.get_ident()
        calls = []
        def dispatch(method, path, body):
            self.assertEqual(threading.get_ident(), main)
            calls.append((method, path, body))
            return 200, {'applied': body['value']}
        for _ in range(1000):
            self.assertEqual(queue.drain(dispatch), 0)
        self.assertEqual(calls, [])
        with concurrent.futures.ThreadPoolExecutor() as executor:
            pending = executor.submit(queue.request, 'POST', '/api/apply', {'value': 3})
            self.wait_pending(queue)
            self.assertEqual(queue.drain(dispatch), 1)
            self.assertEqual(pending.result(), (200, {'applied': 3}))
        self.assertEqual(len(calls), 1)

    def test_timeout_cancels_queued_action_and_close_releases_waiter(self):
        queue = HostRequests(timeout=.01)
        status, result = queue.request('POST', '/api/apply', {})
        self.assertEqual((status, result['code']), (503, 'manager_not_responding'))
        self.assertEqual(queue.drain(lambda *args:self.fail('expired action executed')), 0)
        queue.timeout = 1
        with concurrent.futures.ThreadPoolExecutor() as executor:
            pending = executor.submit(queue.request, 'POST', '/api/apply', {})
            self.wait_pending(queue)
            queue.close()
            self.assertEqual(pending.result()[1]['code'], 'manager_unavailable')
        self.assertEqual(queue.request('GET', '/api/state', None)[1]['code'], 'manager_unavailable')

    def test_running_timeout_reports_uncertainty_without_repeating(self):
        queue = HostRequests(timeout=.01)
        calls = []
        def dispatch(*args):
            calls.append(args)
            time.sleep(.03)
            return 200, {'ok': True}
        with concurrent.futures.ThreadPoolExecutor() as executor:
            pending = executor.submit(queue.request, 'POST', '/api/apply', {})
            self.wait_pending(queue)
            queue.drain(dispatch)
            self.assertEqual(pending.result()[1]['code'], 'application_outcome_unknown')
        queue.drain(dispatch)
        self.assertEqual(len(calls), 1)
        self.assertEqual(queue.outcomes()[0]['status'], 200)

    def test_late_failure_keeps_original_diagnostic_after_waiter_leaves(self):
        queue = HostRequests(timeout=.01)
        def dispatch(*args):
            time.sleep(.03)
            raise RuntimeError('GPU rejected late candidate')
        with concurrent.futures.ThreadPoolExecutor() as executor:
            pending = executor.submit(queue.request, 'POST', '/api/shader/target/apply', {'privateGraph': {}})
            self.wait_pending(queue)
            queue.drain(dispatch)
            receipt = pending.result()[1]
        outcome = queue.outcomes()[0]
        self.assertEqual(outcome['requestId'], receipt['requestId'])
        self.assertEqual(outcome['error'], 'GPU rejected late candidate')
        self.assertIn('RuntimeError: GPU rejected late candidate', outcome['traceback'])
        self.assertNotIn('privateGraph', json.dumps(outcome))

    def test_main_thread_checks_expiry_even_if_waiting_worker_has_not_resumed(self):
        queue = HostRequests(timeout=1)
        with concurrent.futures.ThreadPoolExecutor() as executor:
            pending = executor.submit(queue.request, 'POST', '/api/apply', {})
            self.wait_pending(queue)
            with queue._lock:
                queue._pending[0]['deadline'] = time.monotonic() - .01
            self.assertEqual(queue.drain(lambda *args:self.fail('expired action executed')), 0)
            self.assertEqual(pending.result()[1]['code'], 'manager_not_responding')

    def test_bounded_queue_and_errors_retain_operation_context(self):
        queue = HostRequests(capacity=1)
        def fail(*args):
            raise RuntimeError('Native binding rejected')
        with concurrent.futures.ThreadPoolExecutor() as executor:
            pending = executor.submit(queue.request, 'POST', '/api/apply', {})
            self.wait_pending(queue)
            self.assertEqual(queue.request('POST', '/api/other', {})[1]['code'], 'manager_busy')
            queue.drain(fail)
            status, result = pending.result()
            self.assertEqual((status, result['operation'], result['error']),
                             (500, 'POST /api/apply', 'Native binding rejected'))

    def test_real_http_hands_json_to_main_thread_without_blocking_static_assets(self):
        queue = HostRequests()
        server = service.EditorHTTP(service.AssetSnapshot(bundle(), 'embedded'), port=0)
        server.connect(queue)
        def request(path, method='GET', data=None):
            client = http.client.HTTPConnection('127.0.0.1', server.port, timeout=2)
            try:
                client.request(method, path, body=json.dumps(data) if data is not None else None,
                               headers={'Content-Type': 'application/json'})
                response = client.getresponse()
                return response.status, response.read()
            finally:
                client.close()
        try:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                pending = executor.submit(request, '/api/apply', 'POST', {'revision': 1})
                self.wait_pending(queue)
                self.assertEqual(request('/nested/app.js'), (200, b'/* static */'))
                def dispatch(method, path, body):
                    self.assertEqual((method, path, body), ('POST', '/api/apply', {'revision': 1}))
                    return 200, {'ok': True}
                queue.drain(dispatch)
                self.assertEqual(json.loads(pending.result()[1]), {'ok': True})
            self.assertEqual(request('/api/apply', 'POST', [1])[0], 400)
            self.assertEqual(request('/api/state', 'HEAD')[0], 405)
        finally:
            server.close()


if __name__ == '__main__':
    unittest.main()
