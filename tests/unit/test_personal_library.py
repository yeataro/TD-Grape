import copy
import json
import tempfile
import unittest
from pathlib import Path
import sgrape_core as c
import sgrape_library as lib

def fixture():
    graph=c.demo_graph('color')
    inner=copy.deepcopy(c.function_library()[1])
    outer=copy.deepcopy(inner);outer['id']='outer';outer['name']='Nested Invert';outer['scope']='local';outer.pop('source',None)
    outer['graph']={'nodes':[
        {'id':'input','definitionUuid':c.FUNCTION_INPUT,'params':{}},
        {'id':'invert','definitionUuid':c.CALL,'params':{'functionId':inner['id']}},
        {'id':'output','definitionUuid':c.FUNCTION_OUTPUT,'params':{}}],
        'edges':[{'from':['input','color'],'to':['invert','color']},{'from':['invert','color'],'to':['output','color']}]}
    graph['functions']=[outer,inner]
    return graph

class PersonalTests(unittest.TestCase):
    def test_nested_portable_snapshot(self):
        graph=fixture();before=copy.deepcopy(graph)
        packet=lib.build(c,graph,'outer');self.assertEqual(graph,before)
        self.assertEqual(len(packet['functions']),2)
        entry=lib.entry(c,packet)
        self.assertEqual(entry['scope'],'personal');self.assertEqual(len(entry['dependencies']),1)
        self.assertEqual(entry['graph']['nodes'][1]['params']['functionId'],entry['dependencies'][0]['id'])
        self.assertNotIn('builtin',json.dumps(packet.get('source',{})))
        self.assertEqual(lib.build(c,graph,'outer'),packet)

    def test_save_reuse_and_source_isolation(self):
        graph=fixture()
        with tempfile.TemporaryDirectory() as folder:
            first=lib.save(c,folder,graph,'outer');original=(Path(folder)/first['file']).read_bytes()
            again=lib.save(c,folder,graph,'outer');self.assertFalse(again['created'])
            graph['functions'][0]['name']='Different name'
            second=lib.save(c,folder,graph,'outer');self.assertTrue(second['created'])
            self.assertEqual((Path(folder)/first['file']).read_bytes(),original)
            self.assertEqual(len(lib.read(c,folder)['items']),2)
            self.assertFalse(list(Path(folder).glob('*.tmp')))

    def test_external_declarations_rejected_before_writing(self):
        for key in ('uniform','texture'):
            with self.subTest(key=key),tempfile.TemporaryDirectory() as folder:
                graph=fixture();graph['functions'][0]['graph']['nodes'].append(c.node(key,'external'))
                with self.assertRaisesRegex(ValueError,'self-contained'):lib.save(c,folder,graph,'outer')
                self.assertEqual(list(Path(folder).iterdir()),[])

    def test_corrupt_file_does_not_hide_valid_entries(self):
        with tempfile.TemporaryDirectory() as folder:
            lib.save(c,folder,fixture(),'outer')
            (Path(folder)/('broken'+lib.SUFFIX)).write_text('{broken',encoding='utf-8')
            report=lib.read(c,folder);self.assertEqual(len(report['items']),1);self.assertEqual(len(report['issues']),1)

    def test_checksums_and_newer_versions(self):
        packet=lib.build(c,fixture(),'outer')
        changed=copy.deepcopy(packet);changed['functions'][0]['name']='Tampered'
        with self.assertRaisesRegex(ValueError,'checksum'):lib.validate(c,changed)
        packet['formatVersion']=2
        with self.assertRaisesRegex(ValueError,'Unsupported'):lib.validate(c,packet)

    def test_unknown_nodes_and_cycles(self):
        graph=fixture();graph['functions'][0]['graph']['nodes'][1]['params']['functionId']='outer'
        with self.assertRaisesRegex(ValueError,'cycle'):lib.build(c,graph,'outer')
        graph=fixture();graph['functions'][0]['graph']['nodes'][1]['definitionUuid']='some.unknown.node'
        with self.assertRaisesRegex(ValueError,'Unknown node'):lib.build(c,graph,'outer')

    def test_existing_file_never_overwritten(self):
        graph=fixture();packet=lib.build(c,graph,'outer')
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/(packet['contentHash']+lib.SUFFIX);path.write_bytes(b'existing user file')
            with self.assertRaisesRegex(ValueError,'preserved'):lib.save(c,folder,graph,'outer')
            self.assertEqual(path.read_bytes(),b'existing user file')

    def test_missing_folder_is_not_created_by_read(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'not-created'
            self.assertEqual(lib.read(c,path)['items'],[]);self.assertFalse(path.exists())

if __name__=='__main__':unittest.main()
