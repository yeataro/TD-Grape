"""Parameter actions only; no frame callback or periodic file scanning."""


def onValueChange(par, prev):
    parent().ext.EditorServiceExt.onParValueChange(par, prev)


def onPulse(par):
    parent().ext.EditorServiceExt.onParPulse(par)
