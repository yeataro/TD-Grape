// The Library change report (Refactor.123; design workspace work/refactor/library-package-build-design-2026-10-18.md §6): what this build's
// built-in Library changes compared with this branch's upstream as recorded here (no network). The reference and commit are named; when
// there is nothing to compare with, the reason is said instead of "no changes". `git(args)` runs git and throws when it fails (tests give
// their own). 資源庫修改報告：這次建置的內建資源庫，和本機記錄的這個分支的 upstream 比（不連網）；寫出參照與 commit；比不了就說原因，
// 不說「沒有變更」。git(args) 執行 git、失敗時丟出（測試自己給）。
function libraryReport(files, libraryChanges, git) {
  let ref, commit, before;
  try { ref = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']); }
  catch { return 'Library report: no comparison (this branch has no upstream)'; }
  try { commit = git(['rev-parse', '--short', '@{upstream}']); }
  catch { return 'Library report: no comparison (' + ref + ' cannot be read here)'; }
  try { before = JSON.parse(git(['show', '@{upstream}:src/generated/editor-bootstrap.json'])); }
  catch { return 'Library report: no comparison (' + ref + ' ' + commit + ' has no editor-bootstrap.json)'; }
  if (!before.library || !Array.isArray(before.library.files)) return 'Library report: no comparison (' + ref + ' ' + commit + ' has no Library)';
  const c = libraryChanges(before.library.files, files);
  const title = id => (files.concat(before.library.files).find(f => f.subgraph.libraryId === id) || { subgraph: { title: id } }).subgraph.title + ' (' + id + ')';
  const lines = [];
  if (c.added.length) lines.push('  added: ' + c.added.map(title).join(', '));
  if (c.removed.length) lines.push('  removed: ' + c.removed.map(title).join(', '));
  if (c.changed.length) lines.push('  content changed: ' + c.changed.map(title).join(', '));
  if (c.following.length) lines.push('  changed through what they use: ' + c.following.map(title).join(', '));
  for (const t of c.titles) lines.push('  title: ' + t.from + ' → ' + t.to + ' (' + t.libraryId + ')');
  for (const p of c.ports) lines.push('  ' + p.side + ' of ' + title(p.libraryId) + ':' + (p.added.length ? ' added ' + p.added.join(', ') : '')
    + (p.removed.length ? ' removed ' + p.removed.join(', ') + ' (wires to them go when people update)' : '') + (p.retyped.length ? ' retyped ' + p.retyped.join(', ') : ''));
  return 'Library report (compared with ' + ref + ' ' + commit + ' as recorded here):' + (lines.length ? '\n' + lines.join('\n') : ' no changes');
}
module.exports = { libraryReport };
