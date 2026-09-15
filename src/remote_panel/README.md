# TD Remote Panel — experimental 0.1.4

One TouchDesigner Panel COMP or native OP Viewer, streamed to one browser over
WebRTC, with mouse and translated touch events returned to that same panel. The component owns its
server, signaling, capture and control channel. It has no dependency on Grape's
graph, compiler or editor.

## Try it

The development TOE contains `TD_Grape/remote_panel`. The standalone
`TD-Remote-Panel.tox` in this directory can also be loaded into another project.

1. Choose **Test Panel** for the included button and slider, **OP Viewer** for a
   **Target OP**, or **Panel** for an existing Panel COMP.
2. Set an unused **Web Port**, then enable **Active**.
3. Press **Open in Browser** or open **Local URL**. For another device, enable
   **Allow LAN Connections** and use one of **LAN URLs**.
4. Click the picture to focus it. In **OP Viewer** mode, press **H** to call TD's
   `resetViewer()` on that target. Click elsewhere or press **Tab** to leave the
   panel. This is not TD's native H/Home: on the tested MAT it resets display
   options but leaves the current rotation intact. Native homing remains unresolved.
5. A new connection takes control and disconnects the previous browser. The old
   page shows **Taken over** and stays disconnected until its user presses
   **Connect** again. **Reset Connection** releases a stale receiver.

The standalone TOX starts inactive, with LAN disabled and Test Panel selected.
The development TOE may preserve the developer's explicitly selected settings.
When LAN is enabled, anyone who can reach this service can view and operate the
configured panel; this prototype has no login. No STUN, TURN or external signaling
service is used. Internet routing and multiple receivers are outside this preview.

## Current behavior

- The browser displays the actual TD source path, connection state and received
  resolution. In the standalone page, TD chooses the target. Grape integration
  chooses its current shader when the browser acquires the connection.
- Mouse buttons, movement and wheel events use native `PanelCOMP.interactMouse`.
  Viewer gestures keep TD's own behavior. Browser coordinates account for video
  letterboxing and TD's mirrored video transport.
- Touch: **tap** clicks, **one-finger drag** performs a left drag. A 3D OP Viewer
  (MAT, SOP, POP or object COMP) also accepts **two-finger pan** and **pinch zoom**,
  translated to TD's right drag and middle-button dolly. Pinch uses a virtual
  vertical drag rather than wheel events; its horizontal position stays fixed.
  Panel/Test Panel and other viewer types retain single-finger control.
- Two-finger pan or pinch is selected after a small movement and remains selected
  until lift. Lift all fingers before starting another gesture. A second finger
  cancels a pending tap; three fingers cancel navigation. Focus loss, pointer
  cancellation, window resize, source changes and disconnection release held
  input and discard queued movement. Browser touch gestures are disabled only
  over the video, leaving the surrounding page scrollable.
- OP Viewer mode captures the Target OP directly with OP Viewer TOP. Its companion
  OP Viewer COMP only receives mouse input, changing the same target viewer state.
  This avoids depth artifacts observed when capturing a MAT through OP Viewer COMP
  on TD 2025.32820. TOP's deprecated Allow Panel Interaction stays disabled.
  Keep the internal controller's Center/Scale at their defaults; native viewer
  pan/zoom/rotate operations are supported, additional COMP-level transforms are not.
- The unmodified **H** shortcut only runs while the connected browser panel has
  focus. IME composition, held-key repeats and modifier combinations are ignored.
  Other keys keep their normal browser behavior. Panel and Test Panel modes do
  not expose the viewer-reset action.
- Arbitrary native keyboard forwarding is unavailable in TD 2025.32820: neither
  Panel COMP nor OP Viewer COMP has `interactKeyboard`. The official webRTCPanel
  example contains a future stub, and its browser README also lists keyboard
  input as unsupported. We do not change the host's keyboard focus or inject OS
  keys. Long-press context menus and native popup windows remain outside this preview.
- Only a connected receiver enables video output. Static panels are cooked at
  the configured frame rate while streaming so WebRTC keeps receiving frames.
  TD's available cook rate and WebRTC adaptation can reduce the delivered rate
  or resolution. Disconnection disables the stream and releases held mouse input.
- Changes to source invalidate older control messages and release held buttons.
  H addresses the exact captured target; a target change cannot redirect a stale
  reset message to the next OP. Takeover releases the old mouse input and closes
  its peer before creating the replacement. Old callbacks cannot reclaim control.
- TD must be running with Cooking enabled. A heartbeat failure shows a reconnect
  message. This component does not bypass TD's global Cooking switch.
- This preview is separate from Grape's existing Output Preview. Intermediate
  shader compilation and shared preview selection have not been added.

## Browser integration

`remote-panel.js` is a framework-independent custom element with Shadow DOM:

```html
<script type="module" src="./remote-panel.js"></script>
<td-remote-panel endpoint="http://127.0.0.1:8920/" autoconnect></td-remote-panel>
```

Host the module alongside the embedding page, or serve that page from the TD
component's origin. Cross-origin module loading requires appropriate HTTP headers;
the prototype server does not enable cross-origin asset access. An HTTPS page
needs a secure signaling endpoint; use the supplied HTTP test page for this preview.

`connect()` and `disconnect()` control the session. `panel-state`, `panel-source`,
`panel-format` and `panel-focus` events expose state, TD paths, decoded video
dimensions and browser focus. `touch-gestures.js` is the browser-only translation
module; embed it alongside `remote-panel.js`. `panel-source.detail.touchNavigation`
is `3d` when two-finger navigation is available, otherwise empty.
`panel-source.detail.shortcuts` lists supported
actions; currently only `reset-viewer` in OP Viewer mode. The `replaced` state
means a newer receiver took control; hosts should not auto-reconnect that state.
`index.html`, `demo.js` and `style.css` implement the small test page.

## Viewer follow-up

The user observed that a secondary OP Viewer can defer its updates until a mouse
gesture ends. This remains a TD viewer behavior to investigate separately. A
user-built single Universal Viewer or two coordinated viewers may replace this
prototype's source later. Existing **Panel** source mode can target that custom
Panel COMP without changing signaling or the browser element; a specialized
capture/control split would need its own verification.

## Development

All runtime scripts and browser assets are embedded as DAT text. A copied TOX
does not read these files at runtime. `build.py` refreshes those DATs from this
directory and preserves existing parameter values and OP identities.

From the repository with a running development bridge:

```text
node --test tests/unit/test_remote_panel_touch.mjs tests/unit/test_remote_panel_input.mjs tests/unit/test_remote_panel_size.mjs
python tools/dev/submit_job.py tools/dev/jobs/build_remote_panel.py
python tools/dev/submit_job.py tools/dev/jobs/export_remote_panel.py
python tools/dev/submit_job.py tests/td/test_remote_panel.py --report remote-panel
```

The native test builds the component outside Grape, rebuilds it without duplicate
controls, reloads its TOX and checks source selection, asset embedding, network
boundaries and preservation of existing shader states.

Touch state/adapter checks run headlessly in Node. Native event replay verified
the button, slider and 3D rotation/pan/dolly; desktop Chromium still controls the
live panel. These checks do not replace physical phone/iPad touch testing.

Native API references: [WebRTC DAT](https://docs.derivative.ca/WebRTC_DAT),
[PanelCOMP](https://docs.derivative.ca/PanelCOMP_Class),
[Geometry Viewer navigation](https://derivative.ca/UserGuide/Geometry_Viewer),
[Derivative's browser example](https://github.com/TouchDesigner/WebRTC-Remote-Panel-Web-Demo).

## Grape integration (0.8.74)

Graph UI embeds the same `<td-remote-panel>` element, served as ES modules from
its own editor origin. There is one `remote_panel` under the manager. Both the
controller COMP and the capture TOP resolve the same **Target OP**; capture stays
direct, not nested through the controller.

`POST /api/{shaderId}/remote-preview` passes through the editor's existing access
checks. On TD's main thread it reserves the resolved shader OP for 30 seconds and
returns a one-use ticket plus the module port. It does not change the active
source. The ticket is consumed at `/signal?ticket=…`; only then does the new peer
replace the previous peer and select its target. Invalid, expired, reused or
removed-target tickets cannot evict the existing peer. Tickets are memory-only,
bounded to 32 pending reservations, and cleared when the module stops. These are
handoff reservations, not a new login system for the standalone prototype.

The web component accepts `connect({ticket})`; omitting the ticket retains its
standalone behavior. Graph edits, uniform polling, returning to a tab and moving
a docked pane never reclaim a lost connection. The connection button explicitly
reclaims it; unchecking Live preview closes it. Focused viewer keys do not leak
to graph shortcuts. Source path and connection state remain visible above video.

The editor CSP permits media blobs and only the companion WebSocket port on the
same host. No worker thread calls the TD API. Change the companion Web Port before
refreshing embedded sources/reloading an editor, so its asset/CSP snapshot matches.
A future custom Viewer can replace the source behind this adapter without changing
Graph UI or duplicating stream encoders in shader components.

Multiple cloned sources are deferred. Creating them with TD Clone would not alone
solve resource lifetime: a future design would also need a receiver/source limit
and an idle lease, so forgotten Editor tabs cannot keep allocating new renderers.


## Settled viewport sizing (0.1.4 / Grape 0.8.75)

Graph UI opts into `<td-remote-panel follow-size>`. During panel drags the browser
scales the current video. After every pointer is released and layout stays stable
for 350 ms, `panel-size.js` sends the final CSS content size over the existing
control data channel. Window capture observes release events even when host
splitters stop their propagation. Hidden/collapsed/disconnected views send no
resize requests; a new connection submits that page's current viewport.

The requested dimensions use CSS pixels (not device pixel ratio), rounded to even
numbers and bounded to 64–1920 wide / 64–1080 high, scaling proportionally when
possible. Small previews retain a minimum encodable size. The active native peer
and source revision are checked before changing Width/Height; both controller
COMP and capture TOP already follow those parameters. Repeated identical sizes
are ignored. Source metadata acknowledges the result and supplies the revision
for subsequent input. The peer, data channel and video track are retained; the
encoder/decoder may briefly adjust. Actual received resolution may also reflect
WebRTC adaptation.

The standalone demo omits `follow-size`, so its native manual dimensions retain
their existing behavior. UI controls and further overlay simplification are tracked
in [preview UI notes](../../docs/discussions/PREVIEW_UI_NOTES.md).
