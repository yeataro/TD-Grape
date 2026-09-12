"""TouchDesigner Parameter Execute DAT: open this editor in the default browser."""
def onPulse(par):
    ui.viewFile(parent().op('runtime').module.start(parent()))
    return
