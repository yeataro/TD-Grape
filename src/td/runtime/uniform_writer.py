"""Uniforms on the Grape OP's GLSL OP, written directly (Uniform D1, Refactor.47; design-interview
Q55–Q61, work/in-place-refactor-design/uniform-d.md). Same as the legacy product: rows are found by
the Uniform's name, never by position; only missing rows are added; existing rows keep whatever
drives them.

Grape deals with constant values (`val`) only (human 2026-10-09). A component is written when it is
constant, or bound (Bind shares a constant value: its bind master is written). Expression, Export
and anything else are not Grape's: they are only reported as a state. Read the working value with
`eval()`; `val` is only the constant underneath (TD docs, Par class).

Colours are on the Colors page, the rest on the Vectors page (Q59: decided when created).
GLSL OP 上的 Uniform 直接寫入（照舊產品：用名字找列、只補缺的、不重設既有的驅動）。Grape 只管常數值：
固定值寫自己、Bind 寫它綁到的參數；Expression、Export 只回報狀態。讀現值用 eval()。
"""
import json


class Refused(ValueError):
    """TD refuses a request on purpose, with a code the host maps to a reply (Refactor.62). Anything without a code is
    a failure and is reported as one, never as a refusal. TD 刻意拒絕一個請求，帶代碼讓宿主轉成回覆；沒有代碼的是失敗，照實回報。"""
    code = 'host_rejected'

from td_text import tr

COUNTS = {'float': 1, 'vec2': 2, 'vec3': 3, 'vec4': 4}
PAGES = {'vec': ('valuex', 'valuey', 'valuez', 'valuew'), 'color': ('rgbr', 'rgbg', 'rgbb', 'alpha')}
PAGE_NAMES = {'vec': 'Vectors', 'color': 'Colors'}


def page_of(uniform):
    return 'color' if uniform.get('color') is True else 'vec'


def values_of(uniform):
    value = uniform['value']
    return [value] if COUNTS[uniform['type']] == 1 else list(value)


def mode_name(par):
    return str(par.mode).split('.')[-1].upper()


def par(shader, page, index, suffix):
    return getattr(shader.par, '%s%d%s' % (page, index, suffix))


def sequence(shader, page):
    return getattr(shader.seq, page)


def find_row(shader, page, name):
    for index in range(sequence(shader, page).numBlocks):
        if par(shader, page, index, 'name').eval() == name:
            return index
    return None


def writable(p):
    """The parameter whose `val` holds this component's constant value, or None when something else
    drives it. Bind is followed to its master (Q56), never by writing the bound parameter's `val`
    (td-issues/par-val-on-bind.md). 這個分量的常數值存在哪個參數；被別的東西驅動時回傳 None。"""
    seen = set()
    while p is not None and id(p) not in seen:
        seen.add(id(p))
        mode = mode_name(p)
        if mode == 'CONSTANT':
            return p
        if mode != 'BIND':
            return None
        master = getattr(p, 'bindMaster', None)
        p = master if hasattr(master, 'mode') and hasattr(master, 'val') else None
    return None


def write(p, value):
    target = writable(p)
    if target is None:
        return False
    target.val = value
    return True


def state(p):
    """What the editor shows for one component (Q56, Q60): values only for constant and bound ones.
    給編輯器顯示的狀態：只有固定值與 Bind 帶數值。"""
    mode = mode_name(p)
    if mode == 'CONSTANT':
        return {'mode': 'constant', 'value': p.eval()}
    if mode == 'BIND':
        return {'mode': 'bind', 'value': p.eval(), 'editable': writable(p) is not None, 'text': p.bindExpr}
    if mode == 'EXPRESSION':
        return {'mode': 'expression', 'text': p.expr}
    if mode == 'EXPORT':
        source = getattr(p, 'exportOP', None)
        family = getattr(source, 'family', '') or ''
        return {'mode': 'export', 'text': (family + ' Export').strip(), 'source': export_source(p)}
    return {'mode': 'other', 'text': mode.lower()}


def export_source(p):
    source, item = getattr(p, 'exportOP', None), getattr(p, 'exportSource', None)
    if source is None:
        return ''
    name = getattr(item, 'name', None)
    return source.name + (':' + name if name else '')


def states(shader, uniforms):
    """Each Uniform's components as TD has them now, by declaration ID. 各 Uniform 各分量的現況。"""
    result = {}
    for uniform in uniforms:
        page = page_of(uniform)
        row = find_row(shader, page, uniform['name'])
        if row is None:
            continue
        suffixes = PAGES[page][:COUNTS[uniform['type']]]
        result[uniform['id']] = [state(par(shader, page, row, suffix)) for suffix in suffixes]
    return result


def _leaving(uniforms, previous):
    """(page, name) of rows Grape is about to remove or rename: they are not in the way.
    即將拿掉或改名的列（頁、名字）：不算擋路。"""
    now = {u['id']: u for u in uniforms}
    return {(page_of(old), old['name']) for old in previous
            if old['id'] not in now or now[old['id']]['name'] != old['name'] or page_of(now[old['id']]) != page_of(old)}


def _taken_over(shader, uniforms, previous):
    """IDs of renamed Uniforms whose new name is a row someone made in TD on the same page: that row
    is taken over and the Uniform's own row goes (human 2026-10-09). 改名成同頁 TD 上已有的列：接手它，原本的列拿掉。"""
    before, leaving = {u['id']: u for u in previous}, _leaving(uniforms, previous)
    return {u['id'] for u in uniforms if u['id'] in before and before[u['id']]['name'] != u['name']
            and page_of(before[u['id']]) == page_of(u) and (page_of(u), u['name']) not in leaving
            and find_row(shader, page_of(u), u['name']) is not None}


def check_rows(shader, uniforms, previous):
    """Refuse before anything changes (Refactor.47, 48.2):
    - a row to rename has its name driven in TD (legacy did the same);
    - a Uniform taking a name for the first time finds that name on the other page (Colors vs Vectors:
      two rows of one name would fight over one uniform; human 2026-10-09).
    A row of that name on its own page is taken over instead (see apply).
    動手前先拒絕：要改名的列名字被 TD 驅動；第一次用這個名字、卻在另一頁已有同名的列。同一頁有同名的列則接手（見 apply）。"""
    before, leaving = {u['id']: u for u in previous}, _leaving(uniforms, previous)
    taken = _taken_over(shader, uniforms, previous)
    for uniform in uniforms:
        page, old, name = page_of(uniform), before.get(uniform['id']), uniform['name']
        renamed = old is not None and old['name'] != name and page_of(old) == page
        if renamed and uniform['id'] not in taken:
            row = find_row(shader, page, old['name'])
            if row is not None and mode_name(par(shader, page, row, 'name')) != 'CONSTANT':
                raise Refused('The name of Uniform ' + old['name'] + ' is driven in TD, so TD-Grape cannot rename it to '
                                 + name + '. Set the name back to a constant in the GLSL OP first.')
        if old is None or renamed:
            other = 'vec' if page == 'color' else 'color'
            if find_row(shader, other, name) is not None and (other, name) not in leaving:
                raise Refused('The ' + PAGE_NAMES[other] + ' page of the GLSL OP already has a row named ' + name
                                 + ', but this Uniform belongs on the ' + PAGE_NAMES[page] + ' page. Choose another name, '
                                 'or rename or remove that row in TD.')


def _pristine_only_row(shader, page):
    seq = sequence(shader, page)
    if seq.numBlocks != 1 or par(shader, page, 0, 'name').eval():
        return False
    parts = [par(shader, page, 0, suffix) for suffix in PAGES[page]]
    return all(mode_name(p) == 'CONSTANT' and p.isDefault for p in parts)


def _add_row(shader, page):
    if _pristine_only_row(shader, page):
        return 0  # the untouched first row (legacy did the same) 沒被動過的第一列
    seq = sequence(shader, page)
    seq.numBlocks += 1
    return seq.numBlocks - 1


def _remove_row(shader, page, row, name, notices, constant_mode):
    seq = sequence(shader, page)
    if seq.numBlocks > 1:
        seq.destroyBlock(row)  # later rows move up with what drives them (tested in TD) 後面的列連同驅動往前移
        return
    # TD keeps one row: clear the name and what drives it (human 2026-10-09, new behaviour; legacy
    # kept the drivers). Export cannot be removed from this end. TD 一定留一列：清名字與驅動；Export 動不了。
    name_par = par(shader, page, row, 'name')
    if mode_name(name_par) != 'CONSTANT':
        name_par.mode = constant_mode
    name_par.val = ''
    for suffix in PAGES[page]:
        p = par(shader, page, row, suffix)
        mode = mode_name(p)
        if mode in ('EXPRESSION', 'BIND'):
            p.mode = constant_mode
        elif mode == 'EXPORT':
            notices.append(tr('uniform.exportRemains',
                              '{uniform} was deleted, but {parameter} of the GLSL OP is still driven by an Export from {origin}; TD-Grape cannot remove that from here.',
                              uniform=name, parameter=p.name, origin=export_source(p)))


def apply(shader, uniforms, previous, expressions, constant_mode):
    """Bring the GLSL OP's Uniform rows in line with this program. `previous` is what the last
    successful apply sent: rows Grape stopped using are removed, renamed ones renamed, and a value is
    written only when it changed in the editor since then (Q57, new behaviour) — TD's own changes stay.
    A new row gets the graph's value; a preset Uniform also gets its expression (Q61), once.
    Returns notices for people. 讓 GLSL OP 的 Uniform 列符合這次的程式：拿掉不再用的、改名、只寫在編輯器改過的值；
    新的列寫圖裡的值，預設 Uniform 另寫一次 expression。"""
    notices = []
    before = {u['id']: u for u in previous}
    now = {u['id']: u for u in uniforms}
    taken = _taken_over(shader, uniforms, previous)
    for page in PAGES:
        gone = [old for ident, old in before.items() if page_of(old) == page
                and (ident not in now or page_of(now[ident]) != page or ident in taken)]
        found = [(find_row(shader, page, old['name']), old['name']) for old in gone]
        # Highest row first, so the rows still to remove keep their positions. 由下往上刪，其餘的位置不變。
        for row, name in sorted((f for f in found if f[0] is not None), key=lambda f: f[0], reverse=True):
            _remove_row(shader, page, row, name, notices, constant_mode)
    # Rows to rename are all found before any name changes, so names can be swapped in one step.
    # 先找齊所有要改名的列再改，名字互換也行。
    renames = []
    for uniform in uniforms:
        page, old = page_of(uniform), before.get(uniform['id'])
        if old and page_of(old) == page and old['name'] != uniform['name'] and uniform['id'] not in taken:
            row = find_row(shader, page, old['name'])
            if row is not None:
                renames.append((page, row, uniform['name']))
    for page, row, name in renames:
        par(shader, page, row, 'name').val = name
    for uniform in uniforms:
        page, old = page_of(uniform), before.get(uniform['id'])
        suffixes = PAGES[page][:COUNTS[uniform['type']]]
        row = find_row(shader, page, uniform['name'])
        if row is None:
            row = _add_row(shader, page)
            par(shader, page, row, 'name').val = uniform['name']
            for suffix, value in zip(suffixes, values_of(uniform)):
                par(shader, page, row, suffix).val = value
            entry = uniform.get('entry')
            if entry is not None:
                par(shader, page, row, suffixes[0]).expr = expressions[entry]
            if old is not None:
                notices.append(tr('uniform.rowRecreated',
                                  'The GLSL OP row of {uniform} was missing (changed or deleted in TD); TD-Grape added it again.',
                                  uniform=uniform['name']))
            continue
        if old is None or uniform['id'] in taken:
            # A row someone made in TD with this name: taken over, keeping its values and what drives
            # them (new behaviour, human 2026-10-09; legacy refused the name). Said once.
            # TD 上已有同名的列：接手，保留它的值與驅動（新行為；舊產品拒絕這個名字）。說一次。
            notices.append(tr('uniform.rowAdopted',
                              '{uniform} uses the row already on the GLSL OP; its values and what drives them are kept.',
                              uniform=uniform['name']))
            continue
        if page_of(old) != page or json.dumps(values_of(old)) == json.dumps(values_of(uniform)):
            continue  # a value not changed in the editor: TD keeps its own 不是在編輯器改的值：TD 留著自己的
        for suffix, value, was in zip(suffixes, values_of(uniform), values_of(old) + [None] * 4):
            if value != was:
                write(par(shader, page, row, suffix), value)
    return notices


def live(shader, uniform, value, before):
    """A value while it changes (Uniform C): only the components that changed in the editor since
    `before` (the editor's previous value), and only where Grape may (constant or bound) — the editor
    sends the whole vector, and the other components may have been changed in TD (Q57).
    改變中的值：只寫這次在編輯器變了的分量，而且只寫 Grape 能寫的；其他分量可能是在 TD 改的。"""
    page = page_of(uniform)
    row = find_row(shader, page, uniform['name'])
    if row is None:
        return False
    one = COUNTS[uniform['type']] == 1
    values, was = ([value], [before]) if one else (list(value), list(before))
    wrote = False
    for suffix, component, old in zip(PAGES[page], values, was):
        if component != old:
            wrote = write(par(shader, page, row, suffix), component) or wrote
    return wrote


def retire_export_table(comp, shader):
    """Grape OPs from Refactor.44–46 drive the GLSL OP through the binding table's DAT Export. Turn it
    off once, keeping what it drove: names and numbers become constants, preset expressions become
    expressions. R.44～46 的 Grape OP 用綁定表 Export 驅動；關掉一次，把它驅動的內容留成常數或 expression。"""
    table = comp.op('uniforms')
    if table is None or not getattr(table, 'export', False):
        return False
    rows = []
    for index in range(1, table.numRows):
        name, text = table[index, 1].val, table[index, 2].val
        p = getattr(shader.par, name, None)
        if p is not None:
            rows.append((p, text, p.eval()))
    table.export = False
    for p, text, value in rows:
        try:
            float(text)
            p.val = value
        except ValueError:
            if text[:1] in ('"', "'"):
                p.val = value  # a quoted name 加引號的名字
            else:
                p.expr = text  # a preset expression, e.g. absTime.seconds
    table.clear()
    return True
