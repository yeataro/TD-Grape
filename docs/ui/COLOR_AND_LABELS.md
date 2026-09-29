# Color RGBA and node labels

## Composite type paint (0.8.266)

Socket, Wire, temporary Wire and Link navigation-arrow paint follows the actual GLSL type. Arrays inherit their element type's palette, including arrays of matrices or structs. Integer/double vectors use the corresponding vector-size colors; scalar and unknown types fall back to neutral scalar paint. Resource types share the sampler palette. Existing component hints and selected/hover/error feedback keep their priority.

Matrices use cool slate gray: `#A1ADB7` in Dark mode and `#5D6B78` in Light mode. Built-in and user-defined structs use a muted four-stop gradient on sockets and Wires, with plain neutral type text. Native `TDMatrix` is a struct; its `mat4` fields use the matrix palette. Hollow struct sockets retain the surrounding theme's ordinary input fill. Router and Parameter shortcut sockets follow the same distinction.

Struct gradients share the existing mixed-type Link-arrow palette: Dark `#BC9C85` → `#B690AC` → `#949FC4` → `#83B4A7`, with darker Light equivalents. Link lines keep their gray dashed presentation; their navigation arrows carry the type paint. Wire gradients use endpoint coordinates so horizontal and vertical Wires remain visible. Floating Parameter drag previews carry their gradient definitions into the temporary overlay.

These are presentation rules only; type compatibility, graph data and compilation are unchanged. Broader consolidation of historical UI exceptions is deferred to the planned refactor. `tests/browser/test_type_palette_navigation.cjs` checks both themes, native/user types, arrays, state overrides, Link arrows and the floating preview.

## Generated instance names

Automatically generated instance names use GLSL-safe identifiers independently of the displayed node label. Since 0.8.267, name generation strips a trailing separator after sanitizing/truncating the label and before adding a collision suffix: repeated `Array[i]` nodes become `Array_i`, `Array_i_1`, etc. Creation, duplication and paste share this rule; existing node names are not rewritten. A draft containing the older invalid `Array_i__1` needs one explicit rename. `tests/browser/test_generated_node_names.cjs` checks these editor paths and validates their serialized graphs and generated names against the real compiler.

## RGBA controls and labels

Color RGBA displays four compact numeric fields in one row, ordered R, G, B, A, above an alpha-aware CSS swatch. The swatch opens the same browser-native RGB picker as Parameter. Numeric fields share Parameter's stored values and use the existing inline Enter/blur, Escape, Undo and Value Ladder behavior. Component names remain available in field tooltips and accessible labels. Ordinary vectors retain numeric semantics and do not display a color picker.

All numeric fields on graph nodes use the same neutral background (`--node-value-bg`) without a normal border. Numbers align left; scalar fields fill the remaining row space while retaining the outer node padding and room for socket labels/type captions. Focus and invalid-value outlines remain visible. Component hints reuse subtle red, green, blue and neutral gray colors, with a darker palette in Light mode. Known scalar component ports use the corresponding muted socket/label colors, and their outgoing wires use the source port's color. Grouped RGB/RGBA/vector sockets retain their existing type colors; individual letters in known grouped component labels can be tinted. Arbitrary user labels do not determine component hints.

These are display hints, not new GLSL subtypes: compatibility and compilation are unchanged. Hints do not propagate through operations; a red R wire into Add does not recolor Add's output. Wire selection, hover and deletion feedback retain priority over component colors.

Two independent flags in the footer Experimental features panel control this presentation. `EDITOR_DEV_SETTINGS.rgbaComponentTint` defaults to `true` and enables RGBA numeric text, component labels, scalar sockets and outgoing wires. `vectorComponentTint` defaults to `false`; enabling it extends the same treatment to every known vector component by position, including X/Y/Z/W, UV and RGBA, even when the RGBA-only flag is off. Turning both flags off restores neutral text and the ordinary socket/type colors. These preferences are saved only in the current browser, not in graphs or Layout.

Canvas compact/expanded values, Parameter values and expanded component labels, existing generic component fields, and Swizzle component choices share this index mapping. `data-vector-component="0..3"` records component position, while RGBA elements additionally carry `data-color-component`. The root `vector-component-tint` and `rgba-component-tint` classes apply the colors without rebuilding fields or discarding numeric drafts. Label spelling does not affect the mapping, so the existing generic field builder also supports S/T labels without introducing a new vector naming mode. The actual color-preview swatch and numeric editing behavior remain unchanged.

The browser-native RGB picker changes only RGB and retains the exact Alpha. Choosing its unchanged value is a no-op. Rendering a swatch clamps its display to 0–1, but never changes extended-range stored values. A concise note explains this when the color contains extended-range components. The swatch is a visual reference, not a color-managed render replacement. The browser picker itself supports 0–1 RGB; HDR values remain editable numerically.

Each node can have a custom label, up to 80 characters of single-line plain text. The functional title stays primary; the label is a smaller second line. Edit it in Parameter, or double-click an existing label to focus the same field. Escape cancels. Empty labels disappear, keeping the original compact node height. Double-clicking the rest of a Function call continues to enter the Function.

Labels are stored as `node.ui.label`; node IDs, GLSL names, ports, Function references and compilation behavior do not change. Duplicate, clipboard and group operations preserve this metadata. A first Expose may use the selected node's label only if no public label has been set; subsequent node label edits and Expose toggles do not rename existing public parameters. Function definition names remain a separate existing control shared by references.

Validation: 14 targeted browser checks, plus 8 Function rename, 12 clipboard and 8 touch/Value Ladder regressions. An actual compiler comparison confirms label-only edits preserve vertex/pixel code, semantic hash and bindings. Tests use an isolated fixture server, not the user's current graph. Static live deployment verifies current Shader data and GLSL unchanged.

This does not introduce a Vector4-to-Color mode, color space conversion, Color Ramp, a new TD picker, sampler resources, or a semantic graph migration.

## Source purpose colors (0.8.227)

Dark-mode source titles use a display role independent of node family and browser category. This replaces 0.8.225's `tdBuiltin` menu-path coloring. `nodeCategory` retains the original family; UI-only `sourceColorRoles` and `data-color-role` project the purpose onto graph nodes, Sources, group-count badges, the inspector, creation entries and Link target markers. The compiler contract and serialized graphs do not contain these roles.

| Purpose | Dark background | Representative sources |
|---|---|---|
| Attribute | Olive `#565141` | Position, user Attribute/Tex, TOP/MAT UV, TDNormal, TDColor/TDPointColor, TDTexCoord, instance custom attributes |
| Runtime Info | Cherry `#62414f` | Camera/Instance Index, fragment/point coordinates, camera matrices, light data, texture/output dimensions |
| Compile-time Info | Mist blue `#526D91` | TD_NUM_CAMERAS, TD_NUM_LIGHTS, TD_NUM_ENV_LIGHTS, TD_NUM_COLOR_BUFFERS and TOP input counts |

The three roles describe the source's purpose, not strict GLSL qualifiers. Attribute includes convenient surface-coordinate sources, while runtime information can be delivered through uniforms or query functions. Compile-time information is supplied by TD and is visually distinct from user-configurable Constant/Spec Constant (`#384D73`). Sampler resources use the existing sampler palette; Uniforms, buffer resources and processing nodes such as TDInstanceTexCoord, Deform and World to Projection retain their existing families. No additional browser categories or source-tree rearrangement are introduced.

Canvas/grid, Router title body color, socket/type colors and 85% white title names remain unchanged. Light mode retains its existing family palette. The role table explicitly covers the current built-in source inventory; new sources require a presentation decision rather than inferring purpose from a menu path or name prefix. Unknown sources safely fall back to their family color.
