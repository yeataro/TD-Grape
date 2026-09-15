# TD Remote Panel — experimental 0.1

One TouchDesigner Panel COMP or native OP Viewer, streamed to one browser over
WebRTC, with mouse events returned to that same panel. The component owns its
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
4. Disconnect the current browser before connecting another. **Reset Connection**
   releases a stale receiver.

The standalone TOX starts inactive, with LAN disabled and Test Panel selected.
The development TOE may preserve the developer's explicitly selected settings.
When LAN is enabled, anyone who can reach this service can view and operate the
configured panel; this prototype has no login. No STUN, TURN or external signaling
service is used. Internet routing and multiple receivers are outside this preview.

## Current behavior

- The browser displays the actual TD source path, connection state and received
  resolution. TD remains the place to choose the target.
- Mouse buttons, movement and wheel events use native `PanelCOMP.interactMouse`.
  Viewer gestures keep TD's own behavior. Browser coordinates account for video
  letterboxing and TD's mirrored video transport.
- No keyboard, touch gestures, or translation of native popup windows yet.
- Only a connected receiver enables video output. Static panels are cooked at
  the configured frame rate while streaming so WebRTC keeps receiving frames.
  TD's available cook rate and WebRTC adaptation can reduce the delivered rate
  or resolution. Disconnection disables the stream and releases held mouse input.
- Changes to source invalidate older mouse messages and release held buttons.
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

`connect()` and `disconnect()` control the session. `panel-state`, `panel-source`
and `panel-format` events expose state, TD paths and decoded video dimensions.
`index.html`, `demo.js` and `style.css` implement the small test page.

## Development

All runtime scripts and browser assets are embedded as DAT text. A copied TOX
does not read these files at runtime. `build.py` refreshes those DATs from this
directory and preserves existing parameter values and OP identities.

From the repository with a running development bridge:

```text
python tools/dev/submit_job.py tools/dev/jobs/build_remote_panel.py
python tools/dev/submit_job.py tools/dev/jobs/export_remote_panel.py
python tools/dev/submit_job.py tests/td/test_remote_panel.py --report remote-panel
```

The native test builds the component outside Grape, rebuilds it without duplicate
controls, reloads its TOX and checks source selection, asset embedding, network
boundaries and preservation of existing shader states.

Native API references: [WebRTC DAT](https://docs.derivative.ca/WebRTC_DAT),
[PanelCOMP](https://docs.derivative.ca/PanelCOMP_Class),
[Derivative's browser example](https://github.com/TouchDesigner/WebRTC-Remote-Panel-Web-Demo).
