# Color RGBA and node labels

Color RGBA displays four compact numeric fields in one row, ordered R, G, B, A, above an alpha-aware CSS swatch. The swatch opens the same browser-native RGB picker as Parameter. Numeric fields share Parameter's stored values and use the existing inline Enter/blur, Escape, Undo and Value Ladder behavior. Component names remain available in field tooltips and accessible labels. Ordinary vectors retain numeric semantics and do not display a color picker.

The browser-native RGB picker changes only RGB and retains the exact Alpha. Choosing its unchanged value is a no-op. Rendering a swatch clamps its display to 0–1, but never changes extended-range stored values. A concise note explains this when the color contains extended-range components. The swatch is a visual reference, not a color-managed render replacement. The browser picker itself supports 0–1 RGB; HDR values remain editable numerically.

Each node can have a custom label, up to 80 characters of single-line plain text. The functional title stays primary; the label is a smaller second line. Edit it in Parameter, or double-click an existing label to focus the same field. Escape cancels. Empty labels disappear, keeping the original compact node height. Double-clicking the rest of a Function call continues to enter the Function.

Labels are stored as `node.ui.label`; node IDs, GLSL names, ports, Function references and compilation behavior do not change. Duplicate, clipboard and group operations preserve this metadata. A first Expose may use the selected node's label only if no public label has been set; subsequent node label edits and Expose toggles do not rename existing public parameters. Function definition names remain a separate existing control shared by references.

Validation: 14 targeted browser checks, plus 8 Function rename, 12 clipboard and 8 touch/Value Ladder regressions. An actual compiler comparison confirms label-only edits preserve vertex/pixel code, semantic hash and bindings. Tests use an isolated fixture server, not the user's current graph. Static live deployment verifies current Shader data and GLSL unchanged.

This does not introduce a Vector4-to-Color mode, color space conversion, Color Ramp, a new TD picker, sampler resources, or a semantic graph migration.
