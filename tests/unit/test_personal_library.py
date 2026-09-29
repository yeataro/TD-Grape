import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
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
            self.assertEqual(first['file'],'Nested_Invert'+lib.SUFFIX)
            self.assertEqual(first['entry']['name'],'Nested Invert')
            packet=json.loads(original)
            self.assertEqual(packet,lib.build(c,graph,'outer'))
            self.assertNotIn(packet['contentHash'],first['file'])
            again=lib.save(c,folder,graph,'outer');self.assertFalse(again['created'])
            graph['functions'][0]['name']='Different name'
            second=lib.save(c,folder,graph,'outer');self.assertTrue(second['created'])
            self.assertEqual(second['file'],'Different_name'+lib.SUFFIX)
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
        graph=fixture()
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/('Nested_Invert'+lib.SUFFIX);path.write_bytes(b'existing user file')
            saved=lib.save(c,folder,graph,'outer')
            self.assertEqual(saved['file'],'Nested_Invert_2'+lib.SUFFIX)
            self.assertEqual(path.read_bytes(),b'existing user file')

    def test_same_name_different_content_gets_suffix_and_reuses_correct_snapshot(self):
        graph=fixture()
        with tempfile.TemporaryDirectory() as folder:
            first=lib.save(c,folder,graph,'outer')
            for number in (2,3):
                graph['functions'][0]['inputs'][0]['default']=[number/10]*4
                saved=lib.save(c,folder,graph,'outer')
                self.assertEqual(saved['file'],'Nested_Invert_'+str(number)+lib.SUFFIX)
                self.assertNotEqual(saved['entry']['source'],first['entry']['source'])
                reused=lib.save(c,folder,graph,'outer')
                self.assertFalse(reused['created']);self.assertEqual(reused['file'],saved['file'])
            self.assertEqual(len(lib.read(c,folder)['items']),3)

    def test_renaming_file_and_json_formatting_do_not_change_identity_or_reuse(self):
        graph=fixture()
        with tempfile.TemporaryDirectory() as folder:
            first=lib.save(c,folder,graph,'outer');path=Path(folder)/first['file']
            renamed=path.with_name('My_Organized_Copy'+lib.SUFFIX);path.rename(renamed)
            renamed.write_text(json.dumps(json.loads(renamed.read_bytes()),indent=2),encoding='utf-8')
            self.assertEqual(lib.read(c,folder)['items'],[first['entry']])
            reused=lib.save(c,folder,graph,'outer')
            self.assertFalse(reused['created']);self.assertEqual(reused['file'],renamed.name)
            self.assertEqual(len(list(Path(folder).iterdir())),1)

    def test_filename_sanitizing_preserves_display_name(self):
        cases=[('My Color Mix','My_Color_Mix'),('  My\tColor / Mix:*?  ','My_Color_Mix'),
               ('遮罩 混合','遮罩_混合'),('CON','_CON'),('lpt1.notes','_lpt1.notes'),
               ('COM¹','_COM¹'),('.. / ../test','test'),('...','Subgraph'),('   ','Subgraph'),
               ('A__B. ','A_B'),('😀'*80,'😀'*45)]
        for label,stem in cases:
            with self.subTest(label=label),tempfile.TemporaryDirectory() as folder:
                graph=fixture();graph['functions'][0]['name']=label
                saved=lib.save(c,folder,graph,'outer')
                self.assertEqual(saved['file'],stem+lib.SUFFIX)
                self.assertEqual(saved['entry']['name'],label)
                self.assertEqual((Path(folder)/saved['file']).resolve().parent,Path(folder).resolve())
                self.assertLess(len(saved['file'].encode('utf-8')),255)

    def test_case_insensitive_collision_and_sanitized_name_collision(self):
        graph=fixture()
        with tempfile.TemporaryDirectory() as folder:
            for label,stem in [('My Mask','My_Mask'),('my mask','my_mask_2'),('My/Mask','My_Mask_3')]:
                graph['functions'][0]['name']=label
                saved=lib.save(c,folder,graph,'outer')
                self.assertEqual(saved['file'],stem+lib.SUFFIX)
            self.assertEqual(len(lib.read(c,folder)['items']),3)

    def test_changed_json_number_type_is_not_reused_as_a_valid_snapshot(self):
        graph=fixture()
        graph['functions'][0]['inputs'][0]['default']=[0,0,0,1]
        with tempfile.TemporaryDirectory() as folder:
            saved=lib.save(c,folder,graph,'outer');path=Path(folder)/saved['file']
            packet=json.loads(path.read_bytes());packet['functions'][0]['inputs'][0]['default'][0]=False
            path.write_text(json.dumps(packet),encoding='utf-8')
            reused=lib.save(c,folder,graph,'outer')
            self.assertTrue(reused['created']);self.assertEqual(reused['file'],'Nested_Invert_2'+lib.SUFFIX)
            report=lib.read(c,folder)
            self.assertEqual(len(report['items']),1);self.assertEqual(len(report['issues']),1)

    def test_full_folder_can_reuse_but_not_create(self):
        graph=fixture()
        with tempfile.TemporaryDirectory() as folder,patch.object(lib,'MAX_FILES',2):
            lib.save(c,folder,graph,'outer')
            graph['functions'][0]['inputs'][0]['default']=[.2]*4
            lib.save(c,folder,graph,'outer')
            self.assertFalse(lib.save(c,folder,graph,'outer')['created'])
            graph['functions'][0]['inputs'][0]['default']=[.3]*4
            with self.assertRaisesRegex(ValueError,'snapshots'):lib.save(c,folder,graph,'outer')
            self.assertEqual(len(list(Path(folder).iterdir())),2)

    def test_publish_race_reuses_same_content_or_chooses_next_name(self):
        graph=fixture();link=lib.os.link
        for same in (True,False):
            with self.subTest(same=same),tempfile.TemporaryDirectory() as folder:
                occupied=Path(folder)/('Nested_Invert'+lib.SUFFIX)
                def publish(source,destination):
                    if destination==occupied:
                        occupied.write_bytes(Path(source).read_bytes() if same else b'other writer')
                        raise FileExistsError()
                    link(source,destination)
                with patch.object(lib.os,'link',side_effect=publish):saved=lib.save(c,folder,graph,'outer')
                self.assertEqual(saved['created'],not same)
                self.assertEqual(saved['file'],'Nested_Invert'+('' if same else '_2')+lib.SUFFIX)
                if not same:self.assertEqual(occupied.read_bytes(),b'other writer')
                self.assertFalse(list(Path(folder).glob('*.tmp')))

    def test_failed_publish_cleans_temporary_file(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(lib.os,'link',side_effect=OSError('No hard links')):
            with self.assertRaisesRegex(OSError,'No hard links'):lib.save(c,folder,fixture(),'outer')
            self.assertEqual(list(Path(folder).iterdir()),[])

    def test_missing_folder_is_not_created_by_read(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'not-created'
            self.assertEqual(lib.read(c,path)['items'],[]);self.assertFalse(path.exists())

if __name__=='__main__':unittest.main()
