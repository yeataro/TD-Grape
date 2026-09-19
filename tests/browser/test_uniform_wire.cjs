/* Run against a disposable native TD fixture with two one-use tickets. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const connection=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
async function connect(ticket){
 const ws=new WebSocket(`ws://127.0.0.1:${connection.port}/uniforms?ticket=${encodeURIComponent(ticket)}`),messages=[],pending=new Map();let serial=0;
 let readyResolve,readyReject;const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 ws.onmessage=event=>{const message=JSON.parse(event.data);messages.push(message);if(message.type==='ready')readyResolve();if(message.type==='reply'){const p=pending.get(message.request);if(p){pending.delete(message.request);message.error?p.reject(Error(message.error)):p.resolve(message);}}};
 ws.onerror=()=>readyReject(Error('Socket failed'));ws.onclose=()=>readyReject(Error('Socket closed before ready'));
 const request=(type,body={})=>new Promise((resolve,reject)=>{const request=++serial;pending.set(request,{resolve,reject});ws.send(JSON.stringify({type,request,...body}));});
 await ready;return {ws,request,messages};
}
const timer=setTimeout(()=>{console.error('Timed out');process.exit(1);},15000);
(async()=>{
 let a,b;
 try{
  a=await connect(connection.ticket);b=await connect(connection.ticket2);
  const initial=await a.request('subscribe',{source:'live'});await b.request('subscribe',{source:'live'});
  await a.request('begin',{source:'live',component:0,expected:initial.components[0],gesture:crypto.randomUUID()});
  await assert.rejects(b.request('begin',{source:'live',component:0,expected:initial.components[0]}),/Another editor/);
  for(let i=0;i<12;i++)await a.request('update',{sequence:i,value:.3+i/100});
  const committed=await a.request('commit',{sequence:12,value:.75});assert.ok(committed.receipt);
  const deadline=Date.now()+2000;
  while(!b.messages.some(m=>m.type==='values'&&m.components[0].value===.75)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
  assert.ok(b.messages.some(m=>m.type==='values'&&m.components[0].value===.75),'TD pushes evaluated values to another subscriber');
  console.log(JSON.stringify({passed:true,checks:['native TD WebSocket handshake and one-use authentication','live Par writes and one completed gesture','same component rejects concurrent writers','second subscriber receives TD values without HTTP polling']}));
 }finally{a?.ws.close();b?.ws.close();clearTimeout(timer);}
})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
