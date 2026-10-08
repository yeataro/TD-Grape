"""Uniform rows on the GLSL OP (Uniform D1, Refactor.47; design-interview Q55–Q61, uniform-d.md).

FakeShader copies the TD behaviour measured on 2026-10-09 (TD 2025.33230): writing `val` on an
expression parameter makes it constant; writing `val` on a bound parameter writes its master;
destroyBlock moves later rows up together with what drives them. Not a TD proof.
FakeShader 照 2026-10-09 在 TD 量到的行為；不是 TD 證據。"""
import unittest

import uniform_writer as uw

PAGES = {'vec': ('valuex', 'valuey', 'valuez', 'valuew'), 'color': ('rgbr', 'rgbg', 'rgbb', 'alpha')}


class FakePar:
    def __init__(self, name, default):
        self.name, self.default = name, default
        self.mode, self._val, self._expr, self.bindExpr, self.bindMaster = 'CONSTANT', default, '', '', None
        self.computed = None  # what an expression or Export gives 驅動給的值
        self.exportOP = self.exportSource = None

    @property
    def val(self):
        return self._val

    @val.setter
    def val(self, value):
        if self.mode == 'BIND' and self.bindMaster is not None:
            self.bindMaster.val = value  # measured: the master is written, BIND stays
            return
        if self.mode == 'EXPRESSION':
            self.mode = 'CONSTANT'  # measured: the expression is lost
        self._val = value

    @property
    def expr(self):
        return self._expr

    @expr.setter
    def expr(self, text):
        self.mode, self._expr = 'EXPRESSION', text

    def eval(self):
        if self.mode == 'CONSTANT':
            return self._val
        if self.mode == 'BIND':
            return self.bindMaster.eval()
        return self.computed

    @property
    def isDefault(self):
        return self.mode == 'CONSTANT' and self._val == self.default

    def set_expr(self, text, computed):
        self.mode, self._expr, self.computed = 'EXPRESSION', text, computed

    def bind_to(self, master):
        self.mode, self.bindMaster, self.bindExpr = 'BIND', master, "op('ctrl').par.Gain"

    def export_from(self, source, computed):
        self.mode, self.exportOP, self.computed = 'EXPORT', source, computed
        self.exportSource = type('Channel', (), {'name': 'chan1'})()


class FakeParCollection:
    def __init__(self, shader):
        self._shader = shader

    def __getattr__(self, name):
        for page, rows in self._shader.rows.items():
            for index, row in enumerate(rows):
                for suffix, p in row.items():
                    if '%s%d%s' % (page, index, suffix) == name:
                        return p
        raise AttributeError(name)


class FakeSequence:
    def __init__(self, shader, page):
        self.shader, self.page = shader, page

    @property
    def numBlocks(self):
        return len(self.shader.rows[self.page])

    @numBlocks.setter
    def numBlocks(self, count):
        rows = self.shader.rows[self.page]
        while len(rows) < count:
            rows.append(self.shader.new_row(self.page))
        del rows[count:]
        self.shader.rename()

    def destroyBlock(self, index):
        del self.shader.rows[self.page][index]
        self.shader.rename()


class FakeShader:
    type = 'glsl'

    def __init__(self):
        self.rows = {'vec': [self.new_row('vec')], 'color': [self.new_row('color')]}
        self.rename()
        self.par = FakeParCollection(self)
        self.seq = type('Seq', (), {})()
        self.seq.vec, self.seq.color = FakeSequence(self, 'vec'), FakeSequence(self, 'color')

    @staticmethod
    def new_row(page):
        row = {'name': FakePar('', '')}
        for suffix in PAGES[page]:
            row[suffix] = FakePar('', 1.0 if suffix == 'alpha' else 0.0)
        return row

    def rename(self):
        for page, rows in self.rows.items():
            for index, row in enumerate(rows):
                for suffix, p in row.items():
                    p.name = '%s%d%s' % (page, index, suffix)

    def row(self, page, name):
        return next(r for r in self.rows[page] if r['name'].val == name)

    def names(self, page):
        return [r['name'].val for r in self.rows[page]]


def uniform(ident, name, kind_type='float', value=0.0, **extra):
    return {'id': ident, 'kind': 'uniform', 'name': name, 'type': kind_type, 'value': value, **extra}


PRESETS = {'absTime': 'absTime.seconds'}


def apply(shader, uniforms, previous=()):
    return uw.apply(shader, list(uniforms), list(previous), PRESETS, 'CONSTANT')


class UniformWriterTests(unittest.TestCase):
    def test_new_rows_reuse_the_untouched_first_row_and_follow_the_pages(self):
        shader = FakeShader()
        gain, tint = uniform('u1', 'uGain', value=2.0), uniform('u2', 'uTint', 'vec3', [1.0, 0.0, 0.5], color=True)
        offset = uniform('u3', 'uOffset', 'vec2', [0.25, 0.75])
        self.assertEqual(apply(shader, [gain, tint, offset]), [])
        self.assertEqual(shader.names('vec'), ['uGain', 'uOffset'])  # first row reused, then appended
        self.assertEqual(shader.names('color'), ['uTint'])
        self.assertEqual(shader.row('vec', 'uOffset')['valuey'].val, 0.75)
        self.assertEqual([shader.row('color', 'uTint')[s].val for s in PAGES['color']], [1.0, 0.0, 0.5, 1.0])  # alpha untouched

    def test_a_used_first_row_is_never_taken(self):
        shader = FakeShader()
        shader.rows['vec'][0]['valuex'].val = 3.0  # someone's own value, no name 有人填了值
        apply(shader, [uniform('u1', 'uGain', value=2.0)])
        self.assertEqual(shader.names('vec'), ['', 'uGain'])

    def test_a_preset_uniform_gets_its_expression_once(self):
        shader = FakeShader()
        clock = uniform('b1', 'uAbsTime', entry='absTime')
        apply(shader, [clock])
        par = shader.row('vec', 'uAbsTime')['valuex']
        self.assertEqual((par.mode, par.expr), ('EXPRESSION', 'absTime.seconds'))
        par.mode = 'CONSTANT'  # the user removes it in TD 使用者在 TD 拿掉
        apply(shader, [clock], [clock])
        self.assertEqual(par.mode, 'CONSTANT')  # not put back

    def test_values_are_written_only_when_they_changed_in_the_editor(self):
        shader = FakeShader()
        before = uniform('u1', 'uOffset', 'vec2', [0.0, 0.0])
        apply(shader, [before])
        row = shader.row('vec', 'uOffset')
        row['valuey'].val = 9.0  # changed in TD 在 TD 改的
        after = uniform('u1', 'uOffset', 'vec2', [0.5, 0.0])
        apply(shader, [after], [before])
        self.assertEqual((row['valuex'].val, row['valuey'].val), (0.5, 9.0))  # only x changed in the editor
        apply(shader, [after], [after])  # the same graph again: TD keeps its own
        self.assertEqual(row['valuey'].val, 9.0)

    def test_drivers_stay_and_bind_writes_its_master(self):
        shader = FakeShader()
        before = uniform('u1', 'uMix', 'vec3', [0.0, 0.0, 0.0])
        apply(shader, [before])
        row = shader.row('vec', 'uMix')
        master = FakePar('Gain', 0.0)
        row['valuex'].set_expr('me.time.seconds', 4.0)
        row['valuey'].bind_to(master)
        row['valuez'].export_from(type('CHOP', (), {'name': 'lfo1', 'family': 'CHOP'})(), 0.3)
        apply(shader, [uniform('u1', 'uMix', 'vec3', [1.0, 2.0, 3.0])], [before])
        self.assertEqual((row['valuex'].mode, row['valuex'].expr), ('EXPRESSION', 'me.time.seconds'))
        self.assertEqual((row['valuey'].mode, master.val), ('BIND', 2.0))
        self.assertEqual(row['valuez'].mode, 'EXPORT')
        states = uw.states(shader, [uniform('u1', 'uMix', 'vec3', [1.0, 2.0, 3.0])])['u1']
        self.assertEqual(states[0], {'mode': 'expression', 'text': 'me.time.seconds'})
        self.assertEqual(states[1], {'mode': 'bind', 'value': 2.0, 'editable': True, 'text': "op('ctrl').par.Gain"})
        self.assertEqual(states[2], {'mode': 'export', 'text': 'CHOP Export', 'source': 'lfo1:chan1'})
        master.set_expr('absTime.frame', 7.0)  # the master is driven: not Grape's 被驅動的 master
        self.assertFalse(uw.write(row['valuey'], 5.0))
        self.assertEqual(uw.state(row['valuey'])['editable'], False)

    def test_renames_change_only_the_name_and_are_refused_when_driven(self):
        shader = FakeShader()
        before = uniform('u1', 'uGain', value=2.0)
        apply(shader, [before])
        shader.row('vec', 'uGain')['valuex'].set_expr('absTime.seconds', 1.0)
        renamed = uniform('u1', 'uLevel', value=2.0)
        apply(shader, [renamed], [before])
        row = shader.row('vec', 'uLevel')
        self.assertEqual((row['valuex'].mode, shader.names('vec')), ('EXPRESSION', ['uLevel']))
        row['name'].set_expr("'uLevel'", 'uLevel')
        with self.assertRaisesRegex(ValueError, 'driven in TD'):
            uw.check_renames(shader, [uniform('u1', 'uOther')], [renamed])

    def test_removed_rows_take_their_drivers_and_later_rows_move_up(self):
        shader = FakeShader()
        a, b, c = uniform('u1', 'uA'), uniform('u2', 'uB'), uniform('u3', 'uC')
        apply(shader, [a, b, c])
        shader.row('vec', 'uC')['valuex'].set_expr('absTime.frame', 1.0)
        apply(shader, [c], [a, b, c])
        self.assertEqual(shader.names('vec'), ['uC'])
        self.assertEqual(shader.rows['vec'][0]['valuex'].expr, 'absTime.frame')  # moved with its row

    def test_the_last_row_is_cleared_and_an_export_cannot_be_removed(self):
        shader = FakeShader()
        tint = uniform('u1', 'uTint', 'vec4', [1.0, 1.0, 1.0, 1.0], color=True)
        apply(shader, [tint])
        row = shader.rows['color'][0]
        row['rgbr'].set_expr('0.5', 0.5)
        row['rgbg'].bind_to(FakePar('Gain', 0.0))
        row['alpha'].export_from(type('CHOP', (), {'name': 'lfo1', 'family': 'CHOP'})(), 0.3)
        notices = apply(shader, [], [tint])
        self.assertEqual((len(shader.rows['color']), row['name'].val), (1, ''))  # TD keeps one row
        self.assertEqual((row['rgbr'].mode, row['rgbg'].mode, row['alpha'].mode), ('CONSTANT', 'CONSTANT', 'EXPORT'))
        self.assertEqual([n['code'] for n in notices], ['uniform.exportRemains'])
        self.assertEqual(notices[0]['params'], {'uniform': 'uTint', 'parameter': 'color0alpha', 'origin': 'lfo1:chan1'})

    def test_a_row_deleted_in_td_is_added_again_with_a_notice(self):
        shader = FakeShader()
        gain = uniform('u1', 'uGain', value=2.0)
        apply(shader, [gain])
        shader.rows['vec'][0]['name'].val = 'uSomethingElse'
        notices = apply(shader, [gain], [gain])
        self.assertEqual(shader.names('vec'), ['uSomethingElse', 'uGain'])
        self.assertEqual([n['code'] for n in notices], ['uniform.rowRecreated'])

    def test_live_writes_only_where_grape_may(self):
        shader = FakeShader()
        offset = uniform('u1', 'uOffset', 'vec2', [0.0, 0.0])
        apply(shader, [offset])
        row = shader.row('vec', 'uOffset')
        row['valuey'].set_expr('absTime.seconds', 1.0)
        self.assertTrue(uw.live(shader, offset, [0.5, 0.5], [0.0, 0.0]))
        self.assertEqual((row['valuex'].val, row['valuey'].mode), (0.5, 'EXPRESSION'))
        self.assertFalse(uw.live(shader, uniform('u9', 'uMissing'), 1.0, 0.0))

    def test_live_writes_only_the_components_changed_in_the_editor(self):
        # Found in TD 2026-10-09: the editor sends the whole vector; x changed in TD must stay.
        # TD 實測發現：編輯器送整個向量；在 TD 改的 x 要留著。
        shader = FakeShader()
        mix = uniform('u1', 'uMix', 'vec3', [0.0, 0.0, 0.0])
        apply(shader, [mix])
        row = shader.row('vec', 'uMix')
        row['valuex'].val = 0.7  # changed in TD
        uw.live(shader, mix, [0.0, 0.4, 0.0], [0.0, 0.0, 0.0])
        self.assertEqual((row['valuex'].val, row['valuey'].val), (0.7, 0.4))

    def test_the_old_binding_table_is_retired_keeping_what_it_drove(self):
        # Refactor.44–46 Grape OPs: DAT Export from the `uniforms` table. R.44～46 的綁定表。
        shader = FakeShader()
        row = shader.rows['vec'][0]
        row['name'].export_from(None, 'uAbsTime')
        row['valuex'].export_from(None, 12.5)
        cells = [['path', 'parameter', 'value', 'enable'], ['shader', 'vec0name', "'uAbsTime'", '1'],
                 ['shader', 'vec0valuex', 'absTime.seconds', '1']]

        class Table:
            numRows, on = 3, True

            @property
            def export(self):
                return self.on

            @export.setter
            def export(self, value):
                self.on = value
                for p in (row['name'], row['valuex']):
                    p.mode = 'CONSTANT'  # Export off: TD lets go 關掉 Export 後 TD 放開

            def __getitem__(self, at):
                return type('Cell', (), {'val': cells[at[0]][at[1]]})()

            def clear(self):
                self.cleared = True

        table = Table()
        comp = type('Comp', (), {'op': lambda self, name: table if name == 'uniforms' else None})()
        self.assertTrue(uw.retire_export_table(comp, shader))
        self.assertEqual((row['name'].mode, row['name'].val), ('CONSTANT', 'uAbsTime'))
        self.assertEqual((row['valuex'].mode, row['valuex'].expr), ('EXPRESSION', 'absTime.seconds'))
        self.assertTrue(table.cleared)


if __name__ == '__main__':
    unittest.main()
