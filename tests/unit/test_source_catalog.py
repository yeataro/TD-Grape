"""Source metadata has a single owner across host setup, compiler and UI."""
import copy
import unittest
import json
from pathlib import Path
from types import SimpleNamespace

import sgrape_core as core
import sgrape_sources as native
import sgrape_source_catalog as sources


class SourceCatalog(unittest.TestCase):
    def test_embedded_catalog_needs_no_filesystem_path(self):
        parent = SimpleNamespace(op=lambda name: SimpleNamespace(text=json.dumps(sources.CATALOG)) if name == 'source_catalog' else None)
        namespace = {'me': SimpleNamespace(parent=lambda: parent), '__file__': 'does-not-exist'}
        source = Path(sources.__file__).read_text(encoding='utf-8')
        exec(compile(source, 'embedded-source-catalog', 'exec'), namespace)
        self.assertEqual(namespace['contract'](), sources.contract())

    def test_presets_share_metadata_and_preserve_legacy_identity(self):
        specs = core.type_contract()['sources']['uniformPresets']
        self.assertEqual(set(specs), {'time', 'frame', 'absTime', 'absFrame', 'deltaTime', 'frameStep'})
        for key, spec in specs.items():
            self.assertEqual(native.PRESETS[key], spec['initialize']['expression'])
            graph = core.demo_graph('color', 'top')
            graph['declarations'].append(dict(id='clock', kind='uniform', name=spec['name'],
                                             type=spec['type'], initialDriver=key, value=0))
            core.compile_graph(graph)
        self.assertEqual(specs['absTime']['name'], 'uAbsTime')
        self.assertEqual(specs['time']['initialize']['expression'], 'me.time.seconds')
        specs['time']['name'] = 'changed'
        self.assertEqual(core.type_contract()['sources']['uniformPresets']['time']['name'], 'uTime')

    def test_rejects_unsupported_initialization_and_stage(self):
        for mutation in (
            lambda spec: spec['initialize'].update(mode='SCRIPT'),
            lambda spec: spec.update(type='sampler2D'),
            lambda spec: spec.update(availability={'top': ['vertex']}),
        ):
            data = copy.deepcopy(sources.CATALOG)
            mutation(data['uniformPresets']['time'])
            with self.assertRaises(ValueError):
                sources.validate(data)

    def test_external_types_are_still_owned_by_host(self):
        registry = core.type_registry()
        for name, spec in sources.CATALOG['structures'].items():
            self.assertEqual(spec['provider'], 'external')
            self.assertEqual(registry.structs[name], spec)
        self.assertEqual(sources.CATALOG['builtins']['uTD2DInfos']['type'], 'TDTexInfo[TD_NUM_2D_INPUTS]')

    def test_builtin_catalog_ports_and_availability(self):
        registry = core.type_registry()
        for name, spec in sources.CATALOG['builtins'].items():
            with self.subTest(source=name):
                ports = registry.interface('builtin_source', {'source': name})
                self.assertEqual(ports['inputs'], spec.get('inputs', {}))
                for target in spec['targets']:
                    for stage in spec['stages']:
                        registry.check_environment(spec['type'], target, stage)
                self.assertTrue(spec['path'])
        with self.assertRaises(core.GraphError):
            registry.source('TDNormal', 'top', 'pixel')
        with self.assertRaises(core.GraphError):
            registry.source('TDTexCoord', 'mat', 'pixel')

    def test_accessor_emits_connected_index_without_native_declarations(self):
        from test_array_structures import graph
        g = graph([core.node('scalar','index',type='uint',value=2),core.node('builtin_source','get',source='TDTexCoord')],
                  [core.edge('index','get','layer')],ty='vec3',target='mat',stage='vertex')
        result=core.compile_graph(g)['vertex']
        self.assertIn('TDTexCoord(sg_n_index)',result)
        self.assertNotIn('uniform vec3 TDTexCoord',result)

    def test_catalog_rejects_incomplete_accessor_or_menu_path(self):
        for mutation in (lambda x:x.update(expression='TDTexCoord({missing})'),lambda x:x.update(path=['unknown'])):
            data=copy.deepcopy(sources.CATALOG);mutation(data['builtins']['TDTexCoord'])
            with self.assertRaises(ValueError):sources.validate(data)


if __name__ == '__main__':
    unittest.main()
