/** Preserve authored notes as inert line comments, including GLSL line joins. */
export function commentLines(text:unknown,kind?:string):string[] {
  if(typeof text!=='string'||!text.trim())return [];
  const rows=text.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);if(rows[rows.length-1]==='')rows.pop();
  return rows.map((raw,i)=>{
    let line=raw.replace(/[\x00-\x08\x0b-\x1f\x7f]/g,' ');if(line.trimEnd().endsWith('\\'))line+=' //';
    return '    // '+(kind&&i===0?kind+': ':'')+line;
  });
}
export function appendNodeComments(lines:string[],start:number,note:{label?:unknown;comment?:unknown}):void {
  const labels=commentLines(note.label);
  if(labels.length){if(lines.length>start){lines[start]+=' '+labels[0]!.trimStart();lines.splice(start+1,0,...labels.slice(1));}else lines.push(...labels);}
  lines.push(...commentLines(note.comment,'Comment'));
}
