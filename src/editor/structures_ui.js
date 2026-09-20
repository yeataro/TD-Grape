/* Graph-owned definitions. Native sources and their values have no owner here. */
const StructureUI=(()=>{
  const cards=new Map(),collapsed=new Set();let context='',helpId=null;
  const uid=prefix=>prefix+crypto.randomUUID().replaceAll('-','').slice(0,12);
  const definitions=()=>graph.typeDefinitions||[];
  const shape=item=>JSON.stringify(item?.fields||[]);
  const scopes=document=>[...Object.entries(document.stages).map(([key,data])=>({key,data,owner:null})),...(document.functions||[]).map(owner=>({key:owner.id,data:owner.graph,owner}))];
  function validate(items){
    if(items.length>64)throw Error(t('struct.limit'));
    const document={...graph,typeDefinitions:items},ids=new Set(),names=new Set();
    for(const item of items){
      if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(item.id)||ids.has(item.id)||!item.name.trim()||item.name.length>80||names.has(item.name)||/[\x00-\x1f]/.test(item.name))throw Error(t('struct.invalid'));
      if(typeof item.description!=='string'&&item.description!==undefined||item.description?.length>4000||!item.fields.length||item.fields.length>64)throw Error(t('struct.invalid'));
      ids.add(item.id);names.add(item.name);const fields=new Set(),fieldNames=new Set();
      for(const f of item.fields){
        if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(f.id)||fields.has(f.id)||!nodeNameValid(f.name)||fieldNames.has(f.name)||valueTypes().includes(f.name))throw Error(t('struct.invalid'));
        fields.add(f.id);fieldNames.add(f.name);
      }
    }
    function visit(type,active=new Set(),depth=0){
      if(active.has(type)||depth>16)throw Error(t('struct.cycle'));
      const d=typeDescriptor(type,document);if(!d||isResourceType(type))throw Error(t('struct.invalidType'));
      if(d.shape==='array'){if(typeof d.length!=='number')throw Error(t('struct.fixedArray'));visit(d.elementType,new Set([...active,type]),depth+1);}
      if(d.shape==='struct')for(const f of d.fields)visit(f.type,new Set([...active,type]),depth+1);
    }
    for(const item of items)visit('struct:'+item.id);
  }
  function affectedTypes(id,document=graph){
    const set=new Set(['struct:'+id]);let changed=true;
    while(changed){changed=false;for(const item of document.typeDefinitions||[])if(!set.has('struct:'+item.id)&&item.fields.some(f=>set.has(f.type.split('[')[0]))){set.add('struct:'+item.id);changed=true;}}
    return set;
  }
  function usages(id,document=graph){
    const types=affectedTypes(id,document),uses=value=>[...types].some(type=>JSON.stringify(value).includes('"'+type+'"')||JSON.stringify(value).includes('"'+type+'[')),list=[];
    for(const {key,data,owner}of scopes(document)){
      for(const n of data.nodes)if(uses(n.params))list.push({kind:'node',scope:key,id:n.id});
      if(owner&&uses([owner.inputs,owner.outputs]))list.push({kind:'function',id:owner.id});
    }
    for(const d of document.declarations)if(uses(d.type))list.push({kind:'source',id:d.id});
    for(const item of document.typeDefinitions||[])if(item.id!==id&&item.fields.some(f=>f.type.split('[')[0]==='struct:'+id))list.push({kind:'structure',id:item.id});
    return list;
  }
  function apply(items,id){
    validate(items);const previous=clone(graph),old=definitions().find(d=>d.id===id),next=items.find(d=>d.id===id),typeChanged=shape(old)!==shape(next);
    if(!changeDeclaration(()=>{
      graph.typeDefinitions=items;
      if(typeChanged)for(const {data}of scopes(graph))for(const n of data.nodes)if(n.definitionUuid==='sgrape.builtin.struct_create'&&n.inputValues){
        const fields=compositePorts('struct_create',n.params,graph).inputs;
        for(const port of Object.keys(n.inputValues))if(!fields[port])delete n.inputValues[port];else if(hasValueEditor(fields[port])&&compositePorts('struct_create',n.params,previous).inputs[port]!==fields[port])n.inputValues[port]=shapedValue(n.inputValues[port],fields[port]);
      }
    },{redraw:false,typeChange:typeChanged,disconnectInvalid:false}))return false;
    // Derive the affected visible cards from port/parameter differences, after
    // downstream inference. Unrelated cards keep their DOM and numeric controls.
    const active=currentFunction(),oldScope=active?previous.functions.find(f=>f.id===active.id)?.graph:previous.stages[stage];
    if(oldScope){
      const before=planAutoGraph(previous,oldScope,active&&previous.functions.find(f=>f.id===active.id),new Map(),{draft:true}).ports;
      const after=planAutoGraph(graph,current(),active,new Map(),{draft:true}).ports,types=affectedTypes(id),changed=new Set();
      for(const n of current().nodes){const prior=oldScope.nodes.find(p=>p.id===n.id);if(JSON.stringify(before.get(n.id))!==JSON.stringify(after.get(n.id))||JSON.stringify(prior?.params)!==JSON.stringify(n.params)||(typeChanged||old?.name!==next?.name)&&[...types].some(type=>(JSON.stringify(after.get(n.id))||'').includes(type)))changed.add(n.id);}
      if(changed.size){renderCards({only:changed});wires();}
    }
    render();library();inspector();if(helpContext==='structure')help();return true;
  }
  function help(id=helpId){
    helpId=id;const item=definitions().find(d=>d.id===id),box=$('#nodehelp');box.replaceChildren();if(!item)return;
    box.append(el('h3',{},item.name));for(const f of item.fields)box.append(el('p',{},f.name+' · '+displayType(f.type)));
    if(item.description)box.append(el('p',{class:'structure-notes'},item.description));
    box.append(el('p',{class:'muted'},t('struct.uses').replace('{count}',usages(id).length)));
  }
  function reference(id){
    if(editorMutationBlocked())return;const item=definitions().find(d=>d.id===id),base=catalog.find(d=>d.key==='struct_create');if(item&&base)addBuiltInReference({...base,label:item.name,defaults:{type:'struct:'+id}});
  }
  async function remove(id){
    const item=definitions().find(d=>d.id===id);if(!item||editorMutationBlocked())return;
    if(usages(id).length){status(t('struct.inUse'),true);return;}
    const stamp=JSON.stringify(item),generation=editorLoadGeneration;
    if(!await confirmOverlay({title:t('struct.remove'),message:item.name,confirmLabel:t('sources.remove')}))return;
    if(generation!==editorLoadGeneration||stamp!==JSON.stringify(definitions().find(d=>d.id===id))||usages(id).length)return;
    apply(definitions().filter(d=>d.id!==id),id);
  }
  function menu(id,anchor,event){
    event?.preventDefault();document.querySelector('#structuremenu')?.remove();
    const popup=el('div',{id:'structuremenu',class:'popup-menu source-card-menu',popover:'auto',role:'menu'});
    for(const [label,action]of [['struct.reference',()=>reference(id)],['struct.edit',()=>edit(id)],['struct.remove',()=>remove(id)]]){const button=el('button',{type:'button',role:'menuitem'},t(label));button.disabled=readonly;button.onclick=()=>{popup.hidePopover();action();};popup.append(button);}
    const rect=anchor.getBoundingClientRect();popup.style.left=rect.left/uiScaleFactor()+'px';popup.style.top=rect.bottom/uiScaleFactor()+'px';document.body.append(popup);popup.showPopover();
  }
  function render(){
    const box=$('#structureslist');if(!box||!graph)return;
    const nextContext=JSON.stringify([language,editorLoadGeneration]);if(context!==nextContext){cards.clear();context=nextContext;}
    const children=[];for(const item of definitions()){
      const key=JSON.stringify(item);let cached=cards.get(item.id);
      if(cached?.key!==key){
        const card=el('article',{class:'input-source-row source-card','data-category':'data','data-structure':item.id}),head=el('div',{class:'source-card-head'}),body=el('div',{class:'source-card-body'});
        const fold=el('button',{class:'source-card-toggle','aria-label':t('struct.fields'),'aria-expanded':String(!collapsed.has(item.id))},'›');body.hidden=collapsed.has(item.id);
        fold.onclick=()=>{body.hidden=!body.hidden;fold.setAttribute('aria-expanded',String(!body.hidden));body.hidden?collapsed.add(item.id):collapsed.delete(item.id);};
        const pick=el('button',{class:'input-source-select'});pick.append(el('span',{},item.name),el('small',{},t('struct.type')));pick.onclick=()=>{helpContext='structure';help(item.id);workspaceLayout.reveal('help');};
        const add=el('button',{class:'input-reference','data-structure-reference':item.id,'aria-label':t('struct.reference')},'+');add.onclick=()=>reference(item.id);
        const actions=el('button',{class:'source-card-menu-button','aria-label':t('sources.actions')},'⋯');actions.onclick=e=>menu(item.id,actions,e);head.oncontextmenu=e=>menu(item.id,head,e);
        for(const f of item.fields)body.append(el('p',{class:'source-card-meta'},f.name+' · '+displayType(f.type)));
        head.append(fold,pick,add,actions);card.append(head,body);cached={key,card};cards.set(item.id,cached);
      }
      for(const button of cached.card.querySelectorAll('.input-reference,.source-card-menu-button'))button.disabled=readonly;children.push(cached.card);
    }
    reconcileSourceChildren(box,children);for(const id of cards.keys())if(!definitions().some(d=>d.id===id))cards.delete(id);
    const add=$('#newstructure');add.textContent=t('struct.new');add.disabled=readonly||definitions().length>=64;add.onclick=()=>edit();
  }
  function edit(id=null){
    if(editorMutationBlocked()||document.querySelector('#structuredialog'))return;
    const original=definitions().find(d=>d.id===id);if(id&&!original)return;
    const draft=clone(original||{id:uid('s_'),name:'Structure',description:'',fields:[{id:uid('f_'),name:'value',type:'float'}]}),stamp=JSON.stringify(original),generation=editorLoadGeneration;
    const dialog=el('dialog',{id:'structuredialog','aria-label':t(id?'struct.edit':'struct.new')}),form=el('form'),header=el('header',{class:'custom-dialog-heading'}),close=el('button',{type:'button'},t('action.close'));
    close.onclick=()=>dialog.close();header.append(el('strong',{},t(id?'struct.edit':'struct.new')),close);
    const name=input(draft.name,()=>{},'text',{local:true});name.maxLength=80;name.dataset.structureName='';
    const notes=el('textarea',{maxlength:4000,rows:3,'data-structure-notes':''});notes.value=draft.description||'';
    const fields=el('section',{'data-structure-fields':''}),issue=el('p',{class:'error',role:'alert'}),usage=el('p',{class:'muted'},t('struct.uses').replace('{count}',id?usages(id).length:0));
    function drawFields(){
      fields.replaceChildren();
      for(const [index,f]of draft.fields.entries()){
        const row=el('section',{class:'structure-field','data-structure-field':f.id}),fname=input(f.name,v=>f.name=v,'text',{local:true});fname.maxLength=48;
        const descriptor=typeDescriptor(f.type),array=descriptor?.shape==='array',base=array?descriptor.elementType:f.type;
        const types=[...valueTypes(),...Object.keys(compositeStructs()).filter(type=>type!=='struct:'+draft.id&&typeAvailable(type))];if(!types.includes(base))types.push(base);
        const picker=typeSelect(types.map(type=>[type,displayType(type)]),base,value=>{f.type=lengthToggle.querySelector('input').checked?arrayType(value,Number(size.value)):value;});
        const size=typedScalarInput(array?descriptor.length:4,'int',value=>{if(value>=1&&value<=1024)f.type=arrayType(picker.value,value);});size.min='1';size.max='1024';size.hidden=!array;size.dataset.structureArraySize='';
        const lengthToggle=toggle(t('struct.array'),array,value=>{size.hidden=!value;f.type=value?arrayType(picker.value,Number(size.value)):picker.value;});
        const actions=el('div',{class:'structure-field-actions'});for(const [label,offset]of [['↑',-1],['↓',1]]){const button=el('button',{type:'button','aria-label':t(offset<0?'inputs.moveUp':'inputs.moveDown')},label);button.disabled=index+offset<0||index+offset>=draft.fields.length;button.onclick=()=>{[draft.fields[index],draft.fields[index+offset]]=[draft.fields[index+offset],draft.fields[index]];drawFields();};actions.append(button);}
        const del=el('button',{type:'button','data-structure-field-remove':f.id},t('struct.removeField'));del.onclick=()=>{draft.fields.splice(index,1);drawFields();};actions.append(del);
        row.append(field(t('struct.field'),fname),field(t('struct.fieldType'),picker),lengthToggle,size,actions);fields.append(row);
      }
    }
    drawFields();const add=el('button',{type:'button','data-structure-add-field':''},t('struct.addField'));add.onclick=()=>{if(draft.fields.length<64){draft.fields.push({id:uid('f_'),name:'field'+(draft.fields.length+1),type:'float'});drawFields();}};
    const save=el('button',{class:'primary',type:'submit','data-structure-save':''},t('struct.save'));
    form.append(header,field(t('struct.name'),name),fields,add,field(t('struct.notes'),notes),usage,el('p',{class:'muted'},t('struct.editHint')),issue,save);dialog.append(form);
    form.onsubmit=e=>{e.preventDefault();try{
      if(generation!==editorLoadGeneration||stamp!==JSON.stringify(definitions().find(d=>d.id===id)))throw Error(t('struct.changed'));
      draft.name=name.value.trim();draft.description=notes.value;const next=definitions().map(d=>d.id===id?clone(draft):d);if(!id)next.push(clone(draft));
      if(apply(next,draft.id)){helpId=draft.id;dialog.close();}else issue.textContent=$('#status').textContent;
    }catch(error){issue.textContent=error.message;}};
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();name.focus();name.select();
  }
  return {render,edit,help,reference,validate,usages,apply};
})();
