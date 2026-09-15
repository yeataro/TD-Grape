def onStart():
    parent().op('runtime').module.start()

def onCreate():
    parent().op('runtime').module.start()

def onFrameStart(frame):
    parent().op('runtime').module.tick()

def onExit():
    parent().op('runtime').module.stop()
