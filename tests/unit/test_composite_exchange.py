"""Compound definitions survive the same exchange paths as ordinary graph values."""
import copy
import unittest

import sgrape_core as core
import sgrape_document as document
import sgrape_library as library


def fixture():
    graph = core.demo_graph('color')
    graph['typeDefinitions'] = [{
        'id': 'sample', 'name': 'Sample', 'provider': 'generated',
        'fields': [{'id': 'offset', 'name': 'offset', 'type': 'vec2'},
                   {'id': 'weights', 'name': 'weights', 'type': 'float[3]'}]}]
    with core.type_context(graph):
        default = core.filled_value('struct:sample[2]')
    port = {'id': 'data', 'name': 'Data', 'type': 'struct:sample[2]', 'default': default}
    graph['functions'] = [{
        'id': 'passthrough', 'name': 'Samples', 'scope': 'local',
        'stages': ['pixel'], 'inputs': [copy.deepcopy(port)], 'outputs': [copy.deepcopy(port)],
        'graph': {'nodes': [
            {'id': 'input', 'definitionUuid': core.FUNCTION_INPUT, 'params': {}, 'ui': {'x': 0, 'y': 0}},
            {'id': 'output', 'definitionUuid': core.FUNCTION_OUTPUT, 'params': {}, 'ui': {'x': 200, 'y': 0}}],
            'edges': [{'from': ['input', 'data'], 'to': ['output', 'data']}]}}]
    return graph


class CompositeExchangeTests(unittest.TestCase):
    def test_host_structure_personal_function_preserves_target_scope(self):
        for ty,targets in [('TDTexInfo',['top']),('TDMatrix',['mat']),('TDTexInfo[TD_NUM_2D_INPUTS]',['top']),('sampler2D[TD_NUM_2D_INPUTS]',['top'])]:
            with self.subTest(type=ty):
                graph=core.demo_graph('color',targets[0])
                default=None if '[' in ty else core.filled_value(ty)
                port=dict(id='value',name='Value',type=ty,default=default)
                fn=dict(id='host',name='Host Value',scope='local',stages=['pixel'],inputs=[copy.deepcopy(port)],outputs=[copy.deepcopy(port)],
                    graph=dict(nodes=[dict(id='input',definitionUuid=core.FUNCTION_INPUT,params={}),dict(id='output',definitionUuid=core.FUNCTION_OUTPUT,params={})],
                               edges=[core.edge('input','output','value','value')]))
                graph['functions']=[fn]
                packet=library.build(core,graph,'host');entry=library.entry(core,packet)
                self.assertEqual(entry['targets'],targets)
                self.assertEqual(entry['inputs'][0]['default'],default)
                wrong=core.demo_graph('color','mat' if targets==['top'] else 'top');wrong['functions']=[fn]
                with self.assertRaises(core.GraphError):core.compile_graph(wrong)

    def test_host_type_cannot_claim_an_unavailable_stage(self):
        graph=core.demo_graph('color','top')
        port=dict(id='value',name='Value',type='TDTexInfo',default=core.filled_value('TDTexInfo'))
        graph['functions']=[dict(id='host',name='Host Value',scope='local',stages=['pixel','vertex'],inputs=[copy.deepcopy(port)],outputs=[copy.deepcopy(port)],
            graph=dict(nodes=[dict(id='input',definitionUuid=core.FUNCTION_INPUT,params={}),dict(id='output',definitionUuid=core.FUNCTION_OUTPUT,params={})],edges=[core.edge('input','output','value','value')]))]
        with self.assertRaisesRegex(ValueError,'No supported Shader target'):library.build(core,graph,'host')

    def test_personal_snapshot_roundtrip_keeps_definitions_and_hash(self):
        graph = fixture()
        before = copy.deepcopy(graph)
        packet = library.build(core, graph, 'passthrough')
        self.assertEqual(packet['typeDefinitions'], graph['typeDefinitions'])
        self.assertEqual(library.validate(core, packet), packet)
        self.assertEqual(library.entry(core, packet)['typeDefinitions'], graph['typeDefinitions'])
        self.assertEqual(graph, before)
        broken = copy.deepcopy(packet)
        broken['typeDefinitions'][0]['fields'][0]['type'] = 'vec3'
        with self.assertRaisesRegex(ValueError, 'checksum'):
            library.validate(core, broken)

    def test_unrelated_project_types_do_not_change_personal_snapshot(self):
        graph=fixture();baseline=library.build(core,graph,'passthrough')
        graph['typeDefinitions'].append(dict(id='unrelated',name='Unrelated',fields=[dict(id='x',name='x',type='float')]))
        first=library.build(core,graph,'passthrough')
        graph['typeDefinitions'][1]['fields'][0]['type']='mat4'
        second=library.build(core,graph,'passthrough')
        self.assertEqual(first,baseline);self.assertEqual(second,baseline)
        plain=core.demo_graph('color');plain['functions']=[copy.deepcopy(core.function_library()[0])]
        expected=library.build(core,plain,plain['functions'][0]['id'])
        plain['typeDefinitions']=copy.deepcopy(graph['typeDefinitions'])
        self.assertEqual(library.build(core,plain,plain['functions'][0]['id']),expected)

    def test_snapshot_keeps_nested_field_type_dependency_closure(self):
        graph=fixture()
        leaf=dict(id='leaf',name='Leaf',fields=[dict(id='value',name='value',type='float')])
        graph['typeDefinitions'].append(leaf)
        graph['typeDefinitions'][0]['fields'].append(dict(id='nested',name='nested',type='struct:leaf[2]'))
        with core.type_context(graph):value=core.filled_value('struct:sample[2]')
        for port in graph['functions'][0]['inputs']+graph['functions'][0]['outputs']:port['default']=copy.deepcopy(value)
        packet=library.build(core,graph,'passthrough')
        self.assertEqual({item['id'] for item in packet['typeDefinitions']},{'sample','leaf'})

    def test_document_inspection_retains_graph_local_types(self):
        graph = fixture()
        report = document.inspect_document(graph, core, 'mat')
        self.assertNotEqual(report['status'], 'blocked', report['issues'])
        self.assertEqual(report['candidate']['typeDefinitions'], graph['typeDefinitions'])
        self.assertNotIn('struct:sample', core.type_contract()['composites']['structs'])

    def test_invalid_definition_blocks_without_changing_original(self):
        graph = fixture()
        graph['typeDefinitions'][0]['fields'][0]['type'] = 'struct:sample'
        before = copy.deepcopy(graph)
        report = document.inspect_document(graph, core, 'mat')
        self.assertEqual(report['status'], 'blocked')
        self.assertIsNone(report['candidate'])
        self.assertEqual(graph, before)

    def test_import_uses_inferred_field_type_without_rewriting_fallback(self):
        graph = fixture()
        graph['functions'] = []
        nodes = [core.node('array', 'samples', elementType='struct:sample', length=2),
                 core.node('array_get', 'get'),
                 core.node('struct_field', 'field', field='offset'),
                 core.node('pixel_out', 'pixel')]
        graph['stages']['pixel'] = {'nodes': nodes, 'edges': [
            core.edge('samples', 'get', 'Array'), core.edge('get', 'field', 'value')]}
        # Field still has its disconnected fallback TDTexInfo. The incoming
        # structure determines its real type without a destructive migration.
        before = copy.deepcopy(graph)
        core.compile_graph(graph)
        report = document.inspect_document(graph, core, 'mat')
        self.assertNotEqual(report['status'], 'blocked', report['issues'])
        self.assertEqual(report['candidate']['stages']['pixel']['edges'], graph['stages']['pixel']['edges'])
        self.assertEqual(report['candidate']['stages']['pixel']['nodes'][2]['params'], nodes[2]['params'])
        self.assertEqual(graph, before)


if __name__ == '__main__':
    unittest.main()
