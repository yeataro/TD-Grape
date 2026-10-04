// Generated from src/core-ts/*.ts; run npm run build:core.
"use strict";
/** Pure planning. The application supplies capability data and owns mutation,
 * persistence, history, diagnostics translation, and choosing the supported route.
 * The generated namespace keeps the existing classic-script loader usable.
 */
var GrapeWirePlanning;
(function (GrapeWirePlanning) {
    function compatible(source, target, c) {
        return !!source && !!target && (source === target && c.components[source] !== undefined || c.conversions.some(v => v.from === source && v.to === target));
    }
    function sameEdge(a, b) { return a.from[0] === b.from[0] && a.from[1] === b.from[1] && a.to[0] === b.to[0] && a.to[1] === b.to[1]; }
    function adjacency(graph) {
        const incoming = new Map();
        for (const e of graph.edges) {
            let links = incoming.get(e.to[0]);
            if (!links) {
                links = [];
                incoming.set(e.to[0], links);
            }
            links.push(e);
        }
        return incoming;
    }
    function infer(graph, c, previous) {
        var _a, _b;
        const nodes = new Map(graph.nodes.map(n => [n.id, n])), incoming = adjacency(graph);
        const oldNodes = new Map(previous.nodes.map(n => [n.id, n])), oldIncoming = adjacency(previous);
        const ports = new Map(), choices = new Map(), operands = new Map(), issues = new Map();
        // Kahn ordering avoids recursion depth limits on long chains. Original node
        // order breaks ties, preserving variant ranking for disconnected nodes.
        const degrees = new Map(), outgoing = new Map(), ready = [];
        for (const n of graph.nodes)
            degrees.set(n.id, 0);
        for (const e of graph.edges)
            if (nodes.has(e.from[0]) && nodes.has(e.to[0])) {
                degrees.set(e.to[0], (degrees.get(e.to[0]) || 0) + 1);
                let peers = outgoing.get(e.from[0]);
                if (!peers) {
                    peers = [];
                    outgoing.set(e.from[0], peers);
                }
                peers.push(e.to[0]);
            }
        for (const n of graph.nodes)
            if (!degrees.get(n.id))
                ready.push(n);
        for (let i = 0; i < ready.length; i++) {
            const n = ready[i];
            const policy = n.arithmetic, links = incoming.get(n.id) || [];
            if (!policy)
                ports.set(n.id, n.stored);
            else {
                const source = (e) => { var _a; return (_a = ports.get(e.from[0])) === null || _a === void 0 ? void 0 : _a.outputs[e.from[1]]; };
                const lone = links.length === 1 ? source(links[0]) : undefined;
                const prefer = policy.automatic && policy.preferMatchingOperands && !!lone;
                const score = (v) => links.reduce((sum, e) => sum + Number(source(e) !== v.inputs[e.to[1]]), 0);
                const matching = (v) => prefer ? Number(v.inputs.a !== lone || v.inputs.b !== lone) : 0;
                const variants = policy.variants.filter(v => (policy.automatic || v.type === policy.type) && links.every(e => compatible(source(e), v.inputs[e.to[1]], c)));
                variants.sort((a, b) => score(a) - score(b) || matching(a) - matching(b) || (c.components[a.type] || 0) - (c.components[b.type] || 0));
                const old = oldNodes.get(n.id), oldLinks = oldIncoming.get(n.id) || [];
                const unchanged = prefer && (old === null || old === void 0 ? void 0 : old.definition) === n.definition && ((_a = old.arithmetic) === null || _a === void 0 ? void 0 : _a.automatic) && old.arithmetic.type === policy.type && JSON.stringify(old.arithmetic.operands) === JSON.stringify(policy.operands) && oldLinks.length === 1 && sameEdge(oldLinks[0], links[0]) && ((_b = oldNodes.get(oldLinks[0].from[0])) === null || _b === void 0 ? void 0 : _b.stored.outputs[oldLinks[0].from[1]]) === lone && old.stored.inputs[links[0].to[1]] === lone;
                const retained = unchanged ? variants.find(v => v.type === policy.type && v.inputs.a === old.stored.inputs.a && v.inputs.b === old.stored.inputs.b) : undefined;
                const stored = !policy.automatic && !links.length ? variants.find(v => { var _a, _b; return v.inputs.a === ((_a = policy.operands) === null || _a === void 0 ? void 0 : _a.a) && v.inputs.b === ((_b = policy.operands) === null || _b === void 0 ? void 0 : _b.b); }) : undefined;
                const chosen = retained || stored || variants[0];
                if (chosen) {
                    ports.set(n.id, { inputs: chosen.inputs, outputs: chosen.outputs });
                    choices.set(n.id, chosen.type);
                    operands.set(n.id, chosen.operands || null);
                }
                else {
                    ports.set(n.id, n.stored);
                    issues.set(n.id, { code: 'auto-inputs', node: n.id });
                }
            }
            for (const id of outgoing.get(n.id) || []) {
                const count = degrees.get(id) - 1;
                degrees.set(id, count);
                if (count === 0)
                    ready.push(nodes.get(id));
            }
        }
        if (ready.length !== graph.nodes.length)
            return { code: 'cycle' };
        return { ports, choices, operands, issues };
    }
    function invalidEdges(graph, ports, c) {
        var _a, _b;
        const invalid = new Map();
        for (const e of graph.edges) {
            const sourceType = (_a = ports.get(e.from[0])) === null || _a === void 0 ? void 0 : _a.outputs[e.from[1]], targetType = (_b = ports.get(e.to[0])) === null || _b === void 0 ? void 0 : _b.inputs[e.to[1]];
            if (!compatible(sourceType, targetType, c))
                invalid.set(JSON.stringify([e.from, e.to, sourceType, targetType]), { code: 'downstream', node: e.to[0], sourceType, targetType });
        }
        return invalid;
    }
    function plan(graph, c, intent, previous = graph) {
        var _a;
        let candidate = graph, displaced = [];
        if (intent.kind === 'wire') {
            const source = graph.nodes.find(n => n.id === intent.from.node), target = graph.nodes.find(n => n.id === intent.to.node);
            if (!(source === null || source === void 0 ? void 0 : source.stored.outputs[intent.from.port]) || !(target === null || target === void 0 ? void 0 : target.stored.inputs[intent.to.port]))
                return { ok: false, diagnostic: { code: 'missing-port' } };
            displaced = graph.edges.filter(e => e.to[0] === intent.to.node && e.to[1] === intent.to.port);
            const edges = graph.edges.filter(e => !displaced.includes(e));
            edges.push({ from: [intent.from.node, intent.from.port], to: [intent.to.node, intent.to.port] });
            candidate = { nodes: graph.nodes, edges };
        }
        const inference = infer(candidate, c, previous);
        if ('code' in inference)
            return { ok: false, diagnostic: inference };
        if (intent.kind === 'wire') {
            const old = infer(previous, c, previous);
            if ('code' in old)
                return { ok: false, diagnostic: old };
            for (const [id, issue] of inference.issues)
                if (((_a = old.issues.get(id)) === null || _a === void 0 ? void 0 : _a.code) !== issue.code)
                    return { ok: false, diagnostic: issue };
            const retained = invalidEdges(previous, new Map(previous.nodes.map(n => [n.id, n.stored])), c);
            for (const [key, diagnostic] of invalidEdges(candidate, inference.ports, c))
                if (!retained.has(key))
                    return { ok: false, diagnostic };
        }
        return { ok: true, inference, edges: candidate.edges, displaced };
    }
    GrapeWirePlanning.plan = plan;
})(GrapeWirePlanning || (GrapeWirePlanning = {}));
/** First whole-graph compiler slice. No browser, TD or Python dependency. */
var GrapeTopCompiler;
(function (GrapeTopCompiler) {
    // Ordinary nodes using these primitives extend this one registry. The build
    // also exports its IDs for the receiver; there is no second handwritten list.
    GrapeTopCompiler.definitions = {
        float: { kind: 'literal', type: 'float' }, vec2: { kind: 'literal', type: 'vec2' }, vec3: { kind: 'literal', type: 'vec3' }, vec4: { kind: 'literal', type: 'vec4', constant: true }, color: { kind: 'literal', type: 'vec4' },
        scalar: { kind: 'literal' }, vector: { kind: 'vector', constant: true }, uniform: { kind: 'uniform' },
        add: { kind: 'binary', operator: '+', defaults: { a: 0, b: 0 } }, subtract: { kind: 'binary', operator: '-', defaults: { a: 0, b: 0 } },
        multiply: { kind: 'binary', operator: '*', defaults: { a: 0, b: 0 } }, divide: { kind: 'binary', operator: '/', defaults: { a: 0, b: 1 } },
        abs: { kind: 'unary', operator: 'abs', port: 'value' }, pixel_out: { kind: 'output' }
    };
    GrapeTopCompiler.protocol = 'grape.top.ts.1';
    const types = ['float', 'vec2', 'vec3', 'vec4'];
    const key = (n) => n.definitionUuid.replace(/^sgrape\.builtin\./, '');
    function type(value) { if (!types.includes(String(value)))
        throw Error('Unsupported numeric type'); return value; }
    function count(t) { return t === 'float' ? 1 : Number(t.slice(-1)); }
    function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : undefined; }
    function supports(g) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (g.schemaVersion !== 1 || g.target !== 'top' || Object.keys(g.stages).join() !== 'pixel' || ((_a = g.functions) === null || _a === void 0 ? void 0 : _a.length) || ((_b = g.topInputs) === null || _b === void 0 ? void 0 : _b.length) || ((_c = g.typeDefinitions) === null || _c === void 0 ? void 0 : _c.length))
            return false;
        if ((_e = (_d = g.stages.pixel) === null || _d === void 0 ? void 0 : _d.ui) === null || _e === void 0 ? void 0 : _e.frames)
            return false;
        if (!g.declarations.every(d => d.kind === 'uniform' && types.includes(d.type) && !d.initialDriver && !d.sourceMissing && !['array', 'matrix'].includes(String(d.nativeSequence))))
            return false;
        // Legacy allocates collision suffixes for implicit IDs versus explicit
        // names. Keep those whole graphs on its path until symbol allocation moves.
        const symbols = ((_f = g.stages.pixel) === null || _f === void 0 ? void 0 : _f.nodes.filter(n => key(n) !== 'pixel_out').map(n => n.name || n.id)) || [];
        if (new Set(symbols).size !== symbols.length)
            return false;
        return !!((_g = g.stages.pixel) === null || _g === void 0 ? void 0 : _g.nodes.every(n => {
            var _a, _b;
            const d = GrapeTopCompiler.definitions[key(n)];
            if (!n.definitionUuid.startsWith('sgrape.builtin.') || !d)
                return false;
            if (((_a = n.ui) === null || _a === void 0 ? void 0 : _a.label) || ((_b = n.ui) === null || _b === void 0 ? void 0 : _b.comment) || n.params.requireConstant || n.params.nativeFinishing || n.params.convertColorSpace || n.params.dither || n.params.alphaTest || n.params.bufferCount && n.params.bufferCount !== 1)
                return false;
            if (n.params.type !== undefined && !types.includes(String(n.params.type)))
                return false;
            if (key(n) === 'scalar' && n.params.type !== undefined && n.params.type !== 'float')
                return false;
            if (key(n) === 'vector' && !['vec2', 'vec3', 'vec4'].includes(String(n.params.type)))
                return false;
            return Object.values(object(n.params.operandTypes) || {}).every(t => types.includes(String(t)));
        }));
    }
    GrapeTopCompiler.supports = supports;
    function number(value) {
        if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e20)
            throw Error('Expected a finite number in supported range');
        // GLSL literals are rounded to the existing compiler's nine significant
        // decimal digits. Exponent padding is textual only, not a numeric change.
        if (Object.is(value, -0))
            return '-0.0';
        if (value === 0)
            return '0.0';
        const parts = Math.abs(value).toExponential(8).split('e'), exponent = Number(parts[1]);
        let significand = Number(parts[0].replace('.', ''));
        // JS rounds exact decimal halfway cases away from zero; Python's .9g uses
        // ties-to-even. Correct only an exactly representable halfway value. A
        // rounded binary approximation of a decimal midpoint must not count as one.
        const power = exponent - 8, midpoint = 2 * significand - 1;
        const exact = power < 0 ? midpoint % Math.pow(5, -power) === 0 : midpoint * Math.pow(5, power) <= Number.MAX_SAFE_INTEGER;
        if (significand % 2 && exact && Math.abs(value) === (significand - .5) * Math.pow(10, power))
            significand--;
        const digits = String(significand).replace(/0+$/, '');
        let s;
        if (exponent < -4 || exponent >= 9)
            s = digits[0] + (digits.length > 1 ? '.' + digits.slice(1) : '') + 'e' + (exponent < 0 ? '-' : '+') + String(Math.abs(exponent)).padStart(2, '0');
        else if (exponent < 0)
            s = '0.' + '0'.repeat(-exponent - 1) + digits;
        else
            s = digits.length <= exponent + 1 ? digits + '0'.repeat(exponent + 1 - digits.length) + '.0' : digits.slice(0, exponent + 1) + '.' + digits.slice(exponent + 1);
        return (value < 0 ? '-' : '') + s;
    }
    function literal(value, t) {
        if (t === 'float')
            return number(value);
        if (!Array.isArray(value) || value.length !== count(t))
            throw Error('Expected ' + count(t) + ' components');
        return t + '(' + value.map(number).join(', ') + ')';
    }
    function fill(value, t) { return t === 'float' ? value : Array.from({ length: count(t) }, () => value); }
    function compile(g) {
        var _a, _b, _c, _d;
        if (!supports(g))
            throw Error('Graph is outside the selected frontend compiler capability');
        const data = g.stages.pixel;
        if (data.nodes.length > 256 || data.edges.length > 1024 || JSON.stringify(g).length > 512000)
            throw Error('Graph is too large');
        const nodes = new Map(), ports = Object.create(null);
        const declarations = new Map(), names = new Set();
        for (const d of g.declarations) {
            if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.id) || declarations.has(d.id) || !/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(d.name) || /^(gl_|TD|sg_|sTD)/.test(d.name) || names.has(d.name))
                throw Error('Invalid declaration identity/name');
            if (d.id === 'grapeFallbackSampler' || d.nativeSequence !== undefined && !['vec', 'color'].includes(String(d.nativeSequence)) || d.initialDriver !== undefined)
                throw Error('Unsupported native Uniform source');
            if (d.expose !== undefined && typeof d.expose !== 'boolean')
                throw Error('Expose must be a boolean');
            if (d.exposeName !== undefined && (typeof d.exposeName !== 'string' || d.exposeName.length > 80 || /[\x00-\x1f]/.test(d.exposeName)))
                throw Error('Invalid public Uniform label');
            literal(d.value, type(d.type));
            declarations.set(d.id, d);
            names.add(d.name);
        }
        const symbols = new Set();
        for (const n of data.nodes) {
            if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n.id) || nodes.has(n.id))
                throw Error('Invalid or duplicate node ID');
            const symbol = n.name || n.id;
            if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(symbol) || symbols.has(symbol))
                throw Error('Invalid or duplicate node name');
            symbols.add(symbol);
            nodes.set(n.id, n);
            const d = GrapeTopCompiler.definitions[key(n)];
            let t = d.type || type(n.params.type || 'float');
            const inputs = {};
            if (d.kind === 'uniform') {
                const decl = declarations.get(String(n.params.declarationId));
                if (!decl)
                    throw Error('Select a matching declaration');
                t = type(decl.type);
            }
            if (d.kind === 'literal')
                literal(n.params.value, t);
            if (d.kind === 'vector') {
                if (!Array.isArray(n.params.components) || n.params.components.length !== 4)
                    throw Error('Vector needs four stored components');
                n.params.components.forEach(number);
                literal(n.params.components.slice(0, count(t)), t);
            }
            if (d.kind === 'binary') {
                const operand = object(n.params.operandTypes);
                if (n.params.operandTypes !== undefined && (!operand || Object.keys(operand).sort().join() !== 'a,b'))
                    throw Error('Invalid arithmetic operands');
                inputs.a = type((_a = operand === null || operand === void 0 ? void 0 : operand.a) !== null && _a !== void 0 ? _a : t);
                inputs.b = type((_b = operand === null || operand === void 0 ? void 0 : operand.b) !== null && _b !== void 0 ? _b : t);
                if (inputs.a !== inputs.b || t !== inputs.a)
                    throw Error('Invalid arithmetic signature');
            }
            if (d.kind === 'unary')
                inputs[d.port] = t;
            if (d.kind === 'output') {
                for (const flag of ['nativeFinishing', 'convertColorSpace', 'dither', 'alphaTest'])
                    if (n.params[flag] !== undefined && typeof n.params[flag] !== 'boolean')
                        throw Error('Output finishing must be a boolean');
                inputs.color = 'vec4';
            }
            ports[n.id] = { in: inputs, out: d.kind === 'output' ? {} : { out: t } };
            for (const [p, v] of Object.entries(n.inputValues || {})) {
                if (!inputs[p])
                    throw Error('Unknown input default');
                literal(v, inputs[p]);
            }
        }
        const outputs = data.nodes.filter(n => GrapeTopCompiler.definitions[key(n)].kind === 'output');
        if (outputs.length !== 1)
            throw Error('Exactly one Pixel Output is required');
        const incoming = new Map(), links = new Map();
        for (const e of data.edges) {
            const from = (_c = ports[e.from[0]]) === null || _c === void 0 ? void 0 : _c.out[e.from[1]], to = (_d = ports[e.to[0]]) === null || _d === void 0 ? void 0 : _d.in[e.to[1]], k = e.to.join(':');
            if (!from || !to)
                throw Error('Connection endpoint no longer exists');
            if (links.has(k))
                throw Error('An input can only have one connection');
            if (from !== to && from !== 'float')
                throw Error(from + ' cannot connect to ' + to);
            links.set(k, e);
            const list = incoming.get(e.to[0]) || [];
            list.push(e);
            incoming.set(e.to[0], list);
        }
        const order = [], visited = new Set(), active = new Set();
        function visit(id) {
            if (active.has(id))
                throw Error('Cycle detected');
            if (visited.has(id))
                return;
            active.add(id);
            for (const e of [...(incoming.get(id) || [])].sort((a, b) => a.to[1] < b.to[1] ? -1 : 1))
                visit(e.from[0]);
            active.delete(id);
            visited.add(id);
            order.push(id);
        }
        // Validate disconnected cycles too, then separately select the live closure.
        for (const id of nodes.keys())
            visit(id);
        visited.clear();
        order.length = 0;
        visit(outputs[0].id);
        const used = new Set(), lines = [], lineNodes = [], expressions = new Map();
        for (const id of order) {
            const n = nodes.get(id), d = GrapeTopCompiler.definitions[key(n)], p = ports[id], t = p.out.out;
            const start = lines.length;
            const input = (port) => {
                var _a, _b, _c;
                const target = p.in[port], edge = links.get(id + ':' + port);
                if (edge) {
                    const value = expressions.get(edge.from[0]);
                    return ports[edge.from[0]].out.out === target ? value : target + '(' + value + ')';
                }
                return literal((_b = (_a = n.inputValues) === null || _a === void 0 ? void 0 : _a[port]) !== null && _b !== void 0 ? _b : (d.kind === 'output' ? [0, 0, 0, 1] : fill(((_c = d.defaults) === null || _c === void 0 ? void 0 : _c[port]) || 0, target)), target);
            };
            let expression = '';
            if (d.kind === 'literal')
                expression = literal(n.params.value, t);
            if (d.kind === 'vector')
                expression = literal(n.params.components.slice(0, count(t)), t);
            if (d.kind === 'uniform') {
                const decl = declarations.get(String(n.params.declarationId));
                used.add(decl.id);
                expression = decl.name;
            }
            if (d.kind === 'binary')
                expression = '(' + input('a') + ' ' + d.operator + ' ' + input('b') + ')';
            if (d.kind === 'unary')
                expression = d.operator + '(' + input(d.port) + ')';
            if (d.kind === 'output')
                lines.push('    vec4 sg_color = ' + input('color') + ';', '    fragColor = TDOutputSwizzle(sg_color);');
            else {
                const symbol = 'sg_n_' + (n.name || id);
                lines.push('    ' + (d.constant ? 'const ' : '') + t + ' ' + symbol + ' = ' + expression + ';');
                expressions.set(id, symbol);
            }
            while (lineNodes.length < lines.length)
                lineNodes.push(id);
            if (lines.length === start)
                throw Error('Node emitted no expression');
        }
        const bindings = [...used].sort().map(id => JSON.parse(JSON.stringify(declarations.get(id))));
        const headers = bindings.map(d => 'uniform ' + d.type + ' ' + d.name + ';');
        const pixel = [...headers, 'layout(location=0) out vec4 fragColor;', 'void main() {', '    vec2 sg_uv = vUV.st;', ...lines, '}', ''].join('\n');
        const diagnostics = data.nodes.filter(n => !visited.has(n.id)).sort((a, b) => a.id < b.id ? -1 : 1).map(n => ({ node: n.id, stage: 'pixel', message: 'Disconnected node is not emitted' }));
        const sourceMap = { pixel: lineNodes.map((node, i) => ({ node, stage: 'pixel', trail: [], line: headers.length + 4 + i })) };
        return { vertex: '', pixel, bindings, sourceMap, stages: { pixel: { lines, ports, live: [...visited].sort() } }, diagnostics };
    }
    GrapeTopCompiler.compile = compile;
})(GrapeTopCompiler || (GrapeTopCompiler = {}));
