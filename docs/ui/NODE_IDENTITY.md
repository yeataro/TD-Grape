# Node names, comments and selected-node Parameter

Functional names remain the primary canvas title. Instance Label is currently right-aligned; its future relationship to provenance metadata remains undecided. Types appear on ports. A Subgraph uses the connected three-circle SVG: a source snapshot has 50% icon opacity, while a local editable definition uses full opacity. The Parameter action “Make local editable copy” duplicates the selected source call through the existing independent-copy model and preserves the source definition.

The Parameter pane begins with a 32px node-colored identity header, flush to the pane edges. The functional name is on the left and Label input on the right. Parameters/Settings follow; the collapsible Comment editor stays last. Duplicate type and numeric-ladder explanations are moved to control hints or removed; connected inputs show their source and a compact Disconnect action. Selecting a wire also shows Disconnect wire; Delete/Backspace and Undo/Redo continue to work.

A nonempty `ui.comment` appears directly below canvas ports/values. It has no Comment heading, disclosure arrow or folding state. Every category uses the same muted body text color. Empty comments add no footer. Text is inert even when it resembles HTML. The Parameter Comment editor remains collapsible and the Help pane retains its comment display.

Label/Comment edits support undo, clipboard and read-only protection. Editing presentation inside a library snapshot does not localize its definition. Label is not a GLSL identifier; generated comments follow [GLSL annotations](../features/GLSL_ANNOTATIONS.md). The separate Uniform/Custom Parameters tools replace numeric Expose; legacy Texture controls remain pending their own source migration.

Verification covers real browser editing, copied notes, Escape, Undo/Redo, source/local icon state, independent copies, compact pane geometry and shared plain-text comment colors. Native GLSL tests additionally verify rendering and source-map behavior.
