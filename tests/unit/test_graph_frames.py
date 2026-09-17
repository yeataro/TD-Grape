"""Graph frames persist as UI metadata without changing Shader compilation."""
import copy
import json
import unittest

import sgrape_core as c
import sgrape_document as document
import sgrape_library as library


def frame(data,ident='frame1'):
    return {'id':ident,'name':'Group <plain text>','color':'#aB12ef','nodes':[n['id'] for n in data['nodes']]}


class GraphFrames(unittest.TestCase):
    def test_stage_frame_roundtrip_and_shader_stability(self):
        for target in ('mat','top'):
            graph=c.demo_graph('color',target=target);before=c.compile_graph(graph)
            for data in graph['stages'].values():data['ui']={'frames':[frame(data)]}
            saved=copy.deepcopy(graph)
            self.assertEqual(c.compile_graph(graph),before)
            self.assertEqual(graph,saved)
            report=document.inspect_document(json.loads(json.dumps(graph)),c,target)
            self.assertEqual(report['status'],'valid');self.assertEqual(report['candidate'],saved)
            for data in graph['stages'].values():data['ui']['frames'][0].update(name='Renamed',color='#223344')
            self.assertEqual(c.compile_graph(graph),before)

    def test_unused_function_and_library_frames(self):
        graph=c.demo_graph('color');graph['functions']=c.function_library();before=c.compile_graph(graph)
        for fn in graph['functions']:fn['graph']['ui']={'frames':[frame(fn['graph'])]}
        self.assertEqual(c.compile_graph(graph),before)
        packet=library.build(c,graph,graph['functions'][0]['id'])
        imported=library.entry(c,json.loads(json.dumps(packet)))
        self.assertEqual(imported['graph']['ui'],graph['functions'][0]['graph']['ui'])
        self.assertEqual(document.inspect_document(graph,c,'mat')['status'],'valid')

    def test_invalid_frames_rejected_without_import_mutation(self):
        mutations=[
            lambda f:f.update(id='invalid id'),lambda f:f.update(name=''),
            lambda f:f.update(name='x'*81),lambda f:f.update(name='bad\nname'),
            lambda f:f.update(color='red;position:fixed'),lambda f:f.update(color=None),
            lambda f:f.update(nodes=[]),lambda f:f['nodes'].append('missing'),
            lambda f:f['nodes'].append(f['nodes'][0]),
        ]
        for mutate in mutations:
            graph=c.demo_graph('color');data=graph['stages']['pixel'];item=frame(data);mutate(item);data['ui']={'frames':[item]};before=copy.deepcopy(graph)
            with self.subTest(item=item):
                with self.assertRaises(c.GraphError):c.compile_graph(graph)
                report=document.inspect_document(graph,c,'mat')
                self.assertEqual(report['status'],'blocked');self.assertIsNone(report['candidate']);self.assertEqual(graph,before)
        for frames in (None,{},[None]):
            graph=c.demo_graph('color');graph['stages']['pixel']['ui']={'frames':frames}
            with self.assertRaises(c.GraphError):c.compile_graph(graph)

    def test_membership_and_identity_are_scoped_to_one_graph(self):
        graph=c.demo_graph('color');data=graph['stages']['pixel'];ids=[n['id'] for n in data['nodes']]
        data['ui']={'frames':[{'id':'a','name':'A','nodes':[ids[0]]},{'id':'b','name':'B','nodes':[ids[0]]}]}
        with self.assertRaises(c.GraphError):c.compile_graph(graph)
        data['ui']['frames'][1]['nodes']=[ids[1]];data['ui']['frames'][1]['id']='a'
        with self.assertRaises(c.GraphError):c.compile_graph(graph)
        data['ui']['frames'].pop();c.compile_graph(graph)
        graph['stages']['vertex']['ui']={'frames':[{'id':'a','name':'A','nodes':[graph['stages']['vertex']['nodes'][0]['id']]}]}
        c.compile_graph(graph)


if __name__=='__main__':unittest.main(verbosity=2)
