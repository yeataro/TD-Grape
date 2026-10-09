"""Grape OP identity, embedded in every Grape OP as GrapeControls/identity (design-interview Q32).

The identity is the read-only string parameter Grapeid. TD itself is the registry: a Grape OP
is found by its tag, and when it is created (project start, .tox load, copy, paste) it checks
one frame later whether another Grape OP already uses its ID and takes a new one only then.
A cut-and-paste keeps its ID; a copy gets a new one. Templates never take an ID.
Grape OP 的身分：唯讀字串參數 Grapeid。TD 本身就是名冊——靠 tag 找到 Grape OP；建立時（開專案、
載入 .tox、複製、貼上）延後一幀檢查有沒有別的 Grape OP 用同一個 ID，有才換號。剪下貼上保留原號，
複製的那份換號；範本永遠不取號。
"""
import re
import uuid

TAG = 'grapeOP'
TEMPLATES_TAG = 'grapeTemplates'
VALID = re.compile(r'[0-9a-f]{32}\Z')


def grape_op():
    # This DAT lives in <Grape OP>/GrapeControls.
    return me.parent().parent()


def in_template(comp):
    node = comp.parent()
    while node is not None:
        if TEMPLATES_TAG in node.tags:
            return True
        node = node.parent()
    return False


def identity(comp):
    par = getattr(comp.par, 'Grapeid', None)
    return par.eval() if par is not None else ''


def others_using(comp, ident):
    return [o for o in root.findChildren(tags=[TAG]) if o is not comp and o.valid
            and identity(o) == ident and not in_template(o)]


def assign(comp):
    comp.par.Grapeid.val = uuid.uuid4().hex
    return comp.par.Grapeid.eval()


def check(comp):
    """Keep the ID unless it is missing, malformed or already used by another Grape OP."""
    if comp is None or not comp.valid or in_template(comp):
        return None
    ident = identity(comp)
    if not VALID.match(ident):
        return assign(comp)  # a fresh Grape OP from the template: nothing to report
    if others_using(comp, ident):
        new = assign(comp)
        # Visible on the status bar: a copy changed its identity. 複本換號，顯示在狀態列。
        try:
            ui.status = 'Grape ' + comp.name + ': another Grape OP uses the same Grape ID, so this one took a new ID.'
        except NameError:  # outside TD (unit tests) TD 之外（單元測試）
            pass
        return new
    return ident


def onCreate():
    comp = grape_op()
    if in_template(comp):
        return
    # Other OPs may not exist yet, or not have loaded their parameters, while this one is created.
    # 建立當下其他 OP 可能還沒建立或參數還沒載入，延後一幀再查。
    run("op(args[0]).op('GrapeControls/identity').module.check(op(args[0]))", comp.id, delayFrames=1)
