# Left library category tabs

> 歷史 UI 記錄。左側入口已由 [Node Browser](NODE_BROWSER.md) 的縱向展開區塊取代；浮動 Creator 仍保留分類 Tab。

Nodes / Graph Functions / Examples remain the primary tabs. Nodes now has All / Math / Constants / Uniforms / Texture / TD Built-ins subtabs. Search narrows the selected category, and returning from another primary tab restores it. Empty categories remain visible (available nodes still follow the current Shader stage).

Tabs wrap at the minimum sidebar width. The idle fill uses the same centralized category palette as node titles; selection adds a strong border and underline. The floating Add Node uses the same treatment. Keyboard arrow/Home/End and touch taps are supported. No graph or compiler mutation is involved.

Nine isolated browser checks passed for filtering, scoped search, primary-tab state, keyboard navigation, matching idle colors, minimum-width layout, localization/brand, unchanged graph, and touch taps. Chromium touch emulation does not establish iPad/Safari wire alignment; the user's separate iPad report remains a later investigation.
