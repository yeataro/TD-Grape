"""Bundled Subgraphs ship useful semantic names without altering old snapshots."""
import copy
import json
from pathlib import Path
import re
import subprocess
import unittest

import sgrape_core as c
import sgrape_document as document
import sgrape_library as personal
from test_type_contract import legacy_function_library


def call_graph(function, target='top', stage='pixel'):
    graph=c.normalize_top_sources(c.demo_graph('color',target))[0] if target=='top' else c.demo_graph('color',target)
    graph['functions']=[copy.deepcopy(function)]
    graph['stages'][stage]={
        'nodes':[{'id':'filter','definitionUuid':c.CALL,'params':{'functionId':function['id']},'ui':{'x':48,'y':96}},c.node(stage+'_out','result')],
        'edges':[c.edge('filter','result','color' if stage=='pixel' else 'position','color')]}
    return graph


def canonical_locals(code):
    names={}
    return re.sub(r'\bsg_n_[A-Za-z0-9_]+\b',lambda match:names.setdefault(match[0],'local_'+str(len(names))),code)


class BuiltinSubgraphNames(unittest.TestCase):
    def test_all_defaults_have_valid_unique_names_and_fresh_versions(self):
        library=c.function_library();original=copy.deepcopy(library)
        self.assertEqual([f['name'] for f in library],['Tint','Invert','Contrast','Color Clamp'])
        self.assertEqual([len(f['graph']['nodes']) for f in library],[3,5,7,5])
        for function,legacy in zip(library,legacy_function_library(),strict=True):
            names=[node.get('name') for node in function['graph']['nodes']]
            self.assertTrue(all(c.glsl_code_name(name) for name in names),function['name'])
            self.assertEqual(len(names),len(set(names)))
            self.assertEqual(names[0],'Input');self.assertEqual(names[-1],'Output')
            snapshot=copy.deepcopy(function);source=snapshot.pop('source')
            self.assertEqual(source['version'],c.digest(snapshot))
            self.assertNotEqual(source['version'],legacy['source']['version'])
            self.assertEqual(source['id'],legacy['source']['id'])
        self.assertEqual(library[0]['graph']['nodes'][1]['name'],'Apply_Tint')
        self.assertEqual([f['graph'] for f in c.function_library(with_browser=True)],[f['graph'] for f in library])
        library[0]['graph']['nodes'][1]['name']='Edited_Instance'
        self.assertEqual(c.function_library(),original)

    def test_compile_preserves_math_topology_source_mapping_and_authored_graph(self):
        for function,legacy in zip(c.function_library(),legacy_function_library(),strict=True):
            for target,stage in [('top','pixel'),('mat','pixel'),('mat','vertex')]:
                with self.subTest(function=function['name'],target=target,stage=stage):
                    graph=call_graph(function,target,stage);before=copy.deepcopy(graph)
                    result=c.compile_graph(graph);old=c.compile_graph(call_graph(legacy,target,stage))
                    self.assertEqual(graph,before)
                    self.assertNotEqual(result['hash'],old['hash'])
                    for shader in ('pixel','vertex'):
                        self.assertEqual(canonical_locals(result[shader]),canonical_locals(old[shader]))
                    self.assertEqual(result['sourceMap'],old['sourceMap'])
                    self.assertEqual(result['bindings'],old['bindings'])
                    operation=next(node['name'] for node in function['graph']['nodes'] if node['definitionUuid'] not in (c.FUNCTION_INPUT,c.FUNCTION_OUTPUT,c.CATALOG['split']['definitionUuid']))
                    self.assertIn('sg_n_'+operation,result[stage])

    def test_document_and_personal_snapshot_round_trip_preserve_names(self):
        for function in c.function_library():
            with self.subTest(function=function['name']):
                graph=call_graph(function);before=copy.deepcopy(graph)
                report=document.inspect_document(json.loads(json.dumps(graph)),c,'top')
                self.assertEqual(report['status'],'valid',report)
                self.assertEqual(report['candidate']['functions'],graph['functions'])
                packet=personal.build(c,graph,function['id'])
                restored=personal.entry(c,json.loads(json.dumps(packet)))
                self.assertEqual(restored['graph'],function['graph'])
                self.assertEqual(graph,before)

    def test_editor_import_isolates_old_versions_and_preserves_names_on_localize(self):
        root=Path(__file__).resolve().parents[2]
        payload={'library':c.function_library(),'legacy':legacy_function_library(),'graph':c.demo_graph('color','top'),'contract':c.type_contract()}
        process=subprocess.run(['node',str(root/'tests/unit/test_builtin_subgraph_names.js')],input=json.dumps(payload),capture_output=True,text=True)
        self.assertEqual(process.returncode,0,process.stderr)
        self.assertIn('20 default node names',process.stdout)


if __name__=='__main__':unittest.main()
