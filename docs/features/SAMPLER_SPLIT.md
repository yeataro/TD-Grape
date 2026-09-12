# Sampler separation — 2026-09-12

This is the graph/compiler stage of source separation. Product version remains 0.8.5; the additive catalog version is 0.6.5. Existing 31 node definitions retain their UUIDs, revisions and behavior.

## Available behavior

- New node menus offer Sampler 2D (a reference with a sampler2D output) and Texture 2D (sampler2D plus UV inputs, vec4 output). One source can feed multiple sampling nodes. Independent sources can be created from the selected Sampler's existing parameter controls.
- New sources start with a defined opaque-black texture. An unconnected live sampling input uses one internal opaque-black binding per Shader; it does not acquire a user declaration or numeric value. UV retains the established interpolated-coordinate default and optional explicit vec2 override.
- Sampler interfaces support both Subgraph inputs and outputs, including nested graphs and personal-library export. The compiler expands them as source references; it does not declare local sampler variables or return opaque sampler values from generated GLSL functions. Sampling nodes currently support Pixel stage.
- Grouping leaves Uniform/Sampler source nodes in the current outer graph. Actual incoming ports inherit the source name at creation; they then remain ordinary editable interface names. Pure source selections do not create empty subgraphs. Placement policy is isolated in SubgraphSourcePolicy and does not alter the compiler or old saved groups.
- A legacy combined Texture node remains intact when loaded. Separate Sampler converts that selected node in one undoable edit, preserves its ID/UV connections and declaration, and reuses an existing reference to the same source when available. Library edits use the established localization flow. No bulk migration rewrites user graphs or shared snapshots during deployment.
- Split/new sources opt into opaque-black recovery when their path disappears; missing status is retained. Valid defaults, external TOP input precedence, source identities and existing exposed controls/Expressions remain usable. Wrong operator kinds and shader/type errors are not classified as missing-path recovery. Older untouched Texture sources retain their previous fallback policy.

## Scope still to complete

A separate Samplers inventory backed by native settings, all resource-control/old Expose migration, and additional resource types are still pending. This batch uses the existing texture source controls; it does not claim the entire source-ownership redesign is complete. Native Windows TD 2025.32820 inspection confirms GLSL MAT has a Samplers sequence while GLSL TOP does not: TOP resources use its native inputs. A future shared editor must respect this difference.

## Verification

- 126 Python checks, including 8 new resource behavior tests and all 138 unchanged historical graph fingerprints.
- 10 actual Chrome editing scenarios: no automatic legacy mutation, explicit split, Undo/Redo, source placement/name inheritance, sampler interface controls, independent source creation, clipboard and localization.
- 38 isolated TD checks: MAT/TOP opaque black, shared sampling, retained source expressions/control identities, missing vs wrong source, sampler Subgraph pass-through, failed-apply rollback, TOX reload, and pixel comparisons of browser-generated split/group/paste graphs.
- Function/personal-library model suites, 20 Auto model checks, bilingual keys and generated node-browser projection checked.

Test entry points: tests/unit/test_sampler_split.py; tests/browser/test_sampler_split.cjs SOURCE_DIR STATE_JSON REPORT_DIR (PLAYWRIGHT_MODULE/CHROME_EXECUTABLE as needed); tests/td/test_sampler_split.py with GRAPE_TEST_SOURCE and GRAPE_TEST_OUTPUT after the browser fixture has written its graph cases. TD fixtures are independent and removed after testing.

References: [TD GLSL MAT](https://derivative.ca/UserGuide/GLSL_MAT), [TD GLSL TOP sampler inputs](https://docs.derivative.ca/Write_a_GLSL_TOP#Samplers).
