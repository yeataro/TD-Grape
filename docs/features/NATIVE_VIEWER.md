# Native COMP Viewer — 2026-09-12

The preview panel has an Open Viewer action on the local editor entry. It opens the current graph's Grape COMP with `openViewer(unique=False, borders=True)` on TD's main thread. Repeated requests bring the existing viewer forward. It does not open the internal GLSL OP's parameter dialog, apply drafts, compile, save the TOE, or change the web preview image source. Window placement is controlled by TouchDesigner.

The working direct entry is `127.0.0.1`. The browser recognizes localhost and IPv6 loopback aliases conservatively, but the existing listener still requires its exact destination Host and currently binds IPv4; this feature does not broaden that listener contract. LAN/Tailscale/other-host browser entries hide the action. The authenticated endpoint requires a loopback peer and destination, matching HTTP Origin plus the browser's actual origin supplied in the request, and no standard forwarding headers. The actual browser origin also prevents the existing remote proxy's Host/Origin rewriting from enabling the action in the ordinary Grape UI. This is an environment boundary, not proof of physical presence or a defense against a trusted local process/proxy intentionally disguising requests.

The native GLSL parameter button remains its existing separate action. MAT image capture via OP Viewer TOP/COMP is a separate pending change.

Validation: 10 Python tests (3 viewer cases plus 7 real listener regressions), 7 Chrome cases covering local/remote visibility, request payload, failure/retry and localization; 5 live Windows TD checks including actual MAT/TOP windows, reuse after repeated requests, and preservation of all user Shader documents. Test windows and isolated components were removed. macOS native window behavior remains to be tested.

Run `python -m unittest test_native_viewer` in src. Browser fixture: `node tests/browser/test_native_viewer.cjs SOURCE_DIR STATE_JSON REPORT_DIR`, with PLAYWRIGHT_MODULE/CHROME_EXECUTABLE when needed.

Reference: [Derivative OP floating viewer methods](https://derivative.ca/UserGuide/WindowCOMP_Class#Viewers).
