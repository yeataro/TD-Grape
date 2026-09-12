# Canvas wire geometry

Nodes, sockets and SVG paths share the `#world` element. Wire coordinates are
measured from the sockets' actual HTML bounds relative to that world, whose
explicit 1px square provides the effective horizontal and vertical scale.
The SVG and cards have the same explicit top-left origin.

This avoids converting HTML socket positions through SVG `getScreenCTM()`.
Older WebKit implementations can omit an ancestor CSS scale from that matrix
([WebKit issue 209220](https://bugs.webkit.org/show_bug.cgi?id=209220)). The
reported iPad symptom is consistent with this failure. The reported device is
iPad mini 6, iPadOS 18.7.8, Chrome 151.0.7922.112. On 2026-09-12 the user
confirmed that wire display now behaves normally on that physical device.

Both completed wires and the temporary connection preview use the same
conversion. Socket positions continue to follow actual layout, including node
labels, comments and differing port rows; there are no hardcoded node heights.
Pan and zoom still transform the common parent without rebuilding established
paths on every frame. Selection, snapping, mouse gestures, Undo and graph data
are unchanged. Full touch node editing is a separate task.

## Regression verification

```text
node tests/browser/test_wire_geometry.cjs src/editor tests/fixtures/editor-state.json <report-directory> chromium
node tests/browser/test_wire_geometry.cjs src/editor tests/fixtures/editor-state.json <report-directory> webkit
node tests/browser/test_navigation_browser.cjs src/editor tests/fixtures/editor-state.json <report-file.json>
```

The geometry test compares rendered SVG marker bounds at each path endpoint
with rendered socket bounds, without using the SVG screen matrix as its oracle.
It covers initial render, 25–170% graph zoom, fractional/negative pan, 125% CSS
zoom, tablet portrait/landscape, sidebar collapse, mouse wire preview/cancel,
node dragging and Undo. Chromium also dispatches actual multi-touch events.
Display-only operations must preserve graph data/history and avoid API writes.

A fault-injection case reproduces the legacy SVG matrix omitting ancestor
scale. Before this change, that case missed the socket by up to 138.54 CSS px;
afterward the maximum measured error across the suites was below 0.01 CSS px.
This is a synthetic reproduction, not an observation from the user's iPad.
Read-only checks of the running Editor with its actual graph also matched the
source assets and measured under 0.035 CSS px error across both engines and
the same zoom range. Those checks preserved graph, revision and history.

Verified on Windows with Chromium and Playwright WebKit 26.5: 7 and 6 geometry
groups respectively, plus 25 existing navigation checks. The older navigation
test's obsolete preview-border assertion and single-favicon assumption were
updated to match the current UI and multi-size icon setup. These checks use
isolated fixture APIs and never connect to a user's TD graph.

The physical iPad Chrome result above is user-reported. The user has not
separately checked desktop; desktop coverage is the Windows Chrome automation
and live Editor checks described above. The report confirms wire display, not
full touch dragging/editing or physical Safari/macOS testing.
