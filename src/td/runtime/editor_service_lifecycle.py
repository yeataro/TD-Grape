"""Start/create/exit hooks. Editor HTTP serving needs no TD frame callbacks.

"Active starts the service" is asked at three moments, each a different way the component comes to life (Refactor.67,
D10: kept apart on purpose, not merged): onStart here — the project opens; onCreate here — the component is created or
pasted; EditorServiceExt.onInitTD — its extension code is (re)loaded. They may overlap; Start returns at once when the
service already runs (`if self.http`), so starting twice is harmless.
「Active 就啟動」在三個時機各問一次，各是元件活過來的不同方式（D10：刻意分開、不合併）：這裡的 onStart——開專案；這裡的 onCreate
——建立或貼上元件；EditorServiceExt.onInitTD——擴充程式（重新）載入。可能重疊；服務已在跑時 Start 直接返回，啟動兩次無害。
"""


def onStart():
    if parent().par.Active.eval():
        parent().ext.EditorServiceExt.Start()


def onCreate():
    if parent().par.Active.eval():
        parent().ext.EditorServiceExt.Start()


def onExit():
    # TD is closing: the editors are told so (Refactor.75). TD 正在關閉：告訴編輯器。
    parent().ext.EditorServiceExt.Stop('closed')
