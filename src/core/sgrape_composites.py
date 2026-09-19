"""Graph-owned compound type descriptions; no runtime evaluation or global registry.

Array lengths are literals, host macros, or stable references to integer constants.
Opaque resources are references, never editable/copyable values.
"""
import copy
import re

MAX_ARRAY_LENGTH = 1024
TYPE_ID = re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,63}$')
GLSL_NAME = re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,47}$')
RESERVED_NAMES = frozenset('struct uniform const buffer shared in out inout void if else for while do switch case default break continue return discard layout true false attribute varying precision highp mediump lowp bool int uint float double'.split())
ARRAY_TYPE = re.compile(r'^([^\[\]]+)\[([A-Za-z_][A-Za-z0-9_]*|[0-9]+)\](.*)$')
KEYS = ('array', 'array_create', 'array_get', 'array_replace', 'array_length', 'struct_field', 'builtin_source')

def expression_length(scope,source):
    return 'sg_extent_'+('\0'.join((scope,*source))).encode('utf-8').hex()

def creation_lengths(graph):
    """Describe size provenance; never evaluate the upstream GLSL expression."""
    declarations={d.get('id'):d for d in graph.get('declarations',[]) if isinstance(d,dict)}
    units=list(graph.get('stages',{}).items())+[('fn_'+f['id'],f.get('graph',{})) for f in graph.get('functions',[]) if isinstance(f,dict) and isinstance(f.get('id'),str)]
    expressions={};bindings={}
    for scope,data in units:
        nodes={n.get('id'):n for n in data.get('nodes',[]) if isinstance(n,dict)}
        if not any(n.get('definitionUuid')=='sgrape.builtin.array_create' for n in nodes.values()):continue
        incoming={tuple(e['to']):tuple(e['from']) for e in data.get('edges',[]) if isinstance(e,dict) and isinstance(e.get('to'),list) and len(e['to'])==2 and isinstance(e.get('from'),list) and len(e['from'])==2}
        for ident,n in nodes.items():
            if n.get('definitionUuid')!='sgrape.builtin.array_create':continue
            length=n.get('inputValues',{}).get('length',n.get('params',{}).get('length',4));source=incoming.get((ident,'length'))
            if source:
                upstream=nodes.get(source[0],{});params=upstream.get('params',{});decl=declarations.get(params.get('declarationId'),{})
                if upstream.get('definitionUuid') in ('sgrape.builtin.constant','sgrape.builtin.spec_constant') and decl.get('kind') in ('constant','spec_constant') and decl.get('type') in ('int','uint'):
                    length='sg_len_'+decl['id']
                elif upstream.get('definitionUuid')=='sgrape.builtin.scalar' and params.get('type') in ('int','uint') and type(params.get('value')) is int:
                    length=params['value']
                else:
                    length=expression_length(scope,source)
                    expressions[length]=dict(name=length,type='int',kind='expression',scope=scope,source=source)
            bindings[(scope,ident)]=length
    return expressions,bindings

if 'me' in globals():
    _source_catalog = me.parent().op('sgrape_source_catalog').module
else:
    import sgrape_source_catalog as _source_catalog

# Shared source metadata is loaded once; each graph gets its own Registry copy.
BUILTIN_STRUCTS = _source_catalog.CATALOG['structures']
SOURCES = _source_catalog.CATALOG['builtins']
LENGTH_MACROS = _source_catalog.CATALOG['lengthMacros']

class Registry:
    def __init__(self,base_types,definitions=(),error=ValueError,declarations=(),graph=None):
        self.base=base_types;self.error=error;self.structs=copy.deepcopy(BUILTIN_STRUCTS);self.cache={};self.checked=set();self.environments=set()
        self.lengths={'sg_len_'+d['id']:d for d in declarations if isinstance(d,dict)
                     and isinstance(d.get('id'),str) and TYPE_ID.fullmatch(d['id'])
                      and d.get('kind') in ('constant','spec_constant') and d.get('type') in ('int','uint')}
        expressions,self.creations=creation_lengths(graph or {})
        self.lengths.update(expressions)
        if not isinstance(definitions,(list,tuple)) or len(definitions)>64:self.fail('At most 64 structure definitions are supported')
        for item in definitions:
            if not isinstance(item,dict):self.fail('Invalid structure definition')
            ident=item.get('id'); name=item.get('name')
            if not isinstance(ident,str) or not TYPE_ID.fullmatch(ident) or 'struct:'+ident in self.structs:self.fail('Invalid or duplicate structure identity')
            if not isinstance(name,str) or not name.strip() or len(name)>80:self.fail('Structure name must contain 1–80 characters')
            if item.get('provider','generated')!='generated':self.fail('Project structures must use generated declarations')
            members=item.get('fields')
            if not isinstance(members,list) or not 1<=len(members)<=64:self.fail('Structure must have 1–64 fields')
            seen=set(); names=set()
            for member in members:
                if not isinstance(member,dict):self.fail('Invalid structure field')
                mid=member.get('id');mname=member.get('name')
                if not isinstance(mid,str) or not TYPE_ID.fullmatch(mid) or mid in seen:self.fail('Invalid or duplicate field identity')
                if not isinstance(mname,str) or not GLSL_NAME.fullmatch(mname) or mname.startswith(('gl_','TD','sg_')) or '__' in mname or mname in names or mname in RESERVED_NAMES or mname in self.base:self.fail('Invalid or duplicate GLSL field name')
                seen.add(mid);names.add(mname)
            self.structs['struct:'+ident]=dict(id=ident,name=name,glslName='sg_type_'+ident,provider='generated',fields=copy.deepcopy(members),targets=['top','mat'],stages=['vertex','pixel'])
        for ty,item in self.structs.items():
            if item['provider']=='generated':self._validate_structure(ty,set())

    def fail(self,message):raise self.error(message)

    def _validate_structure(self,ty,active):
        if ty in active:self.fail('Recursive structure definitions are not supported')
        if ty in self.checked:return
        if len(active)>16:self.fail('Structure nesting exceeds 16 levels')
        active=active|{ty}
        for member in self.structs[ty]['fields']:
            child=member.get('type');desc=self.describe(child)
            while desc['kind']=='array':
                if not isinstance(desc['length'],int):self.fail('Structure fields require a fixed array length')
                child=desc['elementType'];desc=self.describe(child)
            if desc['kind']=='resource':self.fail('Structures cannot contain opaque resources')
            if desc['kind']=='struct':self._validate_structure(child,active)
        self.checked.add(ty)

    def describe(self,ty):
        if not isinstance(ty,str) or len(ty)>512:self.fail('Invalid type reference')
        if ty in self.cache:return self.cache[ty]
        if ty in self.base:result=dict(kind='value',type=ty)
        elif ty=='sampler2D':result=dict(kind='resource',type=ty)
        elif ty in self.structs:result=dict(kind='struct',type=ty,definition=self.structs[ty])
        else:
            match=ARRAY_TYPE.fullmatch(ty)
            if match is None:self.fail('Unknown type: '+ty)
            base,raw,tail=match.groups();element=base+tail
            if ty.count('[')>8:self.fail('Array nesting exceeds 8 dimensions')
            if raw.isdigit():
                length=int(raw)
                if str(length)!=raw or not 1<=length<=MAX_ARRAY_LENGTH:self.fail('Array length must be an integer from 1 to '+str(MAX_ARRAY_LENGTH))
            elif raw in LENGTH_MACROS or raw in self.lengths:length=raw
            else:self.fail('Array length must be a positive literal or a supported host length')
            child=self.describe(element)
            if child['kind']=='array' and self.specialized(element):self.fail('Only the outermost array dimension can use a specialization constant')
            result=dict(kind='array',type=ty,elementType=element,length=length)
        self.cache[ty]=result;return result

    def valid(self,ty,resources=True):
        try:self.describe(ty);return resources or not self.opaque(ty)
        except (ValueError,TypeError):return False

    def opaque(self,ty):
        d=self.describe(ty)
        return d['kind']=='resource' or (d['kind']=='array' and self.opaque(d['elementType']))

    def check_environment(self,ty,target,stage):
        key=(ty,target,stage)
        if key in self.environments:return
        d=self.describe(ty)
        if d['kind']=='array':
            if d['length'] in LENGTH_MACROS:self._available(LENGTH_MACROS[d['length']],target,stage)
            self.check_environment(d['elementType'],target,stage)
        elif d['kind']=='struct':
            self._available(d['definition'],target,stage)
            for member in d['definition']['fields']:self.check_environment(member['type'],target,stage)
        self.environments.add(key)

    def _available(self,item,target,stage):
        if target not in item['targets'] or stage not in item['stages']:self.fail('Type or source is unavailable in '+target.upper()+' '+stage)

    def source(self,ident,target=None,stage=None):
        if not isinstance(ident,str) or ident not in SOURCES:self.fail('Select an existing built-in source')
        item=SOURCES[ident]
        if target is not None:self._available(item,target,stage)
        return item

    def field(self,ty,ident):
        d=self.describe(ty)
        if d['kind']!='struct':self.fail('Field selection requires a structure')
        found=next((f for f in d['definition']['fields'] if f['id']==ident),None)
        if found is None:self.fail('Select a field that exists in this structure')
        return found

    def glsl_type(self,ty):
        d=self.describe(ty)
        if d['kind']=='array':return self.array_type(self.glsl_type(d['elementType']),self.extent(d['length']))
        if d['kind']=='struct':return d['definition'].get('glslName',d['definition']['name'])
        return ty

    def array_type(self,element,length):
        base,separator,tail=element.partition('[')
        return base+'['+str(length)+']'+(separator+tail if separator else '')

    def declaration(self,ty,name):
        # GLSL permits type-attached sizes; declarator sizes keep function ports clear.
        d=self.describe(ty)
        if d['kind']=='array':return self.declaration(d['elementType'],name+'['+self.extent(d['length'])+']')
        return self.glsl_type(ty)+' '+name

    def extent(self,length):
        """Render a symbol, never fetch/evaluate its live value from the host."""
        return self.lengths[length]['name'] if length in self.lengths else str(length)

    def length_dependencies(self,ty):
        d=self.describe(ty)
        if d['kind']=='array':
            source=self.lengths.get(d['length'])
            return ({source['id']} if source and 'id' in source else set())|self.length_dependencies(d['elementType'])
        if d['kind']=='struct':return set().union(*(self.length_dependencies(f['type']) for f in d['definition']['fields']))
        return set()

    def specialized(self,ty):
        d=self.describe(ty)
        source=self.lengths.get(d.get('length'),{})
        return d['kind']=='array' and (source.get('kind')=='spec_constant' or source.get('specialized',False) or self.specialized(d['elementType']))

    def expression_dependencies(self,ty):
        d=self.describe(ty)
        if d['kind']=='array':
            return ({d['length']} if self.lengths.get(d['length'],{}).get('kind')=='expression' else set())|self.expression_dependencies(d['elementType'])
        return set()

    def copy_value(self,target,source,ty):
        """Specialization-sized arrays cannot use GLSL aggregate assignment."""
        d=self.describe(ty)
        if not self.specialized(ty):return ['    '+target+' = '+source+';']
        return ['    for (int sg_copy_i = 0; sg_copy_i < '+self.extent(d['length'])+'; ++sg_copy_i) {',
                '        '+target+'[sg_copy_i] = ('+source+')[sg_copy_i];','    }']

    def value(self,ty,base_value,scalar=0,budget=None):
        budget=[0] if budget is None else budget;budget[0]+=1
        if budget[0]>65536:self.fail('Composite default exceeds 65536 values')
        d=self.describe(ty)
        if d['kind']=='array':
            if not isinstance(d['length'],int) or self.opaque(ty):return None
            return [self.value(d['elementType'],base_value,scalar,budget) for _ in range(d['length'])]
        if d['kind']=='struct':return {f['id']:self.value(f['type'],base_value,scalar,budget) for f in d['definition']['fields']}
        if d['kind']=='resource':return None
        return base_value(ty,scalar)

    def literal(self,value,ty,base_literal):
        d=self.describe(ty)
        if d['kind']=='array':
            if self.opaque(ty) or not isinstance(d['length'],int):
                if value is None:return None
                self.fail('This array requires a connected source')
            if not isinstance(value,list) or len(value)!=d['length']:self.fail('Expected '+str(d['length'])+' array elements')
            return self.glsl_type(ty)+'('+', '.join(self.literal(v,d['elementType'],base_literal) for v in value)+')'
        if d['kind']=='struct':
            members=d['definition']['fields']
            if not isinstance(value,dict) or set(value)!={f['id'] for f in members}:self.fail('Expected the declared structure fields')
            return self.glsl_type(ty)+'('+', '.join(self.literal(value[f['id']],f['type'],base_literal) for f in members)+')'
        return base_literal(value,ty)

    def initialize(self,name,ty,base_value,base_literal):
        """Zero an output, including host-sized value arrays, without a readback."""
        result=[];counter=[0]
        def emit(target,kind,indent):
            d=self.describe(kind)
            if self.opaque(kind):self.fail('Opaque outputs cannot be initialized')
            if d['kind']=='array':
                variable='sg_init_'+str(counter[0]);counter[0]+=1
                result.append(indent+'for (int '+variable+' = 0; '+variable+' < '+self.extent(d['length'])+'; ++'+variable+') {')
                emit(target+'['+variable+']',d['elementType'],indent+'    ')
                result.append(indent+'}')
            else:result.append(indent+target+' = '+self.literal(self.value(kind,base_value),kind,base_literal)+';')
        emit(name,ty,'    ');return result

    def declarations(self,types,target,stage):
        emitted=set();lines=[]
        def visit(ty):
            self.check_environment(ty,target,stage);d=self.describe(ty)
            if d['kind']=='array':visit(d['elementType'])
            if d['kind']!='struct' or ty in emitted:return
            item=d['definition']
            for f in item['fields']:visit(f['type'])
            emitted.add(ty)
            if item['provider']=='generated':
                lines.append('struct '+self.glsl_type(ty)+' {')
                lines.extend('    '+self.declaration(f['type'],f['name'])+';' for f in item['fields'])
                lines.append('};')
        for ty in sorted(set(types)):visit(ty)
        return lines

    def interface(self,key,params):
        if key=='builtin_source':return dict(inputs={},outputs={'out':self.source(params.get('source','uTD2DInfos'))['type']})
        if key in ('array','array_create'):
            element=params.get('elementType','float');length=params.get('length',4)
            self.describe(element)
            if type(length) is not int and (not isinstance(length,str) or length not in self.lengths and length not in LENGTH_MACROS):self.fail('Array length must be an integer or a constant reference')
            ty=self.array_type(element,length);self.describe(ty)
            if self.opaque(ty):self.fail('Opaque resources must come from a source; they cannot be initialized')
            return dict(inputs={'length':'int','value':element} if key=='array_create' else {},outputs={'out':ty})
        ty=params.get('type','TDTexInfo' if key=='struct_field' else 'float[4]')
        if key=='struct_field':return dict(inputs={'value':ty},outputs={'out':self.field(ty,params.get('field','res'))['type']})
        d=self.describe(ty)
        if d['kind']!='array':self.fail('Connect an array')
        inputs={'Array':ty}
        if key=='array_length':return dict(inputs=inputs,outputs={'out':'int'})
        index=params.get('indexType','int')
        if index not in ('int','uint'):self.fail('Array index must be int or uint')
        inputs['i']=index
        if key=='array_replace':
            if self.opaque(ty):self.fail('Opaque resource arrays cannot be copied or replaced')
            inputs['replacement']=d['elementType']
        return dict(inputs=inputs,outputs={'out':ty if key=='array_replace' else d['elementType']})

    def contract(self):
        return dict(version=1,hostProfile={'product':'TouchDesigner','build':'2025.32820'},structs=copy.deepcopy(self.structs),sources=copy.deepcopy(SOURCES),
                    array=dict(maxLength=MAX_ARRAY_LENGTH,indexTypes=['int','uint'],lengthMacros=copy.deepcopy(LENGTH_MACROS)))
