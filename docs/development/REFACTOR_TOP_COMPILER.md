# TOP frontend compiler: first slice

Work in progress for workflow step 3. The fixed comparison remains Legacy
`90a946bdd2acacbf52c93842806edbc23f76b7ba`; the previous reviewed refactor checkpoint
is `769d9e2`. Passing offline checks alone does not complete this milestone.

`GrapeTopCompiler` takes one complete TOP document and returns GLSL, bindings,
diagnostics and source locations without DOM, Python or TD. The initial scope is
float/vector literals, arithmetic, numeric Uniforms, Abs and one Color Output.
Unsupported complete graphs select the existing compiler before compilation.
Compilation failures do not silently retry the other compiler. Comments,
functions, textures, MAT, Preview and compound/dynamic interfaces remain outside
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

The compiler registry also generates the receiver's capability IDs in
`frontend_capabilities.json`. Adding a supported emitter for an already defined
ordinary node uses one registry entry; this is **not yet** proof that a completely
new product node can be authored in one place. That broader extension check,
independent receiver review, native preview/Undo/save/reopen, and separated cold/
warm/TD timings are outstanding until recorded in the workspace evidence.

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
