// The Library change report (Refactor.123; design workspace work/refactor/library-package-build-design-2026-10-18.md §6): what this build's
// built-in Library changes compared with this branch's upstream as recorded here (no network). The reference and commit are named; when
// there is nothing to compare with, the reason is said instead of "no changes". The upstream's full SHA is fixed once and every read uses it,
// so what is named is what is compared (Codex R123-6). Older copies still carried in source files follow as a hint (Codex R123-5).
// `git(args)` runs git and throws when it fails (tests give their own).
// 資源庫修改報告：這次建置的內建資源庫，和本機記錄的這個分支的 upstream 比（不連網）；寫出參照與 commit；比不了就說原因，不說「沒有變更」。
// upstream 的完整 SHA 先固定一次、之後都讀它，寫出的就是比的那一版。原始檔裡還夾帶的舊副本接在後面當提示。git(args) 執行 git、失敗時丟出。
const BOOTSTRAP='src/generated/editor-bootstrap.json';
function libraryReport(files, stale, libraryChanges, git) {
  const titles=new Map();
  const titleOf=id=>(titles.get(id)||id)+' ('+id+')';
  const learn=list=>{for(const f of list)for(const e of [f.subgraph,...f.dependencies])if(!titles.has(e.libraryId))titles.set(e.libraryId,e.title);};
  learn(files);
  const at=new Map();
  for(const s of stale)at.set(s.libraryId,[...(at.get(s.libraryId)||[]),s.at]);
  const hint=at.size?'\n  older copies carried in source files (sharing such a file alone would use them): '
    +[...at].map(([id,where])=>titleOf(id)+' in '+where.join(', ')).join('; '):'';
  const none=reason=>'Library report: no comparison ('+reason+')'+hint;
  let full,sha,before;
  try{full=git(['rev-parse','--symbolic-full-name','@{upstream}']);}catch{return none('this branch has no upstream');}
  const ref=full.replace(/^refs\/(remotes|heads)\//,'');
  try{sha=git(['rev-parse','--verify',full]);}catch{return none(ref+' cannot be read here');}
  const shown=ref+' '+sha.slice(0,7);
  try{git(['cat-file','-e',sha+'^{commit}']);}catch{return none(shown+' points to a commit this clone does not have');}
  try{git(['cat-file','-e',sha+':'+BOOTSTRAP]);}catch{return none(shown+' has no editor-bootstrap.json');}
  try{before=JSON.parse(git(['show',sha+':'+BOOTSTRAP]));}catch{return none(shown+': its editor-bootstrap.json cannot be read');}
  if(!before||!before.library||!Array.isArray(before.library.files))return none(shown+' has no Library');
  learn(before.library.files);
  const c=libraryChanges(before.library.files,files);
  const lines=[];
  if(c.added.length)lines.push('  added: '+c.added.map(titleOf).join(', '));
  if(c.removed.length)lines.push('  removed: '+c.removed.map(titleOf).join(', '));
  if(c.changed.length)lines.push('  content changed: '+c.changed.map(titleOf).join(', '));
  if(c.following.length)lines.push('  changed through what they use: '+c.following.map(titleOf).join(', '));
  for(const t of c.titles)lines.push('  title: '+t.from+' → '+t.to+' ('+t.libraryId+')');
  for(const p of c.ports)lines.push('  '+p.side+' of '+titleOf(p.libraryId)+':'+(p.added.length?' added '+p.added.join(', '):'')
    +(p.removed.length?' removed '+p.removed.join(', ')+' (wires to them go when people update)':'')+(p.retyped.length?' retyped '+p.retyped.join(', '):''));
  return 'Library report (compared with '+shown+' as recorded here):'+(lines.length?'\n'+lines.join('\n'):' no changes')+hint;
}
module.exports={libraryReport};
