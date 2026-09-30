# v0.8.271 — Functional Preview

This release expands TD-Grape's material tools, procedural nodes, graph editing, and workspace controls. It collects the changes since [0.8.163](https://github.com/yeataro/TD-Grape/releases/tag/0.8.163).

**TD-Grape remains a functional preview, not yet Alpha.** Development on the current version has continued, with the focus on completing and refining the preview before a planned architectural refactor. The scope and timing of that refactor remain open.

## Materials and procedural tools

- **Phong and PBR materials:** integrated material nodes, editable basic material graphs, and textured presets with separate material-map inputs and normal mapping. PBR Material also provides an Ambient Strength input, defaulting to zero.
- **Voronoi:** a new built-in node with 1D–4D coordinates, F1, F2, Smooth F1, Distance to Edge, N-Sphere Radius, distance metrics, fractal controls, and normalization where applicable. Its feature set follows familiar Voronoi workflows; it does not promise identical results to Blender.
- **Editable material Subgraphs:** Color Multiply, Normal Map, Displacement, View Direction, Fresnel, Facing, Mapping, Rim Light, Subsurface Approx, and Bump. Texture sampling stays outside the relevant helpers so they can accept values from textures or other nodes. Subsurface Approx provides back-light transmission rather than full spatial subsurface scattering.
- **Fragment controls:** Discard, Depth Output, TDDither, and TDAlphaTest. Nodes with terminal effects retain their upstream dependencies even without output sockets. MAT Color Output has separate Dither, Alpha Test, and Output Color Space Conversion switches, enabled by default on newly created nodes and applied to Buffer 0.
- **Expanded GLSL and TD coverage:** more math, bitwise, derivative, texture-sampling, lighting, and geometry functions; richer Vertex-to-Pixel interfaces; named SOP/POP texture attributes and current-instance UV access. Custom Sampler sources can also be used in MAT Vertex with appropriate sampling operations.

## Graph editing and parameter workflows

- **Wire, Link, and Router tools:** alternate connection display, compact routing, bulk Wire/Link conversion, and navigation to connected nodes. Connected-source names in Parameter panels can now be clicked to select and frame their source.
- **Math and Switch:** multi-input arithmetic with readable operation summaries, and a typed Switch with dynamic case inputs and a default value.
- **Custom parameter editing:** create native controls by dragging supported Uniform, Spec Constant, or 2D Sampler sources into the floating editor. Organize pages and parameters, edit labels/defaults/ranges, and undo definition changes.
- **Sources and Subgraphs:** reorganized source categories, more accessible Attributes, clearer library tabs, and readable filenames for newly saved personal Subgraphs.
- **Generated GLSL:** inspect the current stage's code in a workspace panel or a canvas display node.

## Workspace, preview, and appearance

- **Floating panels:** pop out Parameter, OP Parameter, Preview, or Help. Parameter/OP Parameter share the upper-right slot; Preview/Help share the lower-right slot. All can collapse, Preview/Help share resizable dimensions, and floating Parameter offers experimental shortcut input sockets.
- **Saved layouts:** floating-panel visibility, collapse, sizes, and header visibility are included in layout save/apply and JSON export/import. Default closes all floating panels. The new optional **Minimal** preset hides the header and both sidebars while opening floating Parameter and Preview panels.
- **MAT/TOP viewers:** separate viewer controls, editable viewer parameters, automatic Home when switching targets, and corrected remote pan/zoom input handling.
- **Canvas navigation:** middle-mouse dolly on empty canvas. An optional low-zoom overview simplifies node cards below 30% and allows zooming down to 20%, while retaining card dimensions.
- **Five interface languages:** English, Traditional Chinese, Japanese, French, and Korean. This release also refines light/dark text colors, matrix/structure connection colors, translated parameter layouts, and interface scaling, including fixes for temporary-wire alignment on iPad.

## Compatibility and project status

The primary native validation environment is **Windows with TouchDesigner 2025.32820**. macOS, Safari, and physical iPad coverage remain incomplete; desktop browser and simulated-touch checks do not establish full device compatibility.

Normal-map workflows require geometry with the necessary UVs, normals, and tangents. Displacement does not subdivide geometry or automatically rebuild its normals. Advanced native material parity and some resource-binding workflows remain incomplete.

The interface and graph format may still change during the preview stage. Keep a copy of existing projects before upgrading. Generated and applied GLSL can continue running without the editor or manager when the required TD operators, textures, and parameter bindings are retained, within the verified TD version range.

See the [README](https://github.com/yeataro/TD-Grape#readme) for installation and the [documentation index](https://github.com/yeataro/TD-Grape/blob/main/docs/README.md) for feature details and known limitations.

## Credits

Project direction and review by [@yeataro](https://github.com/yeataro), with implementation and revisions by OpenAI Codex (GPT-6 Astra). Initial specification collaboration: Fable 5.1.

Includes [TDFam](https://github.com/dotsimulate/TDFam) by Lyell Hintz (dotsimulate), Dan Molnar (Function Store), and other contributors. See the repository for [full credits and third-party license notices](https://github.com/yeataro/TD-Grape#third-party-acknowledgments).
