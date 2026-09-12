"""TDFam's public placement callbacks; no changes to TDFam internals."""
def onPlaceOp(info):
    return True

def onPostPlaceOp(info):
    owner=parent()
    runtime=owner.op('runtime').module
    runtime.start(owner)
    runtime.register_shader(info['clone'],fresh=True)

def onPreUpdate(info):
    # 0.2 supports family creation. TDFam replaces whole COMPs on update;
    # enable that only once all public parameter associations can be migrated.
    return False

def onPreStub(info):
    # Generated materials remain usable without the editor in 0.2.
    return False
