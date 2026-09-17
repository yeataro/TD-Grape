"""Share discovery reports listener choices and preserves existing API guards."""
import copy
import json
from pathlib import Path
import queue
import socket
import threading
import time
import types
import unittest
from unittest.mock import patch

import test_lan_access


class ShareLinkTests(unittest.TestCase):
    request = test_lan_access.LanTests.request
    tearDown = test_lan_access.LanTests.tearDown

    def setUp(self):
        test_lan_access.LanTests.setUp(self)
        self.running = False
        self.pump.join(1)
        self.running = True
        self.shader = types.SimpleNamespace(path='/test/Grape_TOP1', fetch=lambda key: 'a' * 32)
        def resolve(identity):
            if identity != 'a' * 32:
                raise RuntimeError('Unknown Shader')
            return self.shader
        self.r.resolve_shader = resolve
        self.endpoint = '/api/' + 'a' * 32 + '/share-links'

        def pump():
            while self.running:
                self.r._last_tick = time.monotonic()
                try:
                    job = self.r._queue.get(timeout=.02)
                except queue.Empty:
                    continue
                if job.get('canceled'):
                    continue
                try:
                    job['result'] = self.r.process_request(*job['args'])
                except Exception as error:
                    job['error'] = {'error': str(error)}
                job['done'].set()

        self.pump = threading.Thread(target=pump, daemon=True)
        self.pump.start()

    def test_local_mode_omits_network_inventory_and_all_credentials(self):
        before = copy.deepcopy(self.state)
        with patch.object(self.r, 'network_addresses', side_effect=AssertionError('LAN is disabled')):
            code, raw = self.request(path=self.endpoint)
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(raw), {
            'origins': [{'origin': 'http://127.0.0.1:' + str(self.r._port), 'kind': 'local'}],
            'lanEnabled': False, 'tokenRequired': False, 'shaderPath': '/shader/' + 'a' * 32 + '/',
        })
        self.assertNotIn(self.r._token.encode(), raw)
        self.assertNotIn(b'#', raw)
        self.assertEqual(self.state, before)

    def test_enabled_lan_reports_inventory_with_existing_port(self):
        self.r.set_lan_enabled(True)
        with patch.object(self.r, 'network_addresses', return_value=['100.64.0.2', '192.168.1.2']):
            code, raw = self.request(path=self.endpoint)
        self.assertEqual(code, 200)
        result = json.loads(raw)
        self.assertTrue(result['lanEnabled'])
        self.assertEqual(result['origins'], [
            {'origin': 'http://' + address + ':' + str(self.r._port), 'kind': kind}
            for address, kind in [('127.0.0.1', 'local'), ('100.64.0.2', 'lan'), ('192.168.1.2', 'lan')]
        ])
        with patch.object(self.r, 'network_addresses', return_value=[]):
            result = json.loads(self.request(path=self.endpoint)[1])
        self.assertTrue(result['lanEnabled'])
        self.assertEqual(len(result['origins']), 1)

    def test_real_http_preserves_token_host_origin_and_get_only_guards(self):
        self.owner.par.Requiretoken.val = True
        self.r.service_network()
        for supplied in (None, '', 'wrong-token'):
            self.assertEqual(self.request(path=self.endpoint, headers={'X-Sgrape-Token': supplied})[0], 401)
        code, raw = self.request(path=self.endpoint)
        self.assertEqual(code, 200)
        self.assertTrue(json.loads(raw)['tokenRequired'])
        self.assertNotIn(self.r._token.encode(), raw)
        for headers in ({'Host': 'localhost:' + str(self.r._port)}, {'Origin': 'http://evil.invalid'}, {'Sec-Fetch-Site': 'cross-site'}):
            self.assertEqual(self.request(path=self.endpoint, headers=headers)[0], 403)
        self.assertEqual(self.request(path=self.endpoint, body={})[0], 422)
        self.assertEqual(self.request(path='/api/' + 'b' * 32 + '/share-links')[0], 422)
        self.assertEqual(self.state, self.original)
        self.owner.par.Requiretoken.val = False
        self.r.service_network()
        code, raw = self.request(path=self.endpoint, headers={'X-Sgrape-Token': None})
        self.assertEqual(code, 200)
        self.assertFalse(json.loads(raw)['tokenRequired'])

    def test_discovery_keeps_graph_shader_context_and_session(self):
        previous = self.r._shader
        session = self.r._token, self.r._port, self.r._queue
        with patch.object(self.r, 'deploy', side_effect=AssertionError('No graph writes')):
            self.r.process_request('GET', self.endpoint, {})
        self.assertIs(self.r._shader, previous)
        self.assertEqual((self.r._token, self.r._port, self.r._queue), session)
        self.assertEqual(self.state, self.original)

    def test_legacy_single_shader_keeps_unscoped_root_route(self):
        with patch.object(self.owner, 'fetch', return_value=False):
            result = self.r.process_request('GET', '/api/share-links', {})
        self.assertEqual(result['shaderPath'], '/')
        self.assertFalse(result['lanEnabled'])

    def test_inventory_uses_server_ipv4_and_filters_unshareable_addresses(self):
        addresses = ['192.168.2.1', '100.64.0.2', '192.168.2.1', '127.0.0.1', '169.254.1.2', '0.0.0.0']
        records = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (address, 0)) for address in addresses]
        with patch.object(socket, 'getaddrinfo', return_value=records) as discover:
            self.assertEqual(self.r.network_addresses(), ['100.64.0.2', '192.168.2.1'])
            self.assertEqual(discover.call_args.args[2:], (socket.AF_INET, socket.SOCK_STREAM))
        with patch.object(socket, 'getaddrinfo', side_effect=OSError('No interface found')):
            self.assertEqual(self.r.network_addresses(), [])

    def test_editor_assets_have_embedded_routes_and_source_mappings(self):
        root = Path(__file__).resolve().parents[2]
        source_files = json.loads((root / 'src/td/source_files.json').read_text(encoding='utf-8'))
        embedded = json.loads((root / 'src/td/embedded_sources.json').read_text(encoding='utf-8'))
        assets = {name: types.SimpleNamespace(text=name) for name in ('index_html', 'app_js', 'style_css', 'locales_json', 'qrcode_js', 'share_ui_js')}
        # The HTTP fixture substitutes refresh_assets; load the source definition.
        namespace = {}
        source = (root / 'src/td/runtime/sgrape_runtime.py').read_text(encoding='utf-8')
        exec(compile(source, str(root / 'src/td/runtime/sgrape_runtime.py'), 'exec'), namespace)
        namespace['refresh_assets'](types.SimpleNamespace(op=assets.get))
        for name in ('qrcode', 'share_ui'):
            self.assertEqual(source_files[name + '.js'], 'src/editor/' + name + '.js')
            self.assertEqual(embedded[name + '_js'], name + '.js')
            content, mime = namespace['_assets']['/' + name + '.js']
            self.assertEqual(content, (name + '_js').encode())
            self.assertEqual(mime, 'text/javascript; charset=utf-8')


if __name__ == '__main__':
    unittest.main()
