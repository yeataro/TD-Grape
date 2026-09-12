import copy
import json
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import sgrape_core as c
import sgrape_document as d
import sgrape_runtime as r


class SavedStateTests(unittest.TestCase):
    def raw(self,kind='mat'):
        return json.dumps({'revision':7,'graph':c.demo_graph('tint',target=kind),'appliedHash':'preserved','lastError':''},ensure_ascii=False)

    def check(self,raw,kind='mat'):
        return d.inspect_saved_state(raw,c,kind)

    def test_valid_text_is_not_normalized_or_migrated(self):
        for kind in ('mat','top'):
            raw=self.raw(kind);value=json.loads(raw)
            self.assertEqual(self.check(raw,kind)['state'],value)
            self.assertEqual(self.check(raw,kind)['status'],'valid')
        self.assertEqual(self.check(self.raw(),'top')['status'],'blocked')

    def test_invalid_envelopes_revisions_and_missing_dat(self):
        for raw in [None,'','{broken','null','[]','"text"','{}']:
            self.assertEqual(self.check(raw)['status'],'blocked',raw)
        for revision in [None,True,-1,1.5,2**53,'7']:
            value=json.loads(self.raw());value['revision']=revision
            self.assertEqual(self.check(json.dumps(value))['status'],'blocked',revision)

    def test_duplicate_keys_and_nonfinite_values(self):
        raw=self.raw()
        for bad in [raw.replace('"revision": 7','"revision": 7, "revision": 8'),raw[:-1]+',"extra":NaN}',raw[:-1]+',"extra":1e999}',raw.replace('"value": 1','"value": 1, "value": 2',1)]:
            if bad!=raw:self.assertEqual(self.check(bad)['status'],'blocked')

    def test_valid_json_with_broken_graph_is_protected(self):
        for mutation in ['stages','unknown','position','edge','newer']:
            value=json.loads(self.raw());g=value['graph']
            if mutation=='stages':g['stages']=None
            if mutation=='unknown':g['stages']['pixel']['nodes'][0]['definitionUuid']='unknown'
            if mutation=='position':g['stages']['pixel']['nodes'][0]['ui']={'x':'bad','y':0}
            if mutation=='edge':g['stages']['pixel']['edges'].append({'from':['missing','x'],'to':['missing','y']})
            if mutation=='newer':g['schemaVersion']=100
            before=copy.deepcopy(value);self.assertEqual(self.check(json.dumps(value))['status'],'blocked',mutation);self.assertEqual(value,before)

    def test_inspection_size_bound_and_deep_json(self):
        self.assertEqual(self.check(' '*1048577)['status'],'blocked')
        self.assertEqual(self.check('['*2000+'0'+']'*2000)['status'],'blocked')

    def test_saved_write_guards_run_before_mutating(self):
        for raw in ['{broken',self.raw().replace('"revision": 7','"revision": true')]:
            owner=SimpleNamespace(op=lambda name:SimpleNamespace(module=d) if name=='document' else None)
            with patch.object(r,'_owner',owner),patch.object(r,'saved_state_source',lambda:raw),patch.object(r,'core',lambda:c),patch.object(r,'target',lambda:object()),patch.object(r,'shader_kind',lambda s:'mat'),patch.object(r,'ensure_supported_shader',lambda s:None):
                for action in [lambda:r.deploy(c.demo_graph('color'),7),lambda:r.set_uniform_value({}),lambda:r.save_personal({})]:
                    with self.assertRaisesRegex(RuntimeError,'Saved Shader state'):action()

    def test_malformed_manifest_always_yields_preservation_error(self):
        for raw in ['','{broken','[]','null','{"compilerBuild":42}']:
            comp=SimpleNamespace(op=lambda name:SimpleNamespace(text=raw))
            with self.assertRaises(RuntimeError):r.ensure_supported_shader(comp)


if __name__=='__main__':unittest.main()
