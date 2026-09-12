# Editor Launch

Two native parameter pulses are retained on Grape Shaders and their manager:

- **Open Editor** asks the OS which browser handles this URL scheme. A verified browser/OS combination launches an independent app window. Missing detection, unsupported browsers, missing executables, process creation errors or an immediate nonzero startup exit use the normal system browser instead.
- **Open in Browser** uses TouchDesigner's normal `ui.viewFile` URL opening directly, with no browser detection or app-window logic.

The launcher is a separate `editor_launch.py` module, embedded as a DAT on the manager. Controls own the Shader URL and delegate launch policy. The browser support table, detection and process handling are independent of shader compilation and graph rules.

Current verified app-window combinations: Windows Google Chrome and Windows Microsoft Edge. Both were launched as temporary, isolated app windows on the development PC and identified by their window titles; only test-owned windows were closed. Detection matches the protocol association executable and ProgID, rather than picking an installed browser. Chromium forks and unknown associations do not inherit support. No registry/default-browser/profile settings are changed.

macOS uses Launch Services to identify the preferred URL handler, but its app-window combinations remain disabled until tested on macOS hardware. It reliably takes the ordinary default-browser route. Safari and unverified browsers therefore remain usable. No macOS native verification is claimed. The public UI never mentions App Mode or exposes launch flags.

Process startup is checked on the TD main thread through its delayed callback scheduler; the render/UI thread is not blocked. Nonzero exit triggers normal opening once. A zero exit is accepted as handoff to an already-running browser. Monitoring is bounded to roughly three seconds; renderer crashes later in a session are outside launch handling. An error from the normal system opener is not silently swallowed.

Sources: [Windows association strings](https://learn.microsoft.com/en-us/windows/win32/api/shlwapi/ne-shlwapi-assocstr), [Chromium launch switches](https://chromium.googlesource.com/chromium/src.git/+/master/chrome/common/chrome_switches.cc), [Apple preferred URL handler](https://developer.apple.com/documentation/coreservices/1441725-lscopydefaulthandlerforurlscheme).

Validation: fourteen policy tests cover detection/launch/startup failures, delayed failure, successful process handoff, safe argument passing, unknown platforms/browsers, missing files and normal-opener errors. Native integration verifies both pulses route to the intended opener without publishing its private URL; shaders/GLSL/server identity remain guarded. Existing and new Shader registration preserves the two pulses.

Live delivery does not replace the embedded runtime DAT or restart the server. Small wrappers retain the current registration/master preparation functions and add their launcher entry. The canonical runtime source has the corresponding registration changes for the pending full bootstrap migration. No TOE save or release packaging is performed.
