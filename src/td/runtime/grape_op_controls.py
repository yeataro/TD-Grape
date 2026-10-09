"""Grape page controls, embedded in every Grape OP as GrapeControls/editor_control (Q45).

Open Editor opens this Grape OP's editor as an app window when the default browser supports it,
Open in Browser always in the normal browser; both go through the main component, found by its
global OP shortcut `TDGrape` (design-interview Q49: the one way, no fallback). When the editor
service is off, TD's own dialog asks before starting it (Q45). GLSL Parameters opens the inner
GLSL TOP's parameters. Regenerate ID gives this Grape OP a new identity. Grapeid is read-only in
the UI; a script that writes an invalid or already used ID is reverted (Q32). Opening never
changes the Grape OP. Notable states go to TD's status bar and the `status` DAT.
Grape 頁的控制：Open Editor（能開 App 視窗就開）／Open in Browser 透過全域捷徑 TDGrape 找主組件；
服務沒開時用 TD 對話框先問；GLSL Parameters 打開內部 GLSL TOP 的參數；Regenerate ID 換新身分；
Grape ID 介面上唯讀，被程式改壞時改回。開編輯器不改這個 Grape OP 的任何設定。
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
        except NameError:  # outside TD (unit tests) TD 之外（單元測試）
            pass


def _identity_module(comp):
    return comp.op('GrapeControls/identity').module


def _manager():
    if not hasattr(op, MAIN_SHORTCUT):
        return None, 'The TD-Grape main component is not in this project. Add it to edit this Grape OP.'
    main = getattr(op, MAIN_SHORTCUT)
    manager, editor = main.op('GrapeManager'), main.op('GrapeEditor')
    if manager is None or editor is None:
        return None, 'The TD-Grape main component is incomplete (GrapeManager or GrapeEditor is missing).'
    service = editor.ext.EditorServiceExt
    if service.http is None:
        # The service may have been turned off on purpose, and starting it may open it to the
        # network (Allow LAN): ask first (Q45). 服務可能是故意關的，啟動也可能對區網開放：先問。
        choice = ui.messageBox('TD-Grape', 'The TD-Grape editor service is not running.\n'
                               'Start it and open the editor?', buttons=['Start', 'Cancel'])
        if choice != 0:
            return None, 'The editor was not opened: the TD-Grape editor service is off.'
        editor.par.Active = True
        if not service.Start():
            return None, 'The TD-Grape editor service could not start: ' + editor.par.Serviceerror.eval()
    if manager.ext.GrapeManagerExt.queue is None:
        return None, 'The TD-Grape editor service is running but not connected to the Manager.'
    return manager, None


def onPulse(par):
    comp = par.owner
    if par.name == 'Regenerateid':
        ident = _identity_module(comp).assign(comp)
        _status(comp, 'took a new Grape ID.', state='Identity changed', grapeId=ident)
        return
    if par.name == 'Glslparameters':
        comp.op('shader').openParameters()
        return
    if par.name not in ('Openeditor', 'Openinbrowser'):
        return
    try:
        manager, problem = _manager()
        if problem:
            _status(comp, problem, state='Editing unavailable', message=problem)
            return
        url = manager.ext.GrapeManagerExt.Open(comp, app=par.name == 'Openeditor')
        _status(comp, None, state='Editor opened', url=url)
    except Exception as error:
        if getattr(error, 'code', None) is None:
            raise  # a failure, shown by TD as an error, not as "editing unavailable" (Refactor.62) 是失敗，由 TD 照實顯示
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
