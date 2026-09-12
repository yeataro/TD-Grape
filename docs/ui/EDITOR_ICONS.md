# Editor website icons

Every PNG is independently rendered from `src/assets/brand/app-icon.svg` at its actual target dimensions; no small raster is enlarged. `tools/build/generate_editor_icons.cjs` regenerates source assets and the embedded DAT bundle. It uses the project Playwright runtime (or `PLAYWRIGHT_MODULE`) and optionally `CHROME_EXECUTABLE`.

- PNG sizes: 16, 32, 48, 64, 128, 180, 192, 256, 512 and 1024 px.
- HTML declares 32/48/64/128/256 PNG favicons, the scalable SVG and a multi-image ICO.
- `favicon.ico` embeds the independently rendered 16/32/48/64/128/256 PNGs.
- Manifest declares 192/512/1024 PNGs, exact sizes, image/png and purpose `any`.
- Apple touch icon is a dedicated 180 px PNG.
- The manifest does not include session credentials. It does not install a PWA, introduce a service worker or change the Editor Launch decision/arguments.

PNG/ICO/manifest bytes are bundled into `web_icons.json` for embedding as `web_icons_json` on the manager. `refresh_assets()` serves them with the correct MIME types. They remain usable after a normal product install without external image-file paths. The generator must run whenever the canonical icon SVG changes.

## Verification and current limits

All PNG dimensions, ICO directory entries, manifest declarations, native served bytes and MIME types are checked. Windows Chrome and Edge were actually opened as app windows with isolated test profiles at 168 DPI (175%). Both exposed the grape artwork in the native small icon (28 px) and large icon (56 px), read through WM_GETICON/GetIconInfo. User browser settings and caches were not changed. This verifies native window icon selection, not a separately installed or pinned PWA shortcut.

Computer Use refused the subsequent visual window capture because it could not confidently determine the App Mode URL. Taskbar visual confirmation was therefore not completed. macOS hardware is unavailable; Dock and macOS App Mode checks remain pending. Do not mark either as passed based on asset dimensions or Windows checks. Browser-specific cache work is deferred until an observed failure requires it.

The private Tailscale debug gateway still has its original static-asset allowlist, which excludes the new PNG/ICO/manifest paths. It was not modified. Direct native Editor URLs serve the full asset set; that gateway retains the existing SVG fallback and is not the acceptance environment for these new resources.

Sources: [Manifest icon dimensions and selection](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons), [Apple website icons](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html), [Windows WM_GETICON](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-geticon).
