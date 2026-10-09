// Generated from src/core-ts; run npm run build:core.
var GrapeTopCompiler,GrapeGraph;
(function(){
'use strict';
const factories={
"__composition":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrapeGraph = exports.GrapeTopCompiler = exports.registry = void 0;
const wire = require("./wire_planning");
const graph = require("./graph");
const values = require("./values");
const node_module_1 = require("./node_module");
const top_compiler_1 = require("./top_compiler");
const capacity_1 = require("./capacity");
const structure_1 = require("./structure");
const editor_contract_1 = require("./editor_contract");
const model_1 = require("./model");
const ghosts_1 = require("./ghosts");
const declarations_1 = require("./declarations");
const td_values_1 = require("./td_values");
const uniform_presets_1 = require("./uniform_presets");
const common_sources_1 = require("./common_sources");
const node_sdk_1 = require("./node_sdk");
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
const declaration_1 = require("./nodes/declaration");
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
const td_value_1 = require("./nodes/td_value");
const texture_sample_1 = require("./nodes/texture_sample");
const trunc_1 = require("./nodes/trunc");
const vec2_1 = require("./nodes/vec2");
const vec3_1 = require("./nodes/vec3");
const vec4_1 = require("./nodes/vec4");
const vector_1 = require("./nodes/vector");
const vector_split_1 = require("./nodes/vector_split");
exports.registry = (0, node_module_1.createRegistry)([abs_1.default, add_1.default, all_1.default, any_1.default, ceil_1.default, clamp_1.default, color_1.default, combine_1.default, compare_1.default, convert_1.default, cos_1.default, declaration_1.default, divide_1.default, dot_1.default, equal_1.default, float_1.default, floor_1.default, fract_1.default, function_call_1.default, function_input_1.default, function_output_1.default, greaterThan_1.default, greaterThanEqual_1.default, if_1.default, isinf_1.default, isnan_1.default, length_1.default, lessThan_1.default, lessThanEqual_1.default, math_1.default, max_1.default, min_1.default, mix_1.default, multiply_1.default, normalize_1.default, not_1.default, notEqual_1.default, pixel_out_1.default, replace_1.default, rgba_1.default, round_1.default, router_1.default, scalar_1.default, sign_1.default, sin_1.default, smoothstep_1.default, split_1.default, sqrt_1.default, subtract_1.default, swizzle_1.default, td_value_1.default, texture_sample_1.default, trunc_1.default, vec2_1.default, vec3_1.default, vec4_1.default, vector_1.default, vector_split_1.default]);
exports.GrapeTopCompiler = (0, top_compiler_1.createCompiler)(exports.registry);
exports.GrapeGraph = { ...graph, plan: wire.plan, values, registry: exports.registry, createRegistry: node_module_1.createRegistry, createCompiler: top_compiler_1.createCompiler, resolvePorts: node_module_1.resolvePorts, configureNode: node_module_1.configureNode, createEditorContract: editor_contract_1.createEditorContract, overLimit: capacity_1.overLimit, structureProblems: structure_1.structureProblems, offered: structure_1.offered, removable: structure_1.removable, formatProblem: model_1.formatProblem, ghostsOf: ghosts_1.ghostsOf, declarationKinds: declarations_1.declarationKinds, declarationNameProblem: declarations_1.declarationNameProblem, freeDeclarationName: declarations_1.freeDeclarationName, freeLegacyName: declarations_1.freeLegacyName, defaultTextures: declarations_1.defaultTextures, uniformPresets: uniform_presets_1.uniformPresets, commonSources: common_sources_1.commonSources, tdValues: td_values_1.tdValues, usableTdValue: node_sdk_1.usableTdValue };

},
"capacity":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapacityError = void 0;
exports.measure = measure;
exports.overLimit = overLimit;
exports.requireCapacity = requireCapacity;
const config_1 = require("./config");
function networks(g) {
    return [...Object.entries(g.stages || {}).map(([id, data]) => [id, data]),
        ...(g.subgraphs || []).map(f => ['function:' + f.id, f.graph])];
}
/** Every measure of the graph, with its limit. Expanded size counts a subgraph instance as the
 * expanded size of its definition (an estimate of what the subgraph compiler builds). */
function measure(g, registry, config = config_1.CORE_CONFIG) {
    const definitions = new Map((g.subgraphs || []).map(f => [f.id, f.graph]));
    const expanded = new Map(), visiting = new Set();
    const size = (data, key) => {
        var _a, _b;
        if (expanded.has(key))
            return expanded.get(key);
        if (visiting.has(key))
            return 0; // cycles are refused elsewhere; do not loop here
        visiting.add(key);
        let total = 0;
        for (const n of data.nodes) {
            const ref = (_b = (_a = registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n), inner = ref ? definitions.get(ref) : undefined;
            total += inner ? size(inner, 'function:' + ref) : 1;
        }
        visiting.delete(key);
        expanded.set(key, total);
        return total;
    };
    const result = [{ key: 'subgraphDefinitions', value: definitions.size, limit: config.subgraphDefinitions }];
    for (const [id, data] of networks(g)) {
        result.push({ key: 'nodesPerNetwork', network: id, value: data.nodes.length, limit: config.nodesPerNetwork });
        result.push({ key: 'edgesPerNetwork', network: id, value: data.edges.length, limit: config.edgesPerNetwork });
    }
    for (const [id, data] of Object.entries(g.stages || {}))
        result.push({ key: 'expandedNodes', network: id, value: size(data, id), limit: config.expandedNodes });
    return result;
}
/** Measures over their limit; used to report an over-limit graph when it is opened. */
function overLimit(g, registry, config = config_1.CORE_CONFIG) {
    return measure(g, registry, config).filter(m => m.value > m.limit);
}
class CapacityError extends Error {
    constructor(measures) {
        super('Graph limit reached: ' + measures.map(m => `${m.key}${m.network ? ' (' + m.network + ')' : ''} ${m.value}/${m.limit}`).join(', '));
        this.measures = measures;
        this.name = 'CapacityError';
    }
}
exports.CapacityError = CapacityError;
/** Refuses growth beyond a limit; shrinking an over-limit graph is always allowed. */
function requireCapacity(before, after, registry, config = config_1.CORE_CONFIG) {
    const id = (m) => { var _a; return m.key + '|' + ((_a = m.network) !== null && _a !== void 0 ? _a : ''); };
    const previous = new Map(measure(before, registry, config).map(m => [id(m), m.value]));
    const grown = measure(after, registry, config).filter(m => { var _a; return m.value > m.limit && m.value > ((_a = previous.get(id(m))) !== null && _a !== void 0 ? _a : 0); });
    if (grown.length)
        throw new CapacityError(grown);
}

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
    return new Map([...Object.entries(g.stages), ...(g.subgraphs || []).map(raw => { const f = raw; return ['function:' + f.id, f.graph]; })]);
}
function metadata(g) {
    const { stages, subgraphs, catalogSnapshot, ...rest } = g;
    return { ...rest, subgraphs: (subgraphs || []).map(raw => { const { graph, ...definition } = raw; return definition; }) };
}
const networkMetadata = (data) => { const { nodes, edges, ...rest } = data || {}; return rest; };
function portTypes(g, node, registry, networkId) {
    var _a;
    if (!node)
        return { inputs: {}, outputs: {} };
    const module = registry.get(node.nodeType), context = (0, node_module_1.contextFor)(g, (_a = g.subgraphs) === null || _a === void 0 ? void 0 : _a.find(f => 'function:' + f.id === networkId));
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
    const global = keys(metadata(before), metadata(after)).filter(k => k !== 'subgraphs'), old = networks(before), next = networks(after), changes = [];
    const defs = (g) => new Map((g.subgraphs || []).map(({ graph, ...f }) => [f.id, f]));
    const oldDefs = defs(before), newDefs = defs(after), definitions = [...new Set([...oldDefs.keys(), ...newDefs.keys()])].filter(id => !equal(oldDefs.get(id), newDefs.get(id)));
    const affected = (n, network) => { var _a; if (!n)
        return false; const m = registry.get(n.nodeType); return definitions.includes(((_a = m === null || m === void 0 ? void 0 : m.referencedGraph) === null || _a === void 0 ? void 0 : _a.call(m, n)) || '') || !!(m === null || m === void 0 ? void 0 : m.structural) && definitions.some(id => network === 'function:' + id); };
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
                if (n && !((_a = registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.supports(n, (0, node_module_1.contextFor)(g, (_b = g.subgraphs) === null || _b === void 0 ? void 0 : _b.find(f => 'function:' + f.id === id)))))
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
/** A node's `comment` (moved out of `ui`, Q44) becomes inert lines below its code; `ui.label` is gone.
 * 節點的 comment（已搬出 ui）產成程式下方的註解行；ui.label 已刪除。 */
function appendNodeComments(lines, _start, comment) {
    lines.push(...commentLines(comment, 'Comment'));
}

},
"common_sources":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonSources = void 0;
exports.commonSources = Object.freeze([
    {
        "id": "absTime",
        "type": "float",
        "meaning": "Seconds since the host started running; keeps going."
    },
    {
        "id": "deltaTime",
        "type": "float",
        "meaning": "Seconds from the previous frame to this one."
    },
    {
        "id": "absFrame",
        "type": "float",
        "meaning": "Frames since the host started running."
    },
    {
        "id": "uv",
        "type": "vec2",
        "meaning": "Normalized coordinates of this pixel, 0 to 1."
    },
    {
        "id": "fragCoord",
        "type": "vec4",
        "meaning": "Pixel coordinates of this pixel."
    },
    {
        "id": "resolution",
        "type": "vec2",
        "meaning": "Width and height of the output in pixels."
    }
].map(entry => Object.freeze(entry)));

},
"config":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORE_CONFIG = void 0;
exports.CORE_CONFIG = Object.freeze({
    // No basis in the new architecture: inherited from the legacy Python core, which processed the
    // whole graph on TD's main thread. TD no longer reads the graph (Refactor.19). Temporary safety
    // net until measured limits exist (editing feel, GPU compile time, GLSL size); see CURRENT.
    // 新架構下沒有依據：繼承自舊 Python 核心（TD 主執行緒處理整張圖）。暫時的安全網，待實測後再訂。
    nodesPerNetwork: 256,
    edgesPerNetwork: 1024, // same legacy origin; four edges per node
    expandedNodes: 2048, // legacy-era choice for flattened subgraphs; same status as above
    expandedEdges: 8192, // four edges per expanded node, as before
    // UTF-8 bytes of the graph text. The host's limit (our TD-side code, next_family.MAX_GRAPH_BYTES), not
    // TD's: TD itself has none. The number is inherited; the reason to keep a limit is TD main-thread
    // time per edit (about 3.3 ms per MB, measured 2026-10-09; see next_family.py). See convention 5.
    // 圖文字的 UTF-8 位元組數。是宿主（我們在 TD 裡的程式）的上限，不是 TD 的；同樣沒有實測依據。
    documentBytes: 512000,
    subgraphDefinitions: 64, // legacy-era choice
});

},
"declarations":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeclarationError = exports.declarationKinds = exports.defaultTextures = void 0;
exports.declarationNameProblem = declarationNameProblem;
exports.freeDeclarationName = freeDeclarationName;
exports.freeLegacyName = freeLegacyName;
exports.addDeclaration = addDeclaration;
exports.changeDeclaration = changeDeclaration;
exports.removeDeclaration = removeDeclaration;
const model_1 = require("./model");
const numeric_1 = require("./numeric");
const values_1 = require("./values");
const identifier_rules_1 = require("./identifier_rules");
const uniform_presets_1 = require("./uniform_presets");
const numericValue = (declaration) => {
    if (!numeric_1.types.includes(declaration.type))
        throw Error('Unsupported declaration type');
    (0, numeric_1.literal)(declaration.value, (0, numeric_1.type)(declaration.type));
};
const numericFields = {
    initial: (type) => ({ value: (0, numeric_1.fill)(0, (0, numeric_1.type)(type)) }),
    retype: (d, type) => { var _a; return ({ value: (0, values_1.reshape)((_a = d.value) !== null && _a !== void 0 ? _a : 0, type) }); },
};
// Global constant (Q41): `const` at file scope; changing it changes the program, nothing in TD.
const constantKind = { kind: 'constant', role: 'constant', colorGroup: 'constant', types: numeric_1.types, constant: true, validate: numericValue,
    ...numericFields, header: (d) => 'const ' + d.type + ' ' + d.name + ' = ' + (0, numeric_1.literal)(d.value, (0, numeric_1.type)(d.type)) + ';' };
// Uniform (Q41, Q55–Q61; uniform-d.md). `value` is the value it carries with the graph (Q57); in TD the
// GLSL OP parameter is the authority. `color: true` (Q51) marks a colour, vec3 and vec4 only, decided
// when it is created (Q59: switching would move it to another page and drop what drives it).
// `entry` points to a preset (uniform_presets.json, Q61): its name and type come from the preset and are
// locked in the web editor; otherwise it is an ordinary Uniform.
// Uniform：value 是跟著圖走的值；color 建立時決定、之後不能改；entry 指向預設 Uniform，名字與型別照表、網頁端鎖住。
const colorTypes = ['vec3', 'vec4'];
const presetTable = new Map(uniform_presets_1.uniformPresets.map(preset => [preset.entry, preset]));
const uniformKind = { kind: 'uniform', role: 'source', colorGroup: 'uniform', types: numeric_1.types, constant: false,
    declared: true, optional: ['color', 'entry'],
    validate: d => {
        numericValue(d);
        if (d.color !== undefined && typeof d.color !== 'boolean')
            throw Error('Color must be true or false');
        if (d.color === true && !colorTypes.includes(d.type))
            throw Error('Only vec3 and vec4 can be a colour');
        if (d.entry === undefined)
            return;
        const preset = presetTable.get(String(d.entry));
        if (!preset)
            throw Error('Unknown Uniform preset');
        if (d.name !== preset.name || d.type !== preset.type || d.color === true)
            throw Error('A preset Uniform keeps its own name and type');
    },
    initial: numericFields.initial,
    retype: numericFields.retype,
    prepare: entry => {
        if (entry.entry === undefined)
            return entry;
        const preset = presetTable.get(String(entry.entry));
        if (!preset)
            throw Error('Unknown Uniform preset');
        return { ...entry, name: preset.name, type: preset.type };
    },
    checkChange: (before, after) => {
        if ((before.color === true) !== (after.color === true))
            throw Error('A Uniform is a colour or not from the moment it is created');
        if (before.entry !== after.entry)
            throw Error('A preset Uniform keeps its preset');
    },
    header: (d) => 'uniform ' + d.type + ' ' + d.name + ';' };
/** Default images a TOP texture input shows when nothing is connected from outside (graph-structure
 * `defaultTexture`; human 2026-10-09: the Samples outputs, Grape first). `custom` is the TOP chosen
 * on the Grape OP's Samples. How TD provides them is TD's business (Q45).
 * 外面沒接東西時用的預設圖（人類 10-09：Samples 的出口，預設 Grape）；custom＝Samples 上自選的 TOP。 */
exports.defaultTextures = Object.freeze(['grape', 'banana', 'jellybeans', 'white', 'black', 'normal', 'custom']);
const textureOutputs = Object.freeze([
    { key: 'out', direction: 'output', type: 'sampler2D' },
    { key: 'size', direction: 'output', type: 'vec2' },
    { key: 'pixelSize', direction: 'output', type: 'vec2' },
].map(port => Object.freeze(port)));
// TOP texture input (graph-structure decision 5, Q44; texture-inputs.md): every one becomes an input
// of the Grape OP, in list order; the GLSL index is its position. TD declares sTD2DInputs, so no header.
// TOP 貼圖輸入：每一筆都成為 Grape OP 的輸入接口、照清單順序；GLSL 索引是它的位置。TD 自己宣告 sTD2DInputs。
const topInputKind = { kind: 'topInput', role: 'source', colorGroup: 'sampler', types: ['sampler2D'], constant: false,
    ordered: true, outputs: textureOutputs,
    initial: () => ({ defaultTexture: 'grape' }),
    validate: d => {
        if (d.type !== 'sampler2D')
            throw Error('Unsupported declaration type');
        if (!exports.defaultTextures.includes(String(d.defaultTexture)))
            throw Error('Unknown default texture');
    },
    reference: (_d, i) => ({ out: 'sTD2DInputs[' + i + ']', size: 'uTD2DInfos[' + i + '].res.zw', pixelSize: 'uTD2DInfos[' + i + '].res.xy' }) };
exports.declarationKinds = new Map([constantKind, uniformKind, topInputKind].map(module => [module.kind, Object.freeze(module)]));
function declarationNameProblem(graph, name, except) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name) || name.includes('__'))
        return 'format';
    if (/^(gl_|TD|sTD|uTD|sg_)/.test(name) || identifier_rules_1.identifierRules.reservedNames.includes(name))
        return 'reserved';
    if (graph.declarations.some(d => d.name === name && d.id !== except))
        return 'taken';
    return null;
}
class DeclarationError extends Error {
    constructor(problem, subject) {
        super('Declaration ' + problem + (subject ? ': ' + subject : ''));
        this.problem = problem;
        this.subject = subject;
        this.name = 'DeclarationError';
    }
}
exports.DeclarationError = DeclarationError;
const kindOf = (kind) => { const module = exports.declarationKinds.get(kind); if (!module)
    throw new DeclarationError('kind'); return module; };
const requireName = (graph, name, except) => {
    const problem = declarationNameProblem(graph, name, except);
    if (problem)
        throw new DeclarationError(problem, name);
};
/** A free name from a base, e.g. constant1, constant2. 從基底找一個沒被用的名字。 */
function freeDeclarationName(graph, base) {
    for (let i = 1;; i++)
        if (!declarationNameProblem(graph, base + i))
            return base + i;
}
/** A free name as the legacy editor gives one (legacy functions_ui.js uniqueInputName; human 2026-10-09): the base itself,
 * then base2, base3 — uValue, uColor, cValue. 照舊產品給名字：先用基底本身，再 base2、base3。 */
function freeLegacyName(graph, base) {
    if (!declarationNameProblem(graph, base))
        return base;
    for (let i = 2;; i++)
        if (!declarationNameProblem(graph, base + i))
            return base + i;
}
// Only the kind's own fields can be set (decision 11). 只能設定 kind 自己的欄位。
function setOwnFields(module, declaration, fields) {
    var _a;
    const own = [...Object.keys(module.initial(declaration.type)), ...((_a = module.optional) !== null && _a !== void 0 ? _a : [])];
    for (const [field, value] of Object.entries(fields))
        if (!['id', 'kind', 'name', 'type'].includes(field) && value !== undefined) {
            if (!own.includes(field))
                throw new DeclarationError('field', field);
            declaration[field] = (0, model_1.copy)(value);
        }
}
/** Commands, used inside GraphDocument.change() on its editable candidate document.
 * 指令：在 GraphDocument.change() 的可編輯候選文件上使用。 */
function addDeclaration(graph, given) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(given.id) || graph.declarations.some(d => d.id === given.id))
        throw Error('Invalid or duplicate declaration ID');
    const module = kindOf(given.kind), entry = module.prepare ? module.prepare(given) : given;
    if (!module.types.includes(entry.type))
        throw new DeclarationError('type');
    requireName(graph, entry.name);
    const declaration = { id: entry.id, kind: entry.kind, name: entry.name, type: entry.type, ...module.initial(entry.type) };
    setOwnFields(module, declaration, entry);
    module.validate(declaration);
    graph.declarations.push(declaration);
    return declaration;
}
/** Rename, retype or change the kind's own fields (value, defaultTexture…). A new type reshapes the
 * old value (Q37 1-3: wires that no longer fit become ghost wires, nothing is unplugged).
 * 改名、改型別、改 kind 自己的欄位；改型別時沿用舊值的分量。 */
function changeDeclaration(graph, id, patch) {
    var _a, _b;
    const declaration = graph.declarations.find(d => d.id === id);
    if (!declaration)
        throw new DeclarationError('missing');
    const module = kindOf(declaration.kind);
    const next = { ...(0, model_1.copy)(declaration) };
    if (patch.name !== undefined && patch.name !== declaration.name) {
        requireName(graph, patch.name, id);
        next.name = patch.name;
    }
    if (patch.type !== undefined && patch.type !== declaration.type) {
        if (!module.types.includes(patch.type))
            throw new DeclarationError('type');
        next.type = patch.type;
        Object.assign(next, (_a = module.retype) === null || _a === void 0 ? void 0 : _a.call(module, declaration, patch.type));
    }
    setOwnFields(module, next, patch);
    (_b = module.checkChange) === null || _b === void 0 ? void 0 : _b.call(module, declaration, next);
    module.validate(next);
    Object.assign(declaration, next);
    return declaration;
}
/** Removing a declaration on purpose also removes the nodes that refer to it and their wires, in
 * the same step (one Undo). Ghosts are for what is missing by accident, not for deliberate removals.
 * 刻意刪除宣告時，引用它的節點與線一起刪（同一步、一次 Undo）；Ghost 是給「意外不見」的，不是給刻意刪除。 */
function removeDeclaration(graph, id, refersTo) {
    if (!graph.declarations.some(d => d.id === id))
        throw new DeclarationError('missing');
    graph.declarations = graph.declarations.filter(d => d.id !== id);
    for (const network of Object.values(graph.stages)) {
        const gone = new Set(network.nodes.filter(n => refersTo(n.nodeType, n.params) === id).map(n => n.id));
        if (!gone.size)
            continue;
        network.nodes = network.nodes.filter(n => !gone.has(n.id));
        network.edges = network.edges.filter(e => !gone.has(e.from[0]) && !gone.has(e.to[0]));
    }
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
    const base = { id: 'projection', nodeType: definition.definitionUuid, params: (0, model_1.copy)(definition.defaults) };
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
        resourceTypes: [...values.opaque], specConstantTypes: [],
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
"ghosts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ghostsOf = ghostsOf;
function ghostsOf(network, policy) {
    var _a;
    const nodes = new Map();
    // Subgraph networks have no stage of their own; their nodes follow the calling stage.
    const stage = network.id.startsWith('function:') ? undefined : network.id;
    for (const node of network.nodes) {
        const data = node.data, module = node.definition;
        const referred = (_a = module === null || module === void 0 ? void 0 : module.referencedDeclaration) === null || _a === void 0 ? void 0 : _a.call(module, data);
        if (!module)
            nodes.set(node.id, 'unknown');
        else if (stage && module.catalog.definition.stages && !module.catalog.definition.stages.includes(stage))
            nodes.set(node.id, 'misplaced');
        // Declarations are referred to only at the top level of a stage (Q41). 宣告只在 stage 最外層引用。
        else if (referred !== undefined && !stage)
            nodes.set(node.id, 'misplaced');
        else if (referred !== undefined && !network.context.declaration(referred))
            nodes.set(node.id, 'missing');
        else if (!module.supports(data, network.context))
            nodes.set(node.id, 'unknown');
        else {
            // Ports that cannot be worked out make it a ghost too. 算不出接孔也是 Ghost。
            try {
                void node.interface;
            }
            catch (_b) {
                nodes.set(node.id, 'unknown');
            }
        }
    }
    const edges = new Set(), edgeData = new Set();
    for (const edge of network.edges) {
        const data = edge.data;
        if (nodes.has(data.from[0]) || nodes.has(data.to[0]) || !edge.connection(policy).valid) {
            edges.add(edge.id);
            edgeData.add(data);
        }
    }
    return { nodes, edges, edgeData };
}

},
"graph":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphDocument = exports.GraphError = exports.Network = exports.Edge = exports.Node = exports.Port = exports.ScopeReferences = exports.prepareNodeWire = exports.contextFor = exports.changesBetween = void 0;
const model_1 = require("./model");
const node_module_1 = require("./node_module");
const ports_1 = require("./ports");
const wire_planning_1 = require("./wire_planning");
const changes_1 = require("./changes");
const capacity_1 = require("./capacity");
const structure_1 = require("./structure");
var changes_2 = require("./changes");
Object.defineProperty(exports, "changesBetween", { enumerable: true, get: function () { return changes_2.changesBetween; } });
var node_module_2 = require("./node_module");
Object.defineProperty(exports, "contextFor", { enumerable: true, get: function () { return node_module_2.contextFor; } });
Object.defineProperty(exports, "prepareNodeWire", { enumerable: true, get: function () { return node_module_2.prepareNodeWire; } });
const subgraphs_1 = require("./subgraphs");
const subgraph_operations_1 = require("./subgraph_operations");
const subgraph_copies_1 = require("./subgraph_copies");
const declarations_1 = require("./declarations");
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
        return this.module; const data = this.data, value = data && this.network.graph.registry.get(data.nodeType); if (!this.network.graph.editable)
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
        if (Object.keys(patch).some(k => !['params', 'inputValues', 'ui', 'name', 'comment'].includes(k)))
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
        if (candidate.id !== node.id || candidate.nodeType !== node.nodeType)
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
                this.network.disconnectAll(removed, false);
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
    get context() { var _a; return (0, node_module_1.contextFor)(this.graph.document, (_a = this.graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.find(f => f.graph === this.data)); }
    node(id) { let n = this.nodeHandles.get(id); if (!n) {
        n = new Node(this, id);
        this.nodeHandles.set(id, n);
    } return n; }
    nodeData(id) {
        const slot = this.nodeSlots.get(id), current = slot === undefined ? undefined : this.data.nodes[slot];
        // A change() candidate is editable: its operations may replace array entries
        // without changing their count. Validate the indexed slot, never just the length.
        // change() 的候選圖可編輯，操作可能換掉陣列項目而長度不變，所以要核對索引位置。
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
    create(id, nodeType, params = {}) {
        return this.insert({ id, nodeType, params });
    }
    /** Insert authored node data through the same validation/ownership seam. */
    insert(authored) {
        const { id, nodeType } = authored;
        this.assertEditable();
        if (!id || this.nodeData(id) || this.removedNodes.has(id))
            throw Error('Invalid, duplicate or retired node ID');
        const module = this.graph.registry.get(nodeType);
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
            if (typeof n.nodeType !== 'string' || !n.nodeType || !n.params || typeof n.params !== 'object' || Array.isArray(n.params))
                throw Error('Invalid fragment node');
            const module = this.graph.registry.get(n.nodeType);
            if (module === null || module === void 0 ? void 0 : module.supports(n, this.context)) {
                module.validate(n, this.context);
                (0, node_module_1.resolvePorts)(module, n, this.context);
            }
            else if (options.unavailable !== 'preserve')
                throw Error('Node module or configuration is unavailable');
        }
        const edgeIds = new Set(this.data.edges.map(e => e.id));
        for (const e of edges) {
            for (const end of [e.from, e.to])
                if (!Array.isArray(end) || end.length !== 2 || end.some(v => typeof v !== 'string' || !v) || !ids.has(end[0]))
                    throw Error('Invalid fragment endpoint');
            const input = JSON.stringify(e.to);
            if (ports.has(input))
                throw Error('Fragment input already connected');
            ports.add(input);
            e.id = newEdgeId(edgeIds);
            edgeIds.add(e.id);
        }
        this.data.nodes.push(...nodes);
        this.data.edges.push(...edges);
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
        const roots = this.data.nodes.filter(n => ids.has(n.id)).map(n => { var _a, _b; return (_b = (_a = this.graph.registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n); }).filter((id) => !!id);
        ids.forEach(id => this.removedNodes.add(id));
        this.data.nodes = this.data.nodes.filter(n => !ids.has(n.id));
        const removed = this.data.edges.filter(e => ids.has(e.from[0]) || ids.has(e.to[0]));
        this.data.edges = this.data.edges.filter(e => !ids.has(e.from[0]) && !ids.has(e.to[0]));
        this.unwired(removed.filter(e => !ids.has(e.to[0])));
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
            return { id: n.id, definition: data.nodeType, stored: overrides.get(n.id) || (prepared.has(n.id) ? (0, node_module_1.resolvePorts)(module, prepared.get(n.id), this.context).types() : n.interface.types()),
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
        // A change() candidate's operations edit its private copy in place, so it rescans.
        // Immutable compiler views build this index once and never pay the rescan.
        // change() 候選圖會就地修改自己的私有複本，所以重掃；唯讀的產碼視圖只建一次索引。
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
     * the adjacency index; editable change() candidates refresh it for in-place edits. */
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
        const before = this.data.edges;
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
            throw e;
        }
    }
    disconnect(edge) {
        this.disconnectAll([edge]);
    }
    disconnectAll(edges, notify = true) {
        this.assertEditable();
        if (edges.some(e => e.network !== this))
            throw Error('Edge belongs to another network');
        this.indexEdges();
        const targets = new Set(edges.map(e => this.edgeIndex.get(e.id)).filter(e => !!e));
        if (!targets.size)
            return;
        this.data.edges = this.data.edges.filter(e => !targets.has(e));
        if (notify)
            this.unwired([...targets]);
    }
    /** After wires are removed, each node that lost the wire into an input may undo the input change it made (Q65:
     * unwire). 線拿掉之後，失去某個輸入的線的節點，可以還原那條線造成的輸入調整（Q65）。 */
    unwired(removed) {
        for (const e of removed) {
            const node = this.node(e.to[0]), data = node.data, module = node.definition;
            if (!data || !(module === null || module === void 0 ? void 0 : module.unwire) || !module.supports(data, this.context) || !node.interface.inputs[e.to[1]])
                continue;
            const wired = this.data.edges.filter(x => x.to[0] === e.to[0]).map(x => x.to[1]);
            if (wired.includes(e.to[1]))
                continue; // still wired 還接著線
            const next = (0, node_module_1.prepareNodeUnwire)(module, data, e.to[1], wired, this.context);
            if ((0, changes_1.equal)(data, next))
                continue;
            for (const key of Object.keys(data))
                if (!Object.prototype.hasOwnProperty.call(next, key))
                    delete data[key];
            Object.assign(data, next);
        }
    }
}
exports.Network = Network;
/** Edge identity is a random, unique string like node IDs; order carries no meaning (Q44).
 * Only language built-ins, so the core runs in any host; uniqueness is checked, not assumed.
 * 接線 id 跟節點一樣隨機產生，只要不重複；先後沒有意義。只用語言內建功能，不重複由檢查保證。 */
function newEdgeId(taken) {
    for (;;) {
        let id = 'e';
        for (let i = 0; i < 4; i++)
            id += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
        if (!taken.has(id))
            return id;
    }
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
    /** Declarations (declarations.ts): add, rename／retype／revalue, remove with its references. */
    addDeclaration(entry) { this.assertEditable(); return (0, declarations_1.addDeclaration)(this.document, entry); }
    changeDeclaration(id, patch) { this.assertEditable(); return (0, declarations_1.changeDeclaration)(this.document, id, patch); }
    removeDeclaration(id) {
        this.assertEditable();
        (0, declarations_1.removeDeclaration)(this.document, id, (nodeType, params) => { var _a, _b; return (_b = (_a = this.registry.get(nodeType)) === null || _a === void 0 ? void 0 : _a.referencedDeclaration) === null || _b === void 0 ? void 0 : _b.call(_a, { id: '', nodeType, params: params }); });
    }
    assertEditable() { if (!this.editable || !this.active)
        throw Error('Graph changes require an active transaction'); }
    close() { this.active = false; }
    nextEdgeId(data) {
        this.assertEditable();
        return newEdgeId(new Set(data.edges.map(e => e.id)));
    }
    snapshot() { return clone(this.document); }
    /** One candidate, one publication. History stores this before/after pair;
     * host receipts and UI selections remain the application's responsibility. */
    change(edit) {
        const before = this.snapshot(), candidate = new GraphDocument(clone(before), this.registry, this.fallback, true);
        try {
            edit(candidate);
            if (!(0, changes_1.equal)(before, candidate.document))
                complete(candidate.document);
            const after = candidate.snapshot();
            // The one gate every edit passes: refuse growth beyond the core limits (capacity.ts) and
            // edits that break the graph's structure rules (structure.ts).
            // 每次修改都經過的唯一關卡：超過核心上限的「變大」、破壞結構規則的修改，整筆拒絕。
            (0, capacity_1.requireCapacity)(before, after, this.registry);
            (0, structure_1.requireStructure)(before, after, this.registry);
            return { before, after, changes: (0, changes_1.changesBetween)(before, after, this.registry) };
        }
        finally {
            candidate.close();
        }
    }
}
exports.GraphDocument = GraphDocument;
function networkEntries(document) {
    return [...Object.entries(document.stages), ...(document.subgraphs || []).map(raw => { const f = raw; return ['function:' + f.id, f.graph]; })];
}
function complete(document) {
    const snapshots = new Set((document.subgraphs || []).filter(f => f.scope !== 'local').map(f => f.graph));
    for (const [, data] of networkEntries(document)) {
        const nodes = new Set(), edges = new Set(), taken = new Set();
        for (const n of data.nodes) {
            if (!n.id || nodes.has(n.id))
                throw Error('Invalid or duplicate node ID');
            nodes.add(n.id);
        }
        for (const e of data.edges)
            taken.add(e.id);
        for (const e of data.edges) {
            // Source snapshots keep their authored bytes. Their read-only Edge
            // handles already have temporary identities; only local data gets IDs.
            if (!e.id && snapshots.has(data))
                continue;
            if (!e.id) {
                e.id = newEdgeId(taken);
                taken.add(e.id);
            }
            if (edges.has(e.id))
                throw Error('Duplicate edge ID');
            edges.add(e.id);
        }
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
exports.GRAPH_VERSION = exports.GRAPH_FORMAT = void 0;
exports.object = object;
exports.copy = copy;
exports.formatProblem = formatProblem;
exports.GRAPH_FORMAT = 'grape-graph';
exports.GRAPH_VERSION = 1;
function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : undefined; }
/** Own JSON values at mutation boundaries; callers never retain editable state. */
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function formatProblem(value) {
    const g = value;
    if (!g || typeof g !== 'object' || Array.isArray(g))
        return { code: 'invalid', message: 'The graph is not a JSON object.' };
    if (g.format !== exports.GRAPH_FORMAT)
        return { code: 'not-grape-graph', message: 'This is not a grape-graph document (older graphs are opened by the importer).' };
    if (!Number.isSafeInteger(g.version) || g.version < 1)
        return { code: 'invalid', message: 'The graph format version is missing or invalid.' };
    if (g.version > exports.GRAPH_VERSION)
        return { code: 'newer-version', message: `This graph was saved by a newer Grape (format version ${g.version}); update Grape to edit it.` };
    if (typeof g.target !== 'string' || !Array.isArray(g.declarations) || !g.stages || typeof g.stages !== 'object')
        return { code: 'invalid', message: 'The graph is missing target, declarations or stages.' };
    const networks = [...Object.values(g.stages), ...(Array.isArray(g.subgraphs) ? g.subgraphs.map(f => f && f.graph) : [])];
    for (const n of networks) {
        const data = n;
        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges))
            return { code: 'invalid', message: 'A network is missing nodes or edges.' };
        if (data.nodes.some(node => !node || typeof node.id !== 'string' || typeof node.nodeType !== 'string'))
            return { code: 'invalid', message: 'A node is missing id or nodeType.' };
        if (data.edges.some(edge => !edge || typeof edge.id !== 'string' || !edge.id))
            return { code: 'invalid', message: 'An edge is missing its id.' };
    }
    return null;
}

},
"node_module":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextFor = contextFor;
exports.createRegistry = createRegistry;
exports.configureNode = configureNode;
exports.editNode = editNode;
exports.prepareNodeWire = prepareNodeWire;
exports.prepareNodeUnwire = prepareNodeUnwire;
exports.resolvePorts = resolvePorts;
const model_1 = require("./model");
const ports_1 = require("./ports");
function contextFor(graph, owner) {
    return { target: graph.target, owner, declaration: id => graph.declarations.find(d => d.id === id), declarations: () => graph.declarations,
        subgraph: id => { var _a; return (_a = graph.subgraphs) === null || _a === void 0 ? void 0 : _a.find(f => f.id === id); } };
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
    if (candidate.id !== node.id || candidate.nodeType !== node.nodeType)
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
    if (candidate.id !== node.id || candidate.nodeType !== node.nodeType)
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
    if (edit.node.id !== node.id || edit.node.nodeType !== node.nodeType || !module.supports(edit.node, context))
        throw Error('Wire preparation changed identity/capability');
    module.validate(edit.node, context);
    const after = resolvePorts(module, edit.node, context).types();
    if (!sameTypes(before.outputs, after.outputs) || edit.replaceInputs.some(p => !before.inputs[p]))
        throw Error('Wire preparation changed outputs or unknown ports');
    return edit;
}
function prepareNodeUnwire(module, node, key, wired, context) {
    if (!module.unwire)
        throw Error('Node has no unwire preparation');
    const before = resolvePorts(module, node, context).types(), candidate = module.unwire((0, model_1.copy)(node), key, context);
    if (candidate.id !== node.id || candidate.nodeType !== node.nodeType || !module.supports(candidate, context))
        throw Error('Unwire changed identity/capability');
    module.validate(candidate, context);
    const after = resolvePorts(module, candidate, context).types();
    if (!sameTypes(before.outputs, after.outputs) || wired.some(p => after.inputs[p] !== before.inputs[p]))
        throw Error('Unwire changed outputs or a wired input');
    return (0, model_1.copy)(candidate);
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
exports.vectorAssembly = exports.values = exports.payload = exports.output = exports.input = exports.reshapeInputs = exports.typedNode = exports.staticNode = exports.usableTdValue = exports.selectedType = exports.requireSubgraph = exports.numericInterface = exports.subgraphPresentation = exports.subgraphPorts = exports.numericTypes = exports.fill = exports.type = exports.literal = void 0;
exports.reshapeDefaults = reshapeDefaults;
exports.fixedPorts = fixedPorts;
exports.literalNode = literalNode;
exports.vectorNode = vectorNode;
exports.binaryNode = binaryNode;
exports.unaryNode = unaryNode;
exports.numericCall = numericCall;
exports.declarationNode = declarationNode;
exports.tdValueNode = tdValueNode;
exports.outputNode = outputNode;
/** Small developer entry point. Builtins and developer modules share this API. */
const model_1 = require("./model");
const numeric_1 = require("./numeric");
const declarations_1 = require("./declarations");
const td_values_1 = require("./td_values");
const values_1 = require("./values");
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
    // Value nodes are drawn as constants (legacy graph_ui.js:148). 值節點畫成常數色（照舊產品）。
    return { catalog, role: 'value', colorGroup: 'constant', supports: n => numeric(n) && (!!fixed || n.params.type === undefined || n.params.type === 'float'),
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
/** The one node that refers to a declaration (design-interview Q45; human 2026-10-09): what it
 * gives and whether that is a constant comes from the declaration's kind module. Missing target:
 * a ghost (ghosts.ts). Only at the top level of a stage (Q41): never inside a subgraph.
 * 引用宣告的唯一節點：給什麼、是不是常數由那筆宣告的 kind 決定；指向不存在＝Ghost；只在 stage 最外層。 */
function declarationNode(catalog) {
    const target = (n, c) => c.declaration(String(n.params.declarationId));
    const kindOf = (n, c) => { const d = target(n, c); return d && declarations_1.declarationKinds.get(d.kind); };
    return { catalog, role: 'value', referencedDeclaration: n => String(n.params.declarationId),
        supports: (n, c) => { var _a; return !c.owner && (!target(n, c) || !!((_a = kindOf(n, c)) === null || _a === void 0 ? void 0 : _a.types.includes(target(n, c).type))); },
        // What a reference gives comes from the kind (a TOP texture input gives three outputs).
        // 引用時給哪些輸出由 kind 決定（TOP 貼圖輸入給三個）。
        ports: (n, c) => { var _a, _b; const d = target(n, c); if (!d)
            throw Error('The declaration no longer exists'); return (_b = (_a = kindOf(n, c)) === null || _a === void 0 ? void 0 : _a.outputs) !== null && _b !== void 0 ? _b : outputPorts[(0, numeric_1.type)(d.type)]; },
        validate: () => { },
        // It switches only among declarations of the same kind: another kind gives other outputs.
        // 只在同一種宣告之間切換：別的種類給的輸出不同。
        presentation: (n, c) => {
            var _a;
            const d = target(n, c), choices = (((_a = c.declarations) === null || _a === void 0 ? void 0 : _a.call(c)) || []).filter(x => declarations_1.declarationKinds.has(x.kind) && (!d || x.kind === d.kind));
            return { label: d === null || d === void 0 ? void 0 : d.name, inlineControls: [{ kind: 'select', key: 'declaration', label: 'declaration', literal: true, command: 'declaration', value: String(n.params.declarationId),
                        options: choices.map(x => ({ value: x.id, label: x.name, literal: true })) }] };
        },
        edit: (n, command, value, c) => {
            var _a, _b;
            if (command !== 'declaration')
                throw Error('Unknown command');
            const id = String((_b = (_a = (0, model_1.object)(value)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : value), next = c.declaration(id), current = target(n, c);
            if (!next)
                throw Error('The declaration no longer exists');
            if (current && current.kind !== next.kind)
                throw Error('A reference switches only among declarations of the same kind');
            n.params.declarationId = id;
            return n;
        },
        emit: (n, c) => { var _a; return ({ outputs: c.referenceDeclaration(String(n.params.declarationId)), constant: !!((_a = kindOf(n, c)) === null || _a === void 0 ? void 0 : _a.constant) }); } };
}
/** TD built-in values (Q45 01, discuss-4.14 §10): one node type picks one entry of the table
 * beside it (td_values.ts) by `entry`; no declaration, so it may be used inside subgraphs (Q46).
 * This round carries entries of plain value types without parameters; samplers, structs, arrays,
 * matrices and entries with an index ({layer}…) come with their rounds — until then a graph that
 * uses one shows a ghost. An unknown entry is a ghost too.
 * TD 內建值：一個節點類型依 entry 從旁邊的表選一筆；不需要宣告、子圖裡也能用。
 * 本輪只接一般數值型別、不帶參數的；其他等各自那一輪，之前是 Ghost。 */
const tdValueTable = new Map(td_values_1.tdValues.map(entry => [entry.id, entry]));
const tdValuePorts = new Map();
const tdValuePort = (t) => { let p = tdValuePorts.get(t); if (!p) {
    p = fixedPorts([out(t)]);
    tdValuePorts.set(t, p);
} return p; };
/** Whether this build can use an entry for a target. 這個版本能不能在這個 target 用這一筆。 */
const usableTdValue = (entry, target) => !!entry && (!target || entry.targets.includes(target))
    && values_1.types.includes(entry.type) && !entry.expression.includes('{');
exports.usableTdValue = usableTdValue;
function tdValueNode(catalog) {
    const entryOf = (n) => tdValueTable.get(String(n.params.entry));
    return { catalog, role: 'value', colorGroup: 'runtime',
        supports: (n, c) => (0, exports.usableTdValue)(entryOf(n), c.target),
        ports: n => tdValuePort(entryOf(n).type), validate: () => { },
        presentation: (n, c) => {
            var _a;
            return ({ label: (_a = entryOf(n)) === null || _a === void 0 ? void 0 : _a.name, inlineControls: [{ kind: 'select', key: 'entry', label: 'entry', literal: true, command: 'entry',
                        value: String(n.params.entry), options: td_values_1.tdValues.filter(e => (0, exports.usableTdValue)(e, c.target)).map(e => ({ value: e.id, label: e.name, literal: true })) }] });
        },
        edit: (n, command, value, c) => {
            var _a, _b;
            if (command !== 'entry')
                throw Error('Unknown command');
            const id = String((_b = (_a = (0, model_1.object)(value)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : value);
            if (!(0, exports.usableTdValue)(tdValueTable.get(id), c.target))
                throw Error('Unknown TD built-in value');
            n.params.entry = id;
            return n;
        },
        emit: n => ({ outputs: { out: entryOf(n).expression } }) };
}
/** Terminal family with a shared, immutable port layout. The owning node
 * supplies target capabilities, controls, validation and shader statements. */
function outputNode(catalog, spec) {
    const { ports, ...implementation } = spec;
    const inputsOnly = (specs) => { if (specs.some(p => p.direction !== 'input'))
        throw Error('Terminal nodes only have input ports'); return specs; };
    // Fixed layout, or one chosen per node (e.g. Color Output follows what is wired in, Q46).
    if (typeof ports === 'function')
        return { ...implementation, catalog, role: 'output', ports: (n, c) => inputsOnly(ports(n, c)) };
    const layout = fixedPorts([...inputsOnly(ports)]);
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
"nodes/declaration":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
// The reference node (design-interview Q45, discuss-4.14 §10): points to one declaration; the
// canvas title shows that declaration's name. Created from the Sources panel, not the add menu.
// 引用宣告節點：指向一筆宣告；畫布標題顯示那一筆的名字。由共用來源面板建立，不在新增選單。
const catalog = {
    "definition": {
        "key": "declaration",
        "label": "Shared Source",
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
        "descriptionKey": "help.declaration",
        "definitionUuid": "sgrape.builtin.declaration"
    },
    "emitter": {
        "id": "declaration",
        "version": 1
    },
    "browser": {
        "category": "inputs",
        "source": "editor",
        "aliases": [
            "source",
            "constant",
            "declaration"
        ],
        "glslName": "declaration",
        "secondaryCategories": [],
        "categoryPath": [
            "inputs",
            "shared"
        ]
    }
};
// Made from the Sources panel, which knows what it points to (Q45): not in the add menu.
// 由共用來源面板建立（面板知道它指向哪一筆），不在新增選單。
exports.default = { ...(0, node_sdk_1.declarationNode)(catalog), entries: () => [] };

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
// Retired: opens old graphs, not offered (legacy functions_ui.js:76; Scalar／Vector make the same value).
// 已淘汰：能開舊圖、不在選單（舊產品同；同樣的值用 Scalar／Vector）。
exports.default = { ...(0, node_sdk_1.literalNode)(catalog, 'float'), entries: () => [] };

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
// Color Output takes any value and fills it to a colour (design-interview Q46): a single value
// (v, v, v, 1), vec2 (x, y, 0.5, 1), vec3 (r, g, b, 1), vec4 as it is; int and bool alike. The input
// follows what is wired in (`params.type`, set by `wire`); unset means vec4, as stored graphs were.
// Color Output 什麼都能接、自動補齊：輸入跟著接進來的型別；沒設定＝vec4（既有的圖照舊）。
const inputType = (n) => { var _a; return String((_a = n.params.type) !== null && _a !== void 0 ? _a : 'vec4'); };
const layouts = new Map();
const layout = (type) => {
    let ports = layouts.get(type);
    if (!ports) {
        const empty = node_sdk_1.values.family(type) === 'bool' ? node_sdk_1.values.fill(false, type) : node_sdk_1.values.fill(0, type);
        ports = (0, node_sdk_1.fixedPorts)([{ key: 'color', direction: 'input', type, default: type === 'vec4' ? [0, 0, 0, 1] : empty }]);
        layouts.set(type, ports);
    }
    return ports;
};
const fillToColor = (type, value) => {
    const count = node_sdk_1.values.count(type);
    if (type === 'vec4')
        return value; // exactly as before 與以前完全相同
    if (count === 1)
        return 'vec4(vec3(float(' + value + ')), 1.0)';
    if (count === 2)
        return 'vec4(vec2(' + value + '), 0.5, 1.0)';
    if (count === 3)
        return 'vec4(vec3(' + value + '), 1.0)';
    return 'vec4(' + value + ')';
};
exports.default = (0, node_sdk_1.outputNode)(catalog, {
    ports: n => layout(inputType(n)),
    supports: (n, c) => (!c.target || c.target === 'top') &&
        node_sdk_1.values.types.includes(inputType(n)) &&
        !flags.some(k => n.params[k]) &&
        !(n.params.bufferCount && n.params.bufferCount !== 1),
    validate: n => {
        if (n.params.bufferCount !== undefined && n.params.bufferCount !== 1)
            throw Error('TOP has one color output');
        for (const k of flags)
            if (n.params[k] !== undefined && typeof n.params[k] !== 'boolean')
                throw Error('Output finishing must be a boolean');
    },
    wire: (n, key, source) => {
        if (key !== 'color' || !node_sdk_1.values.types.includes(source))
            throw Error('Color Output takes a value');
        n.params.type = source;
        return { node: n, replaceInputs: ['color'] };
    },
    emit: (n, c) => ({
        outputs: {},
        statements: [
            '    vec4 sg_color = ' + fillToColor(inputType(n), c.input('color')) + ';',
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
// Drawn as a constant (legacy graph_ui.js:143). 畫成常數色（照舊產品）。
exports.default = { ...(0, node_sdk_1.typedNode)(catalog, {
        types: node_sdk_1.values.scalars,
        fixed: t => ({ value: node_sdk_1.values.reshape(0, t) }),
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
    }), colorGroup: 'constant' };

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
"nodes/td_value":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
// TD built-in value (design-interview Q45 01, discuss-4.14 §10): the canvas title is the entry's
// own name (vUV.st, uTDOutputInfo.res.zw…). Created from the Sources panel, not the add menu.
// TD 內建值：畫布標題是那一筆自己的名字。由共用來源面板建立，不在新增選單。
const catalog = {
    "definition": {
        "key": "td_value",
        "label": "TD Built-in",
        "inputs": {},
        "outputs": {
            "out": "D"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "entry": "vUVSt"
        },
        "descriptionKey": "help.td_value",
        "definitionUuid": "sgrape.builtin.td_value"
    },
    "emitter": {
        "id": "td_value",
        "version": 1
    },
    "browser": {
        "category": "inputs",
        "source": "editor",
        "aliases": [
            "builtin",
            "td",
            "uv",
            "resolution"
        ],
        "glslName": "td_value",
        "secondaryCategories": [],
        "categoryPath": [
            "inputs",
            "td"
        ]
    }
};
// Made from the Sources panel, which knows what it points to (Q45): not in the add menu.
// 由共用來源面板建立（面板知道它指向哪一筆），不在新增選單。
exports.default = { ...(0, node_sdk_1.tdValueNode)(catalog), entries: () => [] };

},
"nodes/texture_sample":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
// Texture 2D (Refactor.43; inventory 7.12: sampling is separate from the source): reads a texture
// at a coordinate. Unconnected coordinate: vUV.st, this pixel. Unconnected texture: opaque black
// (inventory 7.6), worked out by code generation and never stored in the graph.
// 取樣：以座標讀貼圖。座標沒接線＝vUV.st（這個像素）；貼圖沒接線＝不透明黑（產碼時決定，不存進圖）。
const catalog = {
    "definition": {
        "key": "texture_sample",
        "label": "Texture 2D",
        "inputs": {
            "sampler": "sampler2D",
            "uv": "vec2"
        },
        "outputs": {
            "out": "vec4"
        },
        "stages": [
            "pixel"
        ],
        "defaults": {},
        "descriptionKey": "help.texture_sample",
        "definitionUuid": "sgrape.builtin.texture_sample"
    },
    "emitter": {
        "id": "texture_sample",
        "version": 1
    },
    "browser": {
        "category": "texture",
        "source": "glsl",
        "aliases": [
            "sample",
            "texture",
            "lookup"
        ],
        "glslName": "texture",
        "secondaryCategories": [],
        "categoryPath": [
            "texture",
            "2d"
        ]
    }
};
const ports = (0, node_sdk_1.fixedPorts)([
    { key: 'sampler', direction: 'input', type: 'sampler2D' },
    { key: 'uv', direction: 'input', type: 'vec2', default: [0, 0], fallback: 'vUV.st' },
    { key: 'out', direction: 'output', type: 'vec4' },
]);
const textureSample = {
    catalog,
    role: 'value',
    supports: () => true,
    ports: () => ports,
    validate: () => { },
    emit: (_n, c) => ({
        outputs: {
            out: c.connected('sampler') ? 'texture(' + c.input('sampler') + ', ' + c.input('uv') + ')' : 'vec4(0.0, 0.0, 0.0, 1.0)',
        },
    }),
};
exports.default = textureSample;

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
// Retired: opens old graphs, not offered (legacy functions_ui.js:76; Scalar／Vector make the same value).
// 已淘汰：能開舊圖、不在選單（舊產品同；同樣的值用 Scalar／Vector）。
exports.default = { ...(0, node_sdk_1.literalNode)(catalog, 'vec2'), entries: () => [] };

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
// Retired: opens old graphs, not offered (legacy functions_ui.js:76; Scalar／Vector make the same value).
// 已淘汰：能開舊圖、不在選單（舊產品同；同樣的值用 Scalar／Vector）。
exports.default = { ...(0, node_sdk_1.literalNode)(catalog, 'vec3'), entries: () => [] };

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
// Retired: opens old graphs, not offered (legacy functions_ui.js:76; Scalar／Vector make the same value).
// 已淘汰：能開舊圖、不在選單（舊產品同；同樣的值用 Scalar／Vector）。
exports.default = { ...(0, node_sdk_1.literalNode)(catalog, 'vec4', true), entries: () => [] };

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
// Drawn as a constant (legacy graph_ui.js:143). 畫成常數色（照舊產品）。
exports.default = { ...(0, node_sdk_1.typedNode)(catalog, {
        types: node_sdk_1.values.vectors,
        fixed: t => ({ components: node_sdk_1.values.reshape([0, 0, 0, 0], node_sdk_1.values.shaped(node_sdk_1.values.family(t), 4)) }),
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
    }), colorGroup: 'constant' };

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
            target[spec.key] = Object.freeze({ key: spec.key, direction: spec.direction, type: spec.type, default: value === undefined ? undefined : freeze(value),
                ...(spec.fallback === undefined ? {} : { fallback: spec.fallback }) });
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
const opaque = new Set(['code', 'ui', 'source', 'origin', 'catalogSnapshot', 'comment', 'description', 'extensions']);
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
"structure":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructureError = exports.removable = exports.offered = void 0;
exports.structureProblems = structureProblems;
exports.requireStructure = requireStructure;
const stageOutput = (module) => (module === null || module === void 0 ? void 0 : module.role) === 'output';
/** Whether a module may be offered for adding a new node. 新增選單只提供這些。 */
const offered = (module) => !stageOutput(module);
exports.offered = offered;
/** Whether the user may delete this node. 能不能刪。 */
const removable = (module) => !stageOutput(module);
exports.removable = removable;
function counts(g, registry) {
    const count = (data) => data.nodes.filter(n => stageOutput(registry.get(n.nodeType))).length;
    return [
        ...Object.entries(g.stages || {}).map(([id, data]) => ({ key: 'stageOutputs', network: id, value: count(data), expected: 1 })),
        ...(g.subgraphs || []).map(f => ({ key: 'stageOutputs', network: 'function:' + f.id, value: count(f.graph), expected: 0 })),
    ];
}
const distance = (p) => Math.abs(p.value - p.expected);
/** Rules the graph currently breaks; used to report a graph when it is opened. */
function structureProblems(g, registry) {
    return counts(g, registry).filter(p => distance(p) > 0);
}
class StructureError extends Error {
    constructor(problems) {
        super('Graph structure rule: ' + problems.map(p => `${p.key} (${p.network}) ${p.value}, expected ${p.expected}`).join(', '));
        this.problems = problems;
        this.name = 'StructureError';
    }
}
exports.StructureError = StructureError;
/** Refuses edits that move a network further from the rule; repairs are always allowed. */
function requireStructure(before, after, registry) {
    const previous = new Map(counts(before, registry).map(p => [p.network, distance(p)]));
    const worse = counts(after, registry).filter(p => { var _a; return distance(p) > ((_a = previous.get(p.network)) !== null && _a !== void 0 ? _a : 0); });
    if (worse.length)
        throw new StructureError(worse);
}

},
"subgraph_compiler":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubgraphCompiler = createSubgraphCompiler;
/** Compile graph-owned subgraphs through a bounded, disposable expansion.
 * Node modules own interfaces; no imported library or DOM state is consulted. */
const model_1 = require("./model");
const config_1 = require("./config");
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
function createSubgraphCompiler(registry, engineFactory, config = config_1.CORE_CONFIG) {
    const engine = engineFactory((0, node_module_1.createRegistry)([...registry.modules, relay]));
    const identity = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
    const moduleOf = (node) => registry.get(node.nodeType);
    function supports(g) {
        var _a;
        if ((0, model_1.formatProblem)(g) || g.target !== 'top' || Object.keys(g.stages).join() !== 'pixel' ||
            ((_a = g.structDefinitions) === null || _a === void 0 ? void 0 : _a.length) || !Array.isArray(g.subgraphs) || g.subgraphs.length > config.subgraphDefinitions)
            return false;
        if (!g.declarations.every(d => d.kind === 'uniform' && numeric_1.types.includes(d.type)))
            return false;
        const scopes = [[g.stages.pixel, undefined], ...g.subgraphs.map(f => [f.graph, f])];
        return scopes.every(([data, owner]) => {
            var _a;
            if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length > config.nodesPerNetwork || data.edges.length > config.edgesPerNetwork || ((_a = data.ui) === null || _a === void 0 ? void 0 : _a.frames))
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
        if (JSON.stringify(g).length > config.documentBytes)
            throw Error('Graph is too large');
        const definitions = new Map();
        for (const f of g.subgraphs) {
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
                if (flat.nodes.length >= config.expandedNodes)
                    throw Error('Expanded Subgraph graph exceeds ' + config.expandedNodes + ' nodes');
                flat.nodes.push(n);
                origins.set(n.id, origin);
            };
            function expand(data, path, owner, boundary) {
                var _a, _b, _c, _d, _e;
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
                                // A boundary's comment follows its relay so the note stays at the boundary in GLSL.
                                // 邊界節點的 comment 跟著中繼節點，GLSL 裡註解仍在邊界的位置。
                                if (typeof node.comment === 'string' && node.comment.trim())
                                    target.comment = [target.comment, node.comment].filter(Boolean).join('\n');
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
                                    add({ id, nodeType: relay.catalog.definition.definitionUuid, params: { type: p.type },
                                        inputValues: { value: (0, model_1.copy)(direction === 'inputs' ? (_c = (_b = node.inputValues) === null || _b === void 0 ? void 0 : _b[p.id]) !== null && _c !== void 0 ? _c : p.default : p.default) },
                                        ...(node.ui ? { ui: (0, model_1.copy)(node.ui) } : {}), ...(node.comment ? { comment: node.comment } : {}) }, origin);
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
                    const from = (_d = maps.get(edge.from[0])) === null || _d === void 0 ? void 0 : _d.outputs[edge.from[1]], to = (_e = maps.get(edge.to[0])) === null || _e === void 0 ? void 0 : _e.inputs[edge.to[1]];
                    if (!from || !to)
                        throw Object.assign(Error('Connection endpoint no longer exists'), { node: edge.to[0], stage: 'pixel', trail: path, ...(owner ? { functionId: owner.id } : {}) });
                    flat.edges.push({ id: 'x' + flat.edges.length, from, to });
                }
            }
            if (probe) {
                const inside = { inputs: {}, outputs: {} };
                for (const direction of ['inputs', 'outputs'])
                    for (const p of probe[direction]) {
                        const id = allocate();
                        add({ id, nodeType: relay.catalog.definition.definitionUuid, params: { type: p.type }, inputValues: { value: (0, model_1.copy)(p.default) } }, { node: '', stage: 'pixel', trail: [probe.id], functionId: probe.id });
                        inside[direction][p.id] = [id, direction === 'inputs' ? 'out' : 'value'];
                    }
                expand(probe.graph, [probe.id], probe, inside);
                const output = registry.modules.find(m => m.role === 'output');
                add({ id: allocate(), nodeType: output.catalog.definition.definitionUuid, params: (0, model_1.copy)(output.catalog.definition.defaults) }, { node: '', stage: 'pixel', trail: [] });
            }
            else
                expand(g.stages.pixel, []);
            const { subgraphs, ...rest } = g;
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
const reference = (graph, n) => { var _a, _b; return (_b = (_a = graph.registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n); };
function parameters(graph, n, id) {
    var _a;
    const module = graph.registry.get(n.nodeType);
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
    const pending = definitions.map(f => (0, model_1.copy)(f)), used = new Set((graph.document.subgraphs || []).map(f => f.id));
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
    const all = new Map([...(graph.document.subgraphs || []), ...pending].map(f => [f.id, f]));
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
        ((_a = graph.document).subgraphs || (_a.subgraphs = [])).push(...pending);
    return pending;
}
/** Turn a source-owned definition and its source callers into editable local
 * copies. Stored source snapshots remain byte-for-byte authored data. */
function localizeSubgraph(graph, id, next) {
    graph.assertEditable();
    const definitions = graph.document.subgraphs || [], target = definitions.find(f => f.id === id);
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
        // `origin` already records where a snapshot came from; `scope` tells whether it is still one (Q44).
        // origin 已記錄來源；是否仍是唯讀副本由 scope 看出。
        f.id = ids.get(f.id);
        f.scope = 'local';
    }
    for (const p of patches)
        p.node.params = p.params;
    remapScopes([...Object.values(graph.document.stages), ...writable, graph.document.structDefinitions || []], ids);
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
    const id = reference(graph, n), source = (_a = graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.find(f => f.id === id);
    if (!source)
        return null;
    (0, subgraph_operations_1.ensureSubgraphCapacity)(graph, 1);
    const newId = allocate(new Set(graph.document.subgraphs.map(f => f.id)), next);
    const f = (0, model_1.copy)(source);
    f.id = newId;
    f.name = f.name.slice(0, 75) + ' Copy';
    f.scope = 'local';
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
const config_1 = require("./config");
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
    return { id, nodeType: d.definitionUuid, params: { ...(0, model_1.copy)(d.defaults), ...params }, ui };
}
function ensureSubgraphCapacity(graph, additional = 0) {
    var _a;
    if (!Number.isInteger(additional) || additional < 0)
        throw Error('Invalid definition count');
    if ((((_a = graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.length) || 0) + additional > config_1.CORE_CONFIG.subgraphDefinitions)
        throw Object.assign(Error('At most ' + config_1.CORE_CONFIG.subgraphDefinitions + ' Subgraph definitions are supported'), { code: 'function.limit' });
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
    if (ids.size !== f.graph.nodes.length || f.graph.nodes.length > config_1.CORE_CONFIG.nodesPerNetwork || f.graph.edges.length > config_1.CORE_CONFIG.edgesPerNetwork ||
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
    if (f.scope !== 'local' || ((_a = graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.some(d => d.id === f.id)))
        throw Error('Invalid or duplicate local Subgraph identity');
    validateSubgraphData(f);
}
function insertSubgraph(graph, f) {
    var _a;
    validate(graph, f);
    const owned = (0, model_1.copy)(f);
    ((_a = graph.document).subgraphs || (_a.subgraphs = [])).push(owned);
    return owned;
}
function createSubgraph(graph, options) {
    const input = structural(graph, 'input'), output = structural(graph, 'output');
    return insertSubgraph(graph, {
        id: options.id, name: options.name, scope: 'local', stages: [options.stage],
        inputs: [{ id: 'value', name: 'Value', type: 'vec4', default: [1, 1, 1, 1] }],
        outputs: [{ id: 'value', name: 'Value', type: 'vec4', default: [0, 0, 0, 1] }],
        graph: { nodes: [{ ...authored(input, 'input', { x: 48, y: 144 }), name: 'Input' }, { ...authored(output, 'output', { x: 624, y: 144 }), name: 'Output' }],
            edges: [{ id: graph.nextEdgeId({ nodes: [], edges: [] }), from: ['input', 'value'], to: ['output', 'value'] }] }
    });
}
function instantiateSubgraph(network, definitionId, id, ui = {}) {
    var _a;
    network.assertEditable();
    const graph = network.graph, f = (_a = graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.find(f => f.id === definitionId);
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
        const role = (_a = graph.registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.role;
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
    const owner = (_e = graph.document.subgraphs) === null || _e === void 0 ? void 0 : _e.find(f => f.graph === data), oldScope = owner ? 'fn_' + owner.id : network.id;
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
    const definitions = new Map((graph.document.subgraphs || []).map(f => [f.id, f]));
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
            if (n.nodeType && n.params) {
                const ref = (_b = (_a = graph.registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n);
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
    const candidates = closure(roots), retained = references({ ...graph.document, subgraphs: [], catalogSnapshot: undefined });
    for (const [id, f] of definitions)
        if (!candidates.has(id) || f.graph === active)
            retained.add(id);
    const keep = closure(retained);
    graph.document.subgraphs = (graph.document.subgraphs || []).filter(f => !candidates.has(f.id) || keep.has(f.id));
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
        return (_a = this.graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.find(f => f.id === this.id);
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
            ...(this.graph.document.subgraphs || []).map(d => d.graph)
        ];
        const affected = (node, data) => {
            var _a;
            const module = this.graph.registry.get(node.nodeType);
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
"td_values":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tdValues = void 0;
exports.tdValues = Object.freeze([
    { "id": "uTD2DInfos", "name": "uTD2DInfos", "expression": "uTD2DInfos", "type": "TDTexInfo[TD_NUM_2D_INPUTS]", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "2d"], "hint": "Metadata for each input texture of this dimension. res.xy is reciprocal size and res.zw is size.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "sTD2DInputs", "name": "sTD2DInputs", "expression": "sTD2DInputs", "type": "sampler2D[TD_NUM_2D_INPUTS]", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "2d"], "hint": "Array of connected sampler2D resources, grouped by texture dimension. Select an array item before sampling.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "uTDMats", "name": "uTDMats", "expression": "uTDMats", "type": "TDMatrix[TD_NUM_CAMERAS]", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "matrices"], "hint": "Camera-indexed transforms between geometry, world, camera and projection spaces. Select a camera entry, then its matrix field.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_Uniforms" },
    { "id": "uTDCamInfos", "name": "uTDCamInfos", "expression": "uTDCamInfos", "type": "TDCameraInfo[TD_NUM_CAMERAS]", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "cameras"], "hint": "Per-camera information supplied by the render pass, including camera projection data.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_Uniforms" },
    { "id": "uTDLights", "name": "uTDLights", "expression": "uTDLights", "type": "TDLight[TD_NUM_LIGHTS]", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "lights"], "hint": "Per-light data for regular lights in the current render pass. Environment lights have a separate array.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_Uniforms" },
    { "id": "tdNum2dInputs", "name": "TD_NUM_2D_INPUTS", "expression": "TD_NUM_2D_INPUTS", "type": "int", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "2d"], "hint": "Compile-time number of 2d inputs in this shader configuration.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "sTD3DInputs", "name": "sTD3DInputs", "expression": "sTD3DInputs", "type": "sampler3D[TD_NUM_3D_INPUTS]", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "3d"], "hint": "Array of connected sampler3D resources, grouped by texture dimension. Select an array item before sampling.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "uTD3DInfos", "name": "uTD3DInfos", "expression": "uTD3DInfos", "type": "TDTexInfo[TD_NUM_3D_INPUTS]", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "3d"], "hint": "Metadata for each input texture of this dimension. res.xy is reciprocal size and res.zw is size.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "tdNum3dInputs", "name": "TD_NUM_3D_INPUTS", "expression": "TD_NUM_3D_INPUTS", "type": "int", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "3d"], "hint": "Compile-time number of 3d inputs in this shader configuration.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "sTD2DArrayInputs", "name": "sTD2DArrayInputs", "expression": "sTD2DArrayInputs", "type": "sampler2DArray[TD_NUM_2D_ARRAY_INPUTS]", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "2dArray"], "hint": "Array of connected sampler2DArray resources, grouped by texture dimension. Select an array item before sampling.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "uTD2DArrayInfos", "name": "uTD2DArrayInfos", "expression": "uTD2DArrayInfos", "type": "TDTexInfo[TD_NUM_2D_ARRAY_INPUTS]", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "2dArray"], "hint": "Metadata for each input texture of this dimension. res.xy is reciprocal size and res.zw is size.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "tdNum2dArrayInputs", "name": "TD_NUM_2D_ARRAY_INPUTS", "expression": "TD_NUM_2D_ARRAY_INPUTS", "type": "int", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "2dArray"], "hint": "Compile-time number of 2d array inputs in this shader configuration.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "sTDCubeInputs", "name": "sTDCubeInputs", "expression": "sTDCubeInputs", "type": "samplerCube[TD_NUM_CUBE_INPUTS]", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "cube"], "hint": "Array of connected samplerCube resources, grouped by texture dimension. Select an array item before sampling.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "uTDCubeInfos", "name": "uTDCubeInfos", "expression": "uTDCubeInfos", "type": "TDTexInfo[TD_NUM_CUBE_INPUTS]", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "cube"], "hint": "Metadata for each input texture of this dimension. res.xy is reciprocal size and res.zw is size.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "tdNumCubeInputs", "name": "TD_NUM_CUBE_INPUTS", "expression": "TD_NUM_CUBE_INPUTS", "type": "int", "targets": ["top"], "stages": ["pixel"], "category": ["textures", "cube"], "hint": "Compile-time number of cube inputs in this shader configuration.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "uTDOutputInfo", "name": "uTDOutputInfo", "expression": "uTDOutputInfo", "type": "TDTexInfo", "targets": ["top"], "stages": ["pixel"], "category": ["tdBuiltin", "render"], "hint": "Output texture metadata. res.xy contains reciprocal dimensions; res.zw contains width and height.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "uTDOutputInfoResZw", "name": "uTDOutputInfo.res.zw", "expression": "uTDOutputInfo.res.zw", "type": "vec2", "targets": ["top"], "stages": ["pixel"], "category": ["common", "output"], "hint": "Output width and height in pixels.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms", "common": "resolution" },
    { "id": "uTDOutputInfoResXy", "name": "uTDOutputInfo.res.xy", "expression": "uTDOutputInfo.res.xy", "type": "vec2", "targets": ["top"], "stages": ["pixel"], "category": ["common", "output"], "hint": "Reciprocal output width and height.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "vUV", "name": "vUV", "expression": "vUV", "type": "vec3", "targets": ["top"], "stages": ["pixel"], "category": ["common", "coordinates"], "hint": "The original three-component TOP texture coordinates.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "uTDPass", "name": "uTDPass", "expression": "uTDPass", "type": "int", "targets": ["top"], "stages": ["pixel"], "category": ["tdBuiltin", "render"], "hint": "Zero-based GLSL TOP pass index for multipass rendering.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "uTDCurrentDepth", "name": "uTDCurrentDepth", "expression": "uTDCurrentDepth", "type": "int", "targets": ["top"], "stages": ["pixel"], "category": ["tdBuiltin", "render"], "hint": "Current output depth index when producing a layered or 3D TOP texture.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "sTDNoiseMap", "name": "sTDNoiseMap", "expression": "sTDNoiseMap", "type": "sampler2D", "targets": ["top"], "stages": ["pixel"], "category": ["tdBuiltin", "resources"], "hint": "TD-provided noise lookup texture; connect it to a compatible texture sampling input.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "sTDSineLookup", "name": "sTDSineLookup", "expression": "sTDSineLookup", "type": "sampler1D", "targets": ["top"], "stages": ["pixel"], "category": ["tdBuiltin", "resources"], "hint": "TD-provided one-dimensional sine lookup texture. TDSineLookup provides a direct lookup function.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Built-in_Uniforms" },
    { "id": "glFragCoord", "name": "gl_FragCoord", "expression": "gl_FragCoord", "type": "vec4", "targets": ["top", "mat"], "stages": ["pixel"], "category": ["common", "coordinates"], "hint": "The current fragment position in window coordinates.", "helpUrl": "https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf", "common": "fragCoord" },
    { "id": "glFrontFacing", "name": "gl_FrontFacing", "expression": "gl_FrontFacing", "type": "bool", "targets": ["top", "mat"], "stages": ["pixel"], "category": ["common", "shaderInfo"], "hint": "Whether this fragment belongs to a front-facing primitive.", "helpUrl": "https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf" },
    { "id": "glSampleID", "name": "gl_SampleID", "expression": "gl_SampleID", "type": "int", "targets": ["top", "mat"], "stages": ["pixel"], "category": ["common", "shaderInfo"], "hint": "Index of the current multisample sample.", "helpUrl": "https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf" },
    { "id": "glSamplePosition", "name": "gl_SamplePosition", "expression": "gl_SamplePosition", "type": "vec2", "targets": ["top", "mat"], "stages": ["pixel"], "category": ["common", "shaderInfo"], "hint": "The current sample position within its pixel.", "helpUrl": "https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf" },
    { "id": "glHelperInvocation", "name": "gl_HelperInvocation", "expression": "gl_HelperInvocation", "type": "bool", "targets": ["top", "mat"], "stages": ["pixel"], "category": ["common", "shaderInfo"], "hint": "Whether this is a helper invocation used for derivatives.", "helpUrl": "https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf" },
    { "id": "tdNormal", "name": "TDNormal", "expression": "TDNormal()", "type": "vec3", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "geometry"], "hint": "Normal of the current vertex before TD geometry deformation. Use TDDeformNorm for a deformed world-space normal.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Working_with_Geometry_Attributes" },
    { "id": "tdPointColor", "name": "TDPointColor", "expression": "TDPointColor()", "type": "vec4", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "geometry"], "hint": "Color attribute of the current point, including alpha.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Working_with_Geometry_Attributes" },
    { "id": "tduvUnwrapCoord", "name": "TDUVUnwrapCoord", "expression": "TDUVUnwrapCoord()", "type": "vec3", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "geometry"], "hint": "Coordinates used for the current UV-unwrapping render configuration.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Common_Functions" },
    { "id": "tdInstanceID", "name": "TDInstanceID", "expression": "TDInstanceID()", "type": "int", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "instances"], "hint": "Instance index supplied by TD for the geometry being rendered.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Instancing" },
    { "id": "tdCameraIndex", "name": "TDCameraIndex", "expression": "TDCameraIndex()", "type": "int", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "cameras"], "hint": "Camera index within the current render pass. Pass it flat to Pixel when indexing camera-specific data there.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Common_Functions" },
    { "id": "tdTrueCameraIndex", "name": "TDTrueCameraIndex", "expression": "TDTrueCameraIndex()", "type": "int", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "cameras"], "hint": "Camera index in the full camera list, as distinguished from the current pass index.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Common_Functions" },
    { "id": "tdTexCoord", "name": "TDTexCoord", "expression": "TDTexCoord({layer})", "type": "vec3", "targets": ["mat"], "stages": ["vertex"], "category": ["common", "coordinates"], "hint": "Texture coordinates from the selected UV layer.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Working_with_Geometry_Attributes" },
    { "id": "tdBoneMat", "name": "TDBoneMat", "expression": "TDBoneMat({boneIndex})", "type": "mat4", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "geometry"], "hint": "Bone transform matrix for the selected bone index.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Common_Functions" },
    { "id": "tdInstanceMat", "name": "TDInstanceMat", "expression": "TDInstanceMat({instanceIndex})", "type": "mat4", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "instances"], "hint": "Four-by-four transform matrix for the selected geometry instance.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Instancing" },
    { "id": "tdInstanceMat3", "name": "TDInstanceMat3", "expression": "TDInstanceMat3({instanceIndex})", "type": "mat3", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "instances"], "hint": "Three-by-three transform matrix for the selected geometry instance.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Instancing" },
    { "id": "tdInstanceTextureIndex", "name": "TDInstanceTextureIndex", "expression": "TDInstanceTextureIndex({instanceIndex})", "type": "uint", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "instances"], "hint": "Texture index associated with the selected geometry instance.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Instancing" },
    { "id": "tdInstanceCustomAttrib0", "name": "TDInstanceCustomAttrib0", "expression": "TDInstanceCustomAttrib0({instanceIndex})", "type": "vec4", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "instances"], "hint": "Custom instance attribute slot 0 as four components.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Instancing" },
    { "id": "tdInstanceCustomAttrib1", "name": "TDInstanceCustomAttrib1", "expression": "TDInstanceCustomAttrib1({instanceIndex})", "type": "vec4", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "instances"], "hint": "Custom instance attribute slot 1 as four components.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Instancing" },
    { "id": "tdInstanceCustomAttrib2", "name": "TDInstanceCustomAttrib2", "expression": "TDInstanceCustomAttrib2({instanceIndex})", "type": "vec4", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "instances"], "hint": "Custom instance attribute slot 2 as four components.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Instancing" },
    { "id": "tdInstanceCustomAttrib3", "name": "TDInstanceCustomAttrib3", "expression": "TDInstanceCustomAttrib3({instanceIndex})", "type": "vec4", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "instances"], "hint": "Custom instance attribute slot 3 as four components.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Instancing" },
    { "id": "tdPointCoord", "name": "TDPointCoord", "expression": "TDPointCoord()", "type": "vec2", "targets": ["mat"], "stages": ["pixel"], "category": ["common", "coordinates"], "hint": "Coordinates within the point being rendered.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Common_Functions" },
    { "id": "uTDGeneral", "name": "uTDGeneral", "expression": "uTDGeneral", "type": "TDGeneral", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "render"], "hint": "General render state, including combined ambient-light color and viewport information.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_Uniforms" },
    { "id": "uTDGeneralAmbientColor", "name": "uTDGeneral.ambientColor", "expression": "uTDGeneral.ambientColor", "type": "vec4", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "lights"], "hint": "Combined ambient-light color from the ambient lights used by this render pass.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_Uniforms" },
    { "id": "viewportOrigin", "name": "Viewport Origin", "expression": "uTDGeneral.viewport.xy", "type": "vec2", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["common", "output"], "hint": "Origin of the current viewport.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_Uniforms" },
    { "id": "viewportResolution", "name": "Viewport Resolution", "expression": "(1.0 / uTDGeneral.viewport.zw)", "type": "vec2", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["common", "output"], "hint": "Width and height of the current viewport.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_Uniforms" },
    { "id": "uTDEnvLights", "name": "uTDEnvLights", "expression": "uTDEnvLights", "type": "TDEnvLight[TD_NUM_ENV_LIGHTS]", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "lights"], "hint": "Environment-light settings for the current render pass.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_Uniforms" },
    { "id": "tdNumLights", "name": "TD_NUM_LIGHTS", "expression": "TD_NUM_LIGHTS", "type": "int", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "lights"], "hint": "Compile-time number of regular lights in this shader configuration.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_defines" },
    { "id": "tdNumEnvLights", "name": "TD_NUM_ENV_LIGHTS", "expression": "TD_NUM_ENV_LIGHTS", "type": "int", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "lights"], "hint": "Compile-time number of environment lights in this shader configuration.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_defines" },
    { "id": "tdNumCameras", "name": "TD_NUM_CAMERAS", "expression": "TD_NUM_CAMERAS", "type": "int", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "cameras"], "hint": "Compile-time number of cameras in this shader configuration.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_defines" },
    { "id": "tdNumColorBuffers", "name": "TD_NUM_COLOR_BUFFERS", "expression": "TD_NUM_COLOR_BUFFERS", "type": "int", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "render"], "hint": "Compile-time number of color buffers in this shader configuration.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_defines" },
    { "id": "uTDEnvLightBuffersShCoeffs", "name": "uTDEnvLightBuffers.shCoeffs", "expression": "uTDEnvLightBuffers[{lightIndex}].shCoeffs", "type": "vec3[9]", "targets": ["mat"], "stages": ["vertex", "pixel"], "category": ["tdBuiltin", "lights"], "hint": "Nine RGB spherical-harmonic coefficients for the selected environment light.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT#TouchDesigner_specific_Uniforms" },
    { "id": "glVertexIndex", "name": "gl_VertexIndex", "expression": "gl_VertexIndex", "type": "int", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "geometry"], "hint": "Index of the current vertex. This is an identity, not an attribute lookup for another vertex.", "helpUrl": "https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf" },
    { "id": "tdScreenSpaceCoord", "name": "TDScreenSpaceCoord", "expression": "TDScreenSpaceCoord().st", "type": "vec2", "targets": ["mat"], "stages": ["pixel"], "category": ["tdBuiltin", "geometry"], "hint": "Screen-space texture coordinates used by native MAT screen-space map sampling. Returns the st components.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT" },
    { "id": "tdInstanceIndex", "name": "TDInstanceIndex", "expression": "TDInstanceIndex()", "type": "int", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "geometry"], "hint": "Current instance index used by native MAT. Pass through a flat Vertex Output to use indexed TDInstanceColor in Pixel Stage.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT" },
    { "id": "tdColor", "name": "TDColor", "expression": "TDColor()", "type": "vec4", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "geometry"], "hint": "Geometry color used by native Phong/PBR before current-instance color is applied. This is the native TDColor accessor, distinct from TDPointColor.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_MAT" },
    { "id": "vUVSt", "name": "vUV.st", "expression": "vUV.st", "type": "vec2", "targets": ["top"], "stages": ["pixel"], "category": ["common", "coordinates"], "hint": "Texture coordinates of this pixel, from 0 to 1 (the first two components of vUV).", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP", "common": "uv" },
    { "id": "tdPos", "name": "TDPos", "expression": "TDPos()", "type": "vec4", "targets": ["mat"], "stages": ["vertex"], "category": ["tdBuiltin", "geometry"], "hint": "Position of this vertex in SOP space.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_Material" },
].map(entry => Object.freeze(entry)));

},
"text":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMessage = exports.tr = void 0;
const tr = (code, source, params) => Object.freeze(params ? { code, source, params: Object.freeze({ ...params }) } : { code, source });
exports.tr = tr;
const isMessage = (value) => !!value && typeof value === 'object' && typeof value.code === 'string' && typeof value.source === 'string';
exports.isMessage = isMessage;

},
"top_compiler":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protocol = exports.CompilationError = void 0;
exports.codegenKey = codegenKey;
exports.createCompiler = createCompiler;
const config_1 = require("./config");
const subgraph_compiler_1 = require("./subgraph_compiler");
/** Whole-graph orchestration. Concrete node modules are injected by composition. */
const graph_1 = require("./graph");
const model_1 = require("./model");
const values_1 = require("./values");
const comments_1 = require("./comments");
const ghosts_1 = require("./ghosts");
const declarations_1 = require("./declarations");
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
function createFlatCompiler(registry, limits) {
    function supports(g) {
        var _a, _b, _c, _d, _e;
        if ((0, model_1.formatProblem)(g) || g.target !== 'top' || Object.keys(g.stages).join() !== 'pixel' || ((_a = g.subgraphs) === null || _a === void 0 ? void 0 : _a.length) || ((_b = g.structDefinitions) === null || _b === void 0 ? void 0 : _b.length))
            return false;
        if (!g.stages.pixel || g.stages.pixel.nodes.length > limits.nodes || g.stages.pixel.edges.length > limits.edges)
            return false;
        if ((_d = (_c = g.stages.pixel) === null || _c === void 0 ? void 0 : _c.ui) === null || _d === void 0 ? void 0 : _d.frames)
            return false;
        // A kind this build does not know is kept and never read (Q44); its references are ghosts.
        // 不認得的 kind 保留、不讀；引用它的節點是 Ghost。
        if (!g.declarations.every(d => !declarations_1.declarationKinds.has(d.kind) || declarations_1.declarationKinds.get(d.kind).types.includes(d.type)))
            return false;
        // Legacy allocates collision suffixes for implicit IDs versus explicit
        // names. Keep those whole graphs on its path until symbol allocation moves.
        // Ghost nodes (ghosts.ts) are kept but never emitted, so they neither block this path nor
        // take a symbol. Ghost 節點不產碼：不擋這條路，也不佔名稱。
        const context = { declaration: (id) => g.declarations.find(d => d.id === id) };
        const ghost = (n) => {
            const d = registry.get(n.nodeType);
            return !d || !!d.catalog.definition.stages && !d.catalog.definition.stages.includes('pixel') || !d.supports(n, context);
        };
        const live = ((_e = g.stages.pixel) === null || _e === void 0 ? void 0 : _e.nodes.filter(n => !ghost(n))) || [];
        const symbols = live.filter(n => { var _a; return ((_a = registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.role) !== 'output'; }).map(n => n.name || n.id);
        if (new Set(symbols).size !== symbols.length)
            return false;
        return live.every(n => !n.params.requireConstant);
    }
    function compile(g, identifiers) {
        var _a;
        let errorNode;
        try {
            if (!supports(g))
                throw Error('Graph is outside the selected frontend compiler capability');
            // Catalog provenance is checked by the delivery adapter, not graph traversal.
            const { catalogSnapshot, ...document } = g;
            const model = new graph_1.GraphDocument(document, registry), network = model.networks.get('pixel');
            const data = model.document.stages.pixel;
            if (data.nodes.length > limits.nodes || data.edges.length > limits.edges || JSON.stringify(g).length > limits.bytes)
                throw Error('Graph is too large');
            const nodes = new Map(), ports = Object.create(null);
            const ghosts = (0, ghosts_1.ghostsOf)(network, values_1.policy);
            const declarations = new Map(), names = new Set();
            // Position among declarations of the same ordered kind: the GLSL index (decision 5).
            // 在同種（有順序的）宣告裡的位置＝GLSL 索引。
            const positions = new Map(), counts = new Map();
            for (const d of g.declarations) {
                if (!declarations_1.declarationKinds.has(d.kind))
                    continue;
                if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.id) || declarations.has(d.id) || !/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(d.name) || /^(gl_|TD|sg_|sTD)/.test(d.name) || names.has(d.name))
                    throw Error('Invalid declaration identity/name');
                // Old-product fields (initialDriver, nativeSequence, expose, exposeName, sourceMissing) are not read
                // (Q44, Q55: Uniforms have no exposed state). 舊產品欄位不讀；去留由匯入器的對照表處理。
                declarations_1.declarationKinds.get(d.kind).validate(d);
                declarations.set(d.id, d);
                names.add(d.name);
                if (declarations_1.declarationKinds.get(d.kind).ordered) {
                    const i = (_a = counts.get(d.kind)) !== null && _a !== void 0 ? _a : 0;
                    positions.set(d.id, i);
                    counts.set(d.kind, i + 1);
                }
            }
            const symbols = new Set(), authoredNames = new Set();
            for (const n of data.nodes) {
                errorNode = n.id;
                if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n.id) || nodes.has(n.id))
                    throw Error('Invalid or duplicate node ID');
                if (ghosts.nodes.has(n.id))
                    continue;
                if (n.name !== undefined) {
                    if (!identifiers || !/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(n.name) || n.name.includes('__') || /^(gl_|TD|sTD|uTD|sg_|[iu]?sampler|[iu]?image|d?mat[234])/.test(n.name) || identifiers.reservedNames.includes(n.name) || authoredNames.has(n.name))
                        throw Error('Invalid or duplicate node name');
                    authoredNames.add(n.name);
                }
                const d = registry.get(n.nodeType), symbol = n.name || n.id;
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
            const outputs = network.nodes.filter(n => !ghosts.nodes.has(n.id) && n.definition.role === 'output');
            if (outputs.length !== 1)
                throw Error('Exactly one Pixel Output is required');
            const links = new Map();
            for (const edge of network.edges) {
                // A ghost wire counts as not connected: the input keeps its own value (Q37 1-3).
                if (ghosts.edges.has(edge.id))
                    continue;
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
                if (ghosts.nodes.has(node.id))
                    continue;
                const module = node.definition;
                if (module.inputsUsed) {
                    const connected = new Set(node.inputs.filter(p => links.has(p)).map(p => p.key));
                    const used = module.inputsUsed(node.data, connected, model.context);
                    if (used.some(key => !node.interface.inputs[key]))
                        throw Error('Module uses an unknown input');
                    inputsUsed.set(node.id, new Set(used));
                }
            }
            const order = network.order(outputs[0].id, e => !ghosts.edgeData.has(e) && (!inputsUsed.has(e.to[0]) || inputsUsed.get(e.to[0]).has(e.to[1]))), visited = new Set(order.map(n => n.id));
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
                    // Unconnected: the port's fallback expression, else its value. An opaque input has neither,
                    // so its module decides what happens without a wire (connected()).
                    // 沒接線：用接孔的 fallback 式子，否則用它的值；不透明輸入兩者都沒有，由模組先用 connected() 決定。
                    if (port.fallback !== undefined)
                        return port.fallback;
                    if (values_1.opaque.includes(port.type))
                        throw Error('Nothing is connected to ' + key);
                    return (0, values_1.literal)((_b = (_a = n.inputValues) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : port.default, (0, values_1.type)(port.type));
                };
                if (!d.emit)
                    throw Error('Structural nodes require Subgraph expansion');
                const useDeclaration = (declId) => {
                    const declaration = declarations.get(declId);
                    if (!declaration)
                        throw Error('Select a matching declaration');
                    used.add(declId);
                    return declaration.name;
                };
                const referenceDeclaration = (declId) => {
                    const declaration = declarations.get(declId), name = useDeclaration(declId), kind = declarations_1.declarationKinds.get(declaration.kind);
                    return kind.reference ? kind.reference(declaration, positions.get(declId)) : { out: name };
                };
                const emission = d.emit(n, { ...model.context, ports: p, input, connected: key => links.has(node.port('input', key)), useDeclaration, referenceDeclaration });
                if (Object.keys(emission.outputs).sort().join() !== Object.keys(p.outputs).sort().join())
                    throw Error('Module emitted a different output interface');
                if (emission.statements)
                    lines.push(...emission.statements);
                let passed = false;
                for (const [port, expression] of Object.entries(emission.outputs)) {
                    // An opaque value cannot live in a local variable: its expression is written where it is used.
                    // 不透明的值不能放進區域變數：直接代入使用的地方。
                    if (values_1.opaque.includes(p.outputs[port].type)) {
                        expressions.set(node.port('output', port), expression);
                        passed = true;
                        continue;
                    }
                    const symbol = 'sg_n_' + (n.name || id) + (port === 'out' ? '' : '_' + port);
                    lines.push('    ' + (emission.constant ? 'const ' : '') + p.outputs[port].type + ' ' + symbol + ' = ' + expression + ';');
                    expressions.set(node.port('output', port), symbol);
                }
                if (lines.length === start && !passed)
                    throw Error('Node emitted no expression');
                (0, comments_1.appendNodeComments)(lines, start, n.comment);
                while (lineNodes.length < lines.length)
                    lineNodes.push(id);
            }
            // File-scope GLSL comes from each used declaration's kind; only sources go to TD as bindings
            // (a global constant lives in the program, Q41). Ordered kinds (TOP texture inputs) go first, all
            // of them in list order, used or not: each one is an input of the Grape OP (Q44). Uniforms follow,
            // all of them too (`declared`: the TD row lives as long as the declaration).
            // 檔案層級 GLSL 由 kind 產生；只有來源成為綁定交給 TD。有順序的種類（TOP 貼圖輸入）全部照清單順序放前面，
            // 有沒有用到都算：每一筆都是 Grape OP 的輸入接口。Uniform 接著放，也是全部（TD 上那一列跟著宣告存在）。
            const usedDeclarations = [...used].sort().map(id => declarations.get(id));
            const all = [...declarations.values()], kindOf = (d) => declarations_1.declarationKinds.get(d.kind);
            const ordered = all.filter(d => kindOf(d).ordered), declared = all.filter(d => kindOf(d).declared && !kindOf(d).ordered);
            const bindings = [...ordered, ...declared, ...usedDeclarations.filter(d => kindOf(d).role === 'source' && !kindOf(d).ordered && !kindOf(d).declared)]
                .map(d => JSON.parse(JSON.stringify(d)));
            const headers = usedDeclarations.flatMap(d => { const kind = declarations_1.declarationKinds.get(d.kind); return kind.header ? [kind.header(d)] : []; });
            const pixel = [...headers, 'layout(location=0) out vec4 fragColor;', 'void main() {', '    vec2 sg_uv = vUV.st;', ...lines, '}', ''].join('\n');
            const diagnostics = [
                ...data.nodes.filter(n => !visited.has(n.id) && !ghosts.nodes.has(n.id)).sort((a, b) => a.id < b.id ? -1 : 1).map(n => ({ node: n.id, stage: 'pixel', message: 'Disconnected node is not emitted' })),
                ...[...ghosts.nodes].sort(([a], [b]) => a < b ? -1 : 1).map(([node, kind]) => ({ node, stage: 'pixel', message: 'Ghost node (' + kind + ') is kept but not emitted' })),
                ...data.edges.filter(e => ghosts.edgeData.has(e)).map(e => ({ node: e.to[0], stage: 'pixel', message: 'Ghost wire to ' + e.to[1] + ' is treated as not connected' }))
            ];
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
 * depends on, minus authored layout and notes. Node `ui` and `comment` only add layout and GLSL
 * comment lines (comments.ts), so by the human's rule B they are outside the chain; edge ids and
 * edge `ui` (Link／Wire style) never reach GLSL, nor do description／comment／userVersion (Q44).
 * Equal keys must mean the same program apart from comment lines; tests/unit/test_codegen_key.cjs
 * checks this on random edit sequences.
 * 產碼指紋：產出的程式所依賴的一切，扣掉版面與註記。節點 ui、comment 只帶來版面與 GLSL 註解（規則 B，不在鏈路）；
 * 線的 id 與樣式、作品說明不進 GLSL。指紋相同＝除註解行外程式相同，由隨機編輯的性質測試把關。 */
function codegenKey(g) {
    const network = (data) => data && { ...data,
        nodes: (data.nodes || []).map(n => ({ ...n, ui: undefined, comment: undefined })),
        edges: (data.edges || []).map(e => ({ ...e, id: undefined, ui: undefined })) };
    return JSON.stringify({ ...g, description: undefined, comment: undefined, userVersion: undefined,
        stages: Object.fromEntries(Object.entries(g.stages || {}).map(([k, v]) => [k, network(v)])),
        subgraphs: (g.subgraphs || []).map(f => ({ ...f, description: undefined, comment: undefined, userVersion: undefined, graph: network(f.graph) })) });
}
function createCompiler(registry, config = config_1.CORE_CONFIG) {
    const flat = createFlatCompiler(registry, { nodes: config.nodesPerNetwork, edges: config.edgesPerNetwork, bytes: config.documentBytes });
    const subgraphs = (0, subgraph_compiler_1.createSubgraphCompiler)(registry, r => createFlatCompiler(r, { nodes: config.expandedNodes, edges: config.expandedEdges, bytes: config.documentBytes }), config);
    return Object.freeze({ protocol: exports.protocol, key: codegenKey,
        supports: (g) => { var _a; return ((_a = g.subgraphs) === null || _a === void 0 ? void 0 : _a.length) ? subgraphs.supports(g) : flat.supports(g); },
        compile: (g, identifiers) => { var _a; return ((_a = g.subgraphs) === null || _a === void 0 ? void 0 : _a.length) ? subgraphs.compile(g, identifiers) : flat.compile(g, identifiers); }
    });
}

},
"uniform_presets":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniformPresets = void 0;
exports.uniformPresets = Object.freeze([
    {
        "entry": "absTime",
        "name": "uAbsTime",
        "type": "float",
        "expression": "absTime.seconds",
        "common": "absTime",
        "hint": "Seconds since TouchDesigner started; keeps running."
    },
    {
        "entry": "absFrame",
        "name": "uAbsFrame",
        "type": "float",
        "expression": "absTime.frame",
        "common": "absFrame",
        "hint": "Frames since TouchDesigner started; keeps running."
    },
    {
        "entry": "time",
        "name": "uTime",
        "type": "float",
        "expression": "me.time.seconds",
        "common": null,
        "hint": "Seconds on this Grape OP's timeline; stops and loops with the timeline. For time that keeps running, use uAbsTime."
    },
    {
        "entry": "frame",
        "name": "uFrame",
        "type": "float",
        "expression": "me.time.frame",
        "common": null,
        "hint": "Frame on this Grape OP's timeline; stops and loops with the timeline."
    },
    {
        "entry": "deltaTime",
        "name": "uDeltaTime",
        "type": "float",
        "expression": "absTime.stepSeconds",
        "common": "deltaTime",
        "hint": "Seconds from the previous frame to this one (all of TouchDesigner)."
    },
    {
        "entry": "frameStep",
        "name": "uFrameStep",
        "type": "float",
        "expression": "absTime.step",
        "common": null,
        "hint": "Frames from the previous frame to this one; more than 1 when TouchDesigner drops frames."
    }
].map(entry => Object.freeze(entry)));

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
        ...(spec.fixed ? { entries: () => [{ key: '', label: catalog.definition.label, params: {} },
                ...spec.types.map(t => ({ key: t, label: t, literal: true, params: { type: t, fixedType: t, ...spec.fixed(t) } }))] } : {}),
        // A fixed node is titled by its type and has no type menu (Refactor.17.2). 固定型別的節點以型別為標題、沒有型別選單。
        presentation: n => {
            var _a;
            return ({ selectorLabel: 'vector.outputType', ...(_a = spec.presentation) === null || _a === void 0 ? void 0 : _a.call(spec, n),
                ...(n.params.fixedType ? { label: String(n.params.fixedType), literalLabel: true, typeLocked: true } : {}) });
        }
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
exports.copy = exports.policy = exports.fill = exports.opaque = exports.vectors = exports.types = exports.scalars = void 0;
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
/**
 * Opaque types (Refactor.43): a texture is passed as it is to an input of the same type. It has no
 * value, no conversion and no literal, and GLSL cannot keep it in a local variable, so code
 * generation writes its expression where it is used. 不透明型別：貼圖原樣傳給同型別的輸入；
 * 沒有值、不能轉型、沒有字面值，GLSL 也不能放進區域變數，所以產碼時直接代入使用的地方。
 */
exports.opaque = ['sampler2D'];
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
    // Opaque types connect only to the same type (0 components: never a conversion).
    // 不透明型別只能接同型別（0 分量：不參與任何轉換）。
    components: Object.fromEntries([...exports.types.map(t => [t, count(t)]), ...exports.opaque.map(t => [t, 0])]),
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
        // The wire that made a component group is gone: split it back; the components keep their values (Q65).
        // 造成分量組的線拿掉了：分回去；各分量的值不變（Q65）。
        unwire: (n, key) => {
            const groups = { ...(0, model_1.object)(n.params.groups) };
            if (!(key in groups))
                return n;
            delete groups[key];
            n.params.groups = groups;
            return n;
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
const api=load('__composition');GrapeTopCompiler=api.GrapeTopCompiler;GrapeGraph=api.GrapeGraph;
})();
if(typeof module!=='undefined'&&module.exports)module.exports=GrapeGraph;
