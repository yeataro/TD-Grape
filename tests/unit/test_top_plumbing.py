"""Unrelated edits must not rebuild TD's native TOP dependency graph."""
import copy
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import sgrape_runtime as runtime


class Incoming:
    def __init__(self, name, default):
        self._name = name
        self.renames = []
        self.par = SimpleNamespace(connectorder=SimpleNamespace(val=0))
        self.inputConnectors = [SimpleNamespace(
            connections=[SimpleNamespace(owner=default)], connect=Mock())]

    @property
    def name(self): return self._name

    @name.setter
    def name(self, value):
        self.renames.append(value)
        self._name = value


class TopPlumbing(unittest.TestCase):
    def fixture(self):
        default = object()
        incoming = Incoming('in1', default)
        external = SimpleNamespace(path='/external')
        connector = SimpleNamespace(connections=[SimpleNamespace(owner=external)],
                                    disconnect=Mock(), connect=Mock())
        slot = dict(id='image', defaultSource='builtin:white')
        storage = dict(grapeTopSlots=[dict(slot, node='in1')],
                       sgrapeTextureSources={'slot:image':dict(asset='default', default='builtin:white')})
        nodes = {'in1':incoming, 'default':default}
        comp = SimpleNamespace(fetch=lambda key, fallback=None:storage.get(key, fallback),
                               store=lambda key, value:storage.__setitem__(key, value),
                               op=nodes.get, inputConnectors=[connector], create=Mock())
        graph = dict(topInputs=[slot], declarations=[])
        self.enterContext(patch.object(runtime, 'core', return_value=SimpleNamespace(top_input_slots=lambda g:g['topInputs'])))
        return comp, graph, incoming, connector, nodes, storage

    def test_uniform_edit_keeps_existing_internal_and_external_connections(self):
        comp, graph, incoming, connector, _, _ = self.fixture()
        graph['declarations'].append(dict(kind='uniform', name='uValues', type='float[3]'))
        for _ in range(2): runtime.prepare_managed_top_slots(comp, copy.deepcopy(graph))
        self.assertEqual(incoming.renames, [])
        self.assertEqual(incoming.par.connectorder.val, 0)
        incoming.inputConnectors[0].connect.assert_not_called()
        connector.disconnect.assert_not_called()
        connector.connect.assert_not_called()
        comp.create.assert_not_called()

    def test_changed_default_reconnects_without_disconnect_or_rename(self):
        comp, graph, incoming, connector, nodes, _ = self.fixture()
        replacement = object()
        nodes['default'] = replacement
        runtime.prepare_managed_top_slots(comp, graph)
        incoming.inputConnectors[0].connect.assert_called_once_with(replacement)
        self.assertEqual(incoming.renames, [])
        connector.disconnect.assert_not_called()

    def test_missing_internal_connection_is_repaired(self):
        comp, graph, incoming, connector, nodes, _ = self.fixture()
        incoming.inputConnectors[0].connections = []
        runtime.prepare_managed_top_slots(comp, graph)
        incoming.inputConnectors[0].connect.assert_called_once_with(nodes['default'])
        connector.disconnect.assert_not_called()

    def test_removing_connected_source_is_rejected_before_mutation(self):
        comp, graph, incoming, connector, _, _ = self.fixture()
        graph['topInputs'] = []
        with self.assertRaisesRegex(RuntimeError, 'Disconnect the COMP input'):
            runtime.prepare_managed_top_slots(comp, graph)
        self.assertEqual(incoming.renames, [])
        connector.disconnect.assert_not_called()
