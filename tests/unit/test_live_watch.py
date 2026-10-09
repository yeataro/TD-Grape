"""Live Uniform values between TD and connected editors (Uniform D2, Refactor.48; uniform-d.md B).
FakeShader copies TD behaviour measured on 2026-10-09; not a TD proof. 不是 TD 證據。"""
import json
from collections import namedtuple
import unittest

import live_watch
import next_family
from test_uniform_writer import FakeShader, FakePar, uniform

Change = namedtuple('Change', 'par prev')


class Connection:
    def __init__(self, target='t' * 32, session='live1'):
        self.target, self.session, self.sent, self.closed = target, session, [], False

    def send(self, text, replaceable=False):
        self.sent.append(json.loads(text))

    def close(self):
        self.closed = True


class Owner:
    # Like a TD OP: a path, its own id (kept by a rename), still there or not. 同 TD OP：路徑、自己的 id（改名不變）、還在不在。
    def __init__(self, path, id=1):
        self.path, self.id, self.valid = path, id, True


class Family:
    FORMAT = next_family.FORMAT

    def __init__(self, uniforms):
        self.comp = Owner('/project1/grape1')
        self.shader = FakeShader()
        self.shader.path = self.comp.path + '/shader'
        self.uniforms, self.live_calls = uniforms, []
        for p in self.pars():
            p.owner = self.shader
        self.shader.parent = lambda: self.comp

    def pars(self):
        return [p for rows in self.shader.rows.values() for row in rows for p in row.values()]

    def glsl(self):
        return self.shader

    def forget(self, session):
        self.forgotten = session

    def running_uniforms(self):
        return self.uniforms

    def live(self, body):
        self.live_calls.append(body)
        return {'ok': True}


def owned(family):
    for p in family.pars():
        p.owner = family.shader


def setup(uniforms):
    family = Family(uniforms)
    import uniform_writer
    uniform_writer.apply(family.shader, uniforms, [], {}, 'CONSTANT')
    owned(family)
    watched = []
    watch = live_watch.LiveWatch(resolve=lambda target: family if target == 't' * 32 else None,
                                 watcher=lambda paths, comps: watched.append((list(paths), list(comps))), frame=lambda: 120)
    return family, watch, watched


class LiveWatchTests(unittest.TestCase):
    def test_a_connection_watches_its_grape_op_and_gets_the_state_first(self):
        mix = uniform('u1', 'uMix', 'vec2', [0.0, 0.0])
        family, watch, watched = setup([mix])
        connection = Connection()
        watch.drain([('open', connection, None)])
        self.assertEqual(watched, [(['/project1/grape1/shader'], ['/project1/grape1'])])
        self.assertEqual(connection.sent, [{'type': 'state', 'frame': 120, 'uniforms': {
            'u1': [{'mode': 'constant', 'value': 0.0}, {'mode': 'constant', 'value': 0.0}]}}])
        watch.drain([('close', connection, None)])
        self.assertEqual(watched[-1], ([], []), 'nobody connected: nothing watched')
        unknown = Connection(target='x' * 32)
        watch.drain([('open', unknown, None)])
        self.assertTrue(unknown.closed)

    def test_a_rewired_grape_op_nudges_its_editors(self):
        # Refactor.60: TD's onWireChange for a watched Grape OP becomes one small message; others are ignored.
        # 監看中的 Grape OP 在 TD 重新接線：送一則小訊息；其他的不理。
        family, watch, _ = setup([uniform('u1', 'uGain')])
        connection = Connection()
        watch.drain([('open', connection, None)])
        connection.sent.clear()
        watch.wires_changed(family.comp)
        watch.wires_changed(Owner('/project1/other', id=2))
        self.assertEqual(connection.sent, [{'type': 'inputs', 'frame': 120, 'retake': True}])

    def test_a_renamed_or_deleted_grape_op_is_followed(self):
        # Refactor.62: keyed by the OP's own id; a rename is watched under the new path, a deleted OP is let go.
        # 以 OP 自己的 id 為鍵：改名照新路徑監看，刪掉的放掉。
        family, watch, watched = setup([uniform('u1', 'uGain')])
        connection = Connection()
        watch.drain([('open', connection, None)])
        family.comp.path = '/project1/renamed'
        family.shader.path = '/project1/renamed/shader'
        watch.drain([])
        self.assertEqual(watched[-1], (['/project1/renamed/shader'], ['/project1/renamed']))
        connection.sent.clear()
        watch.wires_changed(family.comp)
        self.assertEqual(connection.sent, [{'type': 'inputs', 'frame': 120, 'retake': True}])
        family.comp.valid = False
        watch.drain([])
        self.assertEqual((watched[-1], connection.closed, watch.watched), (([], []), True, {}))

    def test_a_closed_connection_is_forgotten(self):
        family, watch, _ = setup([uniform('u1', 'uGain')])
        connection = Connection(session='run.7')
        watch.drain([('open', connection, None), ('close', connection, None)])
        self.assertEqual(family.forgotten, 'run.7')

    def test_editor_values_are_written_once_per_frame_latest_only(self):
        family, watch, _ = setup([uniform('u1', 'uGain')])
        connection = Connection()
        messages = [('message', connection, json.dumps({'type': 'value', 'id': 'u1', 'value': v, 'seq': i}))
                    for i, v in enumerate((0.1, 0.2, 0.3))]
        watch.drain([('open', connection, None)] + messages + [('message', connection, 'not json')])
        self.assertEqual([(c['id'], c['value'], c['session'], c['seq']) for c in family.live_calls], [('u1', 0.3, 'live1', 2)])

    def test_td_values_go_as_one_bundle_per_frame_and_skip_driven_components(self):
        mix = uniform('u1', 'uMix', 'vec3', [0.0, 0.0, 0.0])
        family, watch, _ = setup([mix])
        connection = Connection()
        watch.drain([('open', connection, None)])
        connection.sent.clear()
        row = family.shader.row('vec', 'uMix')
        master = FakePar('Gain', 0.0)
        row['valuey'].bind_to(master)
        row['valuez'].set_expr('absTime.frame', 9.0)
        master.val = 0.5
        row['valuex'].val = 0.25
        watch.values_changed([Change(row['valuex'], 0.0), Change(row['valuey'], 0.0), Change(row['valuez'], 8.0)])
        self.assertEqual(connection.sent, [{'type': 'values', 'frame': 120, 'values': {'u1': [0.25, 0.5]}}])

    def test_mode_changes_renames_and_applies_send_a_new_state(self):
        mix = uniform('u1', 'uMix')
        family, watch, _ = setup([mix])
        connection = Connection()
        watch.drain([('open', connection, None)])
        row = family.shader.row('vec', 'uMix')
        row['valuex'].set_expr('absTime.seconds', 1.0)
        watch.changed(row['valuex'])
        watch.drain([])
        self.assertEqual(connection.sent[-1]['uniforms'], {'u1': [{'mode': 'expression', 'text': 'absTime.seconds'}]})
        row['name'].val = 'uOther'  # renamed in TD: the Uniform has no row now
        watch.values_changed([Change(row['name'], 'uMix')])
        self.assertEqual(connection.sent[-1], {'type': 'state', 'frame': 120, 'uniforms': {}})
        count = len(connection.sent)
        watch.applied(family)
        # The new state, then a nudge to ask about the inputs again without new snapshots (Refactor.61.5).
        # 新狀態，再提醒重新問輸入、不重拍快照。
        self.assertEqual(len(connection.sent), count + 2)
        self.assertEqual(connection.sent[-1], {'type': 'inputs', 'frame': 120, 'retake': False})


if __name__ == '__main__':
    unittest.main()
