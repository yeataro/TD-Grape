# TOP frontend compiler: first slice

## Current update: Refactor.12 / .13

The initial-slice description below is historical. Current modules live in
`src/core-ts/nodes/`; the build discovers those files and generates the editor
bundle, catalog projections and receiver capabilities. There are 53 ordinary and
3 structural modules. A module owns metadata, ports, explicit configuration,
controls and emission. The graph owns node/port/edge handles and transactions.

Refactor.12 adds Compare, If, predicates and boolean/vector comparisons, plus
portable float/int/uint/bool values and Subgraph interfaces. Refactor.13 adds
Combine, Replace, Vector Split, Swizzle, Convert, Router, RGBA and Split, and
extends Vector literals to those families. General arithmetic still retains its
own narrower capability; this is not complete integer arithmetic coverage.

SDK additions are generic contracts, not a second node-name dispatch table:

- `typedNode` / `staticNode`: common module construction; `values` handles the
  portable scalar/vector literals, shapes and legal connection conversions.
- `wire`: pure node-local input-layout preparation. Graph planning and commit
  use the same result, preserve outputs, and remove overlapping incoming wires
  in the same transaction. Combine/Replace share `vectorAssembly`.
- `editInput`: translates input edits to the module's authored data. Component
  defaults live in `params.components`, without a second default-value copy.
- `creations`: module-owned choices for creation from a wire. Disconnect does
  not reset that authored choice; existing outputs never follow inputs.
- `inputsUsed`: effective expression dependencies. Replace can leave a fully
  overridden base dormant, including its Uniform binding. Cycle validation
  still sees every wire, including dormant ones.

The temporary Python adapter consumes generated capabilities to preserve these
rules in mixed graphs: retained component groups, legal numeric casts and fixed
Router output. Untouched configurations keep the legacy behavior. This adapter
is not a second extensibility API and is removed when its remaining scope moves.

Validation: 91 core tests; 127 logic and 376 vector complete-graph GPU/binding
comparisons against fixed Legacy; real editor controls, wiring and Undo; 24
native TD cases; Library composition with a bool interface, Make Local, TOX
save/reopen and zero Python emission after initial frontend submission. Detailed
evidence is in workspace `work/refactor/logic-vectors/RESULTS.md`.

MAT/Vertex, double, matrices/resources, custom GLSL, Require Constant and other
unsupported whole graphs remain explicitly outside this frontend slice. Native
Uniform binding types still use the existing float/vector boundary. The human
requested stopping before the next GLSL/resource/host-binding design step.

## Historical first slice

Technical candidate for workflow step 3, awaiting human experience review. The fixed comparison remains Legacy
`90a946bdd2acacbf52c93842806edbc23f76b7ba`; the previous reviewed refactor checkpoint
is `769d9e2`. Passing offline checks alone does not complete this milestone.

`GrapeTopCompiler` takes one complete TOP document and returns GLSL, bindings,
diagnostics and source locations without DOM, Python or TD. The initial scope is
float/vector literals, arithmetic, numeric Uniforms, Abs and one Color Output.
Unsupported complete graphs select the existing compiler before compilation.
Compilation failures do not silently retry the other compiler. Comments,
functions, textures, MAT, temporary Preview nodes and compound/dynamic interfaces remain outside
this slice. Implicit-ID/explicit-name symbol collisions also remain on the old
path. These adapters are temporary, not the final architecture.

The editor checks the receiver's protocol, captures one graph/revision snapshot,
compiles it and sends that exact snapshot alongside the artifact. Generated GLSL
inspection uses the same selected frontend compiler. The receiver checks target
identity, revision binding, snapshot, catalog, sizes and numeric native binding
metadata before the existing deployment transaction. The existing revision
check, candidate GPU validation, Bind/Expression preservation and compensation
remain responsible for TD writes. Source is authenticated editor input; snapshot
hashes are integrity/correlation evidence, not proof that arbitrary GLSL expresses
the graph's semantics.

The TD adapter computes the existing Python semantic hash for compatibility. That
does not emit code. Python JSON number/Unicode formatting is not assumed to match
JavaScript JSON.stringify. Complete graph and artifact are stored together in TD
state, so reopening an unchanged frontend-produced graph can reuse the artifact.
The saved artifact is checked again against its graph and catalog. A source change
which invalidates it may still use the legacy path during migration. Native value
ownership remains independent of graph defaults.

Ordinary nodes using the current unary primitive can be authored in one registry
entry with `product` metadata. The build projects catalog/fingerprint, browser
search/Creator metadata and receiver IDs; the catalog supplies the existing type
contract. A temporary Python adapter reads the same generated operator and port
for whole graphs outside the frontend slice. Abs uses this route now. New
capabilities and dynamic interfaces still need an explicit implementation.
`frontendGenerated` tracks owned catalog rows; removing a row removes its
projection. Removal with historical revisions requires an explicit migration.
Primitive semantics participate in the catalog contract to invalidate saved
artifacts after an operator change.

`tests/integration/test_frontend_node_extension.cjs <absolute-evidence-directory>`
proves this in an isolated source copy: one new entry with a novel input port,
browser/type/receiver reachability, exact dual-compiler parity, changing an
existing primitive, removal, and invalid primitive metadata. It does not ship
the probe node. Module loading by end users is outside this milestone.

The isolated native loop passed with the Python emitter forced to throw after
initial setup: normal Apply, real GPU output/remote preview, unpromoted Uniform
Undo/Redo, complete graph+artifact TOX save/reopen, native Bind/Expression
preservation, late Apply replies, invalid candidate rejection, and injected
post-configure compensation. Both independent review axes have no remaining
blocking findings. Evidence is in workspace `work/refactor/compiler-step/REVIEW.md`.
This does not claim all TD compilation has migrated.

Offline checks:

```
npm run build:core
npm run test:core
python tools/dev/run_tests.py
```

The test-only Python oracle compares complete source, binding tables, ports,
source locations and diagnostics, including disconnected data, input defaults,
invalid graphs and numeric rounding boundaries. It is never loaded by the editor.
Receiver tests check mismatch rejection, stored result validation, owned copies,
and provider reuse without calling the old emitter.

The full portable suite is not green: the pre-existing failing cases are recorded
against the archived previous checkpoint. Targeted changed-path checks and native
evidence are reported separately; do not describe baseline failures as passes.
