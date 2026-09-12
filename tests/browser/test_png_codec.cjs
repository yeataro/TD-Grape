const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const f=process.argv[3]||__dirname,sourceDir=process.argv[2]||path.join(__dirname,'../src'),c=vm.createContext({TextEncoder,TextDecoder,Uint8Array,Uint32Array,DataView});vm.runInContext(fs.readFileSync(path.join(sourceDir,'import_ui.js'),'utf8'),c);const png=vm.runInContext('PngGraph',c),source=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNIMGj4DwAEFAIQv7rKSQAAAABJRU5ErkJggg==','base64'),checks=[];
const graph={schemaVersion:1,target:'top',name:'色彩 · 葉廷皓 🍇',functions:[{name:'nested',graph:{nodes:[],edges:[]}}],stages:{pixel:{nodes:[],edges:[]}}};
const packed=Buffer.from(png.attach(source,graph,{stage:'pixel',functionIds:['nested']}));assert.deepEqual(JSON.parse(png.extract(packed).raw),graph);checks.push('UTF-8 full graph roundtrip through standard iTXt');
assert.deepEqual(JSON.parse(png.extract(png.attach(packed,{...graph,name:'replacement'},{})).raw),{...graph,name:'replacement'});checks.push('rewriting owned metadata produces one latest record');
const bad=(bytes,code)=>assert.throws(()=>png.extract(bytes),e=>e.message===code);
bad(source,'png.missing');checks.push('ordinary PNG has no implicit graph');
const corrupt=Buffer.from(packed);corrupt[40]^=1;bad(corrupt,'png.corrupt');checks.push('CRC error rejected');
for(const bytes of [packed.subarray(0,7),packed.subarray(0,-1),Buffer.concat([packed,Buffer.from([0])])])bad(bytes,'png.invalid');checks.push('signature, truncation and trailing data rejected');
// Test fixture CRC uses an independent bit-at-a-time implementation.
function crc(data){let v=0xffffffff;for(const b of data){v^=b;for(let i=0;i<8;i++)v=v&1?(v>>>1)^0xedb88320:v>>>1;}return (v^0xffffffff)>>>0;}
function chunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b;}
assert.equal(crc(Buffer.from('IEND')),0xae426082);
const key=Buffer.from('TD-Sgrape\0\0\0\0\0'),meta=data=>chunk('iTXt',Buffer.concat([key,Buffer.from(data)])),withMeta=chunks=>Buffer.concat([source.subarray(0,-12),...chunks,source.subarray(-12)]);
bad(withMeta([meta('{}'),meta('{}')]),'png.duplicate');checks.push('duplicate metadata rejected');
const compressed=Buffer.from(key);compressed[10]=1;bad(withMeta([chunk('iTXt',compressed)]),'png.compressed');checks.push('compressed metadata rejected without inflation');
bad(withMeta([meta('{bad')]),'png.invalidMetadata');bad(withMeta([meta(JSON.stringify({format:'td-sgrape.graph-png',version:2,graph}))]),'png.version');bad(withMeta([meta(JSON.stringify({format:'td-sgrape.graph-png',version:1,graph:[]}))]),'png.invalidMetadata');checks.push('invalid JSON, future envelope and invalid graph type rejected');
bad(withMeta([meta(Buffer.from([255]))]),'png.invalidMetadata');checks.push('invalid UTF-8 rejected');
assert.throws(()=>png.attach(source,{large:'x'.repeat(png.maxGraph)},{}),e=>e.message==='graph.size');bad(new Uint8Array(png.maxFile+1),'png.fileSize');checks.push('graph and PNG byte limits enforced');
fs.writeFileSync(path.join(f,'codec-roundtrip.png'),packed);fs.writeFileSync(path.join(f,'codec-tests.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
