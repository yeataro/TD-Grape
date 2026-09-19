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


if __name__ == '__main__':
    unittest.main()
