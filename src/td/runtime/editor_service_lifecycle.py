"""Start/create/exit hooks. Editor HTTP serving needs no TD frame callbacks."""


def onStart():
    if parent().par.Active.eval():
        parent().ext.EditorServiceExt.Start()


def onCreate():
    if parent().par.Active.eval():
        parent().ext.EditorServiceExt.Start()


def onExit():
    parent().ext.EditorServiceExt.Stop()
