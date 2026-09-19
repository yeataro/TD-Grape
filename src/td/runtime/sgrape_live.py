"""Uniform sessions. Native Web Server DAT owns WebSocket framing.

All methods run on TD's main thread. Values never enter graph storage. A
gesture pins actual Par identities; updates cost one component, not one graph.
"""
import collections
import copy
import ipaddress
import json
import secrets
import socket
import time
from urllib.parse import urlsplit, parse_qs

service = None


def constant(p):
    return str(p.mode).endswith('CONSTANT')


class Source:
    def __init__(self, live, comp, ident):
        self.live, self.comp, self.ident = live, comp, ident
        r, m = live.runtime, live.model
        self.operator = r.shader_operator(comp)
        self.record = copy.deepcopy(comp.fetch(m.STORE, {}).get(ident))
        if not self.record or self.record.get('missing') or self.record['sequence'] not in ('vec', 'color'):
            raise RuntimeError('This source has no live numeric components.')
        with r.shader_context(comp):
            self.declaration = next((d for d in r.state()['graph']['declarations'] if d['id'] == ident), None)
        if not self.declaration or self.declaration['kind'] != 'uniform':
            raise RuntimeError('Only Uniform values use live editing.')
        # The inventory reconciler has already established this unique source.
        # Pin its slot and Par identity; never rescan all names for a gesture.
        seq = self.record['sequence']
        self.index = self.record['index']
        if not 0 <= self.index < getattr(self.operator.seq, seq).numBlocks: raise RuntimeError('The Uniform row moved.')
        self.name = m.parameter(self.operator, seq, self.index, 'name')
        self.pars = [m.parameter(self.operator, seq, self.index, suffix) for suffix in m.CHANNELS[seq]]
        self.typepar = getattr(self.operator.par, seq + str(self.index) + 'type', None)
        self.native_type = self.typepar.eval() if self.typepar is not None else None
        self.epoch = live.metadata_epochs.get(comp.id, 0)

    def check(self):
        m = self.live.model
        if not self.comp.valid or not self.operator.valid or self.live.runtime.shader_operator(self.comp) != self.operator:
            raise RuntimeError('The original Shader no longer exists.')
        if self.comp.fetch(m.STORE, {}).get(self.ident) != self.record:
            raise RuntimeError('The Uniform source changed.')
        if self.epoch != self.live.metadata_epochs.get(self.comp.id, 0): raise RuntimeError('Refresh the changed native inventory.')
        if not self.name.valid or str(self.name.eval()) != self.record['name']:
            raise RuntimeError('The Uniform row moved or was renamed.')
        if self.typepar is not None and self.typepar.eval() != self.native_type:
            raise RuntimeError('The Uniform type changed.')
        for p in self.pars:
            current = getattr(self.operator.par, p.name, None) if p.valid else None
            if current is None or not p.isSamePar(current): raise RuntimeError('The Uniform parameter was replaced.')

    def editable(self, p):
        if constant(p): return p
        # Only bindings created and owned by Grape can be edited through their master.
        link = self.comp.fetch('grapeControlLinksV1', {}).get(self.ident, {})
        for item in link.get('components', []):
            if self.pars[item['index']].isSamePar(p) and str(p.mode).endswith('BIND') and p.bindExpr == 'parent().par.' + item['control']:
                master = p.bindMaster
                if master is not None and master.owner == self.comp and constant(master): return master
        return None

    def values(self):
        self.check()
        return [self.live.model.component(p, resolve=self.editable) for p in self.pars]


class Gesture:
    def __init__(self, source, index, expected, ident=None):
        source.check()
        if type(index) is not int or not 0 <= index < len(source.pars): raise RuntimeError('Invalid component.')
        self.source, self.index = source, index
        self.ident = ident or secrets.token_urlsafe(18)
        self.native = source.pars[index]
        current = source.live.model.component(self.native, resolve=source.editable)
        if current != expected or not current['writable']: raise RuntimeError('The value or its control changed in TD.')
        self.parameter = source.editable(self.native)
        self.before = self.after = self.parameter.val
        self.mode = (str(self.native.mode), self.native.bindExpr)
        self.limits = self.parameter.min, self.parameter.max, self.parameter.clampMin, self.parameter.clampMax
        self.sequence = -1

    def validate(self, expected):
        self.source.check()
        p = self.parameter
        if not p.valid or not constant(p) or not p.enable or p.readOnly:
            raise RuntimeError('This value is now controlled or unavailable.')
        current = self.source.editable(self.native)
        if current is None or not current.isSamePar(p) or (str(self.native.mode), self.native.bindExpr) != self.mode:
            raise RuntimeError('The Uniform binding changed.')
        if (p.min, p.max, p.clampMin, p.clampMax) != self.limits or p.val != expected:
            raise RuntimeError('The value or limits changed outside this gesture.')

    def write(self, value, expected):
        self.validate(expected)
        self.source.live.model.validate_uniform_component(self.source.declaration, value)
        self.source.live.runtime._set_parameter_without_native_capture(self.parameter, value)
        return self.parameter.val

    def update(self, sequence, value):
        if type(sequence) is not int or sequence <= self.sequence: raise RuntimeError('Out-of-order Uniform update.')
        self.after = self.write(value, self.after)
        self.sequence = sequence


class Live:
    def __init__(self, runtime, server, lan):
        self.runtime, self.server, self.lan = runtime, server, lan
        self.model = runtime.source_module()
        self.tickets, self.clients = {}, {}
        self.receipts = collections.OrderedDict()
        self.restores = collections.OrderedDict()
        self.next_poll = 0
        self.next_inventory = 0
        self.inventories = {}
        self.watchers, self.metadata_epochs = {}, {}
        self.metadata_dirty = set()

    def watch(self, comp):
        if comp.id in self.watchers: return
        dat = self.runtime._owner.create(parameterexecuteDAT, 'uniform_watch_'+secrets.token_hex(6))
        dat.store('grapeUniformWatcher', True)
        dat.par.active = False
        dat.text = "def onValueChange(par, *args):\n    live = parent().op('live').module.service\n    if live: live.metadata_changed(par)\ndef onModeChange(par, prev):\n    onValueChange(par)\n"
        dat.par.op = self.runtime.shader_operator(comp).path
        dat.par.pars = 'vec*name vec*type color*name color*type matrix*name array*name array*type array*chop array*arraytype const*name const*type'
        dat.par.builtin = True; dat.par.custom = False
        dat.par.valuechange = True; dat.par.modechange = True
        self.watchers[comp.id] = dat
        dat.par.active = True

    def metadata_changed(self, par):
        identity = par.owner.parent().id
        self.metadata_epochs[identity] = self.metadata_epochs.get(identity, 0) + 1
        self.metadata_dirty.add(identity)

    def ticket(self, comp):
        self.runtime.ensure_supported_shader(comp)
        now = time.monotonic()
        self.tickets = {k:v for k,v in self.tickets.items() if v[0] > now}
        if len(self.tickets) >= 32: raise RuntimeError('Too many pending live connections.')
        key = secrets.token_urlsafe(32)
        self.tickets[key] = now + 10, comp
        return {'port':int(self.server.par.port.eval()), 'ticket':key}

    def send(self, client, data):
        self.server.webSocketSendText(client, json.dumps(data, allow_nan=False, separators=(',', ':')))

    def open(self, client, uri):
        try:
            if not self.lan:
                try: address = ipaddress.ip_address(str(client))
                except ValueError: address = ipaddress.ip_address(str(client).rsplit(':', 1)[0].strip('[]'))
                if not address.is_loopback: raise RuntimeError('LAN access is disabled.')
            path = urlsplit(uri)
            key = parse_qs(path.query).get('ticket', [])
            ticket = self.tickets.pop(key[0], None) if len(key) == 1 else None
            if path.path != '/uniforms' or not ticket or ticket[0] <= time.monotonic() or not ticket[1].valid or len(self.clients) >= 8:
                raise RuntimeError('Live connection expired; reconnect.')
            self.clients[client] = {'comp':ticket[1], 'identity':ticket[1].id, 'source':None, 'gesture':None, 'last':None, 'seen':time.monotonic()}
            self.watch(ticket[1])
            self.send(client, {'type':'ready'})
        except Exception:
            self.close(client)
            self.server.webSocketClose(client)

    def close(self, client):
        session = self.clients.pop(client, None)
        if session and session['gesture']:
            # Keep the last applied value; never replay a buffered write after reconnect.
            self.finish(session, cancel=False)
        if session and not any(s['identity']==session['identity'] for s in self.clients.values()):
            dat = self.watchers.pop(session['identity'], None)
            if dat and dat.valid: dat.destroy()

    def finish(self, session, cancel=False):
        gesture, session['gesture'] = session['gesture'], None
        if gesture is None: return None
        if cancel:
            try:
                gesture.write(gesture.before, gesture.after)
                return None
            except RuntimeError:
                # An outside edit wins. Its value must never be rolled back.
                pass
        key = gesture.ident
        self.receipts[key] = {'gesture':gesture, 'applied':True}
        while len(self.receipts) > 256: self.receipts.popitem(last=False)
        if gesture.before != gesture.after and gesture.parameter.valid:
            def validate(value):
                fresh = Source(self, gesture.source.comp, gesture.source.ident)
                if fresh.declaration['type'] != gesture.source.declaration['type']: raise RuntimeError('The Uniform type changed.')
                current = fresh.editable(fresh.pars[gesture.index])
                if current is None or not current.isSamePar(gesture.parameter): raise RuntimeError('The Uniform control was replaced.')
                self.model.validate_uniform_component(fresh.declaration, value)
            self.runtime.record_parameter_undo(gesture.parameter, gesture.before, gesture.after, validate=validate)
        return key if gesture.before != gesture.after else None

    def seal(self, comp, body):
        """Resolve a lost reply through authenticated HTTP; never resend values."""
        key = body.get('gesture')
        for session in self.clients.values():
            g = session['gesture']
            if session['comp'] == comp and g and g.ident == key: self.finish(session)
        receipt = self.receipts.get(key)
        g = receipt['gesture'] if receipt else None
        return {'receipt':key if g and g.source.comp == comp and g.before != g.after else None}

    def restore(self, comp, body):
        request = body.get('requestId')
        signature = (comp.id, body.get('receipt'), body.get('undo'))
        if request in self.restores:
            if self.restores[request] != signature: raise RuntimeError('The history request identity was reused.')
            return {'restored':True}
        receipt = self.receipts.get(body.get('receipt'))
        if receipt is None or receipt['gesture'].source.comp != comp: raise RuntimeError('This live Undo has expired.')
        undo = body.get('undo')
        if type(undo) is not bool or undo != receipt['applied']: raise RuntimeError('This history step is no longer current.')
        g = receipt['gesture']
        if g.before == g.after:
            receipt['applied'] = not undo
        else:
            # History outlives a subscription and ordinary layout/graph edits.
            fresh = Source(self, comp, g.source.ident)
            if fresh.declaration['type'] != g.source.declaration['type']: raise RuntimeError('The Uniform type changed.')
            if not fresh.pars[g.index].isSamePar(g.native): raise RuntimeError('The original Uniform parameter was replaced.')
            g.source = fresh
            expected, value = (g.after, g.before) if undo else (g.before, g.after)
            g.write(value, expected)
            receipt['applied'] = not undo
        if request:
            self.restores[request] = signature
            while len(self.restores) > 128: self.restores.popitem(last=False)
        return {'restored':True}

    def message(self, client, text):
        session = self.clients.get(client)
        if not session: return
        request = {}
        try:
            if len(text) > 8192: raise RuntimeError('Live message too large.')
            request = json.loads(text)
            if not isinstance(request, dict): raise RuntimeError('Invalid live message.')
            kind = request.get('type')
            session['seen'] = time.monotonic()
            if kind == 'ping': result = {}
            elif kind == 'subscribe':
                if session['gesture']: raise RuntimeError('Finish this edit before changing sources.')
                session['source'] = Source(self, session['comp'], request['source']) if request.get('source') else None
                session['last'] = None
                result = {'source':request.get('source'), 'components':session['source'].values() if session['source'] else []}
            elif kind == 'begin':
                if session['gesture']: raise RuntimeError('Another Uniform edit is active.')
                source = session['source']
                if not source or source.ident != request.get('source'): raise RuntimeError('Subscribe to this Uniform first.')
                # A component has one writer; independent components may be edited together.
                for peer in self.clients.values():
                    g = peer['gesture']
                    if g and g.source.comp == source.comp and g.source.ident == source.ident and g.index == request.get('component'):
                        raise RuntimeError('Another editor is changing this component.')
                ident = request.get('gesture')
                if ident is not None and (not isinstance(ident,str) or not 16 <= len(ident) <= 64 or ident in self.receipts):
                    raise RuntimeError('Invalid or completed gesture identity.')
                session['gesture'] = Gesture(source, request.get('component'), request.get('expected'), ident)
                result = {}
            elif kind in ('update', 'commit', 'cancel'):
                g = session['gesture']
                if not g: raise RuntimeError('This live edit is no longer active.')
                if kind != 'cancel': g.update(request.get('sequence'), request.get('value'))
                result = {'value':g.after}
                if kind != 'update': result['receipt'] = self.finish(session, cancel=kind == 'cancel')
            else: raise RuntimeError('Unknown live operation.')
            self.send(client, {'type':'reply', 'request':request.get('request'), **result})
        except Exception as exc:
            receipt = self.finish(session) if session.get('gesture') else None
            self.send(client, {'type':'reply', 'request':request.get('request') if isinstance(request, dict) else None,
                               'error':str(exc), 'receipt':receipt})

    def tick(self):
        if not self.clients: return
        now = time.monotonic()
        if now < self.next_poll: return
        self.next_poll = now + 1/30
        if now >= self.next_inventory:
            self.next_inventory = now + 1
            # Sequence counts are a small fallback for row insertion/deletion.
            # Names/types use native change events, never a per-row polling scan.
            active = {s['comp'].id:s['comp'] for s in self.clients.values() if s['comp'].valid}
            for identity, comp in active.items():
                operator = self.runtime.shader_operator(comp)
                if operator is None: continue
                try:
                    shape = []
                    for name in self.model.SEQUENCE_CHANNELS:
                        seq = getattr(operator.seq, name, None)
                        if seq is None: continue
                        shape.append((name, seq.numBlocks))
                except Exception:
                    shape = ['unavailable']
                previous = self.inventories.get(identity)
                self.inventories[identity] = shape
                if previous is not None and previous != shape:
                    self.metadata_epochs[identity] = self.metadata_epochs.get(identity, 0) + 1
                    self.metadata_dirty.add(identity)
            self.inventories = {key:value for key,value in self.inventories.items() if key in active}
        # Only subscribed numeric components are evaluated, never a full inventory.
        for client, session in list(self.clients.items()):
            try:
                if not session['comp'].valid:
                    self.close(client); self.server.webSocketClose(client); continue
                if session['comp'].valid and session['comp'].id in self.metadata_dirty:
                    self.send(client, {'type':'inventory'})
                if now - session['seen'] > 20:
                    self.close(client); self.server.webSocketClose(client); continue
                source = session['source']
                if source:
                    values = source.values()
                    if values != session['last']:
                        self.send(client, {'type':'values', 'source':source.ident, 'components':values})
                        session['last'] = values
            except Exception:
                receipt = self.finish(session)
                session['source'] = None
                self.send(client, {'type':'invalidated', 'receipt':receipt})
        self.metadata_dirty.clear()

    def graph_changed(self, comp, data):
        if not self.clients: return
        declarations = {d['id']:d for d in data.get('graph',{}).get('declarations',[])}
        for client, session in list(self.clients.items()):
            source = session['source']
            if session['comp'] != comp or source is None: continue
            current = declarations.get(source.ident, {})
            if any(current.get(k) != source.declaration.get(k) for k in ('type','name','kind','sourceMissing')):
                receipt = self.finish(session)
                session['source'] = None
                self.send(client, {'type':'invalidated', 'receipt':receipt})

    def stop(self):
        for client in list(self.clients): self.close(client)
        for dat in self.watchers.values():
            if dat.valid: dat.destroy()
        self.watchers.clear()
        self.server.par.active = False
        self.tickets.clear()


def start(runtime, lan, preserve_port=False):
    global service
    if service: service.stop()
    owner = runtime._owner
    for dat in list(owner.children):
        if dat.fetch('grapeUniformWatcher',False): dat.destroy()
    server = owner.op('uniform_socket')
    if server and not server.fetch('grapeUniformSocket', False):
        raise RuntimeError('A user operator occupies the Uniform service name.')
    # A newly opened/copied TOE chooses a fresh port. In-process rebinds retain
    # the port already permitted by the open editor's Content Security Policy.
    port = int(server.par.port.eval()) if server and preserve_port else None
    if not server:
        server = owner.create(webserverDAT, 'uniform_socket')
        server.store('grapeUniformSocket', True)
        generated_callback = server.par.callbacks.eval()
        server.par.callbacks = 'live'
        if generated_callback and generated_callback.name == 'uniform_socket_callbacks': generated_callback.destroy()
    server.par.active = False
    server.par.callbacks = 'live'
    if port is None:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    server.par.port = port
    if service is None:
        service = Live(runtime, server, lan)
    else:
        service.runtime, service.server, service.lan = runtime, server, lan
        service.model = runtime.source_module()
    server.par.active = True
    return port


def onHTTPRequest(dat, request, response):
    response.update(statusCode=404, statusReason='Not Found', data='')
    return response


def onWebSocketOpen(dat, client, uri):
    if service: service.open(client, uri)
    else: dat.webSocketClose(client)


def onWebSocketClose(dat, client):
    if service: service.close(client)


def onWebSocketReceiveText(dat, client, data):
    if service: service.message(client, data)


def onWebSocketReceivePing(dat, client, data):
    dat.webSocketSendPong(client, data)


def onWebSocketReceiveBinary(dat, client, data):
    dat.webSocketClose(client)
