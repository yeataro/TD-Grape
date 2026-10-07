// Generated from src/core-ts; run npm run build:core.
var GrapeWirePlanning,GrapeTopCompiler,GrapeGraph;
(function(){
'use strict';
const factories={
"__composition":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrapeGraph = exports.GrapeTopCompiler = exports.GrapeWirePlanning = exports.registry = void 0;
const wire = require("./wire_planning");
const graph = require("./graph");
const values = require("./values");
const node_module_1 = require("./node_module");
const top_compiler_1 = require("./top_compiler");
const editor_contract_1 = require("./editor_contract");
const abs_1 = require("./nodes/abs");
const add_1 = require("./nodes/add");
const all_1 = require("./nodes/all");
const any_1 = require("./nodes/any");
const ceil_1 = require("./nodes/ceil");
const clamp_1 = require("./nodes/clamp");
const color_1 = require("./nodes/color");
const combine_1 = require("./nodes/combine");
const compare_1 = require("./nodes/compare");
const convert_1 = require("./nodes/convert");
const cos_1 = require("./nodes/cos");
const divide_1 = require("./nodes/divide");
const dot_1 = require("./nodes/dot");
const equal_1 = require("./nodes/equal");
const float_1 = require("./nodes/float");
const floor_1 = require("./nodes/floor");
const fract_1 = require("./nodes/fract");
const function_call_1 = require("./nodes/function_call");
const function_input_1 = require("./nodes/function_input");
const function_output_1 = require("./nodes/function_output");
const greaterThan_1 = require("./nodes/greaterThan");
const greaterThanEqual_1 = require("./nodes/greaterThanEqual");
const if_1 = require("./nodes/if");
const isinf_1 = require("./nodes/isinf");
const isnan_1 = require("./nodes/isnan");
const length_1 = require("./nodes/length");
const lessThan_1 = require("./nodes/lessThan");
const lessThanEqual_1 = require("./nodes/lessThanEqual");
const math_1 = require("./nodes/math");
const max_1 = require("./nodes/max");
const min_1 = require("./nodes/min");
const mix_1 = require("./nodes/mix");
const multiply_1 = require("./nodes/multiply");
const normalize_1 = require("./nodes/normalize");
const not_1 = require("./nodes/not");
const notEqual_1 = require("./nodes/notEqual");
const pixel_out_1 = require("./nodes/pixel_out");
const replace_1 = require("./nodes/replace");
const rgba_1 = require("./nodes/rgba");
const round_1 = require("./nodes/round");
const router_1 = require("./nodes/router");
const scalar_1 = require("./nodes/scalar");
const sign_1 = require("./nodes/sign");
const sin_1 = require("./nodes/sin");
const smoothstep_1 = require("./nodes/smoothstep");
const split_1 = require("./nodes/split");
const sqrt_1 = require("./nodes/sqrt");
const subtract_1 = require("./nodes/subtract");
const swizzle_1 = require("./nodes/swizzle");
const trunc_1 = require("./nodes/trunc");
const uniform_1 = require("./nodes/uniform");
const vec2_1 = require("./nodes/vec2");
const vec3_1 = require("./nodes/vec3");
const vec4_1 = require("./nodes/vec4");
const vector_1 = require("./nodes/vector");
const vector_split_1 = require("./nodes/vector_split");
exports.registry = (0, node_module_1.createRegistry)([abs_1.default, add_1.default, all_1.default, any_1.default, ceil_1.default, clamp_1.default, color_1.default, combine_1.default, compare_1.default, convert_1.default, cos_1.default, divide_1.default, dot_1.default, equal_1.default, float_1.default, floor_1.default, fract_1.default, function_call_1.default, function_input_1.default, function_output_1.default, greaterThan_1.default, greaterThanEqual_1.default, if_1.default, isinf_1.default, isnan_1.default, length_1.default, lessThan_1.default, lessThanEqual_1.default, math_1.default, max_1.default, min_1.default, mix_1.default, multiply_1.default, normalize_1.default, not_1.default, notEqual_1.default, pixel_out_1.default, replace_1.default, rgba_1.default, round_1.default, router_1.default, scalar_1.default, sign_1.default, sin_1.default, smoothstep_1.default, split_1.default, sqrt_1.default, subtract_1.default, swizzle_1.default, trunc_1.default, uniform_1.default, vec2_1.default, vec3_1.default, vec4_1.default, vector_1.default, vector_split_1.default]);
exports.GrapeWirePlanning = wire;
exports.GrapeTopCompiler = (0, top_compiler_1.createCompiler)(exports.registry);
exports.GrapeGraph = { ...graph, values, registry: exports.registry, createRegistry: node_module_1.createRegistry, createCompiler: top_compiler_1.createCompiler, resolvePorts: node_module_1.resolvePorts, configureNode: node_module_1.configureNode, createEditorContract: editor_contract_1.createEditorContract };

},
"changes":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.equal = equal;
exports.changesBetween = changesBetween;
const model_1 = require("./model");
const node_module_1 = require("./node_module");
const record = (value) => value && typeof value === 'object' ? value : {};
/** JSON equality independent of property insertion order. Array order matters. */
function equal(a, b) {
    if (a === b)
        return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b))
        return false;
    const x = record(a), y = record(b), keys = Object.keys(x);
    return keys.length === Object.keys(y).length && keys.every(k => Object.prototype.hasOwnProperty.call(y, k) && equal(x[k], y[k]));
}
const keys = (a, b) => [...new Set([...Object.keys(record(a)), ...Object.keys(record(b))])].filter(k => !equal(record(a)[k], record(b)[k]));
function networks(g) {
    return new Map([...Object.entries(g.stages), ...(g.functions || []).map(raw => { const f = raw; return ['function:' + f.id, f.graph]; })]);
}
function metadata(g) {
    const { stages, functions, catalogSnapshot, ...rest } = g;
    return { ...rest, functions: (functions || []).map(raw => { const { graph, ...definition } = raw; return definition; }) };
}
const networkMetadata = (data) => { const { nodes, edges, edgeSequence, ...rest } = data || {}; return rest; };
function portTypes(g, node, registry, networkId) {
    var _a;
    if (!node)
        return { inputs: {}, outputs: {} };
    const module = registry.get(node.definitionUuid), context = (0, node_module_1.contextFor)(g, (_a = g.functions) === null || _a === void 0 ? void 0 : _a.find(f => 'function:' + f.id === networkId));
    if (!(module === null || module === void 0 ? void 0 : module.supports(node, context)))
        return undefined;
    try {
        return (0, node_module_1.resolvePorts)(module, node, context).types();
    }
    catch (_b) {
        return undefined;
    }
}
/** Model publication, also used for snapshot Undo/Redo. This transitional
 * publication diff is shared by views; candidate planning may compare its own
 * inputs. Unknown/dynamic legacy contexts explicitly request fallback. */
function changesBetween(before, after, registry) {
    var _a, _b;
    const global = keys(metadata(before), metadata(after)).filter(k => k !== 'functions'), old = networks(before), next = networks(after), changes = [];
    const defs = (g) => new Map((g.functions || []).map(({ graph, ...f }) => [f.id, f]));
    const oldDefs = defs(before), newDefs = defs(after), definitions = [...new Set([...oldDefs.keys(), ...newDefs.keys()])].filter(id => !equal(oldDefs.get(id), newDefs.get(id)));
    const affected = (n, network) => { var _a; if (!n)
        return false; const m = registry.get(n.definitionUuid); return definitions.includes(((_a = m === null || m === void 0 ? void 0 : m.referencedGraph) === null || _a === void 0 ? void 0 : _a.call(m, n)) || '') || !!(m === null || m === void 0 ? void 0 : m.structural) && definitions.some(id => network === 'function:' + id); };
    for (const id of new Set([...old.keys(), ...next.keys()])) {
        const a = old.get(id), b = next.get(id);
        if (equal(a, b) && !global.length && ![...((a === null || a === void 0 ? void 0 : a.nodes) || []), ...((b === null || b === void 0 ? void 0 : b.nodes) || [])].some(n => affected(n, id)))
            continue;
        const previous = new Map(((a === null || a === void 0 ? void 0 : a.nodes) || []).map(n => [n.id, n])), current = new Map(((b === null || b === void 0 ? void 0 : b.nodes) || []).map(n => [n.id, n]));
        const change = { id, added: [], removed: [], nodes: [], ports: [], edges: [], order: !equal([...previous.keys()], [...current.keys()]), metadata: !equal(networkMetadata(a), networkMetadata(b)), complete: !global.length && !!a && !!b };
        for (const nodeId of new Set([...previous.keys(), ...current.keys()])) {
            const x = previous.get(nodeId), y = current.get(nodeId);
            // Legacy modules may depend on other nodes/definitions; until migrated,
            // an affected mixed network keeps its conservative projection path.
            for (const [g, n] of [[before, x], [after, y]])
                if (n && !((_a = registry.get(n.definitionUuid)) === null || _a === void 0 ? void 0 : _a.supports(n, (0, node_module_1.contextFor)(g, (_b = g.functions) === null || _b === void 0 ? void 0 : _b.find(f => 'function:' + f.id === id)))))
                    change.complete = false;
            if (!x)
                change.added.push(nodeId);
            if (!y)
                change.removed.push(nodeId);
            if (equal(x, y) && !global.length && !affected(x, id) && !affected(y, id))
                continue;
            change.nodes.push({ id: nodeId, fields: [...keys(x, y), ...(affected(x, id) || affected(y, id) ? ['interface'] : [])], params: keys(x === null || x === void 0 ? void 0 : x.params, y === null || y === void 0 ? void 0 : y.params), inputs: keys(x === null || x === void 0 ? void 0 : x.inputValues, y === null || y === void 0 ? void 0 : y.inputValues), ui: keys(x === null || x === void 0 ? void 0 : x.ui, y === null || y === void 0 ? void 0 : y.ui) });
            const from = portTypes(before, x, registry, id), to = portTypes(after, y, registry, id);
            if (!from || !to) {
                change.complete = false;
                continue;
            }
            for (const direction of ['input', 'output']) {
                const left = direction === 'input' ? from.inputs : from.outputs, right = direction === 'input' ? to.inputs : to.outputs;
                for (const key of keys(left, right))
                    change.ports.push({ node: nodeId, direction, key, before: left[key], after: right[key] });
            }
        }
        // Edges without IDs are transitional. Their endpoints supply a stable
        // comparison identity until publication materializes persistent IDs.
        const identity = (e) => e.id || JSON.stringify([e.from, e.to]);
        const left = new Map(((a === null || a === void 0 ? void 0 : a.edges) || []).map(e => [identity(e), e])), right = new Map(((b === null || b === void 0 ? void 0 : b.edges) || []).map(e => [identity(e), e]));
        for (const key of new Set([...left.keys(), ...right.keys()])) {
            const x = left.get(key), y = right.get(key);
            if (!equal(x, y))
                change.edges.push({ id: (y === null || y === void 0 ? void 0 : y.id) || (x === null || x === void 0 ? void 0 : x.id), before: x && (0, model_1.copy)(x), after: y && (0, model_1.copy)(y) });
        }
        changes.push(change);
    }
    // Include persisted sequence/unknown fields even when no view needs repaint.
    return { changed: !equal(before, after), global, definitions, networks: changes };
}

},
"comments":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentLines = commentLines;
exports.appendNodeComments = appendNodeComments;
/** Preserve authored notes as inert line comments, including GLSL line joins. */
function commentLines(text, kind) {
    if (typeof text !== 'string' || !text.trim())
        return [];
    const rows = text.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);
    if (rows[rows.length - 1] === '')
        rows.pop();
    return rows.map((raw, i) => {
        let line = raw.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ');
        if (line.trimEnd().endsWith('\\'))
            line += ' //';
        return '    // ' + (kind && i === 0 ? kind + ': ' : '') + line;
    });
}
function appendNodeComments(lines, start, note) {
    const labels = commentLines(note.label);
    if (labels.length) {
        if (lines.length > start) {
            lines[start] += ' ' + labels[0].trimStart();
            lines.splice(start + 1, 0, ...labels.slice(1));
        }
        else
            lines.push(...labels);
    }
    lines.push(...commentLines(note.comment, 'Comment'));
}

},
"editor_contract":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEditorContract = createEditorContract;
/** Compatibility data for the existing editor, projected from real modules.
 * The host serves this build asset; it does not infer node ports or types.
 */
const model_1 = require("./model");
const node_module_1 = require("./node_module");
const values = require("./values");
const identifier_rules_1 = require("./identifier_rules");
function variants(module, target) {
    var _a;
    const definition = module.catalog.definition;
    const base = { id: 'projection', definitionUuid: definition.definitionUuid, params: (0, model_1.copy)(definition.defaults) };
    const tokens = [...Object.values(definition.inputs), ...Object.values(definition.outputs)];
    const selector = tokens.includes('D') ? 'declaration' :
        tokens.includes('T') || typeof definition.defaults.type === 'string' ? 'parameter' : 'fixed';
    const result = [];
    const types = selector === 'fixed' ? [null] : values.types;
    for (const selected of types) {
        const context = { target, declaration: () => selector === 'declaration' && selected ?
                { id: 'source', kind: 'uniform', name: 'uSource', type: selected, value: values.fill(0, selected) } : undefined };
        let node = (0, model_1.copy)(base);
        if (selector === 'parameter' && selected) {
            const requested = { ...node, params: { ...node.params, type: selected } };
            if (!module.supports(requested, context))
                continue;
            if (!module.configure)
                throw Error('Missing configuration operation for ' + definition.key);
            try {
                node = module.configure(node, { type: selected }, context);
            }
            catch (error) {
                throw Object.assign(Error('Editor projection failed for ' + definition.key + ' / ' + selected + ': ' + String(error)), { cause: error });
            }
            if (!module.supports(node, context))
                throw Error('Configuration changed advertised capability: ' + definition.key + ' / ' + selected);
        }
        if (selector === 'declaration')
            node.params.declarationId = 'source';
        if (!module.supports(node, context))
            continue;
        module.validate(node, context);
        const ports = (0, node_module_1.resolvePorts)(module, node, context).types();
        const signatures = ((_a = module.signatures) === null || _a === void 0 ? void 0 : _a.call(module, node, context)) || [];
        const matching = signatures.filter(row => row.type === selected);
        result.push(...(matching.length ? matching.map(row => ({ type: selected, inputs: { ...row.inputs }, outputs: { ...row.outputs } })) :
            [{ type: selected, inputs: { ...ports.inputs }, outputs: { ...ports.outputs } }]));
    }
    if (!result.length)
        throw Error('No editor interface for module ' + definition.key);
    if (selector === 'parameter' && typeof definition.defaults.type === 'string' &&
        !result.some(row => row.type === definition.defaults.type))
        throw Error('Unsupported default type for module ' + definition.key);
    return { selector, variants: result };
}
// UI compatibility projection for component grouping. Module callbacks remain
// authoritative when an actual node changes or accepts a wire.
function vectorLayouts(type) {
    const width = values.count(type), family = values.family(type), result = [];
    const visit = (start, inputs, groups) => {
        if (start === width) {
            result.push({ inputs, groups });
            return;
        }
        for (let size = 1; size <= width - start; size++) {
            const key = 'xyzw'[start], part = values.shaped(family, size);
            visit(start + size, { ...inputs, [key]: part }, size === 1 ? groups : { ...groups, [key]: part });
        }
    };
    visit(0, {}, {});
    return result;
}
function createEditorContract(registry, target = 'top') {
    const modules = registry.modules.filter(m => !m.structural && m.catalog.definition.stages.includes('pixel'));
    return {
        version: 1, glslCode: identifier_rules_1.identifierRules, valueTypes: [...values.types], numericTypes: values.types.filter(t => values.family(t) !== 'bool'),
        resourceTypes: [], specConstantTypes: [],
        types: Object.fromEntries(values.types.map(t => [t, { family: values.family(t), components: values.count(t) }])),
        conversions: values.policy.conversions.map(row => ({ ...row, kind: values.count(row.from) === 1 && values.count(row.to) > 1 ? 'splat' : 'cast' })),
        definitions: Object.fromEntries(modules.map(m => [m.catalog.definition.definitionUuid, variants(m, target)])),
        convert: { types: [...values.types], fromParameter: 'fromType', toParameter: 'toType',
            pairs: Object.fromEntries(values.types.map(from => [from, values.types.filter(to => values.explicit(from, to))])) },
        vectors: { version: 1, types: [...values.vectors], components: 'xyzw',
            scalarTypes: Object.fromEntries(values.vectors.map(t => [t, values.family(t)])),
            layouts: Object.fromEntries(values.vectors.map(t => [t, vectorLayouts(t)])) }
    };
}

},
"graph":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphDocument = exports.GraphError = exports.Network = exports.Edge = exports.Node = exports.Port = exports.ScopeReferences = exports.prepareNodeWire = exports.contextFor = exports.changesBetween = void 0;
exports.transact = transact;
const model_1 = require("./model");
const node_module_1 = require("./node_module");
const ports_1 = require("./ports");
const wire_planning_1 = require("./wire_planning");
const changes_1 = require("./changes");
var changes_2 = require("./changes");
Object.defineProperty(exports, "changesBetween", { enumerable: true, get: function () { return changes_2.changesBetween; } });
var node_module_2 = require("./node_module");
Object.defineProperty(exports, "contextFor", { enumerable: true, get: function () { return node_module_2.contextFor; } });
Object.defineProperty(exports, "prepareNodeWire", { enumerable: true, get: function () { return node_module_2.prepareNodeWire; } });
const subgraphs_1 = require("./subgraphs");
const subgraph_operations_1 = require("./subgraph_operations");
const subgraph_copies_1 = require("./subgraph_copies");
var scope_references_1 = require("./scope_references");
Object.defineProperty(exports, "ScopeReferences", { enumerable: true, get: function () { return scope_references_1.ScopeReferences; } });
function clone(value, immutable = false) {
    if (!value || typeof value !== 'object')
        return value;
    const result = Array.isArray(value) ? [] : {};
    for (const key of Object.keys(value)) {
        const entry = clone(value[key], immutable);
        if (key === '__proto__')
            Object.defineProperty(result, key, { value: entry, enumerable: true, writable: true, configurable: true });
        else
            result[key] = entry;
    }
    return (immutable ? Object.freeze(result) : result);
}
/** A network-local object identity is independent of its label or canvas order.
 * Node/Port/Edge handles query the same graph-owned document. Missing endpoints
 * remain addressable; no validation path deletes or silently rewires them. */
class Port {
    constructor(node, direction, key) {
        this.node = node;
        this.direction = direction;
        this.key = key;
    }
    get spec() { return (this.direction === 'input' ? this.node.interface.inputs : this.node.interface.outputs)[this.key]; }
    get exists() { return !!this.spec; }
    get type() { var _a; return (_a = this.spec) === null || _a === void 0 ? void 0 : _a.type; }
    get default() { var _a; return (_a = this.spec) === null || _a === void 0 ? void 0 : _a.default; }
    get edges() { return this.node.network.edgesAt(this); }
    get endpoint() { return [this.node.id, this.key]; }
    connect(to, policy) { return this.node.network.connect(this, to, policy); }
}
exports.Port = Port;
class Node {
    constructor(network, id) {
        this.network = network;
        this.id = id;
        this.handles = new Map();
    }
    get data() { if (this.stored)
        return this.stored; const value = this.network.nodeData(this.id); if (!this.network.graph.editable)
        this.stored = value; return value; }
    get definition() { if (this.module)
        return this.module; const data = this.data, value = data && this.network.graph.registry.get(data.definitionUuid); if (!this.network.graph.editable)
        this.module = value; return value; }
    get interface() {
        var _a, _b;
        if (this.resolved)
            return this.resolved;
        const n = this.data;
        if (!n)
            return new ports_1.NodePorts([]);
        const module = this.definition;
        const result = module && module.supports(n, this.network.context) ? (0, node_module_1.resolvePorts)(module, n, this.network.context) : new ports_1.NodePorts(((_b = (_a = this.network.graph).fallback) === null || _b === void 0 ? void 0 : _b.call(_a, n, this.network.id)) || []);
        if (!this.network.graph.editable)
            this.resolved = result;
        return result;
    }
    port(direction, key) {
        const identity = (direction === 'input' ? 'i' : 'o') + key;
        let p = this.handles.get(identity);
        if (!p) {
            p = new Port(this, direction, key);
            this.handles.set(identity, p);
        }
        return p;
    }
    get inputs() { return Object.keys(this.interface.inputs).map(k => this.port('input', k)); }
    get outputs() { return Object.keys(this.interface.outputs).map(k => this.port('output', k)); }
    configure(selection) {
        this.network.assertEditable();
        const node = this.data, module = this.definition;
        if (!node || !module)
            throw Error('Node configuration is unavailable');
        const candidate = (0, node_module_1.configureNode)(module, node, selection, this.network.context);
        this.replace(candidate);
    }
    update(patch) {
        this.network.assertEditable();
        const node = this.data;
        if (!node)
            throw Error('Node no longer exists');
        if (Object.keys(patch).some(k => !['params', 'inputValues', 'ui', 'name'].includes(k)))
            throw Error('Node update cannot change identity');
        const candidate = { ...(0, model_1.copy)(node), ...(0, model_1.copy)(patch) };
        if (this.definition) {
            if (!this.definition.supports(candidate, this.network.context))
                throw Error('Unsupported node configuration');
            this.definition.validate(candidate, this.network.context);
            (0, node_module_1.resolvePorts)(this.definition, candidate, this.network.context);
        }
        this.replace(candidate);
    }
    setInput(key, value) {
        this.network.assertEditable();
        const node = this.data, module = this.definition;
        if (!node || !this.interface.inputs[key])
            throw Error('Unknown node input');
        if (!(module === null || module === void 0 ? void 0 : module.editInput)) {
            this.update({ inputValues: { ...node.inputValues, [key]: (0, model_1.copy)(value) } });
            return;
        }
        const candidate = module.editInput((0, model_1.copy)(node), key, (0, model_1.copy)(value), this.network.context);
        if (candidate.id !== node.id || candidate.definitionUuid !== node.definitionUuid)
            throw Error('Input edit changed identity');
        module.validate(candidate, this.network.context);
        (0, node_module_1.resolvePorts)(module, candidate, this.network.context);
        this.replace(candidate);
    }
    edit(command, value) {
        this.network.assertEditable();
        const node = this.data, module = this.definition;
        if (!node || !module)
            throw Error('Node command is unavailable');
        const before = this.interface, candidate = (0, node_module_1.editNode)(module, node, command, value, this.network.context), after = (0, node_module_1.resolvePorts)(module, candidate, this.network.context);
        const removedInputs = new Set(Object.keys(before.inputs).filter(k => !after.inputs[k])), removedOutputs = new Set(Object.keys(before.outputs).filter(k => !after.outputs[k]));
        // Deliberately removing a port removes its incident edges in the same
        // command. Unsupported imported ports remain a separate preservation path.
        if (removedInputs.size || removedOutputs.size) {
            const handles = this.network.edges, raw = this.network.data.edges;
            const removed = handles.filter((_, i) => raw[i].to[0] === this.id && removedInputs.has(raw[i].to[1]) || raw[i].from[0] === this.id && removedOutputs.has(raw[i].from[1]));
            if (removed.length)
                this.network.disconnectAll(removed);
        }
        this.replace(candidate);
    }
    replace(candidate) {
        const node = this.data;
        if ((0, changes_1.equal)(node, candidate))
            return;
        for (const key of Object.keys(node))
            if (!Object.prototype.hasOwnProperty.call(candidate, key))
                delete node[key];
        Object.assign(node, candidate);
    }
}
exports.Node = Node;
class Edge {
    constructor(network, id) {
        this.network = network;
        this.id = id;
    }
    get data() { if (this.stored)
        return this.stored; const value = this.network.edgeData(this.id); if (!this.network.graph.editable)
        this.stored = value; return value; }
    get exists() { return !!this.data; }
    disconnect() { this.network.disconnect(this); }
    get from() { if (this.source)
        return this.source; const e = this.data, p = e && this.network.node(e.from[0]).port('output', e.from[1]); if (!this.network.graph.editable)
        this.source = p; return p; }
    get to() { if (this.target)
        return this.target; const e = this.data, p = e && this.network.node(e.to[0]).port('input', e.to[1]); if (!this.network.graph.editable)
        this.target = p; return p; }
    connection(policy) {
        if (!this.exists)
            return { valid: false, reason: 'missing-edge' };
        const from = this.from, to = this.to;
        if (!from.exists || !to.exists)
            return { valid: false, reason: 'missing-port' };
        if (!(0, ports_1.compatible)(from.type, to.type, policy.components, policy.conversions))
            return { valid: false, reason: 'type' };
        return { valid: true, conversion: from.type === to.type ? 'identity' : 'convert' };
    }
}
exports.Edge = Edge;
class Network {
    constructor(graph, id, data) {
        this.graph = graph;
        this.id = id;
        this.data = data;
        this.nodeHandles = new Map();
        this.removedNodes = new Set();
        this.edgeHandles = new Map();
        this.nodeIndex = new Map();
        this.edgeIndex = new Map();
        this.nodeSlots = new Map();
        this.nodeCount = -1;
        this.edgeCount = -1;
        this.temporaryIds = new WeakMap();
        this.temporarySequence = 0;
    }
    assertEditable() {
        this.graph.assertEditable();
        if (this.graph.networks.get(this.id) !== this)
            throw Error('Network no longer belongs to this graph');
    }
    groupSubgraph(ids, options) {
        this.assertEditable();
        if (this.removedNodes.has(options.callId))
            throw Error('Retired node ID');
        const call = (0, subgraph_operations_1.groupSubgraph)(this, ids, options);
        ids.forEach(id => this.removedNodes.add(id));
        return this.node(call.id);
    }
    instantiateSubgraph(definitionId, id, ui = {}) {
        return this.node((0, subgraph_operations_1.instantiateSubgraph)(this, definitionId, id, ui).id);
    }
    independentSubgraph(node, next) {
        if (node.network !== this)
            throw Error('Node belongs to another network');
        const f = (0, subgraph_copies_1.independentSubgraph)(this, node.id, next);
        return f ? this.graph.subgraph(f.id) : null;
    }
    get context() { var _a; return (0, node_module_1.contextFor)(this.graph.document, (_a = this.graph.document.functions) === null || _a === void 0 ? void 0 : _a.find(f => f.graph === this.data)); }
    node(id) { let n = this.nodeHandles.get(id); if (!n) {
        n = new Node(this, id);
        this.nodeHandles.set(id, n);
    } return n; }
    nodeData(id) {
        const slot = this.nodeSlots.get(id), current = slot === undefined ? undefined : this.data.nodes[slot];
        // The transitional editor can replace array entries without changing their
        // count. Validate the indexed slot, never just the array's length.
        if (this.indexedNodes !== this.data.nodes || this.nodeCount !== this.data.nodes.length || this.graph.editable && (!current || current.id !== id || this.nodeIndex.get(id) !== current)) {
            const index = new Map(), slots = new Map();
            this.data.nodes.forEach((n, i) => { if (!n.id || index.has(n.id))
                throw Error('Invalid or duplicate node ID'); index.set(n.id, n); slots.set(n.id, i); });
            this.nodeIndex = index;
            this.nodeSlots = slots;
            this.indexedNodes = this.data.nodes;
            this.nodeCount = this.data.nodes.length;
        }
        return this.nodeIndex.get(id);
    }
    get nodes() { return this.data.nodes.map(n => this.node(n.id)); }
    create(id, definitionUuid, params = {}) {
        return this.insert({ id, definitionUuid, params });
    }
    /** Insert authored node data through the same validation/ownership seam. */
    insert(authored) {
        const { id, definitionUuid } = authored;
        this.assertEditable();
        if (!id || this.nodeData(id) || this.removedNodes.has(id))
            throw Error('Invalid, duplicate or retired node ID');
        const module = this.graph.registry.get(definitionUuid);
        if (!module)
            throw Error('Node module is unavailable');
        const node = { ...(0, model_1.copy)(authored), params: { ...(0, model_1.copy)(module.catalog.definition.defaults), ...(0, model_1.copy)(authored.params) } };
        if (!module.supports(node, this.context))
            throw Error('Unsupported node configuration');
        module.validate(node, this.context);
        (0, node_module_1.resolvePorts)(module, node, this.context);
        this.data.nodes.push(node);
        return this.node(id);
    }
    /** Neutral authored fragment ingestion. Adapters own format/ID remapping;
     * the model owns validation, copied state and new edge identities. Missing
     * capabilities may be retained explicitly, without making them executable. */
    insertFragment(fragment, options = {}) {
        this.assertEditable();
        const nodes = fragment.nodes.map(n => (0, model_1.copy)(n)), edges = fragment.edges.map(e => (0, model_1.copy)(e));
        const ids = new Set(this.data.nodes.map(n => n.id)), ports = new Set(this.data.edges.map(e => JSON.stringify(e.to)));
        for (const n of nodes) {
            if (!n || typeof n.id !== 'string' || !n.id || ids.has(n.id) || this.removedNodes.has(n.id))
                throw Error('Invalid, duplicate or retired node ID');
            ids.add(n.id);
            if (typeof n.definitionUuid !== 'string' || !n.definitionUuid || !n.params || typeof n.params !== 'object' || Array.isArray(n.params))
                throw Error('Invalid fragment node');
            const module = this.graph.registry.get(n.definitionUuid);
            if (module === null || module === void 0 ? void 0 : module.supports(n, this.context)) {
                module.validate(n, this.context);
                (0, node_module_1.resolvePorts)(module, n, this.context);
            }
            else if (options.unavailable !== 'preserve')
                throw Error('Node module or configuration is unavailable');
        }
        let sequence = edgeSequence(this.data);
        for (const e of edges) {
            for (const end of [e.from, e.to])
                if (!Array.isArray(end) || end.length !== 2 || end.some(v => typeof v !== 'string' || !v) || !ids.has(end[0]))
                    throw Error('Invalid fragment endpoint');
            const input = JSON.stringify(e.to);
            if (ports.has(input))
                throw Error('Fragment input already connected');
            ports.add(input);
            if (!Number.isSafeInteger(sequence + 1))
                throw Error('Edge sequence exhausted');
            e.id = 'edge_' + ++sequence;
        }
        this.data.nodes.push(...nodes);
        this.data.edges.push(...edges);
        if (edges.length)
            this.data.edgeSequence = sequence;
        return nodes.map(n => this.node(n.id));
    }
    remove(node) {
        this.removeAll([node]);
    }
    removeAll(nodes) {
        this.assertEditable();
        if (nodes.some(n => n.network !== this))
            throw Error('Node belongs to another network');
        const ids = new Set(nodes.filter(n => this.nodeData(n.id)).map(n => n.id));
        if (!ids.size)
            return;
        const roots = this.data.nodes.filter(n => ids.has(n.id)).map(n => { var _a, _b; return (_b = (_a = this.graph.registry.get(n.definitionUuid)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n); }).filter((id) => !!id);
        const sequence = edgeSequence(this.data);
        if (sequence)
            this.data.edgeSequence = sequence;
        ids.forEach(id => this.removedNodes.add(id));
        this.data.nodes = this.data.nodes.filter(n => !ids.has(n.id));
        this.data.edges = this.data.edges.filter(e => !ids.has(e.from[0]) && !ids.has(e.to[0]));
        (0, subgraph_operations_1.collectSubgraphs)(this.graph, roots, this.data);
    }
    plan(policy, intent, overrides = new Map()) {
        var _a, _b;
        const prepared = new Map(), removed = [];
        if (intent.kind === 'wire') {
            const target = this.node(intent.to.node), module = target.definition, data = target.data;
            const sourceType = ((_a = overrides.get(intent.from.node)) === null || _a === void 0 ? void 0 : _a.outputs[intent.from.port]) || ((_b = this.node(intent.from.node).interface.outputs[intent.from.port]) === null || _b === void 0 ? void 0 : _b.type);
            if (data && sourceType && (module === null || module === void 0 ? void 0 : module.supports(data, this.context)) && module.wire) {
                const edit = (0, node_module_1.prepareNodeWire)(module, data, intent.to.port, sourceType, this.context);
                prepared.set(target.id, edit.node);
                removed.push(...this.data.edges.filter(e => e.to[0] === target.id && edit.replaceInputs.includes(e.to[1])));
            }
        }
        const nodes = this.nodes.map(n => {
            const module = n.definition, data = n.data;
            return { id: n.id, definition: data.definitionUuid, stored: overrides.get(n.id) || (prepared.has(n.id) ? (0, node_module_1.resolvePorts)(module, prepared.get(n.id), this.context).types() : n.interface.types()),
                ...((module === null || module === void 0 ? void 0 : module.supports(data, this.context)) && module.signatures ? { variants: module.signatures(data, this.context) } : {}) };
        });
        const result = (0, wire_planning_1.plan)({ nodes, edges: this.data.edges.filter(e => !removed.includes(e)) }, policy, intent);
        return result.ok ? { ...result, prepared, displaced: [...removed, ...result.displaced] } : { ...result, prepared };
    }
    identity(e, _index) {
        if (e.id)
            return e.id;
        let id = this.temporaryIds.get(e);
        if (!id) {
            id = 'temporary:' + ++this.temporarySequence;
            this.temporaryIds.set(e, id);
        }
        return id;
    }
    indexEdges() {
        // Editable views permit legacy in-place mutation. Immutable compiler views
        // build this index once; they never pay the rescan on each getter.
        if (this.graph.editable || this.indexedEdges !== this.data.edges || this.edgeCount !== this.data.edges.length) {
            const index = new Map();
            this.data.edges.forEach((e, i) => { const id = this.identity(e, i); if (index.has(id))
                throw Error('Duplicate edge ID'); index.set(id, e); });
            this.edgeIndex = index;
            this.indexedEdges = this.data.edges;
            this.edgeCount = this.data.edges.length;
            this.adjacency = undefined;
        }
    }
    edgeData(id) { this.indexEdges(); return this.edgeIndex.get(id); }
    edge(id) { let edge = this.edgeHandles.get(id); if (!edge) {
        edge = new Edge(this, id);
        this.edgeHandles.set(id, edge);
    } return edge; }
    get edges() { this.indexEdges(); return [...this.edgeIndex.keys()].map(id => this.edge(id)); }
    /** Query raw endpoints from one validated index, never through E getters that
     * would each reindex an externally editable network. Snapshot views retain
     * the adjacency index; transitional editable views refresh it for raw edits. */
    edgesAt(port) {
        var _a;
        if (port.node.network !== this)
            throw Error('Port belongs to another network');
        this.indexEdges();
        if (!this.adjacency) {
            const input = new Map(), output = new Map();
            const add = (index, endpoint, id) => {
                let ports = index.get(endpoint[0]);
                if (!ports) {
                    ports = new Map();
                    index.set(endpoint[0], ports);
                }
                let edges = ports.get(endpoint[1]);
                if (!edges) {
                    edges = [];
                    ports.set(endpoint[1], edges);
                }
                edges.push(id);
            };
            for (const [id, e] of this.edgeIndex) {
                add(input, e.to, id);
                add(output, e.from, id);
            }
            this.adjacency = { input, output };
        }
        return (((_a = this.adjacency[port.direction].get(port.node.id)) === null || _a === void 0 ? void 0 : _a.get(port.key)) || []).map(id => this.edge(id));
    }
    /** Returns a dependency order and rejects cycles, including disconnected ones. */
    order(sink, used) {
        const active = new Set(), done = new Set(), ordered = [];
        this.indexEdges();
        const incoming = new Map();
        for (const edge of this.edgeIndex.values()) {
            const id = edge.to[0], list = incoming.get(id) || [];
            list.push(edge);
            incoming.set(id, list);
        }
        for (const list of incoming.values())
            list.sort((a, b) => a.to[1] < b.to[1] ? -1 : a.to[1] > b.to[1] ? 1 : 0);
        const visit = (root) => {
            const stack = [{ id: root }];
            while (stack.length) {
                const { id, exit } = stack.pop();
                if (exit) {
                    active.delete(id);
                    done.add(id);
                    ordered.push(this.node(id));
                    continue;
                }
                if (done.has(id))
                    continue;
                if (active.has(id))
                    throw new GraphError('Cycle detected', id);
                if (!this.nodeData(id))
                    throw new GraphError('Connection endpoint no longer exists', id);
                active.add(id);
                stack.push({ id, exit: true });
                const links = incoming.get(id) || [];
                for (let i = links.length - 1; i >= 0; i--)
                    stack.push({ id: links[i].from[0] });
            }
        };
        for (const n of this.nodes)
            visit(n.id);
        if (sink !== undefined) {
            if (used)
                for (const [id, edges] of incoming)
                    incoming.set(id, edges.filter(used));
            ordered.length = 0;
            done.clear();
            visit(sink);
        }
        return ordered;
    }
    connect(from, to, policy) {
        this.assertEditable();
        if (from.node.network !== this || to.node.network !== this || from.direction !== 'output' || to.direction !== 'input')
            throw Error('Connection endpoints must belong to this network');
        const result = this.plan(policy, { kind: 'wire', from: { node: from.node.id, port: from.key }, to: { node: to.node.id, port: to.key } });
        if (!result.ok)
            throw new GraphError(result.diagnostic.code === 'cycle' ? 'Cycle detected' : 'Incompatible connection: ' + result.diagnostic.code, to.node.id);
        const retained = this.edges.find(e => { var _a, _b; return (0, changes_1.equal)((_a = e.data) === null || _a === void 0 ? void 0 : _a.from, from.endpoint) && (0, changes_1.equal)((_b = e.data) === null || _b === void 0 ? void 0 : _b.to, to.endpoint); });
        const signature = result.inference.signatures.get(to.node.id), target = to.node.data, original = (0, model_1.copy)(target);
        const prepared = result.prepared.get(to.node.id);
        if (prepared)
            Object.assign(target, (0, model_1.copy)(prepared));
        if (signature)
            to.node.configure({ signature });
        if (retained && result.displaced.length === 1)
            return retained;
        const before = this.data.edges, sequence = this.data.edgeSequence;
        try {
            const id = this.graph.nextEdgeId(this.data);
            this.data.edges = before.filter(e => !result.displaced.includes(e));
            this.data.edges.push({ id, from: from.endpoint, to: to.endpoint });
            return this.edges.find(e => e.id === id);
        }
        catch (e) {
            this.data.edges = before;
            for (const key of Object.keys(target))
                delete target[key];
            Object.assign(target, original);
            if (sequence === undefined)
                delete this.data.edgeSequence;
            else
                this.data.edgeSequence = sequence;
            throw e;
        }
    }
    disconnect(edge) {
        this.disconnectAll([edge]);
    }
    disconnectAll(edges) {
        this.assertEditable();
        if (edges.some(e => e.network !== this))
            throw Error('Edge belongs to another network');
        this.indexEdges();
        const targets = new Set(edges.map(e => this.edgeIndex.get(e.id)).filter(e => !!e));
        if (!targets.size)
            return;
        const sequence = edgeSequence(this.data);
        if (sequence)
            this.data.edgeSequence = sequence;
        this.data.edges = this.data.edges.filter(e => !targets.has(e));
    }
}
exports.Network = Network;
function edgeSequence(data) {
    var _a;
    let sequence = data.edgeSequence || 0;
    if (!Number.isSafeInteger(sequence) || sequence < 0)
        throw Error('Invalid edge sequence');
    for (const e of data.edges) {
        const match = (_a = e.id) === null || _a === void 0 ? void 0 : _a.match(/^edge_(\d+)$/);
        if (match)
            sequence = Math.max(sequence, Number(match[1]));
    }
    return sequence;
}
class GraphError extends Error {
    constructor(message, node) {
        super(message);
        this.node = node;
    }
}
exports.GraphError = GraphError;
class GraphDocument {
    constructor(document, registry, fallback, editable = false) {
        this.registry = registry;
        this.fallback = fallback;
        this.editable = editable;
        this.networkHandles = new Map();
        this.active = true;
        this.document = editable ? document : clone(document, true);
        this.context = (0, node_module_1.contextFor)(this.document);
    }
    get networks() {
        var _a;
        const current = new Map(networkEntries(this.document));
        for (const [id, data] of current)
            if (((_a = this.networkHandles.get(id)) === null || _a === void 0 ? void 0 : _a.data) !== data)
                this.networkHandles.set(id, new Network(this, id, data));
        for (const id of this.networkHandles.keys())
            if (!current.has(id))
                this.networkHandles.delete(id);
        return this.networkHandles;
    }
    createSubgraph(options) { return this.subgraph((0, subgraph_operations_1.createSubgraph)(this, options).id); }
    ensureSubgraphCapacity(additional = 0) { (0, subgraph_operations_1.ensureSubgraphCapacity)(this, additional); }
    appendSubgraphs(definitions, ids = new Map()) {
        return (0, subgraph_copies_1.appendSubgraphs)(this, definitions, ids).map(f => this.subgraph(f.id));
    }
    localizeSubgraph(id, next) { return (0, subgraph_copies_1.localizeSubgraph)(this, id, next); }
    subgraph(id) { return new subgraphs_1.Subgraph(this, id); }
    assertEditable() { if (!this.editable || !this.active)
        throw Error('Graph changes require an active transaction'); }
    close() { this.active = false; }
    nextEdgeId(data) {
        this.assertEditable();
        const index = edgeSequence(data);
        if (!Number.isSafeInteger(index + 1))
            throw Error('Edge sequence exhausted');
        data.edgeSequence = index + 1;
        return 'edge_' + data.edgeSequence;
    }
    snapshot() { return clone(this.document); }
    /** One candidate, one publication. History stores this before/after pair;
     * host receipts and UI selections remain the application's responsibility. */
    change(edit) {
        const before = this.snapshot(), candidate = new GraphDocument(clone(before), this.registry, this.fallback, true);
        try {
            edit(candidate);
            if (!(0, changes_1.equal)(before, candidate.document))
                complete(candidate.document, before);
            const after = candidate.snapshot();
            return { before, after, changes: (0, changes_1.changesBetween)(before, after, this.registry) };
        }
        finally {
            candidate.close();
        }
    }
}
exports.GraphDocument = GraphDocument;
function networkEntries(document) {
    return [...Object.entries(document.stages), ...(document.functions || []).map(raw => { const f = raw; return ['function:' + f.id, f.graph]; })];
}
function complete(document, previous) {
    const prior = new Map(previous ? networkEntries(previous) : []);
    const snapshots = new Set((document.functions || []).filter(f => f.scope !== 'local').map(f => f.graph));
    for (const [id, data] of networkEntries(document)) {
        const old = prior.get(id);
        let sequence = Math.max(edgeSequence(data), old ? edgeSequence(old) : 0);
        const nodes = new Set(), edges = new Set();
        for (const n of data.nodes) {
            if (!n.id || nodes.has(n.id))
                throw Error('Invalid or duplicate node ID');
            nodes.add(n.id);
        }
        for (const e of data.edges) {
            // Source snapshots keep their authored bytes. Their read-only Edge
            // handles already have temporary identities; only local data gets IDs.
            if (!e.id && snapshots.has(data))
                continue;
            if (!e.id) {
                if (!Number.isSafeInteger(sequence + 1))
                    throw Error('Edge sequence exhausted');
                e.id = 'edge_' + ++sequence;
            }
            if (edges.has(e.id))
                throw Error('Duplicate edge ID');
            edges.add(e.id);
        }
        if (sequence && !snapshots.has(data))
            data.edgeSequence = sequence;
    }
}
/** Transitional editor transaction: existing widgets mutate the one active
 * candidate (including their captured node references). The core publishes and
 * identifies its edges; the application restores `before` on a failed callback.
 * This adapter can disappear as widgets adopt Network operations directly. */
function transact(document, registry, edit) {
    const before = clone(document);
    const model = new GraphDocument(document, registry, undefined, true);
    try {
        const after = edit(before, model);
        if (!(0, changes_1.equal)(before, after))
            complete(after, before);
        return { before, after, changes: (0, changes_1.changesBetween)(before, after, registry) };
    }
    catch (error) {
        for (const key of Object.keys(document))
            delete document[key];
        Object.assign(document, clone(before));
        throw error;
    }
    finally {
        model.close();
    }
}

},
"identifier_rules":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.identifierRules = void 0;
/** GLSL names reserved by the existing editor contract. */
exports.identifierRules = {
    maxPorts: 16,
    maxLength: 16384,
    reservedNames: [
        "active",
        "asm",
        "atomic_uint",
        "attribute",
        "bool",
        "break",
        "buffer",
        "bvec2",
        "bvec3",
        "bvec4",
        "case",
        "cast",
        "centroid",
        "class",
        "coherent",
        "common",
        "const",
        "continue",
        "default",
        "discard",
        "dmat2",
        "dmat2x3",
        "dmat2x4",
        "dmat3",
        "dmat3x2",
        "dmat3x4",
        "dmat4",
        "dmat4x2",
        "dmat4x3",
        "do",
        "double",
        "dvec2",
        "dvec3",
        "dvec4",
        "else",
        "enum",
        "extern",
        "external",
        "false",
        "filter",
        "fixed",
        "flat",
        "float",
        "for",
        "fvec2",
        "fvec3",
        "fvec4",
        "goto",
        "half",
        "highp",
        "hvec2",
        "hvec3",
        "hvec4",
        "if",
        "in",
        "inline",
        "inout",
        "input",
        "int",
        "interface",
        "invariant",
        "ivec2",
        "ivec3",
        "ivec4",
        "layout",
        "long",
        "lowp",
        "main",
        "mat2",
        "mat2x3",
        "mat2x4",
        "mat3",
        "mat3x2",
        "mat3x4",
        "mat4",
        "mat4x2",
        "mat4x3",
        "mediump",
        "namespace",
        "noinline",
        "noperspective",
        "out",
        "output",
        "partition",
        "patch",
        "precise",
        "precision",
        "public",
        "readonly",
        "resource",
        "restrict",
        "return",
        "row_major",
        "sample",
        "sampler3DRect",
        "shared",
        "short",
        "sizeof",
        "smooth",
        "static",
        "struct",
        "subroutine",
        "superp",
        "switch",
        "template",
        "this",
        "true",
        "typedef",
        "uint",
        "uniform",
        "union",
        "unsigned",
        "using",
        "uvec2",
        "uvec3",
        "uvec4",
        "varying",
        "vec2",
        "vec3",
        "vec4",
        "void",
        "volatile",
        "while",
        "writeonly"
    ]
};

},
"model":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.object = object;
exports.copy = copy;
function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : undefined; }
/** Own JSON values at mutation boundaries; callers never retain editable state. */
function copy(value) { return JSON.parse(JSON.stringify(value)); }

},
"node_module":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextFor = contextFor;
exports.createRegistry = createRegistry;
exports.configureNode = configureNode;
exports.editNode = editNode;
exports.prepareNodeWire = prepareNodeWire;
exports.resolvePorts = resolvePorts;
const model_1 = require("./model");
const ports_1 = require("./ports");
function contextFor(graph, owner) {
    return { target: graph.target, owner, declaration: id => graph.declarations.find(d => d.id === id), subgraph: id => { var _a; return (_a = graph.functions) === null || _a === void 0 ? void 0 : _a.find(f => f.id === id); } };
}
function createRegistry(modules) {
    const table = new Map();
    for (const module of modules) {
        const d = module.catalog.definition, id = d.definitionUuid || 'sgrape.builtin.' + d.key;
        if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.key) || table.has(id))
            throw Error('Invalid or duplicate node definition: ' + id);
        if (module.signatures && !module.configure)
            throw Error('Signature module needs a configuration operation: ' + id);
        const freeze = (value) => { if (value && typeof value === 'object') {
            Object.values(value).forEach(freeze);
            Object.freeze(value);
        } };
        const catalog = JSON.parse(JSON.stringify(module.catalog));
        catalog.definition.definitionUuid = id;
        freeze(catalog);
        table.set(id, Object.freeze({ ...module, catalog }));
    }
    // Do not expose a mutable registration table to a compilation in progress.
    return Object.freeze({ modules: Object.freeze([...table.values()]), get: (id) => table.get(id) });
}
const sameTypes = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => b[key] === value);
/** Pure configuration. Module callbacks cannot partly edit a working node. */
function configureNode(module, node, selection, context) {
    var _a;
    if (!module.configure)
        throw Error('Node does not support configuration');
    const before = resolvePorts(module, node, context).types();
    if ('signature' in selection) {
        const wanted = selection.signature;
        const declared = (_a = module.signatures) === null || _a === void 0 ? void 0 : _a.call(module, node, context).find(s => s.type === wanted.type && sameTypes(s.inputs, wanted.inputs) && sameTypes(s.outputs, wanted.outputs));
        if (!sameTypes(before.outputs, wanted.outputs) || !declared)
            throw Error('Invalid native signature');
        selection = { signature: declared };
    }
    const candidate = module.configure((0, model_1.copy)(node), (0, model_1.copy)(selection), context);
    if (candidate.id !== node.id || candidate.definitionUuid !== node.definitionUuid)
        throw Error('Configuration cannot change node identity');
    if (!module.supports(candidate, context))
        throw Error('Unsupported node configuration');
    module.validate(candidate, context);
    const after = resolvePorts(module, candidate, context).types();
    if ('signature' in selection && (!sameTypes(after.outputs, before.outputs) || !sameTypes(after.inputs, selection.signature.inputs)))
        throw Error('Module configuration disagrees with its signature');
    return (0, model_1.copy)(candidate);
}
function editNode(module, node, command, value, context) {
    if (!module.edit)
        throw Error('Node command is unavailable');
    const candidate = module.edit((0, model_1.copy)(node), command, value === undefined ? undefined : (0, model_1.copy)(value), context);
    if (candidate.id !== node.id || candidate.definitionUuid !== node.definitionUuid)
        throw Error('Command cannot change node identity');
    if (!module.supports(candidate, context))
        throw Error('Unsupported node configuration');
    module.validate(candidate, context);
    resolvePorts(module, candidate, context);
    return (0, model_1.copy)(candidate);
}
function prepareNodeWire(module, node, key, source, context) {
    if (!module.wire)
        throw Error('Node has no wire preparation');
    const before = resolvePorts(module, node, context).types(), edit = module.wire((0, model_1.copy)(node), key, source, context);
    if (edit.node.id !== node.id || edit.node.definitionUuid !== node.definitionUuid || !module.supports(edit.node, context))
        throw Error('Wire preparation changed identity/capability');
    module.validate(edit.node, context);
    const after = resolvePorts(module, edit.node, context).types();
    if (!sameTypes(before.outputs, after.outputs) || edit.replaceInputs.some(p => !before.inputs[p]))
        throw Error('Wire preparation changed outputs or unknown ports');
    return edit;
}
const portTemplates = new WeakMap();
function resolvePorts(module, node, context) {
    const specs = module.ports(node, context);
    // A frozen declaration is reusable; graph Port handles still own their
    // network/node/key identity. Dynamic declarations get a fresh projection.
    if (Object.isFrozen(specs)) {
        let resolved = portTemplates.get(specs);
        if (!resolved) {
            resolved = new ports_1.NodePorts(specs);
            portTemplates.set(specs, resolved);
        }
        return resolved;
    }
    return new ports_1.NodePorts(specs);
}

},
"node_sdk":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vectorAssembly = exports.values = exports.payload = exports.output = exports.input = exports.reshapeInputs = exports.typedNode = exports.staticNode = exports.selectedType = exports.requireSubgraph = exports.numericInterface = exports.subgraphPresentation = exports.subgraphPorts = exports.numericTypes = exports.fill = exports.type = exports.literal = void 0;
exports.reshapeDefaults = reshapeDefaults;
exports.literalNode = literalNode;
exports.vectorNode = vectorNode;
exports.binaryNode = binaryNode;
exports.unaryNode = unaryNode;
exports.numericCall = numericCall;
exports.uniformNode = uniformNode;
exports.outputNode = outputNode;
/** Small developer entry point. Builtins and developer modules share this API. */
const model_1 = require("./model");
const numeric_1 = require("./numeric");
var numeric_2 = require("./numeric");
Object.defineProperty(exports, "literal", { enumerable: true, get: function () { return numeric_2.literal; } });
Object.defineProperty(exports, "type", { enumerable: true, get: function () { return numeric_2.type; } });
Object.defineProperty(exports, "fill", { enumerable: true, get: function () { return numeric_2.fill; } });
var numeric_3 = require("./numeric");
Object.defineProperty(exports, "numericTypes", { enumerable: true, get: function () { return numeric_3.types; } });
var subgraph_interface_1 = require("./subgraph_interface");
Object.defineProperty(exports, "subgraphPorts", { enumerable: true, get: function () { return subgraph_interface_1.subgraphPorts; } });
Object.defineProperty(exports, "subgraphPresentation", { enumerable: true, get: function () { return subgraph_interface_1.subgraphPresentation; } });
Object.defineProperty(exports, "numericInterface", { enumerable: true, get: function () { return subgraph_interface_1.numericInterface; } });
Object.defineProperty(exports, "requireSubgraph", { enumerable: true, get: function () { return subgraph_interface_1.requireSubgraph; } });
const numeric = (n) => n.params.type === undefined || numeric_1.types.includes(String(n.params.type));
const out = (t) => ({ key: 'out', direction: 'output', type: t });
function fixedPorts(specs) {
    const freeze = (v) => { if (v && typeof v === 'object') {
        Object.values(v).forEach(freeze);
        Object.freeze(v);
    } };
    freeze(specs);
    return specs;
}
const outputPorts = Object.fromEntries(numeric_1.types.map(t => [t, fixedPorts([out(t)])]));
const selectedType = (node, selection) => {
    const selected = (0, numeric_1.type)('type' in selection ? selection.type : selection.signature.type);
    if (node.params.fixedType && node.params.fixedType !== selected)
        throw Error('Fixed node type');
    return selected;
};
exports.selectedType = selectedType;
function shape(value, t) {
    var _a;
    const values = Array.isArray(value) ? value : [value];
    if (t === 'float')
        return (_a = values[0]) !== null && _a !== void 0 ? _a : 0;
    return Array.from({ length: (0, numeric_1.count)(t) }, (_, i) => { var _a, _b; return (_b = (_a = values[i]) !== null && _a !== void 0 ? _a : values[0]) !== null && _b !== void 0 ? _b : 0; });
}
/** Numeric-family policy, shared by modules, never a node-name dispatch. */
function reshapeDefaults(node, before, after) {
    var _a;
    const old = new Map(before.filter(p => p.direction === 'input').map(p => [p.key, p.type]));
    for (const p of after)
        if (p.direction === 'input' && ((_a = node.inputValues) === null || _a === void 0 ? void 0 : _a[p.key]) !== undefined && old.has(p.key) && old.get(p.key) !== p.type) {
            node.ui || (node.ui = {});
            const cache = (0, model_1.object)(node.ui.inputValuesByType) || {};
            node.ui.inputValuesByType = cache;
            const values = (0, model_1.object)(cache[p.key]) || {};
            cache[p.key] = values;
            values[old.get(p.key)] = (0, model_1.copy)(node.inputValues[p.key]);
            node.inputValues[p.key] = values[p.type] === undefined ? shape(node.inputValues[p.key], (0, numeric_1.type)(p.type)) : (0, model_1.copy)(values[p.type]);
        }
    return node;
}
function editValue(current, t, command, payload) {
    const data = (0, model_1.object)(payload);
    if (!data)
        throw Error('Missing value command');
    if (command === 'value') {
        (0, numeric_1.literal)(data.value, t);
        return (0, model_1.copy)(data.value);
    }
    if (command !== 'component' || typeof data.index !== 'number' || !Number.isInteger(data.index) || data.index < 0 || data.index >= (0, numeric_1.count)(t))
        throw Error('Invalid value component');
    (0, numeric_1.number)(data.value);
    if (t === 'float')
        return data.value;
    const next = Array.isArray(current) ? (0, model_1.copy)(current) : Array((0, numeric_1.count)(t)).fill(0);
    next[data.index] = data.value;
    return next;
}
function literalNode(catalog, fixed, constant = false, appearance = {}) {
    const selected = (n) => fixed || (0, numeric_1.type)(n.params.type || 'float');
    return { catalog, role: 'value', supports: n => numeric(n) && (!!fixed || n.params.type === undefined || n.params.type === 'float'),
        configure: (n, s) => { var _a; const t = selectedType(n, s); if (fixed && fixed !== t)
            throw Error('Fixed literal type'); n.params.type = t; n.params.value = shape((_a = n.params.value) !== null && _a !== void 0 ? _a : 0, t); return n; },
        edit: (n, command, value) => { n.params.value = editValue(n.params.value, selected(n), command, value); return n; },
        presentation: n => ({ value: { value: n.params.value, type: selected(n), componentCommand: 'component', valueCommand: 'value', names: appearance.color ? 'RGBA' : 'XYZW', color: !!appearance.color, expandable: selected(n) !== 'float' } }),
        ports: n => outputPorts[selected(n)], validate: n => { (0, numeric_1.literal)(n.params.value, selected(n)); },
        emit: n => ({ outputs: { out: (0, numeric_1.literal)(n.params.value, selected(n)) }, constant }) };
}
function vectorNode(catalog) {
    return { catalog, role: 'value', supports: n => ['vec2', 'vec3', 'vec4'].includes(String(n.params.type)),
        configure: (n, s) => { n.params.type = selectedType(n, s); return n; },
        edit: (n, command, value) => {
            const t = (0, numeric_1.type)(n.params.type), components = n.params.components;
            const next = editValue(components.slice(0, (0, numeric_1.count)(t)), t, command, value);
            n.params.components = [...next, ...components.slice(next.length)];
            return n;
        },
        presentation: n => { var _a; return ({ value: { value: n.params.components.slice(0, (0, numeric_1.count)((0, numeric_1.type)(n.params.type))), type: String(n.params.type), componentCommand: 'component', valueCommand: 'value', names: String(((_a = n.ui) === null || _a === void 0 ? void 0 : _a.componentNames) || 'XYZW').toUpperCase(), expandable: true } }); },
        ports: n => outputPorts[(0, numeric_1.type)(n.params.type)], validate: n => {
            if (!Array.isArray(n.params.components) || n.params.components.length !== 4)
                throw Error('Vector needs four stored components');
            n.params.components.forEach(numeric_1.number);
        }, emit: n => ({ outputs: { out: (0, numeric_1.literal)(n.params.components.slice(0, (0, numeric_1.count)((0, numeric_1.type)(n.params.type))), (0, numeric_1.type)(n.params.type)) }, constant: true }) };
}
function binaryNode(catalog, operator) {
    const variants = numeric_1.types.flatMap(t => (t === 'float' ? [{ a: t, b: t }] : [{ a: t, b: t }, { a: t, b: 'float' }, { a: 'float', b: t }]).map(inputs => ({ type: t, inputs, outputs: { out: t }, operands: inputs })));
    const signatures = () => variants;
    const layouts = new Map(variants.map(v => [v.type + ':' + v.inputs.a + ':' + v.inputs.b, fixedPorts([{ key: 'a', direction: 'input', type: v.inputs.a, default: (0, numeric_1.fill)(0, (0, numeric_1.type)(v.inputs.a)) }, { key: 'b', direction: 'input', type: v.inputs.b, default: (0, numeric_1.fill)(operator === '/' ? 1 : 0, (0, numeric_1.type)(v.inputs.b)) }, out(v.type)])]));
    const ports = (n) => {
        var _a, _b;
        const t = (0, numeric_1.type)(n.params.type || 'float'), operand = (0, model_1.object)(n.params.operandTypes);
        if (n.params.operandTypes !== undefined && (!operand || Object.keys(operand).sort().join() !== 'a,b'))
            throw Error('Invalid arithmetic operands');
        const a = (0, numeric_1.type)((_a = operand === null || operand === void 0 ? void 0 : operand.a) !== null && _a !== void 0 ? _a : t), b = (0, numeric_1.type)((_b = operand === null || operand === void 0 ? void 0 : operand.b) !== null && _b !== void 0 ? _b : t), layout = layouts.get(t + ':' + a + ':' + b);
        if (!layout)
            throw Error('Invalid arithmetic signature');
        return layout;
    };
    return { catalog, role: 'value', supports: n => numeric(n) && Object.values((0, model_1.object)(n.params.operandTypes) || {}).every(t => numeric_1.types.includes(String(t))),
        signatures,
        ports, configure: (n, s) => {
            const before = ports(n);
            n.params.type = selectedType(n, s);
            if ('signature' in s)
                n.params.operandTypes = { ...s.signature.inputs };
            else
                delete n.params.operandTypes;
            return reshapeDefaults(n, before, ports(n));
        },
        validate: () => { }, emit: (_n, c) => ({ outputs: { out: '(' + c.input('a') + ' ' + operator + ' ' + c.input('b') + ')' } }) };
}
function unaryNode(spec) {
    const identifier = (v) => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v);
    if (![spec.key, spec.operator, spec.port].every(identifier))
        throw Error('Invalid unary node definition');
    const catalog = { definition: { key: spec.key, label: spec.label, inputs: { [spec.port]: 'T' }, outputs: { out: 'T' }, stages: ['vertex', 'pixel'], defaults: { type: 'float' }, descriptionKey: spec.descriptionKey, definitionUuid: 'sgrape.builtin.' + spec.key }, emitter: { id: spec.key, version: 1, primitive: { operator: spec.operator, port: spec.port } }, browser: spec.browser };
    const layouts = Object.fromEntries(numeric_1.types.map(t => [t, fixedPorts([{ key: spec.port, direction: 'input', type: t, default: (0, numeric_1.fill)(0, (0, numeric_1.type)(t)) }, out(t)])]));
    return { catalog, role: 'value', supports: numeric,
        configure: (n, s) => { const before = layouts[(0, numeric_1.type)(n.params.type || 'float')]; n.params.type = selectedType(n, s); return reshapeDefaults(n, before, layouts[(0, numeric_1.type)(n.params.type)]); },
        ports: n => layouts[(0, numeric_1.type)(n.params.type || 'float')],
        validate: () => { }, emit: (_n, c) => ({ outputs: { out: spec.operator + '(' + c.input(spec.port) + ')' } }) };
}
/** Static floating-point calls with optional, explicitly declared native input
 * alternatives. Saved input tuples never determine an existing output type. */
function numericCall(catalog, options = {}) {
    const alternatives = options.alternatives || {};
    const call = catalog.emitter.call;
    if (!call || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(call.operator) || call.ports.join() !== Object.keys(catalog.definition.inputs).join())
        throw Error('Invalid numeric call');
    if (options.tuples && Object.keys(alternatives).length)
        throw Error('Declare complete tuples or independent alternatives');
    const keys = Object.keys(catalog.definition.inputs).sort().join();
    if (options.tuples && (!options.tuples.length || options.tuples.some(row => Object.keys(row).sort().join() !== keys)))
        throw Error('Incomplete numeric input tuple');
    if (Object.keys(alternatives).some(key => !Object.prototype.hasOwnProperty.call(catalog.definition.inputs, key)))
        throw Error('Unknown input alternative');
    const selected = (n) => { var _a; return (0, numeric_1.type)((_a = n.params.type) !== null && _a !== void 0 ? _a : catalog.definition.defaults.type); };
    const layouts = new Map();
    const variants = numeric_1.types.flatMap(t => {
        let inputs = [{}];
        if (options.tuples) {
            inputs = options.tuples.map(row => Object.fromEntries(call.ports.map(key => [key, row[key] === 'T' ? t : row[key]])));
            inputs = [...new Map(inputs.map(row => [JSON.stringify(row), row])).values()];
        }
        else
            for (const [key, declared] of Object.entries(catalog.definition.inputs))
                inputs = inputs.flatMap(row => [...new Set((alternatives[key] || [declared]).map(v => v === 'T' ? t : v))].map(value => ({ ...row, [key]: value })));
        const outputs = Object.fromEntries(Object.entries(catalog.definition.outputs).map(([key, v]) => [key, v === 'T' ? t : v]));
        return inputs.map(input => {
            const defaults = { ...(0, model_1.object)(catalog.definition.inputDefaults), ...call.defaults };
            const specs = [...Object.entries(input).map(([key, value]) => { var _a; return ({ key, direction: 'input', type: value, default: (0, numeric_1.fill)(Number((_a = defaults[key]) !== null && _a !== void 0 ? _a : 0), (0, numeric_1.type)(value)) }); }), ...Object.entries(outputs).map(([key, value]) => ({ key, direction: 'output', type: value }))];
            layouts.set(t + ':' + JSON.stringify(input), fixedPorts(specs));
            return { type: t, inputs: input, outputs };
        });
    });
    const signatures = () => variants;
    const ports = (n) => {
        const t = selected(n), stored = (0, model_1.object)(n.params.inputTypes);
        if (n.params.inputTypes !== undefined && !stored)
            throw Error('Invalid saved input signature');
        const chosen = variants.find(v => v.type === t && (!stored || Object.keys(stored).length === Object.keys(v.inputs).length && Object.entries(v.inputs).every(([k, value]) => stored[k] === value)));
        if (!chosen)
            throw Error('Invalid saved input signature');
        return layouts.get(t + ':' + JSON.stringify(chosen.inputs));
    };
    return { catalog, role: 'value', supports: n => { var _a; return numeric_1.types.includes(String((_a = n.params.type) !== null && _a !== void 0 ? _a : catalog.definition.defaults.type)); },
        ...(options.tuples || Object.keys(alternatives).length ? { signatures } : {}), ports, validate: () => { },
        configure: (n, s) => {
            const before = ports(n);
            n.params.type = selectedType(n, s);
            if ('signature' in s)
                n.params.inputTypes = { ...s.signature.inputs };
            else
                delete n.params.inputTypes;
            return reshapeDefaults(n, before, ports(n));
        },
        presentation: () => ({ selectorLabel: Object.values(catalog.definition.outputs).includes('T') ? 'vector.outputType' : 'vector.inputType' }),
        emit: (_n, c) => ({ outputs: { out: call.operator + '(' + call.ports.map(key => c.input(key)).join(', ') + ')' } }) };
}
function uniformNode(catalog) {
    return { catalog, role: 'value', supports: (n, c) => numeric(n) && (!c.declaration(String(n.params.declarationId)) || numeric_1.types.includes(c.declaration(String(n.params.declarationId)).type)), ports: (n, c) => {
            const d = c.declaration(String(n.params.declarationId));
            if (!d)
                throw Error('Select a matching declaration');
            return outputPorts[(0, numeric_1.type)(d.type)];
        }, validate: () => { }, emit: (n, c) => ({ outputs: { out: c.useUniform(String(n.params.declarationId)) } }) };
}
/** Terminal family with a shared, immutable port layout. The owning node
 * supplies target capabilities, controls, validation and shader statements. */
function outputNode(catalog, spec) {
    if (spec.ports.some(p => p.direction !== 'input'))
        throw Error('Terminal nodes only have input ports');
    const { ports, ...implementation } = spec, layout = fixedPorts([...ports]);
    return { ...implementation, catalog, role: 'output', ports: () => layout };
}
var value_nodes_1 = require("./value_nodes");
Object.defineProperty(exports, "staticNode", { enumerable: true, get: function () { return value_nodes_1.staticNode; } });
Object.defineProperty(exports, "typedNode", { enumerable: true, get: function () { return value_nodes_1.typedNode; } });
Object.defineProperty(exports, "reshapeInputs", { enumerable: true, get: function () { return value_nodes_1.reshapeInputs; } });
Object.defineProperty(exports, "input", { enumerable: true, get: function () { return value_nodes_1.input; } });
Object.defineProperty(exports, "output", { enumerable: true, get: function () { return value_nodes_1.output; } });
Object.defineProperty(exports, "payload", { enumerable: true, get: function () { return value_nodes_1.payload; } });
Object.defineProperty(exports, "values", { enumerable: true, get: function () { return value_nodes_1.values; } });
var vector_assembly_1 = require("./vector_assembly");
Object.defineProperty(exports, "vectorAssembly", { enumerable: true, get: function () { return vector_assembly_1.vectorAssembly; } });

},
"nodes/abs":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.unaryNode)({
    key: 'abs', label: 'Absolute', descriptionKey: 'help.abs',
    operator: 'abs', port: 'value',
    browser: { "category": "math", "source": "glsl", "aliases": ["abs", "absolute", "絕對值"], "glslName": "abs", "secondaryCategories": [], "categoryPath": ["math", "arithmetic"] }
});

},
"nodes/add":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "add",
        "label": "Add",
        "inputs": {
            "a": "T",
            "b": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "descriptionKey": "help.add",
        "definitionUuid": "sgrape.builtin.add"
    },
    "emitter": {
        "id": "add",
        "version": 1
    },
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "+",
            "加法"
        ],
        "glslName": "+",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "arithmetic"
        ]
    }
};
exports.default = (0, node_sdk_1.binaryNode)(catalog, '+');

},
"nodes/all":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "all",
        "label": "all",
        "inputs": {
            "value": "bvec2"
        },
        "outputs": {
            "out": "bool"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "bvec2"
        },
        "inputDefaults": {},
        "descriptionKey": "help.all",
        "definitionUuid": "sgrape.builtin.all",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "all",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "all"
        ],
        "glslName": "all",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: ['bvec2', 'bvec3', 'bvec4'],
    ports: t => [(0, node_sdk_1.input)('value', t), (0, node_sdk_1.output)('out', 'bool')],
    presentation: () => ({ selectorLabel: 'vector.inputType' }),
    emit: (_n, c) => ({ outputs: { out: 'all(' + c.input('value') + ')' } })
});

},
"nodes/any":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "any",
        "label": "any",
        "inputs": {
            "value": "bvec2"
        },
        "outputs": {
            "out": "bool"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "bvec2"
        },
        "inputDefaults": {},
        "descriptionKey": "help.any",
        "definitionUuid": "sgrape.builtin.any",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "any",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "any"
        ],
        "glslName": "any",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: ['bvec2', 'bvec3', 'bvec4'],
    ports: t => [(0, node_sdk_1.input)('value', t), (0, node_sdk_1.output)('out', 'bool')],
    presentation: () => ({ selectorLabel: 'vector.inputType' }),
    emit: (_n, c) => ({ outputs: { out: 'any(' + c.input('value') + ')' } })
});

},
"nodes/ceil":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.unaryNode)({
    "key": "ceil",
    "label": "Ceil",
    "descriptionKey": "help.ceil",
    "operator": "ceil",
    "port": "value",
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "ceil",
            "ceiling",
            "round up",
            "ceil(A)"
        ],
        "glslName": "ceil",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "range"
        ]
    }
});

},
"nodes/clamp":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.numericCall)({
    "definition": {
        "key": "clamp",
        "label": "Clamp",
        "inputs": {
            "value": "T",
            "min": "T",
            "max": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "inputDefaults": {
            "max": 1
        },
        "descriptionKey": "help.clamp",
        "definitionUuid": "sgrape.builtin.clamp"
    },
    "emitter": {
        "id": "clamp",
        "version": 1,
        "call": {
            "operator": "clamp",
            "ports": [
                "value",
                "min",
                "max"
            ]
        }
    },
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "clamp",
            "限制"
        ],
        "glslName": "clamp",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "range"
        ]
    }
}, {
    "tuples": [
        {
            "value": "T",
            "min": "T",
            "max": "T"
        },
        {
            "value": "T",
            "min": "float",
            "max": "float"
        }
    ]
});

},
"nodes/color":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "color",
        "label": "Color RGBA",
        "inputs": {},
        "outputs": {
            "out": "vec4"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "value": [
                0.55,
                0.28,
                0.9,
                1
            ]
        },
        "descriptionKey": "help.color",
        "definitionUuid": "sgrape.builtin.color"
    },
    "emitter": {
        "id": "color",
        "version": 1
    },
    "browser": {
        "category": "color",
        "source": "editor",
        "aliases": [
            "constant",
            "rgba",
            "colour",
            "顏色",
            "色彩"
        ],
        "glslName": "color",
        "secondaryCategories": [],
        "categoryPath": [
            "color",
            "construct"
        ]
    }
};
exports.default = (0, node_sdk_1.literalNode)(catalog, 'vec4', false, { color: true });

},
"nodes/combine":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "combine",
        "label": "Combine",
        "inputs": {
            "x": "float",
            "y": "float"
        },
        "outputs": {
            "out": "vec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2",
            "groups": {},
            "components": [
                0,
                0,
                0,
                0
            ]
        },
        "descriptionKey": "help.combine",
        "definitionUuid": "sgrape.builtin.combine"
    },
    "emitter": {
        "id": "combine",
        "version": 1
    },
    "browser": {
        "category": "vector",
        "source": "glsl",
        "aliases": [
            "compose",
            "append",
            "append vector",
            "merge",
            "construct",
            "合併",
            "組合"
        ],
        "glslName": "vecN",
        "secondaryCategories": [],
        "categoryPath": [
            "vector"
        ]
    }
};
exports.default = (0, node_sdk_1.vectorAssembly)(catalog, false);

},
"nodes/compare":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "compare",
        "label": "Compare",
        "inputs": {
            "a": "T",
            "b": "T"
        },
        "outputs": {
            "out": "bool"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float",
            "operator": ">"
        },
        "inputDefaults": {
            "a": 0,
            "b": 0
        },
        "descriptionKey": "help.compare",
        "definitionUuid": "sgrape.builtin.compare"
    },
    "emitter": {
        "id": "compare",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "editor",
        "aliases": [
            "comparison",
            "greater",
            "less",
            "equal",
            "bool",
            "condition",
            "比較"
        ],
        "glslName": ">, >=, <, <=, ==, !=",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
const operators = ['>', '>=', '<', '<=', '==', '!='];
const control = (operator) => ({
    kind: 'select', key: 'operator', label: 'compare.operator', command: 'operator', value: operator,
    options: operators.map(value => ({ value, label: 'A ' + value + ' B', literal: true }))
});
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: ['float', 'int', 'uint'],
    ports: t => [(0, node_sdk_1.input)('a', t), (0, node_sdk_1.input)('b', t), (0, node_sdk_1.output)('out', 'bool')],
    validate: n => { var _a; if (!operators.includes(String((_a = n.params.operator) !== null && _a !== void 0 ? _a : '>')))
        throw Error('Invalid comparison operator'); },
    edit: (n, command, data) => {
        const value = String((0, node_sdk_1.payload)(data));
        if (command !== 'operator' || !operators.includes(value))
            throw Error('Invalid comparison operator');
        n.params.operator = value;
        return n;
    },
    presentation: n => {
        var _a, _b;
        return ({ selectorLabel: 'vector.inputType',
            controls: [control(String((_a = n.params.operator) !== null && _a !== void 0 ? _a : '>'))], inlineControls: [control(String((_b = n.params.operator) !== null && _b !== void 0 ? _b : '>'))] });
    },
    emit: (n, c) => { var _a; return ({ outputs: { out: '(' + c.input('a') + ' ' + String((_a = n.params.operator) !== null && _a !== void 0 ? _a : '>') + ' ' + c.input('b') + ')' } }); }
});

},
"nodes/convert":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "convert",
        "label": "Convert",
        "inputs": {
            "value": "float"
        },
        "outputs": {
            "out": "int"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "fromType": "float",
            "toType": "int"
        },
        "descriptionKey": "help.convert",
        "definitionUuid": "sgrape.builtin.convert"
    },
    "emitter": {
        "id": "convert",
        "version": 1
    },
    "browser": {
        "category": "data",
        "source": "editor",
        "aliases": [
            "cast",
            "constructor",
            "convert type",
            "float to int",
            "int to float"
        ],
        "glslName": "convert",
        "secondaryCategories": [],
        "categoryPath": [
            "data",
            "values"
        ]
    }
};
const conversion = {
    catalog, role: 'value',
    creations: wire => {
        if (wire && !node_sdk_1.values.types.includes(wire.type))
            return undefined;
        const from = (wire === null || wire === void 0 ? void 0 : wire.direction) === 'output' ? wire.type : 'float';
        const to = (wire === null || wire === void 0 ? void 0 : wire.direction) === 'input' ? wire.type : 'int';
        const pairs = wire ? node_sdk_1.values.types.map(t => wire.direction === 'output' ? [from, t] : [t, to]) : [[from, to]];
        const rows = pairs.filter(([a, b]) => node_sdk_1.values.explicit(a, b)).map(([a, b]) => ({ fromType: a, toType: b }));
        if ((wire === null || wire === void 0 ? void 0 : wire.direction) === 'output')
            rows.sort((a, b) => Number(node_sdk_1.values.count(b.toType) === node_sdk_1.values.count(from)) - Number(node_sdk_1.values.count(a.toType) === node_sdk_1.values.count(from)));
        return rows;
    },
    supports: n => node_sdk_1.values.types.includes(String(n.params.fromType)) && node_sdk_1.values.types.includes(String(n.params.toType)),
    ports: n => {
        const from = String(n.params.fromType), to = String(n.params.toType);
        if (!node_sdk_1.values.explicit(from, to))
            throw Error('Source cannot construct the requested output');
        return [(0, node_sdk_1.input)('value', from), (0, node_sdk_1.output)('out', to)];
    },
    validate: () => { },
    presentation: n => ({
        selector: { value: String(n.params.toType), options: node_sdk_1.values.types.filter(t => node_sdk_1.values.explicit(String(n.params.fromType), t)), command: 'toType', label: 'convert.toType' },
        controls: [{ kind: 'select', key: 'fromType', label: 'convert.fromType', command: 'fromType', value: String(n.params.fromType),
                options: node_sdk_1.values.types.filter(t => node_sdk_1.values.explicit(t, String(n.params.toType))).map(value => ({ value, label: value, literal: true })) }]
    }),
    edit: (n, command, data) => {
        if (!['fromType', 'toType'].includes(command))
            throw Error('Invalid conversion selection');
        const before = conversion.ports(n, { declaration: () => undefined });
        n.params[command] = String((0, node_sdk_1.payload)(data));
        return (0, node_sdk_1.reshapeInputs)(n, before, conversion.ports(n, { declaration: () => undefined }));
    },
    emit: (n, c) => ({ outputs: { out: String(n.params.toType) + '(' + c.input('value') + ')' } })
};
exports.default = conversion;

},
"nodes/cos":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.unaryNode)({
    "key": "cos",
    "label": "Cosine",
    "descriptionKey": "help.cos",
    "operator": "cos",
    "port": "value",
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "cos",
            "cosine",
            "餘弦"
        ],
        "glslName": "cos",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "trigonometry"
        ]
    }
});

},
"nodes/divide":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "divide",
        "label": "Divide",
        "inputs": {
            "a": "T",
            "b": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "inputDefaults": {
            "b": 1
        },
        "descriptionKey": "help.divide",
        "definitionUuid": "sgrape.builtin.divide"
    },
    "emitter": {
        "id": "divide",
        "version": 1
    },
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "/",
            "div",
            "除法"
        ],
        "glslName": "/",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "arithmetic"
        ]
    }
};
exports.default = (0, node_sdk_1.binaryNode)(catalog, '/');

},
"nodes/dot":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.numericCall)({
    "definition": {
        "key": "dot",
        "label": "Dot Product",
        "inputs": {
            "a": "T",
            "b": "T"
        },
        "outputs": {
            "out": "float"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec3"
        },
        "descriptionKey": "help.dot",
        "definitionUuid": "sgrape.builtin.dot"
    },
    "emitter": {
        "id": "dot",
        "version": 1,
        "call": {
            "operator": "dot",
            "ports": [
                "a",
                "b"
            ]
        }
    },
    "browser": {
        "category": "vector",
        "source": "glsl",
        "aliases": [
            "dot",
            "內積"
        ],
        "glslName": "dot",
        "secondaryCategories": [],
        "categoryPath": [
            "vector"
        ]
    }
});

},
"nodes/equal":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "equal",
        "label": "equal",
        "inputs": {
            "a": "vec2",
            "b": "vec2"
        },
        "outputs": {
            "out": "bvec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2"
        },
        "inputDefaults": {},
        "descriptionKey": "help.equal",
        "definitionUuid": "sgrape.builtin.equal",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "equal",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "equal"
        ],
        "glslName": "equal",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.vectors,
    ports: t => [(0, node_sdk_1.input)('a', t), (0, node_sdk_1.input)('b', t), (0, node_sdk_1.output)('out', node_sdk_1.values.shaped('bool', node_sdk_1.values.count(t)))],
    presentation: () => ({ selectorLabel: 'vector.inputType' }),
    emit: (_n, c) => ({ outputs: { out: 'equal(' + c.input('a') + ', ' + c.input('b') + ')' } })
});

},
"nodes/float":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "float",
        "label": "Float",
        "inputs": {},
        "outputs": {
            "out": "float"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "value": 0.5
        },
        "descriptionKey": "help.float",
        "definitionUuid": "sgrape.builtin.float"
    },
    "emitter": {
        "id": "float",
        "version": 1
    },
    "browser": {
        "category": "data",
        "source": "editor",
        "aliases": [
            "constant",
            "scalar",
            "常數",
            "浮點"
        ],
        "glslName": "float",
        "secondaryCategories": [],
        "categoryPath": [
            "data",
            "values"
        ]
    }
};
exports.default = (0, node_sdk_1.literalNode)(catalog, 'float');

},
"nodes/floor":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.unaryNode)({
    "key": "floor",
    "label": "Floor",
    "descriptionKey": "help.floor",
    "operator": "floor",
    "port": "value",
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "floor",
            "round down",
            "floor(A)"
        ],
        "glslName": "floor",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "range"
        ]
    }
});

},
"nodes/fract":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.unaryNode)({
    "key": "fract",
    "label": "Fraction",
    "descriptionKey": "help.fract",
    "operator": "fract",
    "port": "value",
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "fract",
            "fraction",
            "小數"
        ],
        "glslName": "fract",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "range"
        ]
    }
});

},
"nodes/function_call":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
// The common compiler expands this structural module using its declared role
// and graph reference. Only ordinary value modules need an emit callback.
const definition = {
    catalog: {
        definition: {
            key: 'function_call',
            label: 'Subgraph',
            definitionUuid: 'sgrape.function.call',
            inputs: {},
            outputs: {},
            stages: ['vertex', 'pixel'],
            defaults: {},
            descriptionKey: 'help.function'
        },
        emitter: {
            id: 'function_call',
            version: 1
        },
        browser: {}
    },
    structural: true,
    role: 'value',
    referencedGraph: node => String(node.params.functionId),
    reference: graphId => ({ functionId: graphId }),
    supports: (node, context) => { var _a; return (0, node_sdk_1.numericInterface)((_a = context.subgraph) === null || _a === void 0 ? void 0 : _a.call(context, String(node.params.functionId))); },
    ports: (node, context) => (0, node_sdk_1.subgraphPorts)((0, node_sdk_1.requireSubgraph)(context, String(node.params.functionId)), 'call'),
    presentation: (node, context) => (0, node_sdk_1.subgraphPresentation)((0, node_sdk_1.requireSubgraph)(context, String(node.params.functionId)), 'call'),
    validate: (node, context) => {
        (0, node_sdk_1.requireSubgraph)(context, String(node.params.functionId));
    }
};
exports.default = definition;

},
"nodes/function_input":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
// The common compiler expands this structural module using its declared role
// and graph reference. Only ordinary value modules need an emit callback.
const definition = {
    catalog: {
        definition: {
            key: 'function_input',
            label: 'Subgraph Input',
            definitionUuid: 'sgrape.function.input',
            inputs: {},
            outputs: {},
            stages: ['vertex', 'pixel'],
            defaults: {},
            descriptionKey: 'help.functionPorts'
        },
        emitter: {
            id: 'function_input',
            version: 1
        },
        browser: {}
    },
    structural: true,
    role: 'subgraph-input',
    supports: (node, context) => (0, node_sdk_1.numericInterface)(context.owner),
    ports: (node, context) => (0, node_sdk_1.subgraphPorts)((0, node_sdk_1.requireSubgraph)(context), 'input'),
    presentation: (node, context) => (0, node_sdk_1.subgraphPresentation)((0, node_sdk_1.requireSubgraph)(context), 'input'),
    validate: (node, context) => {
        (0, node_sdk_1.requireSubgraph)(context);
    }
};
exports.default = definition;

},
"nodes/function_output":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
// The common compiler expands this structural module using its declared role
// and graph reference. Only ordinary value modules need an emit callback.
const definition = {
    catalog: {
        definition: {
            key: 'function_output',
            label: 'Subgraph Output',
            definitionUuid: 'sgrape.function.output',
            inputs: {},
            outputs: {},
            stages: ['vertex', 'pixel'],
            defaults: {},
            descriptionKey: 'help.functionPorts'
        },
        emitter: {
            id: 'function_output',
            version: 1
        },
        browser: {}
    },
    structural: true,
    role: 'subgraph-output',
    supports: (node, context) => (0, node_sdk_1.numericInterface)(context.owner),
    ports: (node, context) => (0, node_sdk_1.subgraphPorts)((0, node_sdk_1.requireSubgraph)(context), 'output'),
    presentation: (node, context) => (0, node_sdk_1.subgraphPresentation)((0, node_sdk_1.requireSubgraph)(context), 'output'),
    validate: (node, context) => {
        (0, node_sdk_1.requireSubgraph)(context);
    }
};
exports.default = definition;

},
"nodes/greaterThan":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "greaterThan",
        "label": "greaterThan",
        "inputs": {
            "a": "vec2",
            "b": "vec2"
        },
        "outputs": {
            "out": "bvec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2"
        },
        "inputDefaults": {},
        "descriptionKey": "help.greaterThan",
        "definitionUuid": "sgrape.builtin.greaterThan",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "greaterThan",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "greaterThan"
        ],
        "glslName": "greaterThan",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.vectors.filter(t => node_sdk_1.values.family(t) !== 'bool'),
    ports: t => [(0, node_sdk_1.input)('a', t), (0, node_sdk_1.input)('b', t), (0, node_sdk_1.output)('out', node_sdk_1.values.shaped('bool', node_sdk_1.values.count(t)))],
    presentation: () => ({ selectorLabel: 'vector.inputType' }),
    emit: (_n, c) => ({ outputs: { out: 'greaterThan(' + c.input('a') + ', ' + c.input('b') + ')' } })
});

},
"nodes/greaterThanEqual":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "greaterThanEqual",
        "label": "greaterThanEqual",
        "inputs": {
            "a": "vec2",
            "b": "vec2"
        },
        "outputs": {
            "out": "bvec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2"
        },
        "inputDefaults": {},
        "descriptionKey": "help.greaterThanEqual",
        "definitionUuid": "sgrape.builtin.greaterThanEqual",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "greaterThanEqual",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "greaterThanEqual"
        ],
        "glslName": "greaterThanEqual",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.vectors.filter(t => node_sdk_1.values.family(t) !== 'bool'),
    ports: t => [(0, node_sdk_1.input)('a', t), (0, node_sdk_1.input)('b', t), (0, node_sdk_1.output)('out', node_sdk_1.values.shaped('bool', node_sdk_1.values.count(t)))],
    presentation: () => ({ selectorLabel: 'vector.inputType' }),
    emit: (_n, c) => ({ outputs: { out: 'greaterThanEqual(' + c.input('a') + ', ' + c.input('b') + ')' } })
});

},
"nodes/if":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "if",
        "label": "If",
        "inputs": {
            "condition": "bool",
            "true": "T",
            "false": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "inputDefaults": {
            "condition": false,
            "true": 1,
            "false": 0
        },
        "descriptionKey": "help.if",
        "definitionUuid": "sgrape.builtin.if"
    },
    "emitter": {
        "id": "if",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "editor",
        "aliases": [
            "branch",
            "conditional",
            "select",
            "ternary",
            "條件",
            "選擇"
        ],
        "glslName": "?:",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.types,
    ports: t => [(0, node_sdk_1.input)('condition', 'bool', false), (0, node_sdk_1.input)('true', t, 1), (0, node_sdk_1.input)('false', t), (0, node_sdk_1.output)('out', t)],
    emit: (_n, c) => ({ outputs: { out: '(' + c.input('condition') + ' ? ' + c.input('true') + ' : ' + c.input('false') + ')' } })
});

},
"nodes/isinf":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "isinf",
        "label": "isinf",
        "inputs": {
            "value": "float"
        },
        "outputs": {
            "out": "bool"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "inputDefaults": {},
        "descriptionKey": "help.isinf",
        "definitionUuid": "sgrape.builtin.isinf",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "isinf",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "isinf"
        ],
        "glslName": "isinf",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
const inputs = ['float', 'vec2', 'vec3', 'vec4'];
const outputs = ['bool', 'bvec2', 'bvec3', 'bvec4'];
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: inputs,
    ports: t => [(0, node_sdk_1.input)('value', t), (0, node_sdk_1.output)('out', node_sdk_1.values.shaped('bool', node_sdk_1.values.count(t)))],
    presentation: n => ({ selector: {
            value: outputs[inputs.indexOf(String(n.params.type))], options: outputs,
            command: 'output', label: 'vector.outputType'
        } }),
    edit: (n, command, data) => {
        var _a;
        const index = outputs.indexOf(String((0, node_sdk_1.payload)(data)));
        if (command !== 'output' || index < 0)
            throw Error('Invalid predicate output');
        const old = String(n.params.type);
        n.params.type = inputs[index];
        if (((_a = n.inputValues) === null || _a === void 0 ? void 0 : _a.value) !== undefined && old !== n.params.type)
            n.inputValues.value = node_sdk_1.values.reshape(n.inputValues.value, String(n.params.type));
        return n;
    },
    emit: (_n, c) => ({ outputs: { out: 'isinf(' + c.input('value') + ')' } })
});

},
"nodes/isnan":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "isnan",
        "label": "isnan",
        "inputs": {
            "value": "float"
        },
        "outputs": {
            "out": "bool"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "inputDefaults": {},
        "descriptionKey": "help.isnan",
        "definitionUuid": "sgrape.builtin.isnan",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "isnan",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "isnan"
        ],
        "glslName": "isnan",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
const inputs = ['float', 'vec2', 'vec3', 'vec4'];
const outputs = ['bool', 'bvec2', 'bvec3', 'bvec4'];
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: inputs,
    ports: t => [(0, node_sdk_1.input)('value', t), (0, node_sdk_1.output)('out', node_sdk_1.values.shaped('bool', node_sdk_1.values.count(t)))],
    presentation: n => ({ selector: {
            value: outputs[inputs.indexOf(String(n.params.type))], options: outputs,
            command: 'output', label: 'vector.outputType'
        } }),
    edit: (n, command, data) => {
        var _a;
        const index = outputs.indexOf(String((0, node_sdk_1.payload)(data)));
        if (command !== 'output' || index < 0)
            throw Error('Invalid predicate output');
        const old = String(n.params.type);
        n.params.type = inputs[index];
        if (((_a = n.inputValues) === null || _a === void 0 ? void 0 : _a.value) !== undefined && old !== n.params.type)
            n.inputValues.value = node_sdk_1.values.reshape(n.inputValues.value, String(n.params.type));
        return n;
    },
    emit: (_n, c) => ({ outputs: { out: 'isnan(' + c.input('value') + ')' } })
});

},
"nodes/length":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.numericCall)({
    "definition": {
        "key": "length",
        "label": "Length",
        "inputs": {
            "value": "T"
        },
        "outputs": {
            "out": "float"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec3"
        },
        "descriptionKey": "help.length",
        "definitionUuid": "sgrape.builtin.length"
    },
    "emitter": {
        "id": "length",
        "version": 1,
        "call": {
            "operator": "length",
            "ports": [
                "value"
            ]
        }
    },
    "browser": {
        "category": "vector",
        "source": "glsl",
        "aliases": [
            "length",
            "magnitude",
            "長度"
        ],
        "glslName": "length",
        "secondaryCategories": [],
        "categoryPath": [
            "vector"
        ]
    }
});

},
"nodes/lessThan":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "lessThan",
        "label": "lessThan",
        "inputs": {
            "a": "vec2",
            "b": "vec2"
        },
        "outputs": {
            "out": "bvec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2"
        },
        "inputDefaults": {},
        "descriptionKey": "help.lessThan",
        "definitionUuid": "sgrape.builtin.lessThan",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "lessThan",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "lessThan"
        ],
        "glslName": "lessThan",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.vectors.filter(t => node_sdk_1.values.family(t) !== 'bool'),
    ports: t => [(0, node_sdk_1.input)('a', t), (0, node_sdk_1.input)('b', t), (0, node_sdk_1.output)('out', node_sdk_1.values.shaped('bool', node_sdk_1.values.count(t)))],
    presentation: () => ({ selectorLabel: 'vector.inputType' }),
    emit: (_n, c) => ({ outputs: { out: 'lessThan(' + c.input('a') + ', ' + c.input('b') + ')' } })
});

},
"nodes/lessThanEqual":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "lessThanEqual",
        "label": "lessThanEqual",
        "inputs": {
            "a": "vec2",
            "b": "vec2"
        },
        "outputs": {
            "out": "bvec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2"
        },
        "inputDefaults": {},
        "descriptionKey": "help.lessThanEqual",
        "definitionUuid": "sgrape.builtin.lessThanEqual",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "lessThanEqual",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "lessThanEqual"
        ],
        "glslName": "lessThanEqual",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.vectors.filter(t => node_sdk_1.values.family(t) !== 'bool'),
    ports: t => [(0, node_sdk_1.input)('a', t), (0, node_sdk_1.input)('b', t), (0, node_sdk_1.output)('out', node_sdk_1.values.shaped('bool', node_sdk_1.values.count(t)))],
    presentation: () => ({ selectorLabel: 'vector.inputType' }),
    emit: (_n, c) => ({ outputs: { out: 'lessThanEqual(' + c.input('a') + ', ' + c.input('b') + ')' } })
});

},
"nodes/math":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
// The ordered fold owns its dynamic interface, editing rules and presentation.
const operators = { add: '+', subtract: '-', multiply: '*', divide: '/' };
const symbols = { add: '+', subtract: '−', multiply: '×', divide: '÷' };
const limit = 32;
const hasOperator = (value) => Object.prototype.hasOwnProperty.call(operators, value);
function count(n) {
    var _a;
    const value = (_a = n.params.inputCount) !== null && _a !== void 0 ? _a : 3;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 2 || value > limit)
        throw Error('Math supports 2–32 inputs');
    return value;
}
function stored(n) {
    var _a;
    const total = count(n), steps = (_a = n.params.steps) !== null && _a !== void 0 ? _a : Array.from({ length: total - 1 }, (_, i) => ({ operator: 'add', input: i + 1 }));
    if (!Array.isArray(steps) || steps.length !== total - 1)
        throw Error('Math requires one operation per additional input');
    for (const raw of steps) {
        const step = raw;
        if (!step || typeof step.operator !== 'string' || !hasOperator(step.operator) || typeof step.input !== 'number' || !Number.isInteger(step.input) || step.input < 0 || step.input >= total)
            throw Error('Invalid Math operand');
    }
    return steps;
}
function steps(n) {
    var _a, _b;
    const rows = stored(n), mode = (_a = n.params.mode) !== null && _a !== void 0 ? _a : 'steps', operation = (_b = n.params.operation) !== null && _b !== void 0 ? _b : 'add';
    if (!['steps', 'shared'].includes(String(mode)) || typeof operation !== 'string' || !hasOperator(operation))
        throw Error('Invalid Math operation');
    return mode === 'shared' ? rows.map((_, i) => ({ operator: operation, input: i + 1 })) : rows;
}
function name(index) { let value = index + 1, result = ''; while (value) {
    value--;
    result = String.fromCharCode(65 + value % 26) + result;
    value = Math.floor(value / 26);
} return result; }
function ports(n) { var _a; const t = (0, node_sdk_1.type)((_a = n.params.type) !== null && _a !== void 0 ? _a : 'float'); return [...Array.from({ length: count(n) }, (_, i) => ({ key: 'input' + i, direction: 'input', type: t, default: (0, node_sdk_1.fill)(0, t) })), { key: 'out', direction: 'output', type: t }]; }
function formula(n) { var _a; const rows = steps(n); return n.params.mode === 'shared' ? ['A', ...rows.map(s => name(s.input))].join(' ' + symbols[String((_a = n.params.operation) !== null && _a !== void 0 ? _a : 'add')] + ' ') : rows.reduce((text, s) => '(' + text + ' ' + symbols[s.operator] + ' ' + name(s.input) + ')', 'A'); }
const mathModule = {
    catalog: { definition: { key: 'math', label: 'Math', inputs: { input0: 'T', input1: 'T', input2: 'T' }, outputs: { out: 'T' }, stages: ['vertex', 'pixel'], defaults: { type: 'float', inputCount: 3, mode: 'steps', operation: 'add' }, descriptionKey: 'help.math', definitionUuid: 'sgrape.builtin.math' }, emitter: { id: 'math', version: 1 }, browser: { category: 'math', source: 'editor', aliases: ['chain', 'arithmetic', '連加', '連減', '連乘', '連除'], glslName: '', secondaryCategories: [], categoryPath: ['math', 'arithmetic'] } },
    role: 'value', supports: n => { var _a; return node_sdk_1.numericTypes.includes(String((_a = n.params.type) !== null && _a !== void 0 ? _a : 'float')); },
    ports, validate: n => { var _a; steps(n); (0, node_sdk_1.type)((_a = n.params.type) !== null && _a !== void 0 ? _a : 'float'); },
    configure: (n, selection) => { const before = ports(n); n.params.type = (0, node_sdk_1.selectedType)(n, selection); return (0, node_sdk_1.reshapeDefaults)(n, before, ports(n)); },
    edit: (n, command, payload) => {
        var _a, _b;
        const value = payload;
        if (command === 'mode' || command === 'operation')
            n.params[command] = (_a = value === null || value === void 0 ? void 0 : value.value) !== null && _a !== void 0 ? _a : '';
        else if (command === 'step') {
            const rows = stored(n).map(s => ({ ...s })), index = value === null || value === void 0 ? void 0 : value.index;
            if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= rows.length || !['operator', 'input'].includes((value === null || value === void 0 ? void 0 : value.field) || ''))
                throw Error('Invalid Math step');
            n.params.steps = rows.map((s, i) => { var _a; return i === index ? { ...s, [value.field]: (_a = value === null || value === void 0 ? void 0 : value.value) !== null && _a !== void 0 ? _a : null } : s; });
        }
        else if (command === 'append') {
            const total = count(n);
            n.params.steps = [...stored(n), { operator: 'add', input: total }];
            n.params.inputCount = total + 1;
        }
        else if (command === 'remove') {
            const total = count(n);
            n.params.steps = stored(n).slice(0, -1).map((s, i) => s.input === total - 1 ? { ...s, input: i + 1 } : s);
            n.params.inputCount = total - 1;
            (_b = n.inputValues) === null || _b === void 0 ? true : delete _b['input' + (total - 1)];
        }
        else
            throw Error('Unknown Math command');
        return n;
    },
    presentation: n => {
        var _a, _b, _c;
        const total = count(n), mode = String((_a = n.params.mode) !== null && _a !== void 0 ? _a : 'steps'), controls = [{ kind: 'select', key: 'mode', command: 'mode', label: 'math.mode', value: mode, options: ['steps', 'shared'].map(value => ({ value, label: 'math.' + value })) }];
        if (mode === 'shared')
            controls.push({ kind: 'select', key: 'operation', command: 'operation', label: 'math.operation', value: String((_b = n.params.operation) !== null && _b !== void 0 ? _b : 'add'), options: Object.keys(operators).map(value => ({ value, label: 'math.' + value })) });
        else
            stored(n).forEach((s, i) => controls.push({ kind: 'row', key: 'step' + i, label: String(i + 1), literal: true, prefix: i === 0 ? 'A' : 'math.previous', children: [
                    { kind: 'select', key: 'operator' + i, command: 'step', args: { index: i, field: 'operator' }, label: 'math.operation', value: s.operator, options: Object.entries(symbols).map(([value, label]) => ({ value, label, literal: true })) },
                    { kind: 'select', key: 'operand' + i, command: 'step', args: { index: i, field: 'input' }, label: 'math.operand', value: String(s.input), numeric: true, options: Array.from({ length: total }, (_, j) => ({ value: String(j), label: name(j), literal: true })) }
                ] }));
        controls.push({ kind: 'button', key: 'remove', command: 'remove', label: 'math.removeLast', disabled: total <= 2 }, { kind: 'hint', key: 'hint', label: 'math.noteHint' });
        return { controls, portLabels: { inputs: Object.fromEntries(Array.from({ length: total }, (_, i) => ['input' + i, name(i)])), outputs: { out: 'Result' } }, note: { key: 'mathFormula', text: formula(n) }, spare: { direction: 'input', key: 'input' + total, type: String((_c = n.params.type) !== null && _c !== void 0 ? _c : 'float'), command: 'append', count: total, limit, label: 'math.addInput', limitLabel: 'math.portLimit' } };
    },
    emit: (n, c) => ({ outputs: { out: steps(n).reduce((text, s) => '(' + text + ' ' + operators[s.operator] + ' ' + c.input('input' + s.input) + ')', c.input('input0')) } })
};
exports.default = mathModule;

},
"nodes/max":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.numericCall)({
    "definition": {
        "key": "max",
        "label": "Maximum",
        "inputs": {
            "a": "T",
            "b": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "descriptionKey": "help.max",
        "definitionUuid": "sgrape.builtin.max"
    },
    "emitter": {
        "id": "max",
        "version": 1,
        "call": {
            "operator": "max",
            "ports": [
                "a",
                "b"
            ]
        }
    },
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "max",
            "maximum",
            "最大"
        ],
        "glslName": "max",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "range"
        ]
    }
}, {
    "alternatives": {
        "b": [
            "T",
            "float"
        ]
    }
});

},
"nodes/min":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.numericCall)({
    "definition": {
        "key": "min",
        "label": "Minimum",
        "inputs": {
            "a": "T",
            "b": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "descriptionKey": "help.min",
        "definitionUuid": "sgrape.builtin.min"
    },
    "emitter": {
        "id": "min",
        "version": 1,
        "call": {
            "operator": "min",
            "ports": [
                "a",
                "b"
            ]
        }
    },
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "min",
            "minimum",
            "最小"
        ],
        "glslName": "min",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "range"
        ]
    }
}, {
    "alternatives": {
        "b": [
            "T",
            "float"
        ]
    }
});

},
"nodes/mix":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.numericCall)({
    "definition": {
        "key": "mix",
        "label": "Mix",
        "inputs": {
            "a": "T",
            "b": "T",
            "factor": "float"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec4"
        },
        "descriptionKey": "help.mix",
        "definitionUuid": "sgrape.builtin.mix"
    },
    "emitter": {
        "id": "mix",
        "version": 1,
        "call": {
            "operator": "mix",
            "defaults": { "factor": 0.5 },
            "ports": [
                "a",
                "b",
                "factor"
            ]
        }
    },
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "lerp",
            "interpolate",
            "插值"
        ],
        "glslName": "mix",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "interpolation"
        ]
    }
}, { alternatives: { factor: ['float', 'T'] } });

},
"nodes/multiply":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "multiply",
        "label": "Multiply",
        "inputs": {
            "a": "T",
            "b": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec4"
        },
        "descriptionKey": "help.multiply",
        "definitionUuid": "sgrape.builtin.multiply"
    },
    "emitter": {
        "id": "multiply",
        "version": 1
    },
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "*",
            "mul",
            "乘法"
        ],
        "glslName": "*",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "arithmetic"
        ]
    }
};
exports.default = (0, node_sdk_1.binaryNode)(catalog, '*');

},
"nodes/normalize":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.numericCall)({
    "definition": {
        "key": "normalize",
        "label": "Normalize",
        "inputs": {
            "value": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec3"
        },
        "inputDefaults": {
            "value": 1
        },
        "descriptionKey": "help.normalize",
        "definitionUuid": "sgrape.builtin.normalize"
    },
    "emitter": {
        "id": "normalize",
        "version": 1,
        "call": {
            "operator": "normalize",
            "ports": [
                "value"
            ]
        }
    },
    "browser": {
        "category": "vector",
        "source": "glsl",
        "aliases": [
            "normalize",
            "unit",
            "正規化"
        ],
        "glslName": "normalize",
        "secondaryCategories": [],
        "categoryPath": [
            "vector"
        ]
    }
});

},
"nodes/not":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "not",
        "label": "not",
        "inputs": {
            "value": "bvec2"
        },
        "outputs": {
            "out": "bvec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "bvec2"
        },
        "inputDefaults": {},
        "descriptionKey": "help.not",
        "definitionUuid": "sgrape.builtin.not",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "not",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "not"
        ],
        "glslName": "not",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: ['bvec2', 'bvec3', 'bvec4'],
    ports: t => [(0, node_sdk_1.input)('value', t), (0, node_sdk_1.output)('out', t)],
    presentation: () => ({ selectorLabel: 'vector.inputType' }),
    emit: (_n, c) => ({ outputs: { out: 'not(' + c.input('value') + ')' } })
});

},
"nodes/notEqual":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "notEqual",
        "label": "notEqual",
        "inputs": {
            "a": "vec2",
            "b": "vec2"
        },
        "outputs": {
            "out": "bvec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2"
        },
        "inputDefaults": {},
        "descriptionKey": "help.notEqual",
        "definitionUuid": "sgrape.builtin.notEqual",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "notEqual",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "notEqual"
        ],
        "glslName": "notEqual",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.vectors,
    ports: t => [(0, node_sdk_1.input)('a', t), (0, node_sdk_1.input)('b', t), (0, node_sdk_1.output)('out', node_sdk_1.values.shaped('bool', node_sdk_1.values.count(t)))],
    presentation: () => ({ selectorLabel: 'vector.inputType' }),
    emit: (_n, c) => ({ outputs: { out: 'notEqual(' + c.input('a') + ', ' + c.input('b') + ')' } })
});

},
"nodes/pixel_out":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "pixel_out",
        "label": "Color Output",
        "inputs": {
            "color": "vec4"
        },
        "outputs": {},
        "stages": [
            "pixel"
        ],
        "defaults": {},
        "descriptionKey": "help.pixel_out",
        "definitionUuid": "sgrape.builtin.pixel_out"
    },
    "emitter": {
        "id": "pixel_out",
        "version": 1
    },
    "browser": {
        "category": "shader",
        "source": "td",
        "aliases": [
            "output",
            "fragment",
            "輸出"
        ],
        "glslName": "pixel_out",
        "secondaryCategories": [],
        "categoryPath": [
            "shader",
            "stage"
        ]
    }
};
// TD TOP-specific capability and finishing belong to this node, not the SDK.
// MAT buffers and their optional finishing remain outside this migrated slice.
const flags = [
    'nativeFinishing',
    'convertColorSpace',
    'dither',
    'alphaTest'
];
exports.default = (0, node_sdk_1.outputNode)(catalog, {
    ports: [
        {
            key: 'color',
            direction: 'input',
            type: 'vec4',
            default: [0, 0, 0, 1]
        }
    ],
    supports: (n, c) => (!c.target || c.target === 'top') &&
        (n.params.type === undefined || node_sdk_1.numericTypes.includes(String(n.params.type))) &&
        !flags.some(k => n.params[k]) &&
        !(n.params.bufferCount && n.params.bufferCount !== 1),
    validate: n => {
        if (n.params.bufferCount !== undefined && n.params.bufferCount !== 1)
            throw Error('TOP has one color output');
        for (const k of flags)
            if (n.params[k] !== undefined && typeof n.params[k] !== 'boolean')
                throw Error('Output finishing must be a boolean');
    },
    emit: (_n, c) => ({
        outputs: {},
        statements: [
            '    vec4 sg_color = ' + c.input('color') + ';',
            '    fragColor = TDOutputSwizzle(sg_color);'
        ]
    })
});

},
"nodes/replace":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "replace",
        "label": "Replace",
        "inputs": {
            "value": "vec2",
            "x": "float",
            "y": "float"
        },
        "outputs": {
            "out": "vec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2",
            "groups": {},
            "components": [
                0,
                0,
                0,
                0
            ]
        },
        "descriptionKey": "help.replace",
        "definitionUuid": "sgrape.builtin.replace"
    },
    "emitter": {
        "id": "replace",
        "version": 1
    },
    "browser": {
        "category": "vector",
        "source": "glsl",
        "aliases": [
            "replace",
            "override",
            "components",
            "replace components"
        ],
        "glslName": "vecN",
        "secondaryCategories": [],
        "categoryPath": [
            "vector"
        ]
    }
};
exports.default = (0, node_sdk_1.vectorAssembly)(catalog, true);

},
"nodes/rgba":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "rgba",
        "label": "Compose RGBA",
        "inputs": {
            "rgb": "vec3",
            "alpha": "float"
        },
        "outputs": {
            "out": "vec4"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {},
        "descriptionKey": "help.rgba",
        "definitionUuid": "sgrape.builtin.rgba"
    },
    "emitter": {
        "id": "rgba",
        "version": 1
    },
    "browser": {
        "category": "color",
        "source": "editor",
        "aliases": [
            "combine",
            "compose",
            "rgba",
            "組合"
        ],
        "glslName": "rgba",
        "secondaryCategories": [],
        "categoryPath": [
            "color",
            "construct"
        ]
    }
};
exports.default = (0, node_sdk_1.staticNode)(catalog, {
    ports: () => [(0, node_sdk_1.input)('rgb', 'vec3'), (0, node_sdk_1.input)('alpha', 'float', 1), (0, node_sdk_1.output)('out', 'vec4')],
    emit: (_n, c) => ({ outputs: { out: 'vec4(' + c.input('rgb') + ', ' + c.input('alpha') + ')' } })
});

},
"nodes/round":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.unaryNode)({
    "key": "round",
    "label": "Round",
    "descriptionKey": "help.round",
    "operator": "round",
    "port": "value",
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "round",
            "nearest",
            "round(A)"
        ],
        "glslName": "round",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "range"
        ]
    }
});

},
"nodes/router":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "router",
        "label": "Router",
        "inputs": {
            "value": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "descriptionKey": "help.router",
        "definitionUuid": "sgrape.builtin.router"
    },
    "emitter": {
        "id": "router",
        "version": 1
    },
    "browser": {
        "category": "editor",
        "source": "editor",
        "aliases": [
            "reroute",
            "knot",
            "routing",
            "整理接線",
            "轉接",
            "路由"
        ],
        "glslName": "",
        "secondaryCategories": [],
        "categoryPath": [
            "editor"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.types,
    ports: t => [(0, node_sdk_1.input)('value', t), (0, node_sdk_1.output)('out', t)],
    emit: (_n, c) => ({ outputs: { out: c.input('value') } })
});

},
"nodes/scalar":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "scalar",
        "label": "Scalar",
        "inputs": {},
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float",
            "value": 0
        },
        "descriptionKey": "help.scalar",
        "definitionUuid": "sgrape.builtin.scalar"
    },
    "emitter": {
        "id": "scalar",
        "version": 1
    },
    "browser": {
        "category": "data",
        "source": "editor",
        "aliases": [
            "float",
            "int",
            "uint",
            "bool",
            "integer",
            "unsigned",
            "boolean",
            "value",
            "double"
        ],
        "glslName": "scalar",
        "secondaryCategories": [],
        "categoryPath": [
            "data",
            "values"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.scalars,
    ports: t => [(0, node_sdk_1.output)('out', t)],
    configure: (n, t) => { var _a; n.params.value = node_sdk_1.values.reshape((_a = n.params.value) !== null && _a !== void 0 ? _a : 0, t); return n; },
    edit: (n, command, data) => {
        if (!['component', 'value'].includes(command))
            throw Error('Unknown scalar command');
        const value = (0, node_sdk_1.payload)(data);
        node_sdk_1.values.literal(value, String(n.params.type));
        n.params.value = value;
        return n;
    },
    validate: n => { node_sdk_1.values.literal(n.params.value, String(n.params.type)); },
    presentation: n => ({ value: {
            value: n.params.value, type: String(n.params.type),
            componentCommand: 'component', valueCommand: 'value', names: 'X'
        } }),
    emit: n => ({ outputs: { out: node_sdk_1.values.literal(n.params.value, String(n.params.type)) } })
});

},
"nodes/sign":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.unaryNode)({
    "key": "sign",
    "label": "Sign",
    "descriptionKey": "help.sign",
    "operator": "sign",
    "port": "value",
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "sign",
            "signum",
            "sign(A)"
        ],
        "glslName": "sign",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "arithmetic"
        ]
    }
});

},
"nodes/sin":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.unaryNode)({
    "key": "sin",
    "label": "Sine",
    "descriptionKey": "help.sin",
    "operator": "sin",
    "port": "value",
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "sin",
            "sine",
            "正弦"
        ],
        "glslName": "sin",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "trigonometry"
        ]
    }
});

},
"nodes/smoothstep":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.numericCall)({
    "definition": {
        "key": "smoothstep",
        "label": "Smoothstep",
        "inputs": {
            "edge0": "T",
            "edge1": "T",
            "value": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "inputDefaults": {
            "edge1": 1
        },
        "descriptionKey": "help.smoothstep",
        "definitionUuid": "sgrape.builtin.smoothstep"
    },
    "emitter": {
        "id": "smoothstep",
        "version": 1,
        "call": {
            "operator": "smoothstep",
            "ports": [
                "edge0",
                "edge1",
                "value"
            ]
        }
    },
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "smoothstep",
            "平滑"
        ],
        "glslName": "smoothstep",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "interpolation"
        ]
    }
}, {
    "tuples": [
        {
            "edge0": "T",
            "edge1": "T",
            "value": "T"
        },
        {
            "edge0": "float",
            "edge1": "float",
            "value": "T"
        }
    ]
});

},
"nodes/split":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "split",
        "label": "Split RGBA",
        "inputs": {
            "color": "vec4"
        },
        "outputs": {
            "rgb": "vec3",
            "r": "float",
            "g": "float",
            "b": "float",
            "a": "float"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {},
        "descriptionKey": "help.split",
        "definitionUuid": "sgrape.builtin.split"
    },
    "emitter": {
        "id": "split",
        "version": 1
    },
    "browser": {
        "category": "color",
        "source": "editor",
        "aliases": [
            "split",
            "swizzle",
            "分量",
            "拆分"
        ],
        "glslName": "split",
        "secondaryCategories": [],
        "categoryPath": [
            "color",
            "construct"
        ]
    }
};
exports.default = (0, node_sdk_1.staticNode)(catalog, {
    ports: () => [(0, node_sdk_1.input)('color', 'vec4'), (0, node_sdk_1.output)('rgb', 'vec3'), ...'rgba'.split('').map(p => (0, node_sdk_1.output)(p, 'float'))],
    emit: (_n, c) => ({ outputs: Object.fromEntries(['rgb', ...'rgba'].map(p => [p, '(' + c.input('color') + ').' + p])) })
});

},
"nodes/sqrt":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.unaryNode)({
    "key": "sqrt",
    "label": "Sqrt",
    "descriptionKey": "help.sqrt",
    "operator": "sqrt",
    "port": "value",
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "sqrt",
            "square root",
            "sqrt(A)"
        ],
        "glslName": "sqrt",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "exponential"
        ]
    }
});

},
"nodes/subtract":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "subtract",
        "label": "Subtract",
        "inputs": {
            "a": "T",
            "b": "T"
        },
        "outputs": {
            "out": "T"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "float"
        },
        "descriptionKey": "help.subtract",
        "definitionUuid": "sgrape.builtin.subtract"
    },
    "emitter": {
        "id": "subtract",
        "version": 1
    },
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "-",
            "sub",
            "減法"
        ],
        "glslName": "-",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "arithmetic"
        ]
    }
};
exports.default = (0, node_sdk_1.binaryNode)(catalog, '-');

},
"nodes/swizzle":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "swizzle",
        "label": "Swizzle",
        "inputs": {
            "value": "vec2"
        },
        "outputs": {
            "out": "vec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2",
            "mask": "xy"
        },
        "descriptionKey": "help.swizzle",
        "definitionUuid": "sgrape.builtin.swizzle"
    },
    "emitter": {
        "id": "swizzle",
        "version": 1
    },
    "browser": {
        "category": "vector",
        "source": "glsl",
        "aliases": [
            "component mask",
            "reorder",
            "shuffle",
            "分量",
            "重排",
            "取分量"
        ],
        "glslName": "swizzle",
        "secondaryCategories": [],
        "categoryPath": [
            "vector"
        ]
    }
};
const axes = 'xyzw';
function mask(type, value) {
    if (typeof value !== 'string' || !value.length || value.length > 4 || [...value].some(p => !axes.slice(0, node_sdk_1.values.count(type)).includes(p)))
        throw Error('Choose existing vector components');
    return value;
}
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.vectors,
    creations: wire => {
        if (wire && !node_sdk_1.values.types.includes(wire.type))
            return undefined;
        const size = wire ? node_sdk_1.values.count(wire.type) : 2;
        return node_sdk_1.values.vectors.filter(t => node_sdk_1.values.count(t) >= size).map(type => ({ type, mask: axes.slice(0, size) }));
    },
    ports: (t, n) => { var _a; return [(0, node_sdk_1.input)('value', t), (0, node_sdk_1.output)('out', node_sdk_1.values.shaped(node_sdk_1.values.family(t), mask(t, (_a = n.params.mask) !== null && _a !== void 0 ? _a : 'xy').length))]; },
    presentation: n => {
        var _a;
        const t = String(n.params.type), selected = mask(t, (_a = n.params.mask) !== null && _a !== void 0 ? _a : 'xy');
        return { selectorLabel: 'vector.inputType', controls: [{
                    kind: 'row', key: 'mask', label: 'vector.componentOrder', children: [
                        ...[...selected].map((value, index) => ({ kind: 'select', key: 'component' + index, label: String(index + 1), literal: true, command: 'mask', args: { index }, value,
                            options: [...axes.slice(0, node_sdk_1.values.count(t))].map(value => ({ value, label: value.toUpperCase(), literal: true })) })),
                        { kind: 'button', key: 'remove', label: '−', literal: true, command: 'remove', disabled: selected.length === 1 },
                        { kind: 'button', key: 'add', label: '+', literal: true, command: 'add', disabled: selected.length === 4 }
                    ]
                }] };
    },
    edit: (n, command, data) => {
        var _a;
        const t = String(n.params.type), previous = mask(t, (_a = n.params.mask) !== null && _a !== void 0 ? _a : 'xy');
        if (command === 'add' && previous.length < 4)
            n.params.mask = previous + axes[Math.min(previous.length, node_sdk_1.values.count(t) - 1)];
        else if (command === 'remove' && previous.length > 1)
            n.params.mask = previous.slice(0, -1);
        else if (command === 'mask' && data && typeof data === 'object' && !Array.isArray(data)) {
            const i = Number(data.index), value = String((0, node_sdk_1.payload)(data));
            if (!Number.isInteger(i) || i < 0 || i >= previous.length || value.length !== 1)
                throw Error('Invalid swizzle component');
            n.params.mask = mask(t, previous.slice(0, i) + value + previous.slice(i + 1));
        }
        else
            throw Error('Invalid swizzle command');
        return n;
    },
    emit: (n, c) => { var _a; return ({ outputs: { out: '(' + c.input('value') + ').' + mask(String(n.params.type), (_a = n.params.mask) !== null && _a !== void 0 ? _a : 'xy') } }); }
});

},
"nodes/trunc":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
exports.default = (0, node_sdk_1.unaryNode)({
    "key": "trunc",
    "label": "Truncate",
    "descriptionKey": "help.trunc",
    "operator": "trunc",
    "port": "value",
    "browser": {
        "category": "math",
        "source": "glsl",
        "aliases": [
            "trunc",
            "truncate",
            "toward zero",
            "int(A)"
        ],
        "glslName": "trunc",
        "secondaryCategories": [],
        "categoryPath": [
            "math",
            "range"
        ]
    }
});

},
"nodes/uniform":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "uniform",
        "label": "Uniform",
        "inputs": {},
        "outputs": {
            "out": "D"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "declarationId": ""
        },
        "descriptionKey": "help.uniform",
        "definitionUuid": "sgrape.builtin.uniform"
    },
    "emitter": {
        "id": "uniform",
        "version": 1
    },
    "browser": {
        "category": "inputs",
        "source": "editor",
        "aliases": [
            "parameter",
            "參數",
            "公開"
        ],
        "glslName": "uniform",
        "secondaryCategories": [],
        "categoryPath": [
            "inputs",
            "uniforms"
        ]
    }
};
exports.default = (0, node_sdk_1.uniformNode)(catalog);

},
"nodes/vec2":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "vec2",
        "label": "Vector 2",
        "inputs": {},
        "outputs": {
            "out": "vec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "value": [
                0.5,
                0.5
            ]
        },
        "descriptionKey": "help.vec2",
        "definitionUuid": "sgrape.builtin.vec2"
    },
    "emitter": {
        "id": "vec2",
        "version": 1
    },
    "browser": {
        "category": "data",
        "source": "editor",
        "aliases": [
            "constant",
            "vec2",
            "常數"
        ],
        "glslName": "vec2",
        "secondaryCategories": [],
        "categoryPath": [
            "data",
            "values"
        ]
    }
};
exports.default = (0, node_sdk_1.literalNode)(catalog, 'vec2');

},
"nodes/vec3":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "vec3",
        "label": "Vector 3",
        "inputs": {},
        "outputs": {
            "out": "vec3"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "value": [
                1,
                1,
                1
            ]
        },
        "descriptionKey": "help.vec3",
        "definitionUuid": "sgrape.builtin.vec3"
    },
    "emitter": {
        "id": "vec3",
        "version": 1
    },
    "browser": {
        "category": "data",
        "source": "editor",
        "aliases": [
            "constant",
            "vec3",
            "常數"
        ],
        "glslName": "vec3",
        "secondaryCategories": [],
        "categoryPath": [
            "data",
            "values"
        ]
    }
};
exports.default = (0, node_sdk_1.literalNode)(catalog, 'vec3');

},
"nodes/vec4":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "vec4",
        "label": "Vector 4",
        "inputs": {},
        "outputs": {
            "out": "vec4"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "value": [
                0,
                0,
                0,
                0
            ]
        },
        "descriptionKey": "help.vec4",
        "definitionUuid": "sgrape.builtin.vec4"
    },
    "emitter": {
        "id": "vec4",
        "version": 1
    },
    "browser": {
        "category": "data",
        "source": "editor",
        "aliases": [
            "constant",
            "vec4",
            "常數",
            "四維向量"
        ],
        "glslName": "vec4",
        "secondaryCategories": [],
        "categoryPath": [
            "data",
            "values"
        ]
    }
};
exports.default = (0, node_sdk_1.literalNode)(catalog, 'vec4', true);

},
"nodes/vector":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "vector",
        "label": "Vector",
        "inputs": {},
        "outputs": {
            "out": "vec2"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2",
            "components": [
                0,
                0,
                0,
                0
            ]
        },
        "descriptionKey": "help.vector",
        "definitionUuid": "sgrape.builtin.vector"
    },
    "emitter": {
        "id": "vector",
        "version": 1
    },
    "browser": {
        "category": "vector",
        "source": "glsl",
        "aliases": [
            "vec2",
            "vec3",
            "vec4",
            "vector2",
            "vector3",
            "vector4",
            "value",
            "components",
            "dvec2",
            "dvec3",
            "dvec4"
        ],
        "glslName": "vecN",
        "secondaryCategories": [],
        "categoryPath": [
            "vector"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.vectors,
    ports: t => [(0, node_sdk_1.output)('out', t)],
    configure: (n, t) => { var _a; n.params.components = node_sdk_1.values.reshape((_a = n.params.components) !== null && _a !== void 0 ? _a : [0, 0, 0, 0], node_sdk_1.values.shaped(node_sdk_1.values.family(t), 4)); return n; },
    validate: n => { node_sdk_1.values.literal(n.params.components, node_sdk_1.values.shaped(node_sdk_1.values.family(String(n.params.type)), 4)); },
    edit: (n, command, data) => {
        const t = String(n.params.type), old = n.params.components;
        if (command === 'value') {
            const value = (0, node_sdk_1.payload)(data);
            node_sdk_1.values.literal(value, t);
            n.params.components = [...value, ...old.slice(node_sdk_1.values.count(t))];
        }
        else if (command === 'component' && data && typeof data === 'object' && !Array.isArray(data)) {
            const index = Number(data.index), value = (0, node_sdk_1.payload)(data);
            if (!Number.isInteger(index) || index < 0 || index >= node_sdk_1.values.count(t))
                throw Error('Invalid component');
            node_sdk_1.values.literal(value, node_sdk_1.values.family(t));
            old[index] = value;
        }
        else
            throw Error('Invalid vector command');
        return n;
    },
    presentation: n => {
        var _a;
        return ({ value: {
                value: n.params.components.slice(0, node_sdk_1.values.count(String(n.params.type))),
                type: String(n.params.type), componentCommand: 'component', valueCommand: 'value',
                names: String(((_a = n.ui) === null || _a === void 0 ? void 0 : _a.componentNames) || 'XYZW').toUpperCase(), expandable: true
            } });
    },
    emit: n => ({ outputs: { out: node_sdk_1.values.literal(n.params.components.slice(0, node_sdk_1.values.count(String(n.params.type))), String(n.params.type)) }, constant: true })
});

},
"nodes/vector_split":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "vector_split",
        "label": "Split",
        "inputs": {
            "value": "vec2"
        },
        "outputs": {
            "x": "float",
            "y": "float"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "vec2"
        },
        "descriptionKey": "help.vector_split",
        "definitionUuid": "sgrape.builtin.vector_split"
    },
    "emitter": {
        "id": "vector_split",
        "version": 1
    },
    "browser": {
        "category": "vector",
        "source": "glsl",
        "aliases": [
            "separate",
            "break",
            "components",
            "拆分",
            "分量",
            "UV"
        ],
        "glslName": "vector_split",
        "secondaryCategories": [],
        "categoryPath": [
            "vector"
        ]
    }
};
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: node_sdk_1.values.vectors,
    ports: t => [(0, node_sdk_1.input)('value', t), ...'xyzw'.slice(0, node_sdk_1.values.count(t)).split('').map(p => (0, node_sdk_1.output)(p, node_sdk_1.values.family(t)))],
    presentation: () => ({ selectorLabel: 'vector.inputType' }),
    emit: (n, c) => ({ outputs: Object.fromEntries('xyzw'.slice(0, node_sdk_1.values.count(String(n.params.type))).split('').map(p => [p, '(' + c.input('value') + ').' + p])) })
});

},
"numeric":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.types = void 0;
exports.type = type;
exports.count = count;
exports.number = number;
exports.literal = literal;
exports.fill = fill;
exports.types = ['float', 'vec2', 'vec3', 'vec4'];
function type(value) { if (!exports.types.includes(String(value)))
    throw Error('Unsupported numeric type'); return value; }
function count(t) { return t === 'float' ? 1 : Number(t.slice(-1)); }
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

},
"ports":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodePorts = void 0;
exports.compatible = compatible;
class NodePorts {
    constructor(specs) {
        const inputs = Object.create(null), outputs = Object.create(null);
        const inputTypes = {}, outputTypes = {};
        for (const spec of specs) {
            if (!spec.key || !spec.type || !['input', 'output'].includes(spec.direction))
                throw Error('Invalid port definition');
            const target = spec.direction === 'input' ? inputs : outputs;
            if (target[spec.key])
                throw Error('Duplicate port key: ' + spec.key);
            const value = spec.default && typeof spec.default === 'object' ? JSON.parse(JSON.stringify(spec.default)) : spec.default;
            const freeze = (v) => { if (v && typeof v === 'object') {
                Object.values(v).forEach(freeze);
                Object.freeze(v);
            } return v; };
            target[spec.key] = Object.freeze({ key: spec.key, direction: spec.direction, type: spec.type, default: value === undefined ? undefined : freeze(value) });
            (spec.direction === 'input' ? inputTypes : outputTypes)[spec.key] = spec.type;
        }
        this.inputs = Object.freeze(inputs);
        this.outputs = Object.freeze(outputs);
        this.projected = Object.freeze({ inputs: Object.freeze(inputTypes), outputs: Object.freeze(outputTypes) });
        Object.freeze(this);
    }
    types() {
        return this.projected;
    }
}
exports.NodePorts = NodePorts;
/** Connection policy belongs to the graph, not individual modules or widgets. */
function compatible(source, target, types, conversions) {
    return !!source && !!target && (source === target && types[source] !== undefined || conversions.some(v => v.from === source && v.to === target));
}

},
"scope_references":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeReferences = void 0;
const identifier = /^[A-Za-z][A-Za-z0-9_]{0,70}$/;
const opaque = new Set(['code', 'ui', 'source', 'origin', 'catalogSnapshot']);
const fields = new Set(['type', 'elementType', 'fromType', 'toType', 'fixedType', 'length']);
function token(scope, source) {
    const parts = [scope, ...source];
    if (parts.length !== 3 || !parts.every(p => identifier.test(p)))
        throw Error('Invalid scoped output reference');
    return 'sg_extent_' + [...parts.join('\0')]
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}
function reference(value) {
    if (typeof value !== 'string' || !/^sg_extent_(?:[0-9a-f]{2})+$/.test(value))
        return null;
    const parts = value.slice(10).match(/../g)
        .map(v => String.fromCharCode(parseInt(v, 16))).join('').split('\0');
    return parts.length === 3 && parts.every(p => identifier.test(p)) ?
        { scope: parts[0], source: [parts[1], parts[2]] } : null;
}
function walk(value, replace, mutate = true) {
    if (Array.isArray(value)) {
        value.forEach(v => walk(v, replace, mutate));
        return;
    }
    if (!value || typeof value !== 'object')
        return;
    const object = value;
    for (const [key, item] of Object.entries(object)) {
        if (fields.has(key) && typeof item === 'string') {
            const next = item.replace(/\bsg_extent_(?:[0-9a-f]{2})+\b/g, old => {
                const ref = reference(old);
                return ref ? replace(ref, old) : old;
            });
            if (mutate)
                object[key] = next;
        }
        else if (!opaque.has(key))
            walk(item, replace, mutate);
    }
}
exports.ScopeReferences = { token, reference, walk };

},
"subgraph_compiler":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubgraphCompiler = createSubgraphCompiler;
/** Compile graph-owned subgraphs through a bounded, disposable expansion.
 * Node modules own interfaces; no imported library or DOM state is consulted. */
const model_1 = require("./model");
const node_module_1 = require("./node_module");
const subgraph_interface_1 = require("./subgraph_interface");
const values_1 = require("./values");
const numeric_1 = require("./numeric");
const relay = {
    catalog: {
        definition: { key: 'subgraph_relay', definitionUuid: 'grape.internal.subgraph_relay', label: 'Subgraph value', inputs: {}, outputs: {}, stages: ['pixel'], defaults: {}, descriptionKey: '' },
        emitter: { id: 'subgraph_relay', version: 1 }, browser: {}
    },
    role: 'value',
    supports: n => values_1.types.includes(String(n.params.type)),
    ports: n => [
        { key: 'value', direction: 'input', type: String(n.params.type) },
        { key: 'out', direction: 'output', type: String(n.params.type) }
    ],
    validate: n => { (0, values_1.type)(n.params.type); },
    emit: (_n, c) => ({ outputs: { out: c.input('value') } })
};
function createSubgraphCompiler(registry, engineFactory) {
    const engine = engineFactory((0, node_module_1.createRegistry)([...registry.modules, relay]));
    const identity = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
    const moduleOf = (node) => registry.get(node.definitionUuid);
    function supports(g) {
        var _a, _b;
        if (g.schemaVersion !== 1 || g.target !== 'top' || Object.keys(g.stages).join() !== 'pixel' ||
            ((_a = g.topInputs) === null || _a === void 0 ? void 0 : _a.length) || ((_b = g.typeDefinitions) === null || _b === void 0 ? void 0 : _b.length) || !Array.isArray(g.functions) || g.functions.length > 64)
            return false;
        if (!g.declarations.every(d => d.kind === 'uniform' && numeric_1.types.includes(d.type) && !d.initialDriver && !d.sourceMissing && !['array', 'matrix'].includes(String(d.nativeSequence))))
            return false;
        const scopes = [[g.stages.pixel, undefined], ...g.functions.map(f => [f.graph, f])];
        return scopes.every(([data, owner]) => {
            var _a;
            if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length > 256 || data.edges.length > 1024 || ((_a = data.ui) === null || _a === void 0 ? void 0 : _a.frames))
                return false;
            if (owner && (!(0, subgraph_interface_1.numericInterface)(owner) || !Array.isArray(owner.stages) || !owner.stages.includes('pixel') || owner.targets && !owner.targets.includes('top')))
                return false;
            const context = (0, node_module_1.contextFor)(g, owner);
            return data.nodes.every(n => {
                const module = moduleOf(n);
                return !!module && !n.params.requireConstant && module.supports(n, context);
            });
        });
    }
    function compile(g, identifiers) {
        if (!supports(g))
            throw Error('Graph is outside the selected frontend compiler capability');
        if (JSON.stringify(g).length > 512000)
            throw Error('Graph is too large');
        const definitions = new Map();
        for (const f of g.functions) {
            if (!identity.test(f.id) || definitions.has(f.id))
                throw Error('Invalid or duplicate Subgraph ID');
            if (!['local', 'library', 'personal'].includes(f.scope) || typeof f.name !== 'string' || !f.name.length || f.name.length > 80)
                throw Error('Invalid Subgraph definition');
            (0, subgraph_interface_1.requireSubgraph)((0, node_module_1.contextFor)(g), f.id);
            definitions.set(f.id, f);
        }
        const active = new Set(), done = new Set();
        function visit(id) {
            var _a, _b;
            if (active.has(id))
                throw Error('Subgraph reference cycle: ' + id);
            if (done.has(id))
                return;
            const f = definitions.get(id);
            if (!f)
                throw Error('Missing Subgraph: ' + id);
            active.add(id);
            for (const n of f.graph.nodes) {
                const child = (_b = (_a = moduleOf(n)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n);
                if (child)
                    visit(child);
            }
            active.delete(id);
            done.add(id);
        }
        for (const id of definitions.keys())
            visit(id);
        function expanded(probe) {
            const flat = { nodes: [], edges: [] }, origins = new Map();
            const used = new Set(g.stages.pixel.nodes.flatMap(n => [n.id, n.name || n.id]));
            let sequence = 0;
            const allocate = () => { let id; do {
                id = 'sgf' + ++sequence;
            } while (used.has(id)); used.add(id); return id; };
            const location = (n, path) => ({ node: n.id, stage: 'pixel', trail: [...path], ...(path.length ? { functionId: path[path.length - 1] } : {}) });
            const add = (n, origin) => {
                if (flat.nodes.length >= 2048)
                    throw Error('Expanded Subgraph graph exceeds 2048 nodes');
                flat.nodes.push(n);
                origins.set(n.id, origin);
            };
            function expand(data, path, owner, boundary) {
                var _a, _b, _c, _d, _e, _f;
                const context = (0, node_module_1.contextFor)(g, owner), maps = new Map(), names = new Set();
                let inputCount = 0, outputCount = 0;
                for (const node of data.nodes) {
                    const origin = location(node, path);
                    try {
                        if (!identity.test(node.id) || maps.has(node.id))
                            throw Error('Invalid or duplicate node ID');
                        if (node.name !== undefined) {
                            if (!identifiers || !/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(node.name) || node.name.includes('__') || /^(gl_|TD|sTD|uTD|sg_|[iu]?sampler|[iu]?image|d?mat[234])/.test(node.name) || identifiers.reservedNames.includes(node.name) || names.has(node.name))
                                throw Error('Invalid or duplicate node name');
                            names.add(node.name);
                        }
                        const module = moduleOf(node);
                        module.validate(node, context);
                        const ports = (0, node_module_1.resolvePorts)(module, node, context);
                        const ref = (_a = module.referencedGraph) === null || _a === void 0 ? void 0 : _a.call(module, node);
                        if (module.role === 'subgraph-input' || module.role === 'subgraph-output') {
                            if (!boundary)
                                throw Error('Subgraph ports belong inside a Subgraph');
                            const endpoints = module.role === 'subgraph-input' ? boundary.inputs : boundary.outputs;
                            for (const endpoint of Object.values(endpoints)) {
                                const target = flat.nodes.find(n => n.id === endpoint[0]);
                                for (const key of ['label', 'comment']) {
                                    const value = (_b = node.ui) === null || _b === void 0 ? void 0 : _b[key];
                                    if (typeof value === 'string' && value.trim()) {
                                        target.ui || (target.ui = {});
                                        target.ui[key] = [target.ui[key], value].filter(Boolean).join('\n');
                                    }
                                }
                            }
                            if (module.role === 'subgraph-input' && Object.keys(node.inputValues || {}).length)
                                throw Error('Invalid Subgraph port defaults');
                            if (module.role === 'subgraph-input') {
                                inputCount++;
                                maps.set(node.id, { inputs: {}, outputs: boundary.inputs });
                            }
                            else {
                                outputCount++;
                                maps.set(node.id, { inputs: boundary.outputs, outputs: {} });
                                for (const [key, value] of Object.entries(node.inputValues || {})) {
                                    const endpoint = boundary.outputs[key];
                                    if (!endpoint)
                                        throw Error('Invalid Subgraph port defaults');
                                    flat.nodes.find(n => n.id === endpoint[0]).inputValues.value = (0, model_1.copy)(value);
                                    origins.set(endpoint[0], origin);
                                }
                            }
                        }
                        else if (ref) {
                            const fn = definitions.get(ref);
                            if (!fn)
                                throw Error('Missing Subgraph: ' + ref);
                            const mapped = { inputs: {}, outputs: {} }, inside = { inputs: {}, outputs: {} };
                            for (const key of Object.keys(node.inputValues || {}))
                                if (!ports.inputs[key])
                                    throw Error('Invalid Subgraph input values');
                            for (const direction of ['inputs', 'outputs'])
                                for (const p of fn[direction]) {
                                    const id = allocate();
                                    add({ id, definitionUuid: relay.catalog.definition.definitionUuid, params: { type: p.type },
                                        inputValues: { value: (0, model_1.copy)(direction === 'inputs' ? (_d = (_c = node.inputValues) === null || _c === void 0 ? void 0 : _c[p.id]) !== null && _d !== void 0 ? _d : p.default : p.default) },
                                        ...(node.ui ? { ui: (0, model_1.copy)(node.ui) } : {}) }, origin);
                                    mapped[direction][p.id] = [id, direction === 'inputs' ? 'value' : 'out'];
                                    inside[direction][p.id] = [id, direction === 'inputs' ? 'out' : 'value'];
                                }
                            maps.set(node.id, mapped);
                            expand(fn.graph, [...path, fn.id], fn, inside);
                        }
                        else {
                            if (owner && module.role === 'output')
                                throw Error('Use Subgraph boundaries inside a Subgraph');
                            const authored = (0, model_1.copy)(node), id = owner ? allocate() : node.id;
                            authored.id = id;
                            // Authored identifiers are scope-local; generated names remain unique.
                            if (owner && authored.name)
                                authored.name = (id + '_' + authored.name).slice(0, 48);
                            add(authored, origin);
                            maps.set(node.id, { inputs: Object.fromEntries(Object.keys(ports.inputs).map(p => [p, [id, p]])), outputs: Object.fromEntries(Object.keys(ports.outputs).map(p => [p, [id, p]])) });
                        }
                    }
                    catch (error) {
                        throw Object.assign(error instanceof Error ? error : Error(String(error)), origin);
                    }
                }
                if (owner && (inputCount !== 1 || outputCount !== 1))
                    throw Object.assign(Error('Exactly one Subgraph Input and Output are required'), { stage: 'pixel', trail: path, functionId: owner.id });
                for (const edge of data.edges) {
                    const from = (_e = maps.get(edge.from[0])) === null || _e === void 0 ? void 0 : _e.outputs[edge.from[1]], to = (_f = maps.get(edge.to[0])) === null || _f === void 0 ? void 0 : _f.inputs[edge.to[1]];
                    if (!from || !to)
                        throw Object.assign(Error('Connection endpoint no longer exists'), { node: edge.to[0], stage: 'pixel', trail: path, ...(owner ? { functionId: owner.id } : {}) });
                    flat.edges.push({ from, to });
                }
            }
            if (probe) {
                const inside = { inputs: {}, outputs: {} };
                for (const direction of ['inputs', 'outputs'])
                    for (const p of probe[direction]) {
                        const id = allocate();
                        add({ id, definitionUuid: relay.catalog.definition.definitionUuid, params: { type: p.type }, inputValues: { value: (0, model_1.copy)(p.default) } }, { node: '', stage: 'pixel', trail: [probe.id], functionId: probe.id });
                        inside[direction][p.id] = [id, direction === 'inputs' ? 'out' : 'value'];
                    }
                expand(probe.graph, [probe.id], probe, inside);
                const output = registry.modules.find(m => m.role === 'output');
                add({ id: allocate(), definitionUuid: output.catalog.definition.definitionUuid, params: (0, model_1.copy)(output.catalog.definition.defaults) }, { node: '', stage: 'pixel', trail: [] });
            }
            else
                expand(g.stages.pixel, []);
            const { functions, ...rest } = g;
            const document = { ...rest, stages: { pixel: flat } };
            try {
                const result = engine.compile(document, identifiers);
                return { ...result,
                    sourceMap: { pixel: result.sourceMap.pixel.map(row => ({ ...row, ...origins.get(row.node) })) },
                    diagnostics: result.diagnostics.map(row => ({ ...row, ...origins.get(row.node) })) };
            }
            catch (error) {
                const e = error;
                const origin = e.node && origins.get(e.node);
                if (origin)
                    Object.assign(e, origin);
                throw e;
            }
        }
        // Retain validation of unused saved definitions; they are editable content.
        for (const fn of definitions.values())
            expanded(fn);
        return expanded();
    }
    return { supports, compile };
}

},
"subgraph_copies":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendSubgraphs = appendSubgraphs;
exports.localizeSubgraph = localizeSubgraph;
exports.independentSubgraph = independentSubgraph;
const model_1 = require("./model");
const subgraph_operations_1 = require("./subgraph_operations");
const scope_references_1 = require("./scope_references");
const validId = (id) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(id);
const reference = (graph, n) => { var _a, _b; return (_b = (_a = graph.registry.get(n.definitionUuid)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n); };
function parameters(graph, n, id) {
    var _a;
    const module = graph.registry.get(n.definitionUuid);
    if (!(module === null || module === void 0 ? void 0 : module.reference))
        throw Error('Subgraph module cannot redirect its reference');
    const params = { ...(0, model_1.copy)(n.params), ...(0, model_1.copy)(module.reference(id)) };
    if (((_a = module.referencedGraph) === null || _a === void 0 ? void 0 : _a.call(module, { ...n, params })) !== id)
        throw Error('Subgraph reference operation disagrees with its module');
    return params;
}
function remapScopes(value, ids) {
    scope_references_1.ScopeReferences.walk(value, (ref, old) => {
        const id = ref.scope.startsWith('fn_') && ids.get(ref.scope.slice(3));
        return id ? scope_references_1.ScopeReferences.token('fn_' + id, ref.source) : old;
    });
}
function allocate(used, next) {
    const id = next();
    if (!validId(id) || used.has(id))
        throw Error('Invalid or duplicate Subgraph identity');
    used.add(id);
    return id;
}
/** Receive authored definitions, not Library files. The adapter decides which
 * versions to reuse and supplies any ID mapping. All mutation stays here. */
function appendSubgraphs(graph, definitions, ids = new Map()) {
    var _a;
    graph.assertEditable();
    (0, subgraph_operations_1.ensureSubgraphCapacity)(graph, definitions.length);
    const pending = definitions.map(f => (0, model_1.copy)(f)), used = new Set((graph.document.functions || []).map(f => f.id));
    const originalIds = new Set();
    for (const f of pending) {
        if (originalIds.has(f.id))
            throw Error('Duplicate Subgraph identity');
        originalIds.add(f.id);
        f.id = ids.get(f.id) || f.id;
        if (used.has(f.id))
            throw Error('Duplicate Subgraph identity');
        used.add(f.id);
        for (const n of f.graph.nodes) {
            const old = reference(graph, n), mapped = old && ids.get(old);
            if (mapped)
                n.params = parameters(graph, n, mapped);
        }
        remapScopes(f, ids);
        (0, subgraph_operations_1.validateSubgraphData)(f);
    }
    const all = new Map([...(graph.document.functions || []), ...pending].map(f => [f.id, f]));
    const active = new Set(), done = new Set();
    const visit = (id) => {
        if (active.has(id))
            throw Error('Subgraph reference cycle');
        if (done.has(id))
            return;
        const f = all.get(id);
        if (!f)
            throw Error('Missing nested Subgraph');
        active.add(id);
        for (const n of f.graph.nodes) {
            const child = reference(graph, n);
            if (child)
                visit(child);
        }
        active.delete(id);
        done.add(id);
    };
    pending.forEach(f => visit(f.id));
    if (pending.length)
        ((_a = graph.document).functions || (_a.functions = [])).push(...pending);
    return pending;
}
/** Turn a source-owned definition and its source callers into editable local
 * copies. Stored source snapshots remain byte-for-byte authored data. */
function localizeSubgraph(graph, id, next) {
    graph.assertEditable();
    const definitions = graph.document.functions || [], target = definitions.find(f => f.id === id);
    if (!target || target.scope === 'local')
        return new Map();
    const affected = new Set([id]);
    let added = true;
    while (added) {
        added = false;
        for (const f of definitions) {
            if (f.scope === 'local' || affected.has(f.id))
                continue;
            let depends = f.graph.nodes.some(n => affected.has(reference(graph, n) || ''));
            scope_references_1.ScopeReferences.walk(f, (ref, old) => { if (ref.scope.startsWith('fn_') && affected.has(ref.scope.slice(3)))
                depends = true; return old; }, false);
            if (depends) {
                affected.add(f.id);
                added = true;
            }
        }
    }
    (0, subgraph_operations_1.ensureSubgraphCapacity)(graph, affected.size);
    const ids = new Map(), used = new Set(definitions.map(f => f.id));
    for (const old of affected)
        ids.set(old, allocate(used, next));
    const changed = definitions.filter(f => affected.has(f.id)), snapshots = changed.map(f => (0, model_1.copy)(f));
    const writable = definitions.filter(f => f.scope === 'local' || affected.has(f.id));
    const networks = [...Object.values(graph.document.stages), ...writable.map(f => f.graph)];
    const patches = [];
    for (const data of networks)
        for (const n of data.nodes) {
            const old = reference(graph, n), mapped = old && ids.get(old);
            if (mapped)
                patches.push({ node: n, params: parameters(graph, n, mapped) });
        }
    // Prepare all IDs, snapshots and module commands before the first write.
    // Keep node/data objects alive for current editor callbacks during migration.
    for (const f of changed) {
        f.id = ids.get(f.id);
        f.scope = 'local';
        if (f.source || f.origin)
            f.origin = (0, model_1.copy)(f.source || f.origin);
        delete f.source;
    }
    for (const p of patches)
        p.node.params = p.params;
    remapScopes([...Object.values(graph.document.stages), ...writable, graph.document.typeDefinitions || []], ids);
    definitions.push(...snapshots);
    return ids;
}
/** Copy only this instance's definition. Nested children remain shared, as
 * before; the graph already owns their complete content. */
function independentSubgraph(network, nodeId, next) {
    var _a;
    network.assertEditable();
    const graph = network.graph, n = network.nodeData(nodeId);
    if (!n)
        throw Error('Subgraph instance no longer exists');
    const id = reference(graph, n), source = (_a = graph.document.functions) === null || _a === void 0 ? void 0 : _a.find(f => f.id === id);
    if (!source)
        return null;
    (0, subgraph_operations_1.ensureSubgraphCapacity)(graph, 1);
    const newId = allocate(new Set(graph.document.functions.map(f => f.id)), next);
    const f = (0, model_1.copy)(source);
    f.id = newId;
    f.name = f.name.slice(0, 75) + ' Copy';
    f.scope = 'local';
    if (f.source || f.origin)
        f.origin = (0, model_1.copy)(f.source || f.origin);
    delete f.source;
    remapScopes(f, new Map([[source.id, newId]]));
    const params = parameters(graph, n, newId);
    const owned = appendSubgraphs(graph, [f])[0];
    n.params = params;
    return owned;
}

},
"subgraph_interface":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.numericInterface = numericInterface;
exports.requireSubgraph = requireSubgraph;
exports.subgraphPorts = subgraphPorts;
exports.subgraphPresentation = subgraphPresentation;
const values_1 = require("./values");
function numericInterface(f) {
    return !!f && ['inputs', 'outputs'].every(key => Array.isArray(f[key]) &&
        f[key].every(p => values_1.types.includes(p.type)));
}
function requireSubgraph(context, id) {
    var _a;
    const f = id === undefined ? context.owner : (_a = context.subgraph) === null || _a === void 0 ? void 0 : _a.call(context, id);
    if (!f)
        throw Error('Missing Subgraph definition');
    for (const ports of [f.inputs, f.outputs]) {
        if (ports.length > 16)
            throw Error('Subgraph supports at most 16 ports per direction');
        const seen = new Set();
        for (const p of ports) {
            if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(p.id) || seen.has(p.id))
                throw Error('Invalid or duplicate Subgraph port');
            seen.add(p.id);
            (0, values_1.literal)(p.default, (0, values_1.type)(p.type));
        }
    }
    return f;
}
function subgraphPorts(f, kind) {
    const ports = [];
    if (kind === 'call' || kind === 'input')
        for (const p of f.inputs)
            ports.push({ key: p.id, direction: kind === 'input' ? 'output' : 'input', type: p.type, default: p.default });
    if (kind === 'call' || kind === 'output')
        for (const p of f.outputs)
            ports.push({ key: p.id, direction: kind === 'output' ? 'input' : 'output', type: p.type, default: p.default });
    return ports;
}
function subgraphPresentation(f, kind) {
    const names = (ports) => Object.fromEntries(ports.map(p => [p.id, p.name || p.id]));
    return {
        ...(kind === 'call' ? {
            label: f.name,
            descriptionKey: f.scope === 'local' ? 'help.function' : f.descriptionKey || 'help.function'
        } : {}),
        portLabels: kind === 'call' ? { inputs: names(f.inputs), outputs: names(f.outputs) } :
            kind === 'input' ? { outputs: names(f.inputs) } : { inputs: names(f.outputs) }
    };
}

},
"subgraph_operations":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSubgraphCapacity = ensureSubgraphCapacity;
exports.validateSubgraphData = validateSubgraphData;
exports.insertSubgraph = insertSubgraph;
exports.createSubgraph = createSubgraph;
exports.instantiateSubgraph = instantiateSubgraph;
exports.groupSubgraph = groupSubgraph;
exports.collectSubgraphs = collectSubgraphs;
const model_1 = require("./model");
const scope_references_1 = require("./scope_references");
const values_1 = require("./values");
const validId = (id) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(id);
function structural(graph, role) {
    const matches = graph.registry.modules.filter(m => m.structural &&
        (role === 'call' ? !!m.reference : m.role === 'subgraph-' + role));
    if (matches.length !== 1)
        throw Error('Subgraph structural module is unavailable or ambiguous');
    return matches[0];
}
function authored(module, id, ui, params = {}) {
    const d = module.catalog.definition;
    return { id, definitionUuid: d.definitionUuid, params: { ...(0, model_1.copy)(d.defaults), ...params }, ui };
}
function ensureSubgraphCapacity(graph, additional = 0) {
    var _a;
    if (!Number.isInteger(additional) || additional < 0)
        throw Error('Invalid definition count');
    if ((((_a = graph.document.functions) === null || _a === void 0 ? void 0 : _a.length) || 0) + additional > 64)
        throw Object.assign(Error('At most 64 Subgraph definitions are supported'), { code: 'function.limit' });
}
function validateSubgraphData(f) {
    if (!validId(f.id))
        throw Error('Invalid Subgraph identity');
    if (!f.name.trim() || f.name.length > 80 || /[\x00-\x1f\x7f]/.test(f.name))
        throw Error('Invalid Subgraph name');
    if (!['local', 'library', 'personal'].includes(f.scope) || !f.stages.length || f.stages.some(s => !['vertex', 'pixel'].includes(s)))
        throw Error('Invalid Subgraph scope or stage');
    for (const ports of [f.inputs, f.outputs]) {
        if (ports.length > 16 || new Set(ports.map(p => p.id)).size !== ports.length ||
            ports.some(p => !validId(p.id) || typeof p.type !== 'string' || !p.type || p.default === undefined))
            throw Error('Invalid Subgraph interface');
    }
    const ids = new Set(f.graph.nodes.map(n => n.id));
    if (ids.size !== f.graph.nodes.length || f.graph.nodes.length > 256 || f.graph.edges.length > 1024 ||
        [...ids].some(id => !validId(id)))
        throw Error('Invalid Subgraph network');
    for (const e of f.graph.edges)
        if (!ids.has(e.from[0]) || !ids.has(e.to[0]))
            throw Error('Invalid Subgraph edge endpoint');
}
function validate(graph, f) {
    var _a;
    graph.assertEditable();
    ensureSubgraphCapacity(graph, 1);
    if (f.scope !== 'local' || ((_a = graph.document.functions) === null || _a === void 0 ? void 0 : _a.some(d => d.id === f.id)))
        throw Error('Invalid or duplicate local Subgraph identity');
    validateSubgraphData(f);
}
function insertSubgraph(graph, f) {
    var _a;
    validate(graph, f);
    const owned = (0, model_1.copy)(f);
    ((_a = graph.document).functions || (_a.functions = [])).push(owned);
    return owned;
}
function createSubgraph(graph, options) {
    const input = structural(graph, 'input'), output = structural(graph, 'output');
    return insertSubgraph(graph, {
        id: options.id, name: options.name, scope: 'local', stages: [options.stage],
        inputs: [{ id: 'value', name: 'Value', type: 'vec4', default: [1, 1, 1, 1] }],
        outputs: [{ id: 'value', name: 'Value', type: 'vec4', default: [0, 0, 0, 1] }],
        graph: { nodes: [{ ...authored(input, 'input', { x: 48, y: 144 }), name: 'Input' }, { ...authored(output, 'output', { x: 624, y: 144 }), name: 'Output' }],
            edges: [{ from: ['input', 'value'], to: ['output', 'value'] }] }
    });
}
function instantiateSubgraph(network, definitionId, id, ui = {}) {
    var _a;
    network.assertEditable();
    const graph = network.graph, f = (_a = graph.document.functions) === null || _a === void 0 ? void 0 : _a.find(f => f.id === definitionId);
    if (!f)
        throw Error('Subgraph definition no longer exists');
    const module = structural(graph, 'call');
    const n = authored(module, id, (0, model_1.copy)(ui), module.reference(definitionId));
    // Structural graph editing also preserves interfaces whose compiler has not
    // migrated yet. Their descriptions remain the explicit editor adapter's job.
    return network.insertFragment({ nodes: [n], edges: [] }, { unavailable: 'preserve' })[0].data;
}
function defaultValue(type, options) {
    if (options.defaultValue)
        return options.defaultValue(type);
    if (values_1.types.includes(type))
        return (0, values_1.fill)(0, type);
    throw Error('A default value description is required for ' + type);
}
/** Extract selected graph content. UI supplies selection and view metadata;
 * the model owns interface deduplication, rewiring and reference relocation. */
function groupSubgraph(network, selection, options) {
    var _a, _b, _c, _d, _e;
    network.assertEditable();
    const graph = network.graph, data = network.data;
    const chosen = data.nodes.filter(n => selection.has(n.id)), ids = new Set(chosen.map(n => n.id));
    if (!chosen.length || chosen.length !== selection.size)
        throw Error('Invalid Subgraph selection');
    if (!validId(options.callId) || data.nodes.some(n => n.id === options.callId))
        throw Error('Invalid or duplicate instance identity');
    if (chosen.some(n => {
        var _a;
        const role = (_a = graph.registry.get(n.definitionUuid)) === null || _a === void 0 ? void 0 : _a.role;
        return role && role !== 'value';
    }))
        throw Error('Stage outputs and Subgraph boundaries cannot be grouped');
    const unique = (base) => { let id = base, i = 0; while (ids.has(id))
        id = base + '_' + ++i; ids.add(id); return id; };
    const inputId = unique('input'), outputId = unique('output');
    // Boundary IDs are not members of the original selection.
    const selected = new Set(chosen.map(n => n.id));
    const inputs = [], outputs = [], edges = [], outside = [];
    const incoming = new Map(), outgoing = new Map();
    const byId = new Map(data.nodes.map(n => [n.id, n]));
    const port = (n, direction, key) => {
        var _a;
        const projected = network.node(n.id).interface;
        const spec = (direction === 'input' ? projected.inputs : projected.outputs)[key] || ((_a = options.port) === null || _a === void 0 ? void 0 : _a.call(options, n, direction, key));
        if (!spec)
            throw Error('Missing Subgraph endpoint description');
        return spec;
    };
    for (const edge of data.edges) {
        const e = (0, model_1.copy)(edge), a = selected.has(e.from[0]), b = selected.has(e.to[0]);
        if (a && b) {
            edges.push(e);
            continue;
        }
        if (!a && !b) {
            outside.push(e);
            continue;
        }
        if (b) {
            const n = byId.get(e.to[0]), spec = port(n, 'input', e.to[1]);
            const key = JSON.stringify([e.from, spec.type]);
            if (!incoming.has(key)) {
                const id = 'in' + (inputs.length + 1);
                incoming.set(key, id);
                const value = (_c = (_b = (_a = n.inputValues) === null || _a === void 0 ? void 0 : _a[e.to[1]]) !== null && _b !== void 0 ? _b : spec.default) !== null && _c !== void 0 ? _c : defaultValue(spec.type, options);
                inputs.push({ id, name: ((_d = options.inputName) === null || _d === void 0 ? void 0 : _d.call(options, byId.get(e.from[0]), e.from[1], e.to[1])) || e.to[1], type: spec.type, default: (0, model_1.copy)(value) });
                outside.push({ ...e, to: [options.callId, id] });
            }
            edges.push({ ...e, from: [inputId, incoming.get(key)] });
        }
        else {
            const n = byId.get(e.from[0]), spec = port(n, 'output', e.from[1]), key = JSON.stringify(e.from);
            if (!outgoing.has(key)) {
                const id = 'out' + (outputs.length + 1);
                outgoing.set(key, id);
                outputs.push({ id, name: e.from[1], type: spec.type, default: defaultValue(spec.type, options) });
                edges.push({ ...e, to: [outputId, id] });
            }
            outside.push({ ...e, from: [options.callId, outgoing.get(key)] });
        }
    }
    const coordinate = (n, key) => { var _a, _b; return Number((_b = (_a = n.ui) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : 0); };
    const x = Math.min(...chosen.map(n => coordinate(n, 'x'))), y = Math.min(...chosen.map(n => coordinate(n, 'y')));
    const nodes = chosen.map(n => ({ ...(0, model_1.copy)(n), ui: { ...(0, model_1.copy)(n.ui || {}), x: coordinate(n, 'x') - x + 288, y: coordinate(n, 'y') - y + 144 } }));
    const boundary = (role, id, ui) => {
        const n = authored(structural(graph, role), id, ui), base = role === 'input' ? 'Input' : 'Output';
        n.name = base;
        let suffix = 0;
        while (nodes.some(v => v.name === n.name))
            n.name = base + '_' + ++suffix;
        nodes.push(n);
    };
    boundary('input', inputId, { x: 24, y: 144 });
    boundary('output', outputId, { x: Math.max(...nodes.map(n => Number(n.ui.x))) + 288, y: 144 });
    const f = { id: options.id, name: options.name, scope: 'local', stages: [options.stage], inputs, outputs,
        graph: { nodes, edges, ...(options.ui ? { ui: (0, model_1.copy)(options.ui) } : {}) } };
    validate(graph, f);
    const callModule = structural(graph, 'call');
    const call = authored(callModule, options.callId, { x, y }, callModule.reference(f.id));
    const owner = (_e = graph.document.functions) === null || _e === void 0 ? void 0 : _e.find(f => f.graph === data), oldScope = owner ? 'fn_' + owner.id : network.id;
    insertSubgraph(graph, f);
    // A move must not collect definitions used by the nodes it is moving.
    data.nodes = data.nodes.filter(n => !selected.has(n.id));
    data.nodes.push(call);
    data.edges = outside;
    scope_references_1.ScopeReferences.walk(graph.document, (ref, old) => ref.scope === oldScope && selected.has(ref.source[0]) ?
        scope_references_1.ScopeReferences.token('fn_' + f.id, ref.source) : old);
    return call;
}
/** Collect only the dependency closure of removed instances. Other reusable
 * definitions and the active scope remain independent graph documents. */
function collectSubgraphs(graph, roots, active) {
    if (!roots.length)
        return;
    const definitions = new Map((graph.document.functions || []).map(f => [f.id, f]));
    const references = (value) => {
        const result = new Set();
        function scan(item) {
            var _a, _b;
            if (Array.isArray(item)) {
                item.forEach(scan);
                return;
            }
            if (!item || typeof item !== 'object')
                return;
            const n = item;
            if (n.definitionUuid && n.params) {
                const ref = (_b = (_a = graph.registry.get(n.definitionUuid)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n);
                if (ref)
                    result.add(ref);
            }
            for (const [key, child] of Object.entries(item))
                if (!['ui', 'source', 'origin', 'code', 'catalogSnapshot'].includes(key))
                    scan(child);
        }
        scan(value);
        scope_references_1.ScopeReferences.walk(value, (ref, old) => { if (ref.scope.startsWith('fn_'))
            result.add(ref.scope.slice(3)); return old; }, false);
        return result;
    };
    const dependencies = new Map([...definitions].map(([id, f]) => [id, references(f)]));
    const closure = (seeds) => {
        const seen = new Set(), pending = [...seeds];
        while (pending.length) {
            const id = pending.pop();
            if (seen.has(id))
                continue;
            seen.add(id);
            pending.push(...(dependencies.get(id) || []));
        }
        return seen;
    };
    const candidates = closure(roots), retained = references({ ...graph.document, functions: [], catalogSnapshot: undefined });
    for (const [id, f] of definitions)
        if (!candidates.has(id) || f.graph === active)
            retained.add(id);
    const keep = closure(retained);
    graph.document.functions = (graph.document.functions || []).filter(f => !candidates.has(f.id) || keep.has(f.id));
}

},
"subgraphs":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subgraph = void 0;
const model_1 = require("./model");
const values_1 = require("./values");
/** One graph-owned definition and all its instances. Source edits first use
 * the graph's localization operation to preserve their stored snapshot. */
class Subgraph {
    constructor(graph, id) {
        this.graph = graph;
        this.id = id;
    }
    get data() {
        var _a;
        return (_a = this.graph.document.functions) === null || _a === void 0 ? void 0 : _a.find(f => f.id === this.id);
    }
    rename(name) {
        this.graph.assertEditable();
        const f = this.data;
        if (!f || f.scope !== 'local')
            throw Error('Rename a local Subgraph definition');
        if (!name.trim() || name.length > 80 || /[\x00-\x1f\x7f]/.test(name))
            throw Error('Invalid Subgraph name');
        f.name = name.trim();
    }
    editInterface(direction, edit) {
        this.graph.assertEditable();
        const f = this.data;
        if (!f || f.scope !== 'local')
            throw Error('Edit a local Subgraph definition');
        const list = f[direction];
        if (!Array.isArray(list))
            throw Error('Invalid Subgraph interface');
        const next = (0, model_1.copy)(list);
        const index = edit.kind === 'add' ? -1 : next.findIndex(p => p.id === edit.id);
        if (edit.kind !== 'add' && index < 0)
            throw Error('Subgraph port no longer exists');
        if (edit.kind === 'add')
            next.push((0, model_1.copy)(edit.port));
        else if (edit.kind === 'remove')
            next.splice(index, 1);
        else if (edit.kind === 'move') {
            if (!Number.isInteger(edit.delta) || index + edit.delta < 0 || index + edit.delta >= next.length)
                throw Error('Invalid Subgraph port order');
            next.splice(index + edit.delta, 0, next.splice(index, 1)[0]);
        }
        else {
            if (Object.keys(edit.patch).some(k => !['name', 'type', 'default'].includes(k)))
                throw Error('Interface edit cannot change port identity');
            const p = next[index];
            const previous = p.type;
            Object.assign(p, (0, model_1.copy)(edit.patch));
            if (p.type !== previous && edit.patch.default === undefined)
                p.default = (0, values_1.reshape)(p.default, p.type);
        }
        if (next.length > 16)
            throw Error('Subgraph supports at most 16 ports per direction');
        const seen = new Set();
        for (const p of next) {
            if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(p.id) || seen.has(p.id))
                throw Error('Invalid or duplicate Subgraph port');
            seen.add(p.id);
            (0, values_1.literal)(p.default, (0, values_1.type)(p.type));
        }
        // Prepare every patch before mutation, including instance defaults.
        const patches = [];
        const removed = edit.kind === 'remove' ? edit.id : null;
        const changed = edit.kind === 'update' && next[index].type !== list[index].type ? next[index] : null;
        const networks = [
            ...Object.values(this.graph.document.stages),
            ...(this.graph.document.functions || []).map(d => d.graph)
        ];
        const affected = (node, data) => {
            var _a;
            const module = this.graph.registry.get(node.definitionUuid);
            if (((_a = module === null || module === void 0 ? void 0 : module.referencedGraph) === null || _a === void 0 ? void 0 : _a.call(module, node)) === f.id)
                return direction === 'inputs' ? 'input' : 'output';
            if (data === f.graph && (module === null || module === void 0 ? void 0 : module.role) === (direction === 'inputs' ? 'subgraph-input' : 'subgraph-output'))
                return direction === 'inputs' ? 'output' : 'input';
            return null;
        };
        for (const data of networks)
            for (const n of data.nodes) {
                if (affected(n, data) !== 'input' || !n.inputValues)
                    continue;
                const values = (0, model_1.copy)(n.inputValues);
                if (removed)
                    delete values[removed];
                if (changed && Object.prototype.hasOwnProperty.call(values, changed.id))
                    values[changed.id] = (0, values_1.reshape)(values[changed.id], changed.type);
                patches.push({ node: n, values });
            }
        f[direction] = next;
        for (const patch of patches)
            patch.node.inputValues = patch.values;
        if (removed)
            for (const data of networks) {
                const nodes = new Map(data.nodes.map(n => [n.id, affected(n, data)]));
                data.edges = data.edges.filter(e => !(nodes.get(e.from[0]) === 'output' && e.from[1] === removed) &&
                    !(nodes.get(e.to[0]) === 'input' && e.to[1] === removed));
            }
    }
}
exports.Subgraph = Subgraph;

},
"top_compiler":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protocol = exports.CompilationError = void 0;
exports.codegenKey = codegenKey;
exports.createCompiler = createCompiler;
const subgraph_compiler_1 = require("./subgraph_compiler");
/** Whole-graph orchestration. Concrete node modules are injected by composition. */
const graph_1 = require("./graph");
const model_1 = require("./model");
const values_1 = require("./values");
const numeric_1 = require("./numeric");
const comments_1 = require("./comments");
class CompilationError extends Error {
    constructor(message, node) {
        super(message);
        this.node = node;
        this.stage = 'pixel';
        this.trail = [];
        this.name = 'CompilationError';
    }
}
exports.CompilationError = CompilationError;
exports.protocol = 'grape.top.ts.1';
function createFlatCompiler(registry, limit = 256) {
    function supports(g) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (g.schemaVersion !== 1 || g.target !== 'top' || Object.keys(g.stages).join() !== 'pixel' || ((_a = g.functions) === null || _a === void 0 ? void 0 : _a.length) || ((_b = g.topInputs) === null || _b === void 0 ? void 0 : _b.length) || ((_c = g.typeDefinitions) === null || _c === void 0 ? void 0 : _c.length))
            return false;
        if (!g.stages.pixel || g.stages.pixel.nodes.length > limit || g.stages.pixel.edges.length > limit * 4)
            return false;
        if ((_e = (_d = g.stages.pixel) === null || _d === void 0 ? void 0 : _d.ui) === null || _e === void 0 ? void 0 : _e.frames)
            return false;
        if (!g.declarations.every(d => d.kind === 'uniform' && numeric_1.types.includes(d.type) && !d.initialDriver && !d.sourceMissing && !['array', 'matrix'].includes(String(d.nativeSequence))))
            return false;
        // Legacy allocates collision suffixes for implicit IDs versus explicit
        // names. Keep those whole graphs on its path until symbol allocation moves.
        const symbols = ((_f = g.stages.pixel) === null || _f === void 0 ? void 0 : _f.nodes.filter(n => { var _a; return ((_a = registry.get(n.definitionUuid)) === null || _a === void 0 ? void 0 : _a.role) !== 'output'; }).map(n => n.name || n.id)) || [];
        if (new Set(symbols).size !== symbols.length)
            return false;
        return !!((_g = g.stages.pixel) === null || _g === void 0 ? void 0 : _g.nodes.every(n => {
            const d = registry.get(n.definitionUuid);
            if (!d)
                return false;
            if (n.params.requireConstant)
                return false;
            return d.supports(n, { declaration: id => g.declarations.find(d => d.id === id) });
        }));
    }
    function compile(g, identifiers) {
        let errorNode;
        try {
            if (!supports(g))
                throw Error('Graph is outside the selected frontend compiler capability');
            // Catalog provenance is checked by the delivery adapter, not graph traversal.
            const { catalogSnapshot, ...document } = g;
            const model = new graph_1.GraphDocument(document, registry), network = model.networks.get('pixel');
            const data = model.document.stages.pixel;
            if (data.nodes.length > limit || data.edges.length > limit * 4 || JSON.stringify(g).length > 512000)
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
                (0, values_1.literal)(d.value, (0, values_1.type)(d.type));
                declarations.set(d.id, d);
                names.add(d.name);
            }
            const symbols = new Set(), authoredNames = new Set();
            for (const n of data.nodes) {
                errorNode = n.id;
                if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n.id) || nodes.has(n.id))
                    throw Error('Invalid or duplicate node ID');
                if (n.name !== undefined) {
                    if (!identifiers || !/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(n.name) || n.name.includes('__') || /^(gl_|TD|sTD|uTD|sg_|[iu]?sampler|[iu]?image|d?mat[234])/.test(n.name) || identifiers.reservedNames.includes(n.name) || authoredNames.has(n.name))
                        throw Error('Invalid or duplicate node name');
                    authoredNames.add(n.name);
                }
                const d = registry.get(n.definitionUuid), symbol = n.name || n.id;
                if (d.role !== 'output') {
                    if (symbols.has(symbol))
                        throw Error('Duplicate output symbol');
                    symbols.add(symbol);
                }
                nodes.set(n.id, n);
                if (n.inputValues !== undefined && !(0, model_1.object)(n.inputValues))
                    throw Error('Invalid input default values');
                if (n.params.requireConstant !== undefined && typeof n.params.requireConstant !== 'boolean')
                    throw Error('Require Constant must be a boolean');
                d.validate(n, model.context);
                const resolved = network.node(n.id).interface;
                const projected = resolved.types();
                ports[n.id] = { in: projected.inputs, out: projected.outputs };
                for (const [p, v] of Object.entries(n.inputValues || {})) {
                    if (!resolved.inputs[p])
                        throw Error('Unknown input default');
                    (0, values_1.literal)(v, (0, values_1.type)(resolved.inputs[p].type));
                }
            }
            errorNode = undefined;
            const outputs = network.nodes.filter(n => n.definition.role === 'output');
            if (outputs.length !== 1)
                throw Error('Exactly one Pixel Output is required');
            const links = new Map();
            for (const edge of network.edges) {
                const target = edge.to, source = edge.from;
                errorNode = target.node.id;
                const checked = edge.connection(values_1.policy), k = target;
                if (!checked.valid)
                    throw Error(checked.reason === 'missing-port' ? 'Connection endpoint no longer exists' : source.type + ' cannot connect to ' + target.type);
                if (links.has(k))
                    throw Error('An input can only have one connection');
                links.set(k, edge);
            }
            const inputsUsed = new Map();
            for (const node of network.nodes) {
                const module = node.definition;
                if (module.inputsUsed) {
                    const connected = new Set(node.inputs.filter(p => links.has(p)).map(p => p.key));
                    const used = module.inputsUsed(node.data, connected, model.context);
                    if (used.some(key => !node.interface.inputs[key]))
                        throw Error('Module uses an unknown input');
                    inputsUsed.set(node.id, new Set(used));
                }
            }
            const order = network.order(outputs[0].id, e => !inputsUsed.has(e.to[0]) || inputsUsed.get(e.to[0]).has(e.to[1])), visited = new Set(order.map(n => n.id));
            const used = new Set(), lines = [], lineNodes = [], expressions = new Map();
            for (const node of order) {
                const n = node.data, id = node.id, d = node.definition, p = node.interface;
                const start = lines.length;
                errorNode = id;
                const input = (key) => {
                    var _a, _b;
                    const port = p.inputs[key];
                    if (!port)
                        throw Error('Unknown input port: ' + key);
                    const edge = links.get(node.port('input', key));
                    if (edge) {
                        const source = edge.from, value = expressions.get(source);
                        if (value === undefined)
                            throw Error('Source emitted no output: ' + source.key);
                        return source.type === port.type ? value : port.type + '(' + value + ')';
                    }
                    return (0, values_1.literal)((_b = (_a = n.inputValues) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : port.default, (0, values_1.type)(port.type));
                };
                if (!d.emit)
                    throw Error('Structural nodes require Subgraph expansion');
                const emission = d.emit(n, { ...model.context, ports: p, input, connected: key => links.has(node.port('input', key)), useUniform: declId => {
                        const declaration = declarations.get(declId);
                        if (!declaration)
                            throw Error('Select a matching declaration');
                        used.add(declId);
                        return declaration.name;
                    } });
                if (Object.keys(emission.outputs).sort().join() !== Object.keys(p.outputs).sort().join())
                    throw Error('Module emitted a different output interface');
                if (emission.statements)
                    lines.push(...emission.statements);
                for (const [port, expression] of Object.entries(emission.outputs)) {
                    const symbol = 'sg_n_' + (n.name || id) + (port === 'out' ? '' : '_' + port);
                    lines.push('    ' + (emission.constant ? 'const ' : '') + p.outputs[port].type + ' ' + symbol + ' = ' + expression + ';');
                    expressions.set(node.port('output', port), symbol);
                }
                if (lines.length === start)
                    throw Error('Node emitted no expression');
                (0, comments_1.appendNodeComments)(lines, start, n.ui || {});
                while (lineNodes.length < lines.length)
                    lineNodes.push(id);
            }
            const bindings = [...used].sort().map(id => JSON.parse(JSON.stringify(declarations.get(id))));
            const headers = bindings.map(d => 'uniform ' + d.type + ' ' + d.name + ';');
            const pixel = [...headers, 'layout(location=0) out vec4 fragColor;', 'void main() {', '    vec2 sg_uv = vUV.st;', ...lines, '}', ''].join('\n');
            const diagnostics = data.nodes.filter(n => !visited.has(n.id)).sort((a, b) => a.id < b.id ? -1 : 1).map(n => ({ node: n.id, stage: 'pixel', message: 'Disconnected node is not emitted' }));
            const sourceMap = { pixel: lineNodes.map((node, i) => ({ node, stage: 'pixel', trail: [], line: headers.length + 4 + i })) };
            return { vertex: '', pixel, bindings, sourceMap, stages: { pixel: { lines, ports, live: [...visited].sort() } }, diagnostics };
        }
        catch (error) {
            throw new CompilationError(error instanceof Error ? error.message : String(error), error instanceof graph_1.GraphError ? error.node : errorNode);
        }
    }
    return Object.freeze({ protocol: exports.protocol, supports, compile });
}
/** Code-generation fingerprint (design-interview Q38 2-1): everything the generated program
 * depends on, minus authored layout and notes. Node `ui` only adds GLSL comment lines and
 * labels (comments.ts), so by the human's rule B it is outside the chain; edge ids and the
 * edge sequence never reach GLSL. Equal keys must mean the same program apart from comment
 * lines; tests/unit/test_codegen_key.cjs checks this on random edit sequences.
 * 產碼指紋：產出的程式所依賴的一切，扣掉版面與註記。節點 ui 只帶來 GLSL 註解與標籤（規則 B，不在鏈路）；
 * 線的 id 與序號不進 GLSL。指紋相同＝除註解行外程式相同，由隨機編輯的性質測試把關。 */
function codegenKey(g) {
    const network = (data) => data && { ...data, edgeSequence: undefined,
        nodes: (data.nodes || []).map(n => ({ ...n, ui: undefined })),
        edges: (data.edges || []).map(e => ({ ...e, id: undefined })) };
    return JSON.stringify({ ...g, stages: Object.fromEntries(Object.entries(g.stages || {}).map(([k, v]) => [k, network(v)])),
        functions: (g.functions || []).map(f => ({ ...f, graph: network(f.graph) })) });
}
function createCompiler(registry) {
    const flat = createFlatCompiler(registry);
    const subgraphs = (0, subgraph_compiler_1.createSubgraphCompiler)(registry, r => createFlatCompiler(r, 2048));
    return Object.freeze({ protocol: exports.protocol, key: codegenKey,
        supports: (g) => { var _a; return ((_a = g.functions) === null || _a === void 0 ? void 0 : _a.length) ? subgraphs.supports(g) : flat.supports(g); },
        compile: (g, identifiers) => { var _a; return ((_a = g.functions) === null || _a === void 0 ? void 0 : _a.length) ? subgraphs.compile(g, identifiers) : flat.compile(g, identifiers); }
    });
}

},
"value_nodes":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.output = exports.input = exports.values = void 0;
exports.reshapeInputs = reshapeInputs;
exports.typedNode = typedNode;
exports.payload = payload;
exports.staticNode = staticNode;
const model_1 = require("./model");
const values = require("./values");
exports.values = values;
function reshapeInputs(n, before, after) {
    var _a;
    for (const p of after)
        if (p.direction === 'input' && ((_a = n.inputValues) === null || _a === void 0 ? void 0 : _a[p.key]) !== undefined) {
            const old = before.find(v => v.direction === 'input' && v.key === p.key);
            if (old && old.type !== p.type) {
                n.ui || (n.ui = {});
                const cache = (0, model_1.object)(n.ui.inputValuesByType) || {};
                n.ui.inputValuesByType = cache;
                const stored = (0, model_1.object)(cache[p.key]) || {};
                cache[p.key] = stored;
                stored[old.type] = (0, model_1.copy)(n.inputValues[p.key]);
                n.inputValues[p.key] = stored[p.type] === undefined ? values.reshape(n.inputValues[p.key], p.type) : (0, model_1.copy)(stored[p.type]);
            }
        }
    return n;
}
/** A typed value family owns its ports and commands; no node-name dispatch. */
function typedNode(catalog, spec) {
    const selected = (n) => { var _a; return String((_a = n.params.type) !== null && _a !== void 0 ? _a : catalog.definition.defaults.type); };
    const ports = (n) => { const t = selected(n); if (!spec.types.includes(t))
        throw Error('Unsupported node type'); return spec.ports(t, n); };
    return { catalog, role: 'value', supports: n => spec.types.includes(selected(n)), ports,
        configure: (n, s) => {
            if (!('type' in s) || !spec.types.includes(s.type) || n.params.fixedType && n.params.fixedType !== s.type)
                throw Error('Invalid manual type');
            const before = ports(n);
            n.params.type = s.type;
            n = spec.configure ? spec.configure(n, s.type) : n;
            return reshapeInputs(n, before, ports(n));
        },
        validate: (n, c) => { var _a; if (n.params.fixedType && n.params.fixedType !== selected(n))
            throw Error('Fixed node type'); ports(n); (_a = spec.validate) === null || _a === void 0 ? void 0 : _a.call(spec, n, c); },
        edit: spec.edit, emit: spec.emit, creations: spec.creations,
        presentation: n => { var _a; return ({ selectorLabel: 'vector.outputType', ...(_a = spec.presentation) === null || _a === void 0 ? void 0 : _a.call(spec, n) }); }
    };
}
const input = (key, t, value = 0) => ({ key, direction: 'input', type: t, default: values.fill(value, t) });
exports.input = input;
const output = (key, t) => ({ key, direction: 'output', type: t });
exports.output = output;
function payload(value) { const data = (0, model_1.object)(value); if (!data || data.value === undefined)
    throw Error('Missing command value'); return data.value; }
function staticNode(catalog, spec) {
    return { catalog, role: 'value', supports: () => true, validate: () => { }, ...spec };
}

},
"values":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copy = exports.policy = exports.fill = exports.vectors = exports.types = exports.scalars = void 0;
exports.shaped = shaped;
exports.type = type;
exports.count = count;
exports.family = family;
exports.literal = literal;
exports.reshape = reshape;
exports.explicit = explicit;
/**
 * Scalar/vector types, literals, default values and conversion policies.
 * 純量／向量共用的型別與值工具，供節點模組、接線規劃與產碼使用。
 * 包含：型別查詢、GLSL 字面值、預設值調整、手動與自動轉換的配對規則。
 * 目前不涵蓋 double、矩陣或 texture 等資源型別；宿主參數綁定另有自己的規則。
 */
const model_1 = require("./model");
Object.defineProperty(exports, "copy", { enumerable: true, get: function () { return model_1.copy; } });
const numeric_1 = require("./numeric");
// Supported types — 四種元素型別家族，各有純量及 2／3／4 分量向量，共 16 種。
exports.scalars = ['float', 'int', 'uint', 'bool'];
exports.types = exports.scalars.flatMap(f => [f, ...[2, 3, 4].map(n => shaped(f, n))]);
exports.vectors = exports.types.filter(t => count(t) > 1);
/** Type from family + width — 用家族與分量數組出名稱，例如 shaped('int', 3) → ivec3。 */
function shaped(f, n) {
    if (!Number.isInteger(n) || n < 1 || n > 4)
        throw Error('Invalid component count');
    return n === 1 ? f : ({ float: 'vec', int: 'ivec', uint: 'uvec', bool: 'bvec' }[f] + n);
}
/** Validate type name — 確認名稱屬於支援的 16 種型別；不支援時直接報錯。 */
function type(t) { if (typeof t !== 'string' || !exports.types.includes(t))
    throw Error('Unsupported value type'); return t; }
/** Component count — 預期傳入已確認的純量／向量型別；此函式本身不驗證名稱。 */
function count(t) { return /vec[234]$/.test(t) ? Number(t.slice(-1)) : 1; }
/** Element family — 取得元素型別，例如 ivec3 → int、vec4 → float。 */
function family(t) { type(t); return t.startsWith('ivec') ? 'int' : t.startsWith('uvec') ? 'uint' : t.startsWith('bvec') ? 'bool' : t.startsWith('vec') ? 'float' : t; }
/**
 * Validate a value and emit its GLSL literal without reshaping it.
 * 驗證資料並寫成 GLSL 字面值，例如 true、1u、vec3(1.0, 2.0, 3.0)。
 * 向量必須已有正確分量數，整數必須符合 32-bit 範圍；不在這裡自動補值或截斷。
 */
function literal(value, t) {
    type(t);
    const n = count(t), f = family(t);
    if (n > 1) {
        if (!Array.isArray(value) || value.length !== n)
            throw Error('Expected ' + n + ' components');
        return t + '(' + value.map(v => literal(v, f)).join(', ') + ')';
    }
    if (f === 'float')
        return (0, numeric_1.number)(value);
    if (f === 'bool') {
        if (typeof value !== 'boolean')
            throw Error('Expected a boolean');
        return String(value);
    }
    const low = f === 'int' ? -2147483648 : 0, high = f === 'int' ? 2147483647 : 4294967295;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < low || value > high)
        throw Error('Expected a 32-bit ' + f);
    return value === -2147483648 ? '(-2147483647 - 1)' : String(value) + (f === 'uint' ? 'u' : '');
}
/**
 * Reshape stored/default values; this does not define automatic Edge conversions.
 * 明確調整資料中的值，供切換型別、建立預設值等操作使用；不是 Edge 自動轉換。
 * 目標分量較少時取前面的值；不足時補第一個值，連第一個值都沒有才補 0。
 * 轉整數會去除小數並限制範圍；完成後再用 literal() 驗證結果。
 */
function reshape(value, t) {
    const f = family(t), a = Array.isArray(value) ? value : [value];
    const scalar = (v) => f === 'bool' ? Boolean(v) : f === 'float' ? Number(v) : Math.min(f === 'int' ? 2147483647 : 4294967295, Math.max(f === 'int' ? -2147483648 : 0, Math.trunc(Number(v))));
    const next = Array.from({ length: count(t) }, (_, i) => { var _a, _b; return scalar((_b = (_a = a[i]) !== null && _a !== void 0 ? _a : a[0]) !== null && _b !== void 0 ? _b : 0); });
    const result = count(t) === 1 ? next[0] : next;
    literal(result, t);
    return result;
}
/** Fill all components — 用同一值填滿指定型別，例如 fill(1, 'vec3') → [1, 1, 1]。 */
const fill = (v, t) => reshape(v, t);
exports.fill = fill;
/**
 * Explicit Convert pairs: casts, scalar splats and vector truncation, but no vector expansion.
 * 手動 Convert 節點可選的配對，比 Edge 自動轉換寬鬆：
 * 允許布林與數值互轉、純量展開，以及向量取較少分量；不允許向量擴成更多分量。
 * 此處只判斷可否配對，真正的 GLSL 轉換由 Convert 節點產生。
 */
function explicit(source, target) { return exports.types.includes(source) && exports.types.includes(target) && (count(source) === 1 || count(source) >= count(target)); }
/**
 * Automatic Edge conversion policy; source output types stay unchanged.
 * New pairs must also have valid GLSL emission, not just permission to connect.
 * Edge 自動接線的共用規則，不改變來源節點的輸出型別。
 * 同型直連由接線檢查另外接受，因此 conversions 只列出不同型別的有向配對。
 * 放行配對後，產碼端會在使用來源值的位置加入目標型別的 GLSL constructor。
 * 未來若加入需要補值等特殊處理的配對，必須同時實作產碼，不能只擴充此表。
 */
exports.policy = {
    // Type widths — 列出支援的型別與分量數，供同型直連及其他型別查詢使用。
    components: Object.fromEntries(exports.types.map(t => [t, count(t)])),
    // Numeric casts/splats and bool splats only; no automatic vector resizing.
    // 數值家族 float／int／uint：同分量數可互轉，純量可展開成任意數值向量。
    // 布林只允許 bool → bvec2／3／4；不自動做布林與數值互轉。
    // 不自動做向量縮短、向量擴長或向量 → 純量；需要時由使用者明確操作。
    conversions: exports.types.flatMap(from => exports.types.filter(to => from !== to &&
        (family(from) !== 'bool' && family(to) !== 'bool' && (count(from) === count(to) || count(from) === 1) ||
            family(from) === family(to) && count(from) === 1)).map(to => ({ from, to })))
};

},
"vector_assembly":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vectorAssembly = vectorAssembly;
const model_1 = require("./model");
const value_nodes_1 = require("./value_nodes");
const axes = 'xyzw';
/** Component partitions are a vector-family concern, never graph-wide inference. */
function vectorAssembly(catalog, inherit) {
    function layout(n) {
        const t = value_nodes_1.values.type(n.params.type), width = value_nodes_1.values.count(t), family = value_nodes_1.values.family(t), groups = (0, model_1.object)(n.params.groups) || {};
        if (width < 2)
            throw Error('Expected a vector');
        const parts = [];
        for (let start = 0; start < width;) {
            const key = axes[start], type = String(groups[key] || family), size = value_nodes_1.values.count(value_nodes_1.values.type(type));
            if (value_nodes_1.values.family(type) !== family || start + size > width || size === 1 && groups[key])
                throw Error('Invalid component group');
            parts.push({ key, type, start, size });
            start += size;
        }
        if (Object.keys(groups).some(key => !parts.some(p => p.key === key && p.size > 1)))
            throw Error('Overlapping component groups');
        return parts;
    }
    const components = (n) => {
        var _a;
        const t = String(n.params.type), v = (_a = n.params.components) !== null && _a !== void 0 ? _a : value_nodes_1.values.fill(0, value_nodes_1.values.shaped(value_nodes_1.values.family(t), 4));
        value_nodes_1.values.literal(v, value_nodes_1.values.shaped(value_nodes_1.values.family(t), 4));
        return v;
    };
    const ports = (n) => [
        ...(inherit ? [(0, value_nodes_1.input)('value', String(n.params.type))] : []),
        ...layout(n).map(p => ({ ...(0, value_nodes_1.input)(p.key, p.type), default: p.size === 1 ? components(n)[p.start] : components(n).slice(p.start, p.start + p.size) })),
        (0, value_nodes_1.output)('out', String(n.params.type))
    ];
    return { catalog, role: 'value', supports: n => value_nodes_1.values.vectors.includes(String(n.params.type)), ports,
        validate: n => { layout(n); components(n); },
        configure: (n, s) => {
            if (!('type' in s) || !value_nodes_1.values.vectors.includes(s.type))
                throw Error('Invalid assembly output');
            const before = ports(n), old = components(n);
            n.params.type = s.type;
            n.params.groups = {};
            n.params.components = value_nodes_1.values.reshape(old, value_nodes_1.values.shaped(value_nodes_1.values.family(s.type), 4));
            return (0, value_nodes_1.reshapeInputs)(n, before, ports(n));
        },
        wire: (n, key, source) => {
            if (key === 'value' && inherit)
                return { node: n, replaceInputs: ['value'] };
            const parts = layout(n), part = parts.find(p => p.key === key), size = value_nodes_1.values.count(value_nodes_1.values.type(source));
            if (!part || part.start + size > value_nodes_1.values.count(String(n.params.type)))
                throw Error('Component group exceeds the output');
            const end = part.start + size, overlap = parts.filter(p => p.start < end && p.start + p.size > part.start);
            const groups = { ...(0, model_1.object)(n.params.groups) };
            for (const p of overlap)
                delete groups[p.key];
            if (size > 1)
                groups[key] = value_nodes_1.values.shaped(value_nodes_1.values.family(String(n.params.type)), size);
            n.params.groups = groups;
            return { node: n, replaceInputs: overlap.map(p => p.key) };
        },
        editInput: (n, key, value) => {
            const part = layout(n).find(p => p.key === key);
            if (!part) {
                if (!inherit || key !== 'value')
                    throw Error('Unknown component');
                n.inputValues = { ...n.inputValues, value: (0, model_1.copy)(value) };
                return n;
            }
            value_nodes_1.values.literal(value, part.type);
            const next = (0, model_1.copy)(components(n));
            next.splice(part.start, part.size, ...(Array.isArray(value) ? value : [value]));
            n.params.components = next;
            return n;
        },
        presentation: () => ({ selectorLabel: 'vector.outputType' }),
        inputsUsed: (n, connected) => {
            const parts = layout(n), overrides = parts.filter(p => connected.has(p.key)).map(p => p.key);
            return inherit && connected.has('value') && overrides.length < parts.length ? ['value', ...overrides] : overrides;
        },
        emit: (n, c) => {
            const args = layout(n).map(p => {
                if (!inherit || c.connected(p.key) || !c.connected('value'))
                    return c.input(p.key);
                return '(' + c.input('value') + ').' + axes.slice(p.start, p.start + p.size);
            });
            return { outputs: { out: String(n.params.type) + '(' + args.join(', ') + ')' } };
        }
    };
}

},
"wire_planning":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plan = plan;
const ports_1 = require("./ports");
const same = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);
/** No Auto inference. Every existing output is an invariant. Only complete
 * native input tuples can change, and every retained input must still fit.
 * Creation chooses its initial output before entering this planner. */
function resolve(graph, c, only) {
    const nodes = new Map(graph.nodes.map(n => [n.id, n])), incoming = new Map(), outgoing = new Map(), degrees = new Map();
    const ports = new Map(graph.nodes.map(n => [n.id, n.stored])), choices = new Map(), operands = new Map(), issues = new Map();
    const signatures = new Map();
    for (const n of graph.nodes)
        degrees.set(n.id, 0);
    for (const e of graph.edges) {
        const list = incoming.get(e.to[0]) || [];
        list.push(e);
        incoming.set(e.to[0], list);
        if (nodes.has(e.from[0]) && nodes.has(e.to[0])) {
            degrees.set(e.to[0], degrees.get(e.to[0]) + 1);
            const peers = outgoing.get(e.from[0]) || [];
            peers.push(e.to[0]);
            outgoing.set(e.from[0], peers);
        }
    }
    const ready = graph.nodes.filter(n => !degrees.get(n.id)).map(n => n.id);
    for (let i = 0; i < ready.length; i++)
        for (const id of outgoing.get(ready[i]) || []) {
            const count = degrees.get(id) - 1;
            degrees.set(id, count);
            if (!count)
                ready.push(id);
        }
    if (ready.length !== graph.nodes.length)
        return { code: 'cycle' };
    if (only === null || only === void 0 ? void 0 : only.some(id => !nodes.has(id)))
        return { code: 'missing-port' };
    for (const n of only === undefined ? graph.nodes : only.map(id => nodes.get(id))) {
        if (!n.variants)
            continue;
        const links = incoming.get(n.id) || [];
        const source = (e) => { var _a; return (_a = nodes.get(e.from[0])) === null || _a === void 0 ? void 0 : _a.stored.outputs[e.from[1]]; };
        const candidates = n.variants.filter(v => same(v.outputs, n.stored.outputs) && links.every(e => (0, ports_1.compatible)(source(e), v.inputs[e.to[1]], c.components, c.conversions)));
        const conversions = (v) => links.reduce((score, e) => score + Number(source(e) !== v.inputs[e.to[1]]), 0);
        const changes = (v) => Object.entries(n.stored.inputs).reduce((score, [key, value]) => score + Number(v.inputs[key] !== value), 0);
        candidates.sort((a, b) => conversions(a) - conversions(b) || changes(a) - changes(b));
        const chosen = candidates[0];
        if (!chosen) {
            issues.set(n.id, { code: 'input-signature', node: n.id });
            continue;
        }
        ports.set(n.id, { inputs: chosen.inputs, outputs: n.stored.outputs });
        choices.set(n.id, chosen.type);
        operands.set(n.id, chosen.operands || null);
        signatures.set(n.id, chosen);
    }
    return { ports, choices, operands, issues, signatures };
}
function plan(graph, c, intent) {
    var _a, _b;
    let candidate = graph, displaced = [];
    if (intent.kind === 'wire') {
        const source = graph.nodes.find(n => n.id === intent.from.node), target = graph.nodes.find(n => n.id === intent.to.node);
        if (!(source === null || source === void 0 ? void 0 : source.stored.outputs[intent.from.port]) || !(target === null || target === void 0 ? void 0 : target.stored.inputs[intent.to.port]))
            return { ok: false, diagnostic: { code: 'missing-port' } };
        displaced = graph.edges.filter(e => e.to[0] === intent.to.node && e.to[1] === intent.to.port);
        candidate = { nodes: graph.nodes, edges: [...graph.edges.filter(e => !displaced.includes(e)), { from: [intent.from.node, intent.from.port], to: [intent.to.node, intent.to.port] }] };
    }
    const inference = resolve(candidate, c, intent.kind === 'wire' ? [intent.to.node] : intent.nodes);
    if ('code' in inference)
        return { ok: false, diagnostic: inference };
    if (intent.kind === 'wire') {
        const issue = inference.issues.get(intent.to.node);
        if (issue)
            return { ok: false, diagnostic: issue };
        // Other nodes' interfaces never change. Validate only the target's inputs;
        // unrelated missing/incompatible draft edges remain editable.
        for (const e of candidate.edges)
            if (e.to[0] === intent.to.node) {
                const sourceType = (_a = inference.ports.get(e.from[0])) === null || _a === void 0 ? void 0 : _a.outputs[e.from[1]], targetType = (_b = inference.ports.get(e.to[0])) === null || _b === void 0 ? void 0 : _b.inputs[e.to[1]];
                if (!(0, ports_1.compatible)(sourceType, targetType, c.components, c.conversions))
                    return { ok: false, diagnostic: { code: 'downstream', node: intent.to.node, sourceType, targetType } };
            }
    }
    return { ok: true, inference, edges: candidate.edges, displaced };
}

}
};
const cache=Object.create(null);
function load(id){
  if(cache[id])return cache[id].exports;
  if(!Object.prototype.hasOwnProperty.call(factories,id))throw Error('Unknown bundled module: '+id);
  const module={exports:{}};cache[id]=module;
  factories[id](request=>{
    if(!request.startsWith('.'))throw Error('Only relative core imports are supported');
    const parts=id.split('/');parts.pop();
    for(const part of request.split('/'))if(part==='..')parts.pop();else if(part!=='.')parts.push(part);
    return load(parts.join('/'));
  },module,module.exports);return module.exports;
}
const api=load('__composition');GrapeWirePlanning=api.GrapeWirePlanning;GrapeTopCompiler=api.GrapeTopCompiler;GrapeGraph=api.GrapeGraph;
})();
if(typeof module!=='undefined'&&module.exports)module.exports=GrapeGraph;
