# Preview display and contextual Help

The caption is `Preview · width × height`, retaining the actual transmitted image dimensions. Material Preview and Output Preview remain distinct pane titles.

The Background control switches between deep gray and an alpha checkerboard. CSS custom properties centralize both backgrounds. This is a browser preference; it changes neither the PNG nor TD rendering, graph data, or network requests. Tests confirmed that the current material PNG includes real transparency.

Clicking the Preview pane, or pressing Enter/Space on its focused content region, displays a short explanation in the bottom Help pane. Parameter and node selection are retained. Selecting a node restores its Help; language changes preserve the current Help context. Help's existing collapse preference is respected.

MAT Help describes a TD-rendered PNG snapshot refreshed after apply or observed parameter changes with Auto enabled. TOP Help describes the TD output and roughly one-second visible Auto refresh. Both describe manual Refresh and pausing new requests while collapsed or on a hidden browser tab. This remains a snapshot preview, not a video stream.

Validation: 10 browser checks covering backgrounds, real PNG alpha, preferences, localization, keyboard Help, returning to node Help, distinct MAT/TOP policy text, narrow control layout, unchanged graph/revision, no write requests and no browser errors.

## Retained proposals, not behavior changes

- A collapsed bottom-right Preview entry opening over the network canvas is only a placement idea. The user retracted unclear subsequent voice input; do not infer extra background/grid requirements. Keep the current pane location until reviewed.
- Separating Texture Source (`sampler2D`) from Sample Texture/Texel Fetch is a design proposal. Keep the existing compound Texture 2D compatible. Resource ports need deliberate type-contract work; do not silently migrate old shaders.
- Uniform currently supports float/vec2/vec3/vec4 in the core. Creating a declaration still defaults to float; the missing visible creation/type choice is separate from core support. Integer and boolean families remain later work.

Live delivery only refreshes the six named static UI DATs and checks every current Shader state/graph/manifest/GLSL plus the runtime port. No TOE save, private debug helper operation, graph fixture restoration or release archive overwrite.
