"""Grape page controls, embedded in every Grape OP as GrapeControls/editor_control.

Edit opens the editor through the main component, found by its global OP shortcut `TDGrape`
(design-interview Q49: the one way, no fallback). Regenerate ID gives this Grape OP a new
identity. Grapeid is read-only in the UI; a script that writes an invalid or already used ID is
reverted (Q32). Notable states go to TD's status bar and the `status` DAT.
Grape 頁的控制：Edit 透過全域捷徑 TDGrape 找主組件開編輯器（唯一方法、不設備援）；Regenerate ID
換新身分；Grape ID 介面上唯讀，程式寫入不合格或撞號的值時改回。值得注意的狀態顯示在狀態列並寫入 status。
"""
import json

MAIN_SHORTCUT = 'TDGrape'


def _status(comp, notify=None, **state):
    data = comp.op('status')
    if data is not None:
        data.text = json.dumps(state, ensure_ascii=False, indent=2)
    if notify:
        try:
            ui.status = 'Grape ' + comp.name + ': ' + notify
        except Exception:
            pass


def _identity_module(comp):
    return comp.op('GrapeControls/identity').module


def _manager():
    if not hasattr(op, MAIN_SHORTCUT):
        return None, 'The TD-Grape main component is not in this project. Add it to edit this Grape OP.'
    manager = getattr(op, MAIN_SHORTCUT).op('GrapeManager')
    if manager is None or manager.ext.GrapeManagerExt.queue is None:
        return None, 'The TD-Grape editor service is not running.'
    return manager, None


def onPulse(par):
    comp = par.owner
    if par.name == 'Regenerateid':
        ident = _identity_module(comp).assign(comp)
        _status(comp, 'took a new Grape ID.', state='Identity changed', grapeId=ident)
        return
    if par.name != 'Edit':
        return
    try:
        manager, problem = _manager()
        if problem:
            _status(comp, problem, state='Editing unavailable', message=problem)
            return
        _status(comp, None, state='Editor opened', url=manager.ext.GrapeManagerExt.Open(comp))
    except Exception as error:
        _status(comp, str(error), state='Editing unavailable', message=str(error))


def onValueChange(par, prev):
    if par.name != 'Grapeid':
        return
    comp, identity = par.owner, _identity_module(par.owner)
    usable = lambda value: bool(identity.VALID.match(value or '')) and not identity.others_using(comp, value)
    if identity.in_template(comp) or usable(par.eval()):
        return
    # Restore the previous ID when it is still usable; otherwise take a fresh one (never loop).
    # 原值仍可用就改回原值，否則直接換新號（不會來回觸發）。
    restored = prev if usable(prev) else identity.assign(comp)
    if restored == prev:
        par.val = prev
    message = 'Grape ID must be 32 lowercase hex characters and not used by another Grape OP.'
    _status(comp, ('Grape ID restored. ' if restored == prev else 'took a new Grape ID. ') + message,
            state='Identity unchanged' if restored == prev else 'Identity changed', grapeId=restored, message=message)
