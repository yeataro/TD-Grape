/* Uniform values belong to TD. This client never marks or serializes the graph. */
const uniformLive={
  socket:null,ready:false,source:null,subscribed:null,subscribing:false,pending:new Map(),serial:0,retryAt:0,connecting:false,gesture:null,generation:0,lastSeen:0,connectTimer:null,
  render(){
    for(const hint of document.querySelectorAll('[data-uniform-live-status]'))hint.textContent=t(this.ready?'live.ready':this.connecting?'live.connecting':'live.offline');
  },
  request(type,body={}){
    if(!this.ready||this.socket?.readyState!==WebSocket.OPEN)return Promise.reject(Error(t('live.offline')));
    const request=++this.serial;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.disconnect();reject(Error(t('live.offline')));},5000);
      this.pending.set(request,{resolve,reject,timer});
      this.socket.send(JSON.stringify({type,request,...body}));
    });
  },
  disconnect(){
    const socket=this.socket;this.socket=null;this.ready=false;this.connecting=false;this.subscribed=null;this.generation++;
    clearTimeout(this.connectTimer);this.connectTimer=null;
    if(socket)socket.close();
    for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(Error(t('live.offline')));}this.pending.clear();
    this.retryAt=Date.now()+1500;this.render();
  },
  async connect(){
    if(this.socket||this.connecting||document.hidden||!this.source||Date.now()<this.retryAt)return;
    const generation=this.generation,load=editorLoadGeneration;this.connecting=true;this.render();
    try{
      const ticket=await api('live-ticket',{});
      if(generation!==this.generation||load!==editorLoadGeneration||document.hidden){this.connecting=false;return;}
      const url=new URL(location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.port=ticket.port;url.pathname='/uniforms';url.search='?ticket='+encodeURIComponent(ticket.ticket);url.hash='';
      const socket=this.socket=new WebSocket(url);
      this.connectTimer=setTimeout(()=>{if(this.socket===socket)this.disconnect();},5000);
      socket.onclose=()=>{if(this.socket===socket)this.disconnect();};socket.onerror=()=>{if(this.socket===socket)this.disconnect();};
      socket.onmessage=event=>{
        if(this.socket!==socket)return;this.lastSeen=Date.now();
        let message;try{message=JSON.parse(event.data);}catch{this.disconnect();return;}
        if(message.type==='ready'){
          clearTimeout(this.connectTimer);this.connectTimer=null;this.ready=true;this.connecting=false;this.render();
          refreshNativeSources().finally(()=>{this.subscribe();status(t('live.ready'),false,{clearError:'live'});});
        }
        else if(message.type==='reply'){
          const item=this.pending.get(message.request);if(!item)return;this.pending.delete(message.request);clearTimeout(item.timer);
          if(message.error)item.reject(Object.assign(Error(message.error),{receipt:message.receipt}));else item.resolve(message);
        }else if(message.type==='values'){
          const row=nativeSourceRows().find(r=>r.id===message.source);
          if(row){row.components=message.components;renderNativeSourceValues();}
        }else if(message.type==='inventory')refreshNativeSources();
        else if(message.type==='invalidated'){
          this.subscribed=null;this.gesture?.fail(Error(t('live.changed')));refreshNativeSources();
        }
      };
    }catch{if(generation===this.generation){this.connecting=false;this.retryAt=Date.now()+5000;this.render();}}
  },
  watch(source){
    if(this.source===source){if(this.ready)this.subscribe();else this.connect();return;}
    this.source=source;
    if(!source){this.disconnect();return;}
    if(this.ready)this.subscribe();else this.connect();
  },
  async subscribe(){
    if(this.gesture||this.subscribing||!this.ready||this.source===this.subscribed)return;
    this.subscribing=true;
    const source=this.source;
    try{
      const reply=await this.request('subscribe',{source});this.subscribed=source;
      const row=nativeSourceRows().find(r=>r.id===source);if(row&&reply.components){row.components=reply.components;renderNativeSourceValues();}
    }
    catch{this.subscribed=null;}
    finally{this.subscribing=false;if(this.ready&&this.source!==source)this.subscribe();}
  },
  attach(entry,source,component){
    const read=()=>entry.tagName==='SELECT'?(entry.value==='true'?1:0):Number(entry.value);
    const begin=()=>{
      if(!this.ready||this.subscribed!==source||this.gesture)return false;
      const g={id:crypto.randomUUID(),entry,source,component,sequence:0,latest:null,inFlight:false,closed:false,error:null,receipt:null,load:editorLoadGeneration,chain:Promise.resolve()};
      g.fail=error=>{g.error=error;if(error.receipt)g.receipt=error.receipt;};
      g.chain=this.request('begin',{source,component,expected:clone(entry.sourceExpected),gesture:g.id}).catch(g.fail);
      this.gesture=g;entry.uniformGesture=g;return true;
    };
    const flush=()=>{
      const g=entry.uniformGesture;if(!g||g.closed||g.inFlight||g.error||g.latest===null)return;
      const value=g.latest;g.latest=null;g.inFlight=true;
      g.chain=g.chain.then(()=>{if(!g.error)return this.request('update',{sequence:++g.sequence,value});}).catch(g.fail).finally(()=>{g.inFlight=false;flush();});
    };
    const finish=accept=>{
      const g=entry.uniformGesture;if(!g)return false;
      delete entry.uniformGesture;g.closed=true;g.latest=null;entry.inert=true;
      const value=read(),before=clone(graph);
      const done=g.chain.then(async()=>{
        if(g.error)throw g.error;
        const reply=await this.request(accept?'commit':'cancel',{sequence:++g.sequence,value});g.receipt=reply.receipt;
        const row=nativeSourceRows().find(r=>r.id===source);if(accept&&row?.components[component])row.components[component].value=reply.value;
        return g.receipt;
      }).catch(async error=>{
        if(error.receipt)g.receipt=error.receipt;
        status(error.message,true,{kind:'live'});
        if(!g.receipt){try{g.receipt=(await api('live-seal',{gesture:g.id})).receipt;}catch{g.receipt=g.id;}}
        return g.receipt;
      }).finally(()=>{
        entry.inert=false;
        if(this.gesture===g)this.gesture=null;
        this.subscribe();renderNativeSourceValues();
      });
      // Reserve the step now, so a later graph edit cannot reorder this gesture.
      const oldFuture=future;
      const step=g.load===editorLoadGeneration?recordHistory({kind:'liveValue',before,after:clone(before),sourceIds:[],liveReceipt:done}):null;
      done.then(receipt=>{
        if(!receipt&&step&&!historyBusy){const index=past.indexOf(step);if(index>=0){
          if(index===past.length-1&&!future.length)future=oldFuture;
          past.splice(index,1);renderHistoryActions();
        }}
      });
      return true;
    };
    entry.onNumericBegin=begin;
    entry.onNumericFinish=accept=>{
      const handled=finish(accept);
      if(handled)entry.setSyncedValue(entry.value);
      return handled;
    };
    entry.onNumericPreview=()=>{
      const g=entry.uniformGesture;if(!g||!entry.numericGestureActive)return;
      g.latest=read();flush();
    };
    entry.liveCommit=value=>{
      if(!begin())return false;entry.value=String(value);finish(true);return true;
    };
  }
};

// A hidden tab holds no live subscription or writer. Foreground recovery reads
// current TD values; buffered pre-background pointer movements are discarded.
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)uniformLive.disconnect();else{uniformLive.retryAt=0;uniformLive.connect();}
});
window.addEventListener('pagehide',()=>uniformLive.disconnect());
setInterval(()=>{
  if(document.hidden)return;
  if(uniformLive.ready){if(Date.now()-uniformLive.lastSeen>15000)uniformLive.disconnect();else uniformLive.request('ping').catch(()=>{});}
  else uniformLive.connect();
},5000);
