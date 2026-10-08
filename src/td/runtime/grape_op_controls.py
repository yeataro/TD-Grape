"""Grape page controls, embedded in every Grape OP as GrapeControls/editor_control.

Edit opens the editor through the one running Manager, found on demand (no per-frame search,
no retry). Regenerate ID gives this Grape OP a new identity. Grapeid is read-only in the UI;
a script that writes an invalid or already used ID is reverted (design-interview Q32).
Grape 頁的控制：Edit 透過正在執行的 Manager 開編輯器（需要時才找，不輪詢、不重試）；
Regenerate ID 換一個新身分；Grape ID 在介面上唯讀，程式寫入不合格或撞號的值時改回原值。
"""
import json

MANAGER_TAG = 'grapeManager'


def _status(comp, **state):
    comp.op('GrapeControls/status').text = json.dumps(state, ensure_ascii=False)


def _identity_module(comp):
    return comp.op('GrapeControls/identity').module


def onPulse(par):
    comp = par.owner
    if par.name == 'Regenerateid':
        _status(comp, state='Identity changed', grapeId=_identity_module(comp).assign(comp))
        return
    if par.name != 'Edit':
        return
    try:
        managers = [item for item in op('/').findChildren(tags=[MANAGER_TAG])
                    if item.ext.GrapeManagerExt.queue is not None]
        if len(managers) != 1:
            _status(comp, state='Editing unavailable', message='No active Manager.' if not managers
                    else 'More than one Manager is available; select a Manager before editing.')
            return
        _status(comp, state='Editor opened', url=managers[0].ext.GrapeManagerExt.Open(comp))
    except Exception as error:
        _status(comp, state='Editing unavailable', message=str(error))


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
    _status(comp, state='Identity unchanged' if restored == prev else 'Identity changed', grapeId=restored,
            message='Grape ID must be 32 lowercase hex characters and not used by another Grape OP.')
