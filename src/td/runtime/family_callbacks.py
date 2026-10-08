"""TDFam callbacks for the Grape menu (OP Create / Tab); no changes to TDFam internals.

Placing a Grape OP is a plain copy of its template: the template already carries the default
graph and GLSL, and the new Grape OP gives itself an ID when it is created (design-interview
Q32, Q6). Nothing here needs the editor service or the Manager.
TDFam 的回呼：放置 Grape OP 就是複製範本；範本已帶預設圖與 GLSL，新 OP 建立時自己取號。
不需要編輯服務或 Manager。
"""


def onPlaceOp(info):
    return True


def onPostPlaceOp(info):
    pass


def onPreUpdate(info):
    # TDFam replaces whole COMPs on update; Grape OPs are updated by the Grape-OP round, not here.
    return False


def onPreStub(info):
    return False
