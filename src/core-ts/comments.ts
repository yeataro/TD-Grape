/** Preserve authored notes as inert line comments, including GLSL line joins. */
export function commentLines(text:unknown,kind?:string):string[] {
  if(typeof text!=='string'||!text.trim())return [];
  const rows=text.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);if(rows[rows.length-1]==='')rows.pop();
  return rows.map((raw,i)=>{
    let line=raw.replace(/[\x00-\x08\x0b-\x1f\x7f]/g,' ');if(line.trimEnd().endsWith('\\'))line+=' //';
    return '    // '+(kind&&i===0?kind+': ':'')+line;
  });
}
/** A node's `comment` (moved out of `ui`, Q44) becomes inert lines below its code; `ui.label` is gone.
 * 節點的 comment（已搬出 ui）產成程式下方的註解行；ui.label 已刪除。 */
export function appendNodeComments(lines:string[],_start:number,comment:unknown):void {
  lines.push(...commentLines(comment,'Comment'));
}
