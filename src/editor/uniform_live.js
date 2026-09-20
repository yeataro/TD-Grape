/* Uniform values belong to TD. This client never marks or serializes the graph. */
const uniformLive={
  socket:null,ready:false,source:null,subscribed:null,subscribing:false,pending:new Map(),serial:0,retryAt:0,connecting:false,gesture:null,generation:0,lastSeen:0,connectTimer:null,
  sources:[],subscriptions:new Set(),subscriptionKeys:new Map(),subscriptionVersion:0,invalidSources:new Set(),subscribedKey:null,views:new Map(),viewObserver:null,valueFrame:null,changedValues:new Set(),
  ownsValues(row){return this.ready&&this.subscriptions.has(row.id)&&this.subscriptionKeys.get(row.id)===nativeSourceValueKey(row);},
  receiveInventory(){
    this.invalidSources.clear();
    for(const id of this.subscriptions)if(this.subscriptionKeys.get(id)!==nativeSourceValueKey(nativeSourceIndex().get(id))){
      this.subscriptions.delete(id);this.subscriptionKeys.delete(id);this.subscribedKey=null;this.subscriptionVersion++;
    }
  },
  registerView(grid){
    if(this.views.has(grid))return;
    if(!this.viewObserver)this.viewObserver=new IntersectionObserver(entries=>{
      for(const entry of entries)if(this.views.has(entry.target))this.views.set(entry.target,entry.isIntersecting);
      this.watchVisible();
    });
    this.views.set(grid,null);this.viewObserver.observe(grid);
  },
  watchVisible(){
    const ids=new Set(),rows=nativeSourceIndex();let measuring=false;
    for(const [grid,visible]of this.views){
      if(!grid.isConnected){this.viewObserver.unobserve(grid);this.views.delete(grid);continue;}
      if(visible===null)measuring=true;
      const row=rows.get(grid.dataset.nativeComponents);
      if(visible&&row?.kind==='uniform'&&!row.missing&&!row.pending)ids.add(row.id);
    }
    // Replacing a view during a graph render is not leaving the source. Wait
    // for the new DOM's first visibility result before retiring subscriptions.
    if(!measuring)this.watchSources([...ids]);
  },
  acceptValues(values){
    const rows=nativeSourceIndex();
    for(const [id,components]of Object.entries(values)){const row=rows.get(id);if(row&&this.ownsValues(row)){row.components=components;this.changedValues.add(id);}}
    if(this.changedValues.size&&!this.valueFrame)this.valueFrame=requestAnimationFrame(()=>{
      this.valueFrame=null;const changed=this.changedValues;this.changedValues=new Set();renderNativeSourceValues(changed);
    });
  },
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
    for(const id of this.subscriptions)this.invalidSources.add(id);
    const socket=this.socket;this.socket=null;this.ready=false;this.connecting=false;this.subscribed=null;this.subscribedKey=null;this.subscriptions.clear();this.subscriptionKeys.clear();this.subscriptionVersion++;this.generation++;
    ++nativeSourceReadEpoch;nativeSourceRefreshPending=true;
    if(this.valueFrame)cancelAnimationFrame(this.valueFrame);this.valueFrame=null;this.changedValues.clear();
    clearTimeout(this.connectTimer);this.connectTimer=null;
    if(socket)socket.close();
    for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(Error(t('live.offline')));}this.pending.clear();
    this.retryAt=Date.now()+1500;this.render();if(graph)renderNativeSourceValues();
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
          this.acceptValues({[message.source]:message.components});
        }else if(message.type==='inventory')refreshNativeSources({required:true});
        else if(message.type==='invalidated'){
          this.subscribed=null;this.subscribedKey=null;this.subscriptionVersion++;++nativeSourceReadEpoch;
          for(const id of message.sources||this.subscriptions){this.invalidSources.add(id);this.subscriptions.delete(id);this.subscriptionKeys.delete(id);}
          if(this.gesture&&(!message.sources||message.sources.includes(this.gesture.source)))this.gesture.fail(Object.assign(Error(t('live.changed')),{receipt:message.receipt}));
          renderNativeSourceValues();
          refreshNativeSources({required:true});
        }
      };
    }catch{if(generation===this.generation){this.connecting=false;this.retryAt=Date.now()+5000;this.render();}}
  },
  watch(source){
    this.watchSources(source?[source]:[]);
  },
  watchSources(sources){
    this.sources=[...new Set(sources)].sort();this.source=this.sources[0]||null;
    if(!this.source&&!this.gesture){if(this.socket||this.connecting)this.disconnect();return;}
    if(this.ready)this.subscribe();else this.connect();
  },
  async subscribe(){
    const key=JSON.stringify(this.sources);
    if(this.gesture||this.subscribing||!this.ready||nativeSourceRefreshPending||nativeSourcePolling||key===this.subscribedKey)return;
    this.subscribing=true;
    const sources=[...this.sources],generation=this.generation,version=this.subscriptionVersion,readEpoch=nativeSourceReadEpoch,keys=new Map(sources.map(id=>[id,nativeSourceValueKey(nativeSourceIndex().get(id))]));let retry=false;
    try{
      const reply=await this.request('subscribe',sources.length===1?{source:sources[0]}:{sources});
      if(generation!==this.generation||version!==this.subscriptionVersion)return;
      if(readEpoch!==nativeSourceReadEpoch){this.subscribedKey=null;retry=true;return;}
      const values=reply.values||(sources.length===1?{[sources[0]]:reply.components}:{});
      for(const id of Object.keys(values))if(keys.get(id)!==nativeSourceValueKey(nativeSourceIndex().get(id)))delete values[id];
      ++nativeSourceReadEpoch;this.subscribedKey=key;this.subscriptions=new Set(Object.keys(values));this.subscriptionKeys=keys;this.subscribed=sources[0]||null;this.acceptValues(values);
      for(const id of this.subscriptions)this.invalidSources.delete(id);
      if(reply.unavailable?.length)refreshNativeSources({required:true});
    }
    catch{this.subscribed=null;this.subscribedKey=null;}
    finally{this.subscribing=false;if(this.ready&&(retry||JSON.stringify(this.sources)!==key||version!==this.subscriptionVersion))this.subscribe();}
  },
  attach(entry,source,component){
    const read=()=>entry.tagName==='SELECT'?(entry.value==='true'?1:0):Number(entry.value);
    const begin=()=>{
      if(!this.ready||!this.ownsValues(nativeSourceIndex().get(source)||{})||this.gesture||!uniformValueReady(source,false,component))return false;
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
        const row=g.load===editorLoadGeneration&&nativeSourceIndex().get(source);if(accept&&row?.components[component])row.components[component].value=reply.value;
        return g.receipt;
      }).catch(async error=>{
        if(g.load!==editorLoadGeneration)return null;
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
      const step=g.load===editorLoadGeneration?recordHistory({kind:'liveValue',before,after:clone(before),sourceIds:[],liveReceipt:done,liveEmptyFuture:oldFuture}):null;
      done.then(receipt=>{
        if(receipt&&step)delete step.liveEmptyFuture;
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
