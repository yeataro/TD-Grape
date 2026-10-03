/* Exercise candidate discovery and hit testing with real editor functions and a small DOM model. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=process.argv[2]||path.resolve(__dirname,'../../src/editor');
const source=fs.readFileSync(path.join(dir,'graph_ui.js'),'utf8');
const settings=source.slice(source.indexOf('const EDITOR_DEV_DEFAULTS'),source.indexOf('let touchGraphGesture'));
const functions=source.slice(source.indexOf('function portInfo('),source.indexOf('function clearWireGesture('));
assert.ok(settings&&functions,'load actual editor settings, discovery and hit-testing functions');
const rectangle=(left,top,width=6,height=6)=>({left,top,right:left+width,bottom:top+height,width,height});

function fixture(mode){
  const sockets=[],calls=[],observers=[],listeners=new Map(),hits=new Map();
  let uiScale=1;
  class Element {
    constructor({id='',classes=[],dataset={},parent=null,rect=rectangle(0,0),hidden=false,disabled=false}={}){
      Object.assign(this,{id,dataset,parent,rect,hidden,disabled,nodeType:1,children:[],isConnected:true});
      this.classes=new Set(classes);
      this.classList={contains:name=>this.classes.has(name),add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)};
      if(parent)parent.children.push(this);
    }
    matches(selector){return selector.split(',').some(part=>{
      part=part.trim();
      if(part.startsWith('#'))return this.id===part.slice(1);
      if(part.startsWith('.'))return this.classes.has(part.slice(1));
      if(part==='[data-node]')return this.dataset.node!==undefined;
      return false;
    });}
    closest(selector){for(let node=this;node;node=node.parent)if(node.matches(selector))return node;return null;}
    querySelector(selector){for(const child of this.children){if(child.matches(selector))return child;const match=child.querySelector(selector);if(match)return match;}return null;}
    getClientRects(){for(let node=this;node;node=node.parent)if(node.hidden||!node.isConnected)return [];return [this.rect];}
    getBoundingClientRect(){return this.rect;}
  }
  const canvas=new Element({id:'canvas',rect:rectangle(100,100,200,160)});
  const cards=new Element({id:'cards',parent:canvas});
  const floating=new Element({id:'floatingparameters'});
  class Observer {
    constructor(callback){this.callback=callback;this.targets=[];this.pending=[];this.connected=true;observers.push(this);}
    observe(root,options){this.targets.push({root,options});}
    takeRecords(){return this.pending.splice(0);}
    disconnect(){this.connected=false;this.targets=[];this.pending=[];}
    queue(records){
      if(!this.connected)return;
      this.pending.push(...records.filter(record=>this.targets.some(({root,options})=>{
        let contained=false;for(let node=record.target;node;node=node.parent)if(node===root)contained=true;
        return contained&&(record.type==='childList'?options.childList:options.attributes&&(!options.attributeFilter||options.attributeFilter.includes(record.attributeName)));
      })));
    }
    emit(records){
      this.queue(records);const delivered=this.takeRecords();
      if(delivered.length)this.callback(delivered);
    }
  }
  const document={
    documentElement:{clientWidth:1000,clientHeight:800},
    querySelector:selector=>({'#canvas':canvas,'#cards':cards,'#floatingparameters':floating})[selector]||null,
    querySelectorAll:()=>sockets.filter(socket=>socket.isConnected),
    addEventListener(name,handler,capture){if(!listeners.has(name))listeners.set(name,new Map());listeners.get(name).set(handler,capture);},
    removeEventListener(name,handler,capture){if(listeners.get(name)?.get(handler)===capture)listeners.get(name).delete(handler);},
    elementFromPoint(x,y){
      const key=x+','+y;if(hits.has(key))return hits.get(key);
      return sockets.find(socket=>socket.isConnected&&socket.getClientRects().length&&x===socket.rect.left+socket.rect.width/2&&y===socket.rect.top+socket.rect.height/2)||canvas;
    }
  };
  const context=vm.createContext({document,MutationObserver:Observer,pan:{x:0,y:0},scale:1,editVersion:0,
    $:document.querySelector,uiScaleFactor:()=>uiScale,
    connectionProblem(from,to){calls.push({...to});return from.kind===to.kind?'direction':sockets.find(socket=>socket.dataset.testNode===to.node)?.invalid?'autoConflict':null;}
  });
  Object.defineProperty(context,'devicePixelRatio',{get(){throw Error('candidate geometry must use CSS pixels');}});
  vm.runInContext(settings+functions,context,{filename:'graph_ui.js candidates'});
  if(mode!==undefined)context.EDITOR_DEV_SETTINGS_VALUE=mode,vm.runInContext('EDITOR_DEV_SETTINGS.wireValidation=EDITOR_DEV_SETTINGS_VALUE',context);
  const start={node:'source',port:'out',kind:'outputs',type:'float'};
  const add=(id,{x=150,y=150,kind='inputs',type='float',panel=false,router=false,hidden=false,disabled=false,invalid=false,width=6,height=6}={})=>{
    const node=new Element({classes:router?['node','node-router']:['node'],dataset:{node:id},parent:panel?floating:cards});
    const row=new Element({classes:['port-row'],parent:node});
    const button=new Element({classes:['port',...(panel?['parameter-input-port']:[])],dataset:{testNode:id,port:kind==='inputs'?'value':'out',kind,type},parent:row,rect:rectangle(x,y,width,height),hidden,disabled});
    button.invalid=invalid;sockets.push(button);return button;
  };
  return {context,document,canvas,cards,floating,calls,observers,listeners,add,start,
    create:radius=>context.createWireCandidates(start,radius),
    find:(session,x,y,radius=14)=>context.findWireTarget(session.get(),x,y,radius,session.accept),
    hit:(x,y,element)=>hits.set(x+','+y,element),
    mutation:record=>observers.forEach(observer=>observer.emit([record])),
    queueMutation:record=>observers.forEach(observer=>observer.queue([record])),
    scroll:()=>{for(const handler of listeners.get('scroll')?.keys()||[])handler();},
    setUiScale:value=>{uiScale=value;}
  };
}
const ids=buttons=>Array.from(buttons,button=>button.dataset.testNode);
const checked=f=>f.calls.map(info=>info.node);

// Legacy mode eagerly checks every rendered socket, including offscreen ones,
// and keeps the initial accepted set for the gesture.
{
  const f=fixture('all');
  f.add('same-direction',{kind:'outputs'});f.add('inside');f.add('offscreen',{x:1500});
  f.add('invalid',{invalid:true});f.add('hidden',{hidden:true});f.add('disabled',{disabled:true});
  const session=f.create();
  assert.deepEqual(checked(f),['same-direction','inside','offscreen','invalid']);
  assert.deepEqual(ids(session.get()),['inside','offscreen']);
  session.get();assert.equal(f.calls.length,4,'legacy get must not repeat the initial whole scan');
  session.dispose();
}

// Hover leaves distant sockets unvalidated and caches both accepted and rejected
// sockets. Model changes and socket-identity changes invalidate those answers.
{
  const f=fixture('hover'),valid=f.add('valid'),invalid=f.add('invalid',{x:170,invalid:true});
  for(let i=0;i<80;i++)f.add('distant-'+i,{x:1000+i*20});
  const session=f.create();
  session.get();assert.equal(f.calls.length,0,'hover construction and discovery must not validate');
  assert.equal(f.find(session,500,500),null);assert.equal(f.calls.length,0,'empty space must not validate distant sockets');
  f.hit(153,153,valid);f.hit(173,153,invalid);
  assert.equal(f.find(session,153,153),valid);assert.equal(f.find(session,153,153),valid);
  assert.equal(f.find(session,173,153),null);assert.equal(f.find(session,173,153),null);
  assert.deepEqual(checked(f),['valid','invalid'],'repeat valid and invalid hovers must reuse answers');
  f.context.editVersion++;
  assert.equal(f.find(session,153,153),valid);assert.equal(f.calls.length,3);
  valid.dataset.type='vec3';
  assert.equal(f.find(session,153,153),valid);assert.equal(f.calls.length,4,'port signature changes must invalidate without waiting for an observer');
  valid.hidden=true;assert.equal(session.accept(valid),false);
  valid.hidden=false;valid.isConnected=false;assert.equal(session.accept(valid),false);
  valid.isConnected=true;assert.equal(f.calls.length,4,'hidden or detached cached sockets must be rejected without revalidation');
  session.dispose();
  const next=f.create();assert.equal(f.find(next,153,153),valid);assert.equal(f.calls.length,5,'new gesture must not reuse old legality');next.dispose();
}

// A direct rejected port must not snap elsewhere. Over blank canvas, a nearer
// rejected socket must not block a farther accepted socket inside the radius.
{
  const f=fixture('hover'),invalid=f.add('invalid',{x:98,y:104,width:4,height:4,invalid:true}),valid=f.add('valid',{x:98,y:108,width:4,height:4});
  const session=f.create();f.hit(100,100,invalid);
  assert.equal(f.find(session,100,100),null);assert.deepEqual(checked(f),['invalid']);
  f.hit(100,100,f.canvas);
  assert.equal(f.find(session,100,100),valid);assert.equal(f.find(session,100,100),valid);
  assert.deepEqual(checked(f),['invalid','valid'],'nearby rejected candidates must remain memoized too');
  valid.disabled=true;
  assert.equal(f.find(session,100,100),null);assert.equal(f.calls.length,2,'disabled sockets must not become targets');
  session.dispose();
}

// A socket hidden behind another surface is not even a validation candidate.
{
  const f=fixture('hover'),occluded=f.add('occluded',{x:198,y:203,width:4,height:4});
  const session=f.create();f.hit(200,205,f.canvas);
  assert.equal(f.find(session,200,200),null);assert.equal(f.calls.length,0);
  f.hit(200,205,occluded);assert.equal(f.find(session,200,200),occluded);assert.equal(f.calls.length,1);session.dispose();
}

// Default mode clips to the canvas and browser viewport in CSS pixels, with a
// fixed snap-radius margin. Floating inputs are independent of source visibility.
{
  const f=fixture();f.setUiScale(2);f.context.scale=.35;
  f.add('inside');f.add('left-margin',{x:80});f.add('left-outside',{x:79});
  f.add('right-margin',{x:314});f.add('right-outside',{x:315});
  f.add('top-margin',{y:80});f.add('top-outside',{y:79});
  f.add('bottom-margin',{y:274});f.add('bottom-outside',{y:275});
  f.add('floating',{x:950,y:750,panel:true});f.add('hidden-floating',{panel:true,hidden:true});
  const session=f.create(),expected=['inside','left-margin','right-margin','top-margin','bottom-margin','floating'];
  assert.deepEqual(ids(session.get()),expected);assert.deepEqual(checked(f),expected);
  session.get();assert.equal(f.calls.length,expected.length,'unchanged viewport must not rescan');
  f.setUiScale(.8);assert.deepEqual(ids(session.get()),expected,'UI scale must not multiply CSS-pixel margin');
  assert.equal(f.calls.length,expected.length*2,'UI-scale change must refresh geometry');
  f.document.documentElement.clientWidth=220;
  assert.deepEqual(ids(session.get()),['inside','left-margin','top-margin','bottom-margin','floating'],'browser clipping must apply before the CSS-pixel margin');
  session.dispose();
}

// Touch uses its larger CSS-pixel radius. Omitting the predicate still supports
// source-port picking before a wire gesture exists.
{
  const f=fixture('hover'),button=f.add('touch',{x:98,y:118,width:4,height:4});
  const session=f.create(22);
  assert.equal(f.find(session,100,100,14),null);assert.equal(f.calls.length,0);
  assert.equal(f.find(session,100,100,22),button);assert.equal(f.calls.length,1);
  assert.equal(f.context.findWireTarget([button],100,100,22),button);
  assert.equal(f.calls.length,1,'source picking must not add connection validation');session.dispose();
  const viewport=fixture('viewport');viewport.add('touch-margin',{x:320});
  const touch=viewport.create(22);assert.deepEqual(ids(touch.get()),['touch-margin']);touch.dispose();
}

// Routers expose the direction opposite the gesture origin even when their
// rendered socket has the other data-kind; the router body is also a hit target.
{
  const f=fixture('hover'),button=f.add('router',{router:true,kind:'outputs'});
  const session=f.create();f.hit(180,180,button.parent);
  assert.equal(f.find(session,180,180),button);
  assert.deepEqual(checked(f),['router']);assert.equal(f.calls[0].kind,'inputs');assert.equal(f.calls[0].port,'value');session.dispose();
}

// View geometry and model changes refresh discovery; scroll and real socket DOM
// changes invalidate, while temporary highlights and unrelated repainting do not.
{
  const f=fixture('viewport'),inside=f.add('inside'),moving=f.add('moving',{x:450});
  const session=f.create();assert.deepEqual(ids(session.get()),['inside']);
  moving.rect=rectangle(200,150);f.context.pan.x=30;
  assert.deepEqual(ids(session.get()),['inside','moving']);assert.equal(f.calls.length,3);
  moving.rect=rectangle(450,150);f.context.scale=2;
  assert.deepEqual(ids(session.get()),['inside']);assert.equal(f.calls.length,4);
  f.canvas.rect=rectangle(100,100,400,160);
  assert.deepEqual(ids(session.get()),['inside','moving']);assert.equal(f.calls.length,6);
  moving.rect=rectangle(650,150);f.scroll();
  assert.deepEqual(ids(session.get()),['inside']);assert.equal(f.calls.length,7);
  f.context.editVersion++;session.get();assert.equal(f.calls.length,8);
  f.mutation({type:'attributes',target:inside,attributeName:'class'});session.get();assert.equal(f.calls.length,8,'wire-target decoration must not cause a rescan');
  f.mutation({type:'attributes',target:inside.parent,attributeName:'class'});session.get();assert.equal(f.calls.length,8,'vector preview decoration must not cause a rescan');
  f.mutation({type:'childList',target:f.cards,addedNodes:[{nodeType:1,matches:()=>false,querySelector:()=>null}],removedNodes:[]});
  session.get();assert.equal(f.calls.length,8,'non-socket repainting must not cause a rescan');
  inside.disabled=true;f.mutation({type:'attributes',target:inside,attributeName:'disabled'});
  assert.deepEqual(ids(session.get()),[]);
  const replacement=f.add('replacement',{x:250});
  f.mutation({type:'childList',target:f.cards,addedNodes:[replacement.parent],removedNodes:[]});
  assert.deepEqual(ids(session.get()),['replacement']);
  replacement.isConnected=false;f.mutation({type:'childList',target:replacement.parent,addedNodes:[],removedNodes:[replacement]});
  assert.deepEqual(ids(session.get()),[]);
  const observer=f.observers[0];assert.equal(f.listeners.get('scroll').size,1);
  const count=f.calls.length;session.dispose();assert.equal(observer.connected,false);assert.equal(f.listeners.get('scroll').size,0);
  f.scroll();f.context.editVersion++;assert.deepEqual(ids(session.get()),[]);assert.equal(session.accept(inside),false);assert.equal(f.calls.length,count,'disposed gesture must remain inert');
}

// Socket geometry can change without an editVersion (e.g. DOM positioning or
// hiding a containing surface). Ancestor changes must refresh viewport discovery.
{
  const f=fixture('viewport'),button=f.add('moving-card',{x:450});
  const session=f.create();assert.deepEqual(ids(session.get()),[]);
  button.rect=rectangle(200,150);
  f.queueMutation({type:'attributes',target:button.closest('.node'),attributeName:'style'});
  assert.deepEqual(ids(session.get()),['moving-card'],'pending card style changes must refresh before MutationObserver delivery');
  button.parent.hidden=true;
  f.mutation({type:'attributes',target:button.parent,attributeName:'hidden'});
  assert.deepEqual(ids(session.get()),[],'hiding an ancestor must remove its sockets');
  button.parent.hidden=false;
  f.mutation({type:'attributes',target:button.parent,attributeName:'hidden'});
  assert.deepEqual(ids(session.get()),['moving-card'],'revealing an ancestor must rediscover its sockets');session.dispose();
}

console.log('Wire candidates: legacy/hover/viewport validation counts, CSS geometry, snapping, routers, touch, invalidation and disposal passed');
