def onValueChange(par, prev):
    parent().op('runtime').module.changed(par.name)

def onPulse(par):
    parent().op('runtime').module.pulse(par.name)
