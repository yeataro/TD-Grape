"""Delivery behavior without a TD process, Python core, or compiler import."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('host_artifact', ROOT / 'src/td/runtime/host_artifact.py')
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)


class HostArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Use actual built node modules and the actual TypeScript compiler.
        script = r'''
const fs=require('node:fs'),vm=require('node:vm');
const context={};vm.runInNewContext(fs.readFileSync('src/generated/wire_planning.js','utf8'),context);
const node=(key,id,params)=>({id,definitionUuid:'sgrape.builtin.'+key,params,ui:{x:0,y:0}});
const graph={schemaVersion:1,target:'top',declarations:[{id:'gain',kind:'uniform',name:'uGain',type:'float',value:0.25,expose:false}],functions:[],stages:{pixel:{nodes:[node('uniform','gain',{declarationId:'gain'}),node('pixel_out','out',{})],edges:[{id:'wire',from:['gain','out'],to:['out','color']}]}}};
const compiled=context.GrapeTopCompiler.compile(graph);
console.log(JSON.stringify({graph,compiled}));
'''
        result = subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True, text=True, check=True)
        cls.actual = json.loads(result.stdout)

    def setUp(self):
        self.body = {'graph': copy.deepcopy(self.actual['graph']), 'revision': 4,
            'frontendArtifact': {'protocol': host.PROTOCOL, 'targetId': 'target', 'baseRevision': 4,
                'snapshot': json.dumps(self.actual['graph']), 'catalogHash': 'a' * 64,
                'compiled': copy.deepcopy(self.actual['compiled'])}}

    def receive(self, body=None):
        return host.receive(self.body if body is None else body, target_id='target', revision=4, catalog_hash='a' * 64)

    def test_actual_frontend_result_roundtrips_without_a_python_core(self):
        candidate = self.receive()
        state = host.saved_state(candidate)
        restored = host.restore(json.dumps(state), target_id='target')
        self.assertEqual(restored['frontendArtifact']['compiled'], self.actual['compiled'])
        self.assertEqual(restored['revision'], 5)
        self.body['graph']['declarations'][0]['value'] = 0.9
        candidate['compiled']['pixel'] = 'changed after save'
        self.assertEqual(state['graph']['declarations'][0]['value'], .25)
        self.assertEqual(restored['frontendArtifact']['compiled']['pixel'], self.actual['compiled']['pixel'])

    def test_rejects_stale_delivery_and_mixed_snapshots(self):
        for field, value in [('targetId', 'other'), ('baseRevision', 3), ('baseRevision', True),
                             ('snapshot', '{}'), ('protocol', 'other'), ('catalogHash', 'b' * 64)]:
            changed = copy.deepcopy(self.body)
            changed['frontendArtifact'][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.receive(changed)

    def test_no_python_fallback_and_no_arbitrary_parameter_binding(self):
        without_artifact = copy.deepcopy(self.body)
        del without_artifact['frontendArtifact']
        with self.assertRaisesRegex(ValueError, 'no Python compiler fallback'):
            self.receive(without_artifact)
        for field, value in [('initialDriver', 'op("other")'), ('nativeSequence', 'matrix'),
                             ('name', 'TDInjected'), ('value', True), ('type', 'samplerBuffer')]:
            changed = copy.deepcopy(self.body)
            changed['frontendArtifact']['compiled']['bindings'][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.receive(changed)

    def test_saved_mismatch_preserves_original_and_does_not_recompile(self):
        saved = host.saved_state(self.receive())
        altered = copy.deepcopy(saved)
        altered['graph']['declarations'][0]['value'] = .75
        with self.assertRaisesRegex(ValueError, 'saved graph/artifact changed'):
            host.restore(json.dumps(altered), target_id='target')
        with self.assertRaisesRegex(ValueError, 'saved target mismatch'):
            host.restore(json.dumps(saved), target_id='other')
        self.assertEqual(saved['graph']['declarations'][0]['value'], .25)


if __name__ == '__main__':
    unittest.main()
