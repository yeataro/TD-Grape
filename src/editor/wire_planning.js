// Generated from src/core-ts/wire_planning.ts; run npm run build:core.
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
