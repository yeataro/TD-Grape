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
const connectivity_1 = require("./connectivity");
const subgraph_stages_1 = require("./subgraph_stages");
const subgraph_operations_1 = require("./subgraph_operations");
const declarations_1 = require("./declarations");
const td_values_1 = require("./td_values");
const uniform_presets_1 = require("./uniform_presets");
const common_sources_1 = require("./common_sources");
const node_sdk_1 = require("./node_sdk");
const component_names_1 = require("./component_names");
const upgrades_1 = require("./upgrades");
const node_names_1 = require("./node_names");
const clipboard_1 = require("./clipboard");
const library_1 = require("./library");
const library_policy_1 = require("./library_policy");
const library_files_1 = require("./library_files");
const groups = require("./groups");
const abs_1 = require("./nodes/abs");
const add_1 = require("./nodes/add");
const all_1 = require("./nodes/all");
const any_1 = require("./nodes/any");
const boolean_operation_1 = require("./nodes/boolean_operation");
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
const force_compile_error_1 = require("./nodes/force_compile_error");
const fract_1 = require("./nodes/fract");
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
const subgraph_input_1 = require("./nodes/subgraph_input");
const subgraph_instance_1 = require("./nodes/subgraph_instance");
const subgraph_output_1 = require("./nodes/subgraph_output");
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
exports.registry = (0, node_module_1.createRegistry)([abs_1.default, add_1.default, all_1.default, any_1.default, boolean_operation_1.default, ceil_1.default, clamp_1.default, color_1.default, combine_1.default, compare_1.default, convert_1.default, cos_1.default, declaration_1.default, divide_1.default, dot_1.default, equal_1.default, float_1.default, floor_1.default, force_compile_error_1.default, fract_1.default, greaterThan_1.default, greaterThanEqual_1.default, if_1.default, isinf_1.default, isnan_1.default, length_1.default, lessThan_1.default, lessThanEqual_1.default, math_1.default, max_1.default, min_1.default, mix_1.default, multiply_1.default, normalize_1.default, not_1.default, notEqual_1.default, pixel_out_1.default, replace_1.default, rgba_1.default, round_1.default, router_1.default, scalar_1.default, sign_1.default, sin_1.default, smoothstep_1.default, split_1.default, sqrt_1.default, subgraph_input_1.default, subgraph_instance_1.default, subgraph_output_1.default, subtract_1.default, swizzle_1.default, td_value_1.default, texture_sample_1.default, trunc_1.default, vec2_1.default, vec3_1.default, vec4_1.default, vector_1.default, vector_split_1.default]);
exports.GrapeTopCompiler = (0, top_compiler_1.createCompiler)(exports.registry);
exports.GrapeGraph = { ...graph, plan: wire.plan, values, registry: exports.registry, createRegistry: node_module_1.createRegistry, createCompiler: top_compiler_1.createCompiler, resolvePorts: node_module_1.resolvePorts, configureNode: node_module_1.configureNode, createEditorContract: editor_contract_1.createEditorContract, overLimit: capacity_1.overLimit, documentBytes: capacity_1.documentBytes, structureProblems: structure_1.structureProblems, offered: structure_1.offered, removable: structure_1.removable, formatProblem: model_1.formatProblem, ghostsOf: ghosts_1.ghostsOf, connectedWires: connectivity_1.connectedWires, subgraphStages: subgraph_stages_1.subgraphStages, subgraphStageTable: subgraph_stages_1.subgraphStageTable, subgraphGroups: subgraph_stages_1.subgraphGroups, newPortId: subgraph_operations_1.newPortId, instanceCounts: subgraph_operations_1.instanceCounts, useCounts: subgraph_operations_1.useCounts, subgraphCycle: subgraph_operations_1.subgraphCycle, newSubgraphCycle: subgraph_operations_1.newSubgraphCycle, declarationKinds: declarations_1.declarationKinds, declarationNameProblem: declarations_1.declarationNameProblem, declarationLabel: declarations_1.declarationLabel, freeDeclarationName: declarations_1.freeDeclarationName, freeLegacyName: declarations_1.freeLegacyName, defaultTextures: declarations_1.defaultTextures, uniformPresets: uniform_presets_1.uniformPresets, commonSources: common_sources_1.commonSources, tdValues: td_values_1.tdValues, usableTdValue: node_sdk_1.usableTdValue, componentStyle: component_names_1.componentStyle, componentStyles: component_names_1.componentStyles, componentLetters: component_names_1.componentLetters, upgradeGraph: upgrades_1.upgradeGraph, nodeUpgrades: upgrades_1.nodeUpgrades, validNodeName: node_names_1.validNodeName, typedName: node_names_1.typedName, storedName: node_names_1.storedName, shownName: node_names_1.shownName, freeName: node_names_1.freeName, newNodeName: node_names_1.newNodeName, validSubgraphTitle: node_names_1.validSubgraphTitle, newInstanceName: node_names_1.newInstanceName, namesIn: node_names_1.namesIn, takesName: node_names_1.takesName, NAME_LIMIT: node_names_1.NAME_LIMIT, copyNodes: clipboard_1.copyNodes, readClip: clipboard_1.readClip, pasteClip: clipboard_1.pasteClip, clipCorner: clipboard_1.clipCorner, groups, standardForm: library_1.standardForm, closureOrder: library_1.closureOrder, validLibraryId: library_1.validLibraryId, planLibraryEntry: library_policy_1.planLibraryEntry, repairLibraryCopies: library_policy_1.repairLibraryCopies, repairDuplicates: library_policy_1.repairDuplicates, readLibraryFile: library_files_1.readLibraryFile, saveLibraryFile: library_files_1.saveLibraryFile, libraryIdFrom: library_files_1.libraryIdFrom, bringInLibraryFile: library_files_1.bringInLibraryFile, verifyLibraryFile: library_files_1.verifyLibraryFile };

},
"capacity":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapacityError = void 0;
exports.utf8Bytes = utf8Bytes;
exports.documentBytes = documentBytes;
exports.measure = measure;
exports.overLimit = overLimit;
exports.requireCapacity = requireCapacity;
const config_1 = require("./config");
/** Room kept for `savedBy`, which the editor writes when it sends the graph (host_sync.ts); the core measures without it.
 * 留給 savedBy 的位置（編輯器送出時才寫上）；核心量的時候不含它。 */
const SAVED_BY_ROOM = 128;
/** UTF-8 bytes of a text, counted without encoding it. 文字的 UTF-8 位元組數，不必真的編碼。 */
function utf8Bytes(text) {
    let n = 0;
    for (let i = 0; i < text.length; i++) {
        const u = text.charCodeAt(i);
        n += u < 0x80 ? 1 : u < 0x800 ? 2 : u >= 0xd800 && u < 0xdc00 ? (i++, 4) : 3;
    }
    return n;
}
/** The bytes the host will receive for this graph (its text as sent, `savedBy` included). 宿主會收到的位元組數（送出的文字，含 savedBy）。 */
function documentBytes(g) {
    const { savedBy: _, ...rest } = g;
    return utf8Bytes(JSON.stringify(rest)) + SAVED_BY_ROOM;
}
function networks(g) {
    return [...Object.entries(g.stages || {}).map(([id, data]) => [id, data]),
        ...(g.subgraphs || []).map(f => ['subgraph:' + f.id, f.graph])];
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
            total += inner ? size(inner, 'subgraph:' + ref) : 1;
        }
        visiting.delete(key);
        expanded.set(key, total);
        return total;
    };
    const result = [{ key: 'documentBytes', value: documentBytes(g), limit: config.documentBytes }];
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
    // The graph before is measured only when the one after is over a limit, so an ordinary edit serializes once. 只有修改後超過上限
    // 才量修改前的圖，一般的修改只序列化一次。
    const over = measure(after, registry, config).filter(m => m.value > m.limit);
    if (!over.length)
        return;
    const previous = new Map(measure(before, registry, config).map(m => [id(m), m.value]));
    const grown = over.filter(m => { var _a; return m.value > ((_a = previous.get(id(m))) !== null && _a !== void 0 ? _a : 0); });
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
    return new Map([...Object.entries(g.stages), ...(g.subgraphs || []).map(raw => { const f = raw; return ['subgraph:' + f.id, f.graph]; })]);
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
    const module = registry.get(node.nodeType), context = (0, node_module_1.contextFor)(g, (_a = g.subgraphs) === null || _a === void 0 ? void 0 : _a.find(f => 'subgraph:' + f.id === networkId));
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
        return false; const m = registry.get(n.nodeType); return definitions.includes(((_a = m === null || m === void 0 ? void 0 : m.referencedGraph) === null || _a === void 0 ? void 0 : _a.call(m, n)) || '') || !!(m === null || m === void 0 ? void 0 : m.structural) && definitions.some(id => network === 'subgraph:' + id); };
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
                if (n && !((_a = registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.supports(n, (0, node_module_1.contextFor)(g, (_b = g.subgraphs) === null || _b === void 0 ? void 0 : _b.find(f => 'subgraph:' + f.id === id)))))
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
"clipboard":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyNodes = copyNodes;
exports.readClip = readClip;
exports.pasteClip = pasteClip;
exports.clipCorner = clipCorner;
const library_policy_1 = require("./library_policy");
const model_1 = require("./model");
const node_names_1 = require("./node_names");
const structure_1 = require("./structure");
const groups_1 = require("./groups");
const subgraph_operations_1 = require("./subgraph_operations");
const subgraphs_1 = require("./subgraphs");
/** The copy of some nodes of one network (`networkId`: a stage, or 'subgraph:'+id; the top-level pixel network by default), or
 * null when none of them can be copied (a node with a fixed identity cannot: the Color Output, a subgraph boundary; structure.ts).
 * The copy is always written as a pixel network, whichever network it came from. 一張網路（networkId：stage 或 subgraph:+id；預設頂層
 * pixel）裡一些節點的複製；一個都不能複製時是 null（身分固定的節點不能：Color Output、子圖邊界節點）。不管從哪張網路複製，都寫成 pixel 網路。 */
function copyNodes(graph, ids, source, networkId = 'pixel') {
    var _a, _b, _c, _d;
    const data = graph.document, network = (_a = graph.networks.get(networkId)) === null || _a === void 0 ? void 0 : _a.data, chosen = new Set(ids);
    if (!network)
        return null;
    const nodes = network.nodes.filter(node => chosen.has(node.id) && (0, structure_1.removable)(graph.registry.get(node.nodeType)));
    if (!nodes.length)
        return null;
    const kept = new Set(nodes.map(node => node.id));
    const edges = network.edges.filter(edge => kept.has(edge.from[0]) && kept.has(edge.to[0]));
    const used = new Set(nodes.flatMap(node => { var _a, _b; const id = (_b = (_a = graph.registry.get(node.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedDeclaration) === null || _b === void 0 ? void 0 : _b.call(_a, node); return id ? [id] : []; }));
    const groups = (0, groups_1.completeGroups)((0, groups_1.groupsOf)(network), kept);
    // A copy always carries the definitions its instances use, with their whole dependency closure (basic design §3.13, amendment B4: the
    // paste may land where the Library is not, so the content must travel). 複製永遠帶著實例用到的定義，連同完整的依賴閉包（§3.13、B4：
    // 貼上的地方可能沒有 Library，內容必須跟著走）。
    const byId = new Map(((_b = data.subgraphs) !== null && _b !== void 0 ? _b : []).map(f => [f.id, f])), needed = new Map();
    const visit = (id) => {
        var _a, _b;
        const f = byId.get(id);
        if (!f || needed.has(id))
            return;
        needed.set(id, f);
        for (const n of f.graph.nodes) {
            const ref = (_b = (_a = graph.registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n);
            if (ref)
                visit(ref);
        }
    };
    for (const node of nodes) {
        const ref = (_d = (_c = graph.registry.get(node.nodeType)) === null || _c === void 0 ? void 0 : _c.referencedGraph) === null || _d === void 0 ? void 0 : _d.call(_c, node);
        if (ref)
            visit(ref);
    }
    return (0, model_1.copy)({ format: model_1.GRAPH_FORMAT, version: model_1.GRAPH_VERSION, target: data.target, declarations: data.declarations.filter(d => used.has(d.id)),
        ...(needed.size ? { subgraphs: [...needed.values()] } : {}),
        stages: { pixel: { nodes, edges, ...(groups.length ? { ui: { groups: groups } } : {}) } }, source });
}
/** Read what the clipboard holds: a copy, or null when it is not one of ours (any other text). 讀剪貼簿：是我們的複製就回傳，不是就 null。 */
function readClip(text) {
    var _a;
    let value;
    try {
        value = JSON.parse(text);
    }
    catch (_b) {
        return null;
    }
    const clip = value;
    if ((0, model_1.formatProblem)(value) || typeof (clip === null || clip === void 0 ? void 0 : clip.source) !== 'string')
        return null;
    const pixel = (_a = clip.stages) === null || _a === void 0 ? void 0 : _a.pixel;
    if (clip.subgraphs !== undefined && !Array.isArray(clip.subgraphs))
        return null;
    return pixel && Array.isArray(pixel.nodes) && Array.isArray(pixel.edges) ? clip : null;
}
/** A copied node's place; a value that is not a number counts as 0 (only hand-made text has one). 複製的節點位置；不是數字的值當 0
 * （只有手寫的文字會有）。 */
const placeOf = (node) => {
    var _a, _b;
    const x = Number((_a = node.ui) === null || _a === void 0 ? void 0 : _a.x), y = Number((_b = node.ui) === null || _b === void 0 ? void 0 : _b.y);
    return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
};
/** Paste a copy into the top-level pixel network of an editable candidate (inside GraphDocument.change), its top-left node corner
 * at `at`; returns the new nodes' IDs in their copied order. `newId` names nodes, `newGroupId` groups (the editor's, the same as
 * for a new group). A declaration that is gone since it was copied comes back when its
 * ID and name are still free; otherwise its nodes become ghosts, as on opening. Named nodes take the next free name.
 * 把複製貼進可編輯候選文件（在 GraphDocument.change 裡）的頂層 pixel 網路，左上角的節點角落放在 at；回傳新節點的 ID（照複製的順序）。
 * 複製之後被刪掉的宣告，ID 與名字都還沒人用時就加回來；否則它的節點變 Ghost，同開圖。有名字的節點取下一個沒人用的名字。newId 給節點、newGroupId 給群組（編輯器的，
 * 同新建群組）。 */
/** `sameSource`: the copy came from this very graph (the editor compares the Grape OP); `newSubgraphId` names definitions brought in.
 * Definitions (basic design §3.13, amendment A5 rules 1–2, amendment 2 B3): from the same graph, a pasted instance whose definition is
 * still in the document uses it as it is now, its explicit values fitted to the current interface; a definition the pasted instances need
 * that is gone comes back under a new identity together with everything it depends on in the copy (its dependencies are never
 * resolved to the current ones); from another graph the whole copied closure comes in under new identities. One batch keeps its
 * shared relations; locals are never merged by content. Every definition in the copy is validated first; a Library copy keeps its
 * Library ID and stays read-only, and one already here with the same ID and standard form is reused (A5 rule 3, B3–B4; Refactor.118). sameSource：複製來自這張圖本身（編輯器比 Grape OP）；newSubgraphId 給帶進來的定義命名。定義
 * （§3.13、A5 第 1–2 條、附錄二 B3）：同圖時，貼上的實例所指的定義還在就用現在這份，實例值對齊目前接口；實例需要、但已刪的定義以新身分
 * 回來，連同它在複製裡的所有依賴（依賴不改指現有的）；別張圖時整個閉包以新身分進來。同批保留共用關係；本地永不按內容合併。複製裡每份定義
 * 先驗證；Library 副本保留 Library ID、仍然唯讀，這裡已有同 ID 同標準形的就沿用（A5 第 3 條、B3–B4；R.118）。 */
function pasteClip(candidate, clip, at, newId, newGroupId, networkId = 'pixel', newSubgraphId = newId, sameSource = true, library = {}) {
    var _a, _b;
    const network = candidate.networks.get(networkId);
    if (!network)
        throw Error('No network to paste into');
    // Every definition the copy carries is checked first, as written, also those that will not be brought in (TECH-4, amendment 2
    // B7-5); two with one ID are refused too, so none can hide behind another (R113-2). One that fails refuses the whole paste.
    // 複製帶著的每份定義照原樣先驗，包括不會帶進來的；同 ID 的兩份也拒絕，免得一份藏在另一份後面。任一份不過，整筆拒絕。
    const carried = (_a = clip.subgraphs) !== null && _a !== void 0 ? _a : [];
    for (const f of carried)
        (0, subgraph_operations_1.validateSubgraphData)((0, subgraph_operations_1.withoutStoredUse)((0, model_1.copy)(f)));
    if (new Set(carried.map(f => f.id)).size !== carried.length)
        throw Error('Duplicate Subgraph identity');
    const snapshot = new Map(carried.map(f => [f.id, f]));
    const current = new Map(((_b = candidate.document.subgraphs) !== null && _b !== void 0 ? _b : []).map(f => [f.id, f]));
    const referenceOf = (node) => { var _a, _b; return (_b = (_a = candidate.registry.get(node.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, node); };
    const instances = clip.stages.pixel.nodes.map(referenceOf).filter((ref) => ref !== undefined);
    // What comes in (TECH-1, amendment 2 B3): from another graph, the whole closure; from this graph, the definitions the pasted instances
    // point at that are gone now, with everything they depend on in the copy, all under one map. A pasted instance whose definition is still
    // here keeps it. 帶進來的：別張圖的整個閉包；同一張圖的，是貼上的實例所指、現在已不在的定義，加上它們在複製裡的所有依賴，共用一張對照。
    // 定義還在的實例沿用它。
    // Among what is needed, Library copies follow the entry rule (library_policy.ts, amendment 3 C4): the batch's own duplicates settled,
    // then each meets the one copy with its Library ID here — same content reused, none comes in read-only, other content as `library`
    // chooses (default: keep the graph's version, the incoming ones come in local). 需要的當中，Library 副本照進圖規則：先處理這批自己的
    // 重複，再對上這裡唯一同 Library ID 的那份——同內容沿用、沒有就唯讀進來、內容不同照 library 的選擇（預設保留圖裡版本，帶進來的轉本地）。
    const needed = [], seen = new Set();
    const need = (id) => {
        const f = snapshot.get(id);
        if (!f || seen.has(id))
            return;
        seen.add(id);
        needed.push(id);
        for (const node of f.graph.nodes) {
            const ref = referenceOf(node);
            if (ref)
                need(ref);
        }
    };
    for (const id of sameSource ? instances.filter(ref => !current.has(ref)) : snapshot.keys())
        need(id);
    const ids = (0, library_policy_1.applyLibraryEntry)(candidate, (0, library_policy_1.planLibraryEntry)(candidate.document, clip, needed, candidate.registry, library), newSubgraphId);
    for (const declaration of clip.declarations) {
        if (candidate.document.declarations.some(d => d.id === declaration.id))
            continue;
        try {
            candidate.addDeclaration((0, model_1.copy)(declaration));
        }
        catch ( /* its nodes stay ghosts 它的節點維持 Ghost */_c) { /* its nodes stay ghosts 它的節點維持 Ghost */ }
    }
    const nodes = clip.stages.pixel.nodes, { x, y } = clipCorner(clip);
    const taken = (0, node_names_1.namesIn)(network.data);
    const nodeIds = new Map(nodes.map(node => [node.id, newId()]));
    const pasted = nodes.map(node => {
        var _a, _b;
        const place = placeOf(node);
        const fresh = { ...(0, model_1.copy)(node), id: nodeIds.get(node.id), ui: { ...(0, model_1.copy)((_a = node.ui) !== null && _a !== void 0 ? _a : {}), x: place.x - x + at.x, y: place.y - y + at.y } };
        if (node.name !== undefined && (0, node_names_1.takesName)(candidate.registry, node.nodeType)) {
            fresh.name = (0, node_names_1.freeName)(node.name, taken);
            taken.add(fresh.name);
        }
        // An instance keeps the definition still here, else follows its new identity. 實例沿用還在的定義，否則跟著新身分。
        const module = candidate.registry.get(node.nodeType), ref = (_b = module === null || module === void 0 ? void 0 : module.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(module, node);
        const kept = ref !== undefined && sameSource && current.has(ref), mapped = ref !== undefined && !kept ? ids.get(ref) : undefined;
        if ((module === null || module === void 0 ? void 0 : module.reference) && mapped)
            fresh.params = { ...fresh.params, ...(0, model_1.copy)(module.reference(mapped)) };
        // An instance copied before its definition's interface changed takes the current interface (TECH-2) — the definition as it stands
        // after this paste, which an 'incoming' entry may have just updated (Codex R119-2). 定義的接口在複製後改過：照目前的接口——這次貼上之後的
        // 那份，進圖選「改用帶進來的」時可能剛更新過。
        if (kept && fresh.inputValues)
            fresh.inputValues = (0, subgraphs_1.fitInstanceValues)(fresh.inputValues, candidate.document.subgraphs.find(f => f.id === ref).inputs);
        return fresh;
    });
    const edges = clip.stages.pixel.edges.filter(edge => nodeIds.has(edge.from[0]) && nodeIds.has(edge.to[0]))
        .map(edge => ({ ...(0, model_1.copy)(edge), id: '', from: [nodeIds.get(edge.from[0]), edge.from[1]], to: [nodeIds.get(edge.to[0]), edge.to[1]] }));
    network.insertFragment({ nodes: pasted, edges }, { unavailable: 'preserve' });
    const groups = (0, groups_1.groupsOf)(clip.stages.pixel);
    if (groups.length)
        (0, groups_1.addCopiedGroups)(network, groups, nodeIds, newGroupId);
    return pasted.map(node => node.id);
}
/** Where the copied nodes start: their top-left corner, for Duplicate's offset. 複製的節點從哪裡開始：左上角，給複製副本位移用。 */
function clipCorner(clip) {
    const places = clip.stages.pixel.nodes.map(placeOf);
    return { x: Math.min(...places.map(place => place.x)), y: Math.min(...places.map(place => place.y)) };
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
"component_names":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.componentLetters = exports.componentStyle = exports.storedOr = exports.componentStyles = void 0;
/** Component names (Refactor.59; legacy graph_ui.js:1224-1236): a node shows its vector components as X/Y/Z/W,
 * R/G/B/A, S/T/P/Q or U/V. Stored on the node as `ui.componentNames` (appearance only, never compiled, design-interview
 * Q67); when not stored, the node module's default; nothing said, X/Y/Z/W. Switched in the Parameter panel's Settings tab (Refactor.85).
 * 分量名稱：節點把向量分量顯示成 X/Y/Z/W、R/G/B/A、S/T/P/Q 或 U/V。存在節點的 ui.componentNames（只是外觀、不產碼）；
 * 沒存時用節點模組的預設，沒說就是 X/Y/Z/W。在參數面板的設定分頁切換（R.85）。 */
exports.componentStyles = ['xyzw', 'rgba', 'stpq', 'uv'];
const isStyle = (value) => exports.componentStyles.includes(value);
/** A node's names when its module says `fallback` by default. 模組預設為 fallback 時這個節點的名稱樣式。 */
const storedOr = (node, fallback) => { var _a; return isStyle((_a = node.ui) === null || _a === void 0 ? void 0 : _a.componentNames) ? node.ui.componentNames : fallback; };
exports.storedOr = storedOr;
/** A node's names, as it shows them. 節點顯示的名稱樣式。 */
const componentStyle = (module, node, context) => { var _a, _b; return (0, exports.storedOr)(node, (_b = (_a = module === null || module === void 0 ? void 0 : module.componentNames) === null || _a === void 0 ? void 0 : _a.call(module, node, context)) !== null && _b !== void 0 ? _b : 'xyzw'); };
exports.componentStyle = componentStyle;
/** The letters for a style; U/V only with two components, otherwise X/Y/Z/W (legacy vectorNames).
 * 樣式的字母；U/V 只用在兩個分量，否則 X/Y/Z/W（照舊產品）。 */
const componentLetters = (style, count) => style === 'uv' ? (count === 2 ? 'UV' : 'XYZW') : style.toUpperCase();
exports.componentLetters = componentLetters;

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
    // No count of subgraph definitions (amendment 3 C9, design-interview Q77): the legacy 64 had no basis and only turned an extra copy
    // into a refused paste; a graph's size is held by documentBytes. 不限子圖定義份數：舊的 64 沒有依據，只把多一份變成貼上被拒；圖的大小由 documentBytes 管。
    // Legacy-era choice (legacy sgrape_core.py:2104), no measured basis; checked when a subgraph is created, its
    // interface edited and an instance resolved (Refactor.61, Q47 supplement 8). 舊產品時代的數字、沒有實測依據；建立、改介面、解析實例時檢查。
    subgraphPortsPerSide: 16,
});

},
"connectivity":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unusableNodes = unusableNodes;
exports.connectedWires = connectedWires;
const subgraph_stages_1 = require("./subgraph_stages");
/** The nodes this build cannot use, and why (Q37 1-1; Q45: a reference to a declaration that no longer exists). 這一版用不了的節點與
 * 原因（Q37 1-1；Q45：引用的宣告已不存在）。 */
function unusableNodes(network) {
    var _a;
    const nodes = new Map();
    // Subgraph networks have no stage of their own; their nodes follow the stage of their instance.
    const stage = network.id.startsWith('subgraph:') ? undefined : network.id;
    let stagesOf; // one table for every instance here (TECH-3) 這裡所有實例共用一張表
    for (const node of network.nodes) {
        const data = node.data, module = node.definition;
        const referred = (_a = module === null || module === void 0 ? void 0 : module.referencedDeclaration) === null || _a === void 0 ? void 0 : _a.call(module, data);
        if (!module)
            nodes.set(node.id, 'unknown');
        else if (stage && module.catalog.definition.stages && !module.catalog.definition.stages.includes(stage))
            nodes.set(node.id, 'misplaced');
        // A subgraph instance whose content cannot run in this stage (Q46, Q37 1-4): kept, marked, back once the content fits.
        // 子圖內容不能在這個 Stage 用的實例：保留、標示，內容改回能用就恢復。
        else if (stage && module.referencedGraph && !(stagesOf !== null && stagesOf !== void 0 ? stagesOf : (stagesOf = (0, subgraph_stages_1.subgraphStageTable)(network.graph.document, network.graph.registry)))(module.referencedGraph(data)).includes(stage))
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
    return nodes;
}
/** The stored wires in effect, as the stored objects (the same ones the raw list holds). 接通的線，用存著的物件（和原始清單是同一批）。 */
function connectedWires(network, policy, unusable = unusableNodes(network)) {
    const connected = new Set();
    for (const edge of network.edges) {
        const data = edge.data;
        if (!unusable.has(data.from[0]) && !unusable.has(data.to[0]) && edge.connection(policy).valid)
            connected.add(data);
    }
    return connected;
}

},
"declarations":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeclarationError = exports.declarationKinds = exports.defaultTextures = void 0;
exports.declarationNameProblem = declarationNameProblem;
exports.declarationLabel = declarationLabel;
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
 * `defaultTexture`). `none` (Refactor.60; human 2026-10-10) is TD's own "nothing connected" — transparent — and comes first:
 * a new input starts with it, as TD users expect. The rest are the Samples outputs. The TOP chosen on Samples (`custom`)
 * is gone: wire the image into the input instead. How TD provides them is TD's business (Q45).
 * 外面沒接東西時用的預設圖。none＝TD 自己的「沒接」（透明），排第一、新增的輸入用它，符合 TD 使用者的預期（人類 10-10）；
 * 其他是 Samples 的出口。Samples 上自選的 TOP 已拿掉：改把圖接進輸入。 */
exports.defaultTextures = Object.freeze(['none', 'grape', 'banana', 'jellybeans', 'white', 'black', 'normal']);
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
    initial: () => ({ defaultTexture: 'none' }),
    validate: d => {
        if (d.type !== 'sampler2D')
            throw Error('Unsupported declaration type');
        if (!exports.defaultTextures.includes(String(d.defaultTexture)))
            throw Error('Unknown default texture');
    },
    reference: (_d, i) => ({ out: 'sTD2DInputs[' + i + ']', size: 'uTD2DInfos[' + i + '].res.zw', pixelSize: 'uTD2DInfos[' + i + '].res.xy' }),
    // Named by position, its GLSL name, and not renamed (legacy inspector.js:2986; human 2026-10-09): deleting one
    // before it renumbers it, so the name always matches TD. 照位置命名＝它的 GLSL 名字、不能改（同舊產品）：刪掉前面的就改號，名字永遠對得上 TD。
    label: (_d, i) => 'sTD2DInputs[' + i + ']' };
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
/** The name people see for a declaration: its kind's label from its position among its kind, or its own name.
 * 宣告給人看的名字：種類有 label 就照它在同種宣告裡的位置給，否則用自己的名字。 */
function declarationLabel(all, declaration) {
    const kind = exports.declarationKinds.get(declaration.kind);
    if (!(kind === null || kind === void 0 ? void 0 : kind.label))
        return declaration.name;
    return kind.label(declaration, all.filter(d => d.kind === declaration.kind).findIndex(d => d.id === declaration.id));
}
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
const wire_drop_1 = require("./wire_drop");
function variants(module, target) {
    var _a;
    const definition = module.catalog.definition;
    const base = { id: 'projection', nodeType: definition.nodeType, params: (0, model_1.copy)(definition.defaults) };
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
        definitions: Object.fromEntries(modules.map(m => [m.catalog.definition.nodeType, variants(m, target)])),
        convert: { types: [...values.types], fromParameter: 'fromType', toParameter: 'toType',
            pairs: Object.fromEntries(values.types.map(from => [from, values.types.filter(to => values.explicit(from, to))])) },
        vectors: { version: 1, types: [...values.vectors], components: 'xyzw',
            scalarTypes: Object.fromEntries(values.vectors.map(t => [t, values.family(t)])),
            layouts: Object.fromEntries(values.vectors.map(t => [t, vectorLayouts(t)])) },
        // What a wire dropped on the blank canvas can make (Refactor.77). 線放到空白處能新增什麼（R.77）。
        wireDrop: (0, wire_drop_1.wireDropTable)(registry, [...values.types, ...values.opaque], target)
    };
}

},
"ghosts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ghostsOf = ghostsOf;
const connectivity_1 = require("./connectivity");
function ghostsOf(network, policy) {
    const nodes = (0, connectivity_1.unusableNodes)(network), connected = (0, connectivity_1.connectedWires)(network, policy, nodes);
    const edges = new Set(), edgeData = new Set();
    for (const edge of network.edges)
        if (!connected.has(edge.data)) {
            edges.add(edge.id);
            edgeData.add(edge.data);
        }
    return { nodes, edges, edgeData };
}

},
"graph":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphDocument = exports.GraphError = exports.Network = exports.Edge = exports.Node = exports.Port = exports.ScopeReferences = exports.prepareNodeWire = exports.contextFor = exports.changesBetween = void 0;
const model_1 = require("./model");
const groups_1 = require("./groups");
const node_module_1 = require("./node_module");
const ports_1 = require("./ports");
const wire_planning_1 = require("./wire_planning");
const connectivity_1 = require("./connectivity");
const changes_1 = require("./changes");
const capacity_1 = require("./capacity");
const structure_1 = require("./structure");
var changes_2 = require("./changes");
Object.defineProperty(exports, "changesBetween", { enumerable: true, get: function () { return changes_2.changesBetween; } });
var node_module_2 = require("./node_module");
Object.defineProperty(exports, "contextFor", { enumerable: true, get: function () { return node_module_2.contextFor; } });
Object.defineProperty(exports, "prepareNodeWire", { enumerable: true, get: function () { return node_module_2.prepareNodeWire; } });
const subgraphs_1 = require("./subgraphs");
const library_1 = require("./library");
const library_operations_1 = require("./library_operations");
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
    subgraphFromSelection(ids, options) {
        this.assertEditable();
        if (this.removedNodes.has(options.instanceId))
            throw Error('Retired node ID');
        const instance = (0, subgraph_operations_1.subgraphFromSelection)(this, ids, options);
        ids.forEach(id => this.removedNodes.add(id));
        return this.node(instance.id);
    }
    instantiateSubgraph(definitionId, id, ui = {}) {
        return this.node((0, subgraph_operations_1.instantiateSubgraph)(this, definitionId, id, ui).id);
    }
    independentSubgraph(node, next, at) {
        if (node.network !== this)
            throw Error('Node belongs to another network');
        const f = (0, subgraph_copies_1.independentSubgraph)(this, node.id, next, at);
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
    /** Remove nodes and their wires. `collectible` names the subgraph definitions that may go when their last instance goes
     * (subgraph_operations.ts collectSubgraphs); by default none. 刪節點與線；collectible 是刪掉最後一個實例時可回收的定義，預設沒有。 */
    removeAll(nodes, collectible = new Set()) {
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
        (0, subgraph_operations_1.collectSubgraphs)(this.graph, roots, this.data, collectible);
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
        // Only the wires in effect constrain (Refactor.103.1). 只有接通的線算數（R.103.1）。
        const result = (0, wire_planning_1.plan)({ nodes, edges: this.data.edges.filter(e => !removed.includes(e)) }, policy, intent, (0, connectivity_1.connectedWires)(this, policy));
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
    /** Remove a definition with no instances (subgraph_operations.ts). 刪掉沒有實例的定義。 */
    removeSubgraph(id) { (0, subgraph_operations_1.removeSubgraph)(this, id); }
    appendSubgraphs(definitions, ids = new Map()) {
        return (0, subgraph_copies_1.appendSubgraphs)(this, definitions, ids).map(f => this.subgraph(f.id));
    }
    subgraph(id) { return new subgraphs_1.Subgraph(this, id); }
    /** Make Local (library_operations.ts): returns the ID holding the local content (the same, or the fork B′). 轉為本地：回傳放本地內容的 ID。 */
    makeLocal(id, next, at) { return (0, library_operations_1.makeLocal)(this, id, next, at); }
    /** Take a Library copy's new content (library_operations.ts). 讓 Library 副本換成新內容。 */
    updateFromLibrary(id, content) { (0, library_operations_1.updateFromLibrary)(this, id, content); }
    /** Declarations (declarations.ts): add, rename／retype／revalue, remove with its references. */
    addDeclaration(entry) { this.assertEditable(); return (0, declarations_1.addDeclaration)(this.document, entry); }
    changeDeclaration(id, patch) { this.assertEditable(); return (0, declarations_1.changeDeclaration)(this.document, id, patch); }
    removeDeclaration(id) {
        this.assertEditable();
        (0, declarations_1.removeDeclaration)(this.document, id, (nodeType, params) => { var _a, _b; return (_b = (_a = this.registry.get(nodeType)) === null || _a === void 0 ? void 0 : _a.referencedDeclaration) === null || _b === void 0 ? void 0 : _b.call(_a, { id: '', nodeType, params: params }); });
    }
    assertEditable() { if (!this.editable || !this.active)
        throw Error('Graph changes require an active transaction'); }
    /** This transaction's Library ledger (library.ts). 這筆交易的 Library 帳本。 */
    get library() { var _a, _b; this.assertEditable(); return (_a = this.ledger) !== null && _a !== void 0 ? _a : (this.ledger = new library_1.LibraryLedger((_b = this.start) !== null && _b !== void 0 ? _b : this.document)); }
    /** Whether this transaction has a ledger yet (asking does not make one). 這筆交易是否已有帳本（問了不會建）。 */
    get libraryInUse() { return !!this.ledger; }
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
        candidate.start = before;
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
            // A subgraph that reaches itself through its instances cannot be expanded: an edit that adds an instance edge closing a cycle is refused
            // as a whole, even when the graph already has another one (TECH-8); a graph opened with one stays editable and repairable (the
            // compiler reports it). 經由實例回到自己的子圖展不開：新增的實例邊會成環的修改整筆拒絕，圖裡已有別的循環也一樣；開圖時已有的照樣能編、能修。
            const cycle = (0, subgraph_operations_1.newSubgraphCycle)(before, after, this.registry);
            if (cycle)
                throw Object.assign(Error('Subgraph reference cycle: ' + cycle), { code: 'subgraph.cycle', subgraphId: cycle });
            // Library copies change only through the legal operations, checked against this edit's ledger (library.ts, amendment 2 B1).
            // Library 副本只能經由合法操作改變，對這筆修改的帳本檢查。
            (0, library_1.requireLibrary)(before, after, candidate.ledger, this.registry);
            return { before, after, changes: (0, changes_1.changesBetween)(before, after, this.registry) };
        }
        finally {
            candidate.close();
        }
    }
}
exports.GraphDocument = GraphDocument;
function networkEntries(document) {
    return [...Object.entries(document.stages), ...(document.subgraphs || []).map(raw => { const f = raw; return ['subgraph:' + f.id, f.graph]; })];
}
function complete(document) {
    // Groups are tidied at the end of every change (design-interview 1-2), so no command has to remember them. 每次修改結束時整理群組
    // （1-2），任何指令都不必記得處理群組。
    (0, groups_1.tidyGroups)(document);
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
"groups":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeGroups = exports.inAnyGroup = exports.canGroup = exports.groupsOf = exports.validGroupName = exports.GROUP_TEXT_LIMIT = exports.GROUP_NAME_LIMIT = exports.MEMBER_LIMIT = exports.GROUP_LIMIT = exports.TEXT_SCALE_MAX = exports.TEXT_SCALE_MIN = void 0;
exports.tidy = tidy;
exports.tidyGroups = tidyGroups;
exports.joinTarget = joinTarget;
exports.createGroup = createGroup;
exports.joinGroup = joinGroup;
exports.leaveGroups = leaveGroups;
exports.removeGroup = removeGroup;
exports.changeGroup = changeGroup;
exports.addCopiedGroups = addCopiedGroups;
const model_1 = require("./model");
const changes_1 = require("./changes");
/** The body text's size factor, as legacy (graph_ui.js:1688: up to 10). 內文字體倍率範圍（照舊產品：最大 10）。 */
exports.TEXT_SCALE_MIN = 0.5, exports.TEXT_SCALE_MAX = 10;
const validScale = (value) => typeof value === 'number' && Number.isFinite(value) && value >= exports.TEXT_SCALE_MIN && value <= exports.TEXT_SCALE_MAX;
/** Legacy's limits (functions_model.js:10-13). 舊產品的上限。 */
exports.GROUP_LIMIT = 256, exports.MEMBER_LIMIT = 256, exports.GROUP_NAME_LIMIT = 80;
/** The body text's length (a few pages; Refactor.99). 內文長度上限（幾頁；R.99）。 */
exports.GROUP_TEXT_LIMIT = 10000;
const ID = /^[A-Za-z][A-Za-z0-9_]{0,63}$/, COLOR = /^#[0-9a-f]{6}$/;
/** A name people can read: 1 to 80 characters, no control characters, not only spaces. 看得懂的名字：1 到 80 字、沒有控制字元、不是只有空白。 */
const validGroupName = (name) => typeof name === 'string' && name.trim().length > 0 && name.length <= exports.GROUP_NAME_LIMIT && !/[\u0000-\u001f\u007f]/.test(name);
exports.validGroupName = validGroupName;
/** The groups of a network, tidied (the automatic fix, 1-2): members that are not nodes of this network are dropped (a ghost node is
 * still a node), a node claimed by two groups stays with the first, repeats go, an empty group goes; a malformed entry is dropped.
 * `fixed` says whether anything was changed. 一張網路的群組，整理過（自動修正，1-2）：不是這張網路節點的成員拿掉（Ghost 節點仍是節點）、
 * 被兩個群組認領的節點留在第一個、重複的拿掉、空群組拿掉；格式不對的整筆拿掉。fixed：有沒有改到東西。 */
function tidy(network) {
    var _a;
    const raw = (_a = network.ui) === null || _a === void 0 ? void 0 : _a.groups;
    if (raw === undefined)
        return { groups: [], fixed: false };
    if (!Array.isArray(raw))
        return { groups: [], fixed: true };
    const nodes = new Set(network.nodes.map(node => node.id)), claimed = new Set(), ids = new Set(), groups = [];
    for (const entry of raw.slice(0, exports.GROUP_LIMIT)) {
        const group = entry;
        if (!group || typeof group !== 'object' || typeof group.id !== 'string' || !ID.test(group.id) || ids.has(group.id) || !(0, exports.validGroupName)(group.name)
            || !Array.isArray(group.nodes))
            continue;
        const members = [...new Set(group.nodes)].filter((id) => typeof id === 'string' && nodes.has(id) && !claimed.has(id)).slice(0, exports.MEMBER_LIMIT);
        if (!members.length)
            continue;
        members.forEach(id => claimed.add(id));
        ids.add(group.id);
        groups.push({ id: group.id, name: group.name, nodes: members, ...(typeof group.color === 'string' && COLOR.test(group.color) ? { color: group.color } : {}),
            ...(typeof group.text === 'string' && group.text && group.text.length <= exports.GROUP_TEXT_LIMIT ? { text: group.text } : {}),
            ...(validScale(group.textScale) && group.textScale !== 1 ? { textScale: group.textScale } : {}),
            ...(group.textAlign === 'center' || group.textAlign === 'right' ? { textAlign: group.textAlign } : {}),
            ...(group.textPlace === 'bottom' ? { textPlace: group.textPlace } : {}) });
    }
    // Compared as JSON values, whatever order the fields were written in. 照 JSON 的值比，不管欄位寫的順序。
    return { groups, fixed: !(0, changes_1.equal)(groups, raw) };
}
/** The groups of a network as they are now (tidied, read-only use). 一張網路現在的群組（整理過，只讀用）。 */
const groupsOf = (network) => tidy(network).groups;
exports.groupsOf = groupsOf;
function write(network, groups) {
    var _a;
    if (groups.length) {
        network.ui = { ...((_a = network.ui) !== null && _a !== void 0 ? _a : {}), groups: (0, model_1.copy)(groups) };
        return;
    }
    if (!network.ui)
        return;
    const { groups: _, ...rest } = network.ui;
    if (Object.keys(rest).length)
        network.ui = rest;
    else
        delete network.ui;
}
/** Tidy every network of a document in place; how many networks were fixed. Run at the end of every change and when a graph is
 * opened (1-2: the only two gates). Every subgraph network is tidied like a stage (Refactor.109: no read-only snapshots in
 * a graph). 就地整理整份文件的每張網路；回傳修了幾張。在每次修改結束時與開圖時執行（1-2：只有這兩個關卡）。子圖網路和 stage 一樣整理。 */
function tidyGroups(document) {
    var _a;
    let fixed = 0;
    const networks = [...Object.values(document.stages), ...((_a = document.subgraphs) !== null && _a !== void 0 ? _a : []).map(subgraph => subgraph.graph)];
    for (const network of networks) {
        const result = tidy(network);
        if (result.fixed) {
            write(network, result.groups);
            fixed++;
        }
    }
    return fixed;
}
const groupOf = (groups, node) => groups.find(group => group.nodes.includes(node));
/** Whether these nodes can make a new group: two or more, none in a group yet (legacy frames_ui.js:23-27). 這些節點能不能建立新群組：兩個以上、
 * 都還沒在群組裡（照舊產品）。 */
const canGroup = (groups, ids) => new Set(ids).size === ids.length
    && ids.length >= 2 && ids.length <= exports.MEMBER_LIMIT && groups.length < exports.GROUP_LIMIT && ids.every(id => !groupOf(groups, id));
exports.canGroup = canGroup;
/** The group these nodes would join: the one holding most of them, when it is the only such one, some are outside it (legacy
 * frames_ui.js:38-48), and they all fit under the member limit. 這些節點會加入哪個群組：裝著最多個的那一個，只有它一個這麼多、
 * 有些不在裡面時（照舊產品），而且全部放得進成員上限。 */
function joinTarget(groups, ids) {
    var _a;
    const counts = groups.map(group => ({ group, count: ids.filter(id => group.nodes.includes(id)).length })).filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);
    const best = counts[0];
    if (!best || ((_a = counts[1]) === null || _a === void 0 ? void 0 : _a.count) === best.count || ids.every(id => best.group.nodes.includes(id)))
        return null;
    return new Set([...best.group.nodes, ...ids]).size <= exports.MEMBER_LIMIT ? best.group : null;
}
/** Whether some of these nodes are in a group (Remove from group). 這些節點有沒有在群組裡的（移出群組）。 */
const inAnyGroup = (groups, ids) => ids.some(id => !!groupOf(groups, id));
exports.inAnyGroup = inAnyGroup;
// Commands, inside GraphDocument.change() on the editable candidate. 指令：在 GraphDocument.change() 的可編輯候選文件上使用。
function edit(network, change) {
    network.assertEditable();
    write(network.data, change((0, exports.groupsOf)(network.data)));
}
/** A new group of these nodes (G-3, Ctrl+G). 用這些節點建立新群組（G-3，Ctrl＋G）。 */
function createGroup(network, ids, group) {
    edit(network, groups => {
        if (!ID.test(group.id) || groups.some(item => item.id === group.id) || !(0, exports.validGroupName)(group.name))
            throw Error('Invalid group');
        if (!(0, exports.canGroup)(groups, ids) || ids.some(id => !network.data.nodes.some(node => node.id === id)))
            throw Error('These nodes cannot make a group');
        return [...groups, { id: group.id, name: group.name, nodes: [...ids], ...(group.color ? { color: group.color } : {}) }];
    });
}
/** Move these nodes into the group most of them are in (G-3, Alt+Shift+G). 把這些節點移入多數所在的群組（G-3，Alt＋Shift＋G）。 */
function joinGroup(network, ids) {
    edit(network, groups => {
        const target = joinTarget(groups, ids);
        if (!target)
            throw Error('No group to join');
        return groups.map(group => group.id === target.id ? { ...group, nodes: [...group.nodes, ...ids.filter(id => !group.nodes.includes(id))] }
            : { ...group, nodes: group.nodes.filter(id => !ids.includes(id)) });
    });
}
/** Take these nodes out of their groups (G-3, Alt+G); a group left empty goes. 把這些節點移出群組（G-3，Alt＋G）；空了的群組拿掉。 */
function leaveGroups(network, ids) {
    edit(network, groups => groups.map(group => ({ ...group, nodes: group.nodes.filter(id => !ids.includes(id)) })));
}
/** Remove a group, keeping its nodes (G-3). 拿掉群組，節點留著（G-3）。 */
function removeGroup(network, id) {
    edit(network, groups => groups.filter(group => group.id !== id));
}
/** Rename, recolour or rewrite a group; an empty text takes the text away. 群組改名、改色或改內文；空的內文＝拿掉內文。 */
function changeGroup(network, id, patch) {
    edit(network, groups => groups.map(group => {
        if (group.id !== id)
            return group;
        if (patch.name !== undefined && !(0, exports.validGroupName)(patch.name))
            throw Error('Invalid group name');
        if (patch.color !== undefined && !COLOR.test(patch.color))
            throw Error('Invalid group color');
        if (patch.text !== undefined && patch.text.length > exports.GROUP_TEXT_LIMIT)
            throw Error('Group text too long');
        if (patch.textScale !== undefined && !validScale(patch.textScale))
            throw Error('Invalid text scale');
        if (patch.textAlign !== undefined && !['left', 'center', 'right'].includes(patch.textAlign))
            throw Error('Invalid text alignment');
        if (patch.textPlace !== undefined && !['top', 'bottom'].includes(patch.textPlace))
            throw Error('Invalid text place');
        // The defaults are not stored: no text, size 1, left, top. 預設值不存：沒有內文、倍率 1、靠左、靠上。
        const { text, textScale, textAlign, textPlace, ...rest } = { ...group, ...patch };
        return { ...rest, ...(text ? { text } : {}), ...(textScale !== undefined && textScale !== 1 ? { textScale } : {}),
            ...(textAlign && textAlign !== 'left' ? { textAlign } : {}), ...(textPlace === 'bottom' ? { textPlace } : {}) };
    }));
}
/** The groups that come along when these nodes are copied: only those whose members are all among them (G-2). 複製這些節點時帶著的群組：
 * 只有成員全在裡面的（G-2）。 */
const completeGroups = (groups, ids) => groups.filter(group => group.nodes.every(id => ids.has(id)));
exports.completeGroups = completeGroups;
/** Add copied groups to a network under new IDs, their members renamed by `nodes` (G-2); none past the limit. 把複製的群組加進網路、換新
 * ID，成員依 nodes 換成新節點（G-2）；超過上限的不加。 */
function addCopiedGroups(network, copied, nodes, newId) {
    edit(network, groups => [...groups, ...copied.map(group => ({ ...(0, model_1.copy)(group), id: newId(), nodes: group.nodes.flatMap(id => nodes.has(id) ? [nodes.get(id)] : []) }))]
        .slice(0, exports.GROUP_LIMIT));
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
"library":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.instancesOf = exports.readOnly = exports.now = exports.LibraryLedger = exports.validLibraryId = void 0;
exports.localize = localize;
exports.requireCurrent = requireCurrent;
exports.requireLibrary = requireLibrary;
exports.standardForm = standardForm;
exports.libraryMatcher = libraryMatcher;
exports.closureOrder = closureOrder;
/** Library copies in a graph (basic design §3.7–3.10, amendment 1 A2–A6, amendment 2 B1–B4 revision 3; Refactor.118).
 * A definition carrying `libraryId` is a read-only copy: an ordinary edit may not change it, only the legal operations (add a copy,
 * make local, make single user, update from the Library, remove) may, and each passes through one transaction ledger. The gate at
 * the end of GraphDocument.change() checks the ledger against the edit's result. A graph without Library copies never builds a ledger
 * and the gate returns after one scan of the definition lists, with no content comparison (zero cost, measured). The core never reads a Library: content comes from the caller.
 * 圖裡的 Library 副本：帶 libraryId 的定義唯讀，一般修改不能改它，只有合法操作（加入副本、轉為本地、設為唯一、從 Library 更新、移除）
 * 可以，而且都經過同一張交易帳本；change() 末尾的關卡拿帳本對結果。沒有 Library 副本的圖不建帳本，關卡只掃一次定義清單、不比內容就返回（零成本，量過）。核心不讀
 * Library，內容由呼叫端給。 */
const model_1 = require("./model");
const changes_1 = require("./changes");
const scope_references_1 = require("./scope_references");
/** A Library identity is a UUID (Q74.1). Library ID 是 UUID。 */
const validLibraryId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
exports.validLibraryId = validLibraryId;
const key = (id, libraryId) => id + '\u0000' + libraryId;
/** One transaction's ledger. A state is first taken from the document as the transaction began; legal operations replace it, never
 * keep the old one. Content is held as its own copy, never shared with the candidate (B1-R2 implementation contract).
 * 一筆交易的帳本：初值取自交易開始時的文件；合法操作取代它、不保留舊值。內容存自己的複本，不和候選文件共用參照。 */
class LibraryLedger {
    constructor(start) {
        this.start = start;
        this.states = new Map();
    }
    state(id, libraryId) {
        var _a;
        const held = this.states.get(key(id, libraryId));
        if (held)
            return held.state;
        const f = (_a = this.start.subgraphs) === null || _a === void 0 ? void 0 : _a.find(d => d.id === id && d.libraryId === libraryId);
        return f ? { kind: 'content', data: f } : undefined;
    }
    set(id, libraryId, state) {
        this.states.set(key(id, libraryId), { id, libraryId, state: state.kind === 'content' ? { kind: 'content', data: (0, model_1.copy)(state.data) } : state });
    }
    /** Every identity the ledger was told about. 帳本被告知過的每個身分。 */
    entries() { return [...this.states.values()]; }
    get size() { return this.states.size; }
}
exports.LibraryLedger = LibraryLedger;
/** The time written into a provenance entry. 寫進出處的時間。 */
const now = () => new Date().toISOString();
exports.now = now;
/** A copy loses its Library ID and keeps where it came from (amendment 3 C6): one `library` entry, replacing an older one.
 * 副本拿掉 Library ID，記下出處：一筆 library，取代舊的那筆。 */
function localize(f, at) {
    var _a;
    const libraryId = f.libraryId;
    if (libraryId === undefined)
        return;
    delete f.libraryId;
    f.provenance = [...((_a = f.provenance) !== null && _a !== void 0 ? _a : []).filter(p => p.kind !== 'library'), { kind: 'library', libraryId, title: f.title, at }];
}
const readOnly = (what) => Object.assign(Error('A subgraph from a Library is read-only (' + what + '); make it local to edit it'), { code: 'subgraph.readOnly' });
exports.readOnly = readOnly;
/** The start check of every legal operation (B1 contract 1): the definition as it stands in the candidate must equal the ledger's
 * current content. 合法操作的起點檢查：候選文件裡的那份必須等於帳本目前的內容。 */
function requireCurrent(ledger, f) {
    if (f.libraryId === undefined)
        return;
    const state = ledger.state(f.id, f.libraryId);
    if (!state || state.kind !== 'content' || !(0, changes_1.equal)(f, state.data))
        throw (0, exports.readOnly)('it was changed in this edit');
}
/** The definitions a definition's instances point at. 一份定義裡的實例指向哪些定義。 */
const instancesOf = (f, registry) => f.graph.nodes.flatMap(n => { var _a, _b; const ref = (_b = (_a = registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n); return ref === undefined ? [] : [ref]; });
exports.instancesOf = instancesOf;
/** The gate (B1, end of change()): every read-only identity in the ledger, before or after must end as the ledger says; and a
 * read-only definition may only use read-only ones (A3). A graph with no Library copy and no ledger returns after scanning the definition lists.
 * 關卡：帳本、before、after 裡每個唯讀身分的結局都要符合帳本；唯讀定義只能用唯讀定義（A3）。沒有 Library 副本也沒有帳本的圖，掃過定義清單就返回。 */
function requireLibrary(before, after, ledger, registry) {
    var _a, _b, _c;
    const held = (g) => { var _a; return ((_a = g.subgraphs) !== null && _a !== void 0 ? _a : []).filter(f => f.libraryId !== undefined); };
    const was = held(before), now = held(after);
    if (!was.length && !now.length && !(ledger === null || ledger === void 0 ? void 0 : ledger.size))
        return;
    const book = ledger !== null && ledger !== void 0 ? ledger : new LibraryLedger(before);
    const identities = new Map();
    for (const f of [...was, ...now])
        identities.set(key(f.id, f.libraryId), { id: f.id, libraryId: f.libraryId });
    for (const entry of book.entries())
        identities.set(key(entry.id, entry.libraryId), entry);
    const after_ = new Map(((_a = after.subgraphs) !== null && _a !== void 0 ? _a : []).map(f => [f.id, f]));
    for (const { id, libraryId } of identities.values()) {
        const state = book.state(id, libraryId), found = after_.get(id);
        if (!state) {
            if ((found === null || found === void 0 ? void 0 : found.libraryId) === libraryId)
                throw (0, exports.readOnly)('it entered without being added');
            continue;
        }
        if (state.kind === 'content') {
            if (!found || !(0, changes_1.equal)(found, state.data))
                throw (0, exports.readOnly)('it was changed');
            continue;
        }
        // Made local means no Library ID at all, not merely not this one (Codex R118-1). 轉為本地＝不帶任何 Library ID，不只是不帶原本那個。
        if (state.kind === 'local') {
            if ((found === null || found === void 0 ? void 0 : found.libraryId) !== undefined)
                throw (0, exports.readOnly)('it was made local');
            continue;
        }
        if (found)
            throw (0, exports.readOnly)('it was removed');
    }
    // One Library ID, at most one shared definition (amendment 3 C2): an edit may not add a copy of one already here. A graph opened
    // with duplicates is repaired as it opens (library_policy.ts), not refused here. 一個 Library ID 至多一份共用定義：修改不能多加一份
    // 已有的；開圖前就有的重複在開圖時修補，不在這裡擋。
    const count = (list) => list.reduce((m, f) => { var _a; return m.set(f.libraryId, ((_a = m.get(f.libraryId)) !== null && _a !== void 0 ? _a : 0) + 1); }, new Map());
    const had = count(was);
    for (const [libraryId, n] of count(now))
        if (n > 1 && n > ((_b = had.get(libraryId)) !== null && _b !== void 0 ? _b : 0))
            throw Object.assign(Error('A Library subgraph may be in a graph only once'), { code: 'subgraph.libraryDuplicate' });
    for (const f of now)
        for (const ref of (0, exports.instancesOf)(f, registry))
            if (((_c = after_.get(ref)) === null || _c === void 0 ? void 0 : _c.libraryId) === undefined)
                throw Object.assign(Error('A read-only subgraph may only use read-only subgraphs'), { code: 'subgraph.readOnlyClosure' });
}
/** A JSON text with its object keys in order, so equal content gives equal text. 物件鍵排好序的 JSON，內容相同就字串相同。 */
function canonical(value) {
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort()
            .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
}
/** Every string value escaped in place so it holds no bare \u0000 (keys stay). 每個字串值就地轉義，不留單獨的 \u0000（鍵不動）。 */
function escapeStrings(value) {
    if (!value || typeof value !== 'object')
        return;
    const record = value;
    for (const key of Object.keys(record)) {
        const item = record[key];
        if (typeof item === 'string')
            record[key] = item.replace(/[\u0000\u0001]/g, c => c === '\u0001' ? '\u0001\u0001' : '\u0001\u0002');
        else
            escapeStrings(item);
    }
}
/** The standard form of a definition with its closure (amendment 2 B4): the closure numbered in a fixed walk (root 0, then each
 * dependency as first met), instance references replaced by those numbers, each definition keeping its Library ID, without in-graph
 * IDs and derived fields. null when the closure is incomplete. Compared as text where both sides are at hand (no hash).
 * 閉包的標準形（B4）：固定走訪給編號（根＝0，依序首次遇到的依賴），實例參照換成編號，每份保留 Library ID，不含圖內 ID 與推算欄位；
 * 閉包不完整就是 null。兩邊都在手上時直接比字串，不算雜湊。 */
function standardForm(document, registry, rootId) {
    const order = closureOrder(document, registry, rootId);
    if (!order)
        return null;
    const numbers = new Map(order.map((f, i) => [f.id, i]));
    return canonical(order.map(f => {
        const { id: _id, stages: _stages, targets: _targets, provenance: _provenance, ...rest } = (0, model_1.copy)(f);
        // Stored text first has its control characters escaped (\u0001 → \u0001\u0001, \u0000 → \u0001\u0002), so no stored text holds a bare
        // \u0000 and cannot imitate the markers below, whatever the field (Codex R118.2-2). 存的文字先轉義控制字元，就不會有單獨的 \u0000，
        // 不管在哪個欄位都仿不出下面的標記。
        escapeStrings(rest);
        rest.graph.nodes = rest.graph.nodes.map((n) => {
            var _a;
            const module = registry.get(n.nodeType), ref = (_a = module === null || module === void 0 ? void 0 : module.referencedGraph) === null || _a === void 0 ? void 0 : _a.call(module, n);
            return ref === undefined || !(module === null || module === void 0 ? void 0 : module.reference) ? n : { ...n, params: { ...n.params, ...module.reference('#' + numbers.get(ref)) } };
        });
        // A scoped reference to a network in the closure takes that network's number too: only renumbering in-graph IDs must not make two
        // copies differ (Codex R118-3). The marker is \u0000 + JSON + \u0000, which escaped stored text never reads, so a resolved reference
        // never equals unresolved text (Codex R118.1-2, R118.2-2). 指向閉包裡某張網路的 scoped 參照也換成那張網路的編號：只是圖內 ID 重配，
        // 不能讓兩份變得不同。標記是 \u0000＋JSON＋\u0000，轉義過的存檔文字不可能讀成它，所以解析得到的參照不會和任何原文相等。
        scope_references_1.ScopeReferences.walk(rest, (ref, old) => {
            const n = ref.scope.startsWith('fn_') ? numbers.get(ref.scope.slice(3)) : undefined;
            return n === undefined ? old : '\u0000' + JSON.stringify(['closure', n, ...ref.source]) + '\u0000';
        });
        return rest;
    }));
}
/** Whether Library copies of two documents have the same standard form, worked out once per pair and remembered, for documents that
 * each hold at most one copy per Library ID (amendment 3 C2). Under C2 a closure is named by Library IDs, so two copies match when
 * their own content matches with references written as Library IDs and every child pair matches: a long chain costs one walk, not one
 * closure per level (Codex A3-4, R.120). That test is kept on the lenient side — scoped references are compared without the network
 * they name — so it never says different where the standard forms are equal; `same` then confirms a match with the standard form once,
 * and a confirmed parent vouches for its whole closure. 兩份文件的 Library 副本是否同標準形：每一對只算一次並記住，前提是各自每個
 * Library ID 至多一份（C2）。這時閉包可以用 Library ID 指名，所以「自己的內容（參照寫成 Library ID）相同、每一對子也相同」就相同：長鏈走
 * 一次，不是每層一個閉包。這個判斷刻意偏寬（scoped 參照不比它指的網路），所以標準形相同時它不會說不同；same 再用標準形確認一次，確認過的父
 * 整個閉包都算數。 */
function libraryMatcher(source, target, registry) {
    const ids = (g) => { var _a; return new Map(((_a = g.subgraphs) !== null && _a !== void 0 ? _a : []).map(f => [f.id, f])); };
    const sides = [{ g: source, byId: ids(source), own: new Map() }, { g: target, byId: ids(target), own: new Map() }];
    const mark = (parts) => '\u0000' + JSON.stringify(parts) + '\u0000';
    const ownOf = (side, f) => {
        if (side.own.has(f.id))
            return side.own.get(f.id);
        const { id: _id, stages: _stages, targets: _targets, provenance: _provenance, ...rest } = (0, model_1.copy)(f);
        escapeStrings(rest);
        let complete = true;
        rest.graph.nodes = rest.graph.nodes.map((n) => {
            var _a;
            const module = registry.get(n.nodeType), ref = (_a = module === null || module === void 0 ? void 0 : module.referencedGraph) === null || _a === void 0 ? void 0 : _a.call(module, n);
            if (ref === undefined || !(module === null || module === void 0 ? void 0 : module.reference))
                return n;
            const child = side.byId.get(ref);
            if ((child === null || child === void 0 ? void 0 : child.libraryId) === undefined) {
                complete = false;
                return n;
            }
            return { ...n, params: { ...n.params, ...module.reference(mark(['library', child.libraryId])) } };
        });
        scope_references_1.ScopeReferences.walk(rest, () => mark(['scope']));
        const own = complete ? canonical(rest) : null;
        side.own.set(f.id, own);
        return own;
    };
    // Whether a definition and everything it uses name no network but their own by scope (a scoped reference to itself is fine).
    // 一份定義和它用到的每一份，scoped 參照是否都只指自己的網路。
    const tidy = sides.map(() => new Map());
    const clean = (side, id) => {
        const memo = tidy[sides.indexOf(side)];
        if (memo.has(id))
            return memo.get(id);
        memo.set(id, false);
        const f = side.byId.get(id);
        let own = !!f;
        if (f)
            scope_references_1.ScopeReferences.walk(f, (ref, old) => { if (ref.scope !== 'fn_' + f.id)
                own = false; return old; }, false);
        const result = own && (0, exports.instancesOf)(f, registry).every(child => clean(side, child));
        memo.set(id, result);
        return result;
    };
    const known = new Map(), vouched = new Map();
    const like = (s, t) => {
        const key = s.id + '\u0000' + t.id;
        if (known.has(key))
            return known.get(key);
        known.set(key, false);
        // Every child pair is settled even when this one already differs, so one walk leaves an answer for the whole closure.
        // 這一對已經不同時，子的每一對照樣算完，走一次就留下整個閉包的答案。
        const children = (0, exports.instancesOf)(s, registry), theirs = (0, exports.instancesOf)(t, registry);
        let result = children.length === theirs.length;
        children.forEach((c, i) => { var _a; const a = sides[0].byId.get(c), b = sides[1].byId.get((_a = theirs[i]) !== null && _a !== void 0 ? _a : ''); if (!a || !b || !like(a, b))
            result = false; });
        const own = ownOf(sides[0], s);
        result && (result = s.libraryId !== undefined && s.libraryId === t.libraryId && own !== null && own === ownOf(sides[1], t));
        known.set(key, result);
        return result;
    };
    return {
        /** Same standard form, exactly. The common case (equal) costs one standard form and vouches for the closure; a difference then
         * walks the pairs once, so the levels below answer from memory. 標準形相同（精確）。常見的相同只算一次標準形並替閉包作保；不同時才把每一對
         * 走一次，下面各層就從記憶回答。 */
        same(sourceId, targetId) {
            if (vouched.get(sourceId) === targetId)
                return true;
            const s = sides[0].byId.get(sourceId), t = sides[1].byId.get(targetId);
            if (!s || !t || known.get(s.id + '\u0000' + t.id) === false)
                return false;
            const form = standardForm(source, registry, sourceId);
            if (form === null || form !== standardForm(target, registry, targetId)) {
                like(s, t);
                return false;
            }
            // A confirmed parent vouches only for members whose own closures name no other network by scope: a scoped reference outside a
            // member's closure keeps its raw ID in that member's own standard form, so the parent's equality says nothing about it (Codex
            // R120-1). Others are confirmed on their own when asked. 確認過的父只替「自己閉包裡沒有指向別的網路的 scoped 參照」的成員作保：
            // 成員閉包外的 scoped 參照在它自己的標準形裡保留原 ID，父相同不代表它相同。其餘的被問到時各自確認。
            const from = closureOrder(source, registry, sourceId), to = closureOrder(target, registry, targetId);
            from.forEach((g, i) => { if (clean(sides[0], g.id) && clean(sides[1], to[i].id))
                vouched.set(g.id, to[i].id); });
            return true;
        },
    };
}
/** A definition's closure in the standard form's fixed walk (root first, then each dependency as first met); null when incomplete.
 * Two closures with equal standard forms line up position by position. 標準形固定走訪下的閉包（根在先，依序首次遇到的依賴）；不完整就是 null。
 * 標準形相同的兩個閉包可以逐位對齊。 */
function closureOrder(document, registry, rootId) {
    var _a;
    const byId = new Map(((_a = document.subgraphs) !== null && _a !== void 0 ? _a : []).map(f => [f.id, f])), seen = new Set(), order = [];
    const visit = (id) => {
        if (seen.has(id))
            return true;
        const f = byId.get(id);
        if (!f)
            return false;
        seen.add(id);
        order.push(f);
        return (0, exports.instancesOf)(f, registry).every(visit);
    };
    return visit(rootId) ? order : null;
}

},
"library_files":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIBRARY_VERSION = exports.LIBRARY_FORMAT = void 0;
exports.libraryIdFrom = libraryIdFrom;
exports.saveLibraryFile = saveLibraryFile;
exports.readLibraryFile = readLibraryFile;
exports.bringInLibraryFile = bringInLibraryFile;
exports.verifyLibraryFile = verifyLibraryFile;
/** Library files (D-2, Refactor.121; fields: workspace `work/refactor/library-fields-draft-2026-10-15.md`, decided 10-15/16). One file is
 * one subgraph with the subgraphs it uses: `subgraph` plus `dependencies`, the same shape, nested instances naming each other by Library
 * ID — a file holds no in-graph IDs; they are given when a file is read. Saving is how a person turns a subgraph into a file (the
 * built-in Tint is made this way, tools/make_tint.cjs); reading checks every definition as a graph would, and the stored stages and
 * targets must match what the content gives. The core never reads a Library: callers hand files in.
 * 資源庫檔：一個檔＝一份子圖連同它用到的子圖：subgraph＋dependencies，形狀相同，巢狀實例用 Library ID 互指——檔裡沒有圖內 ID，讀檔時才配。
 * 存檔是使用者把子圖變成檔的方式（內建 Tint 也這樣做）；讀檔照圖的規則驗每份定義，存著的 stages／targets 要和內容算出的一樣。核心不讀
 * 資源庫：檔案由呼叫端給。 */
const model_1 = require("./model");
const node_module_1 = require("./node_module");
const graph_1 = require("./graph");
const changes_1 = require("./changes");
const groups_1 = require("./groups");
const subgraph_interface_1 = require("./subgraph_interface");
const wire_drop_1 = require("./wire_drop");
const values = require("./values");
const library_1 = require("./library");
const subgraph_operations_1 = require("./subgraph_operations");
const subgraph_stages_1 = require("./subgraph_stages");
const scope_references_1 = require("./scope_references");
const library_policy_1 = require("./library_policy");
exports.LIBRARY_FORMAT = 'grape-subgraph';
exports.LIBRARY_VERSION = 1;
const fail = (message) => Object.assign(Error(message), { code: 'library.file' });
const referenceOf = (registry, n) => { var _a, _b; return (_b = (_a = registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n); };
/** A Library ID from 16 random bytes, as a version 4 UUID; the caller gives the randomness (crypto.getRandomValues, which works on
 * plain http too). Library ID：16 個亂數位元組做成第 4 版 UUID；亂數由呼叫端給（crypto.getRandomValues，一般 http 也能用）。 */
function libraryIdFrom(bytes) {
    if (bytes.length < 16)
        throw Error('A Library ID needs 16 random bytes');
    const b = Array.from(bytes).slice(0, 16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = b.map(x => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
/** Where a definition can be used, worked out from its content: the stages (Q46) and the graph targets every node inside takes.
 * 定義能用在哪裡，由內容推算：Stage（Q46），以及裡面每個節點都接受的圖 target。 */
function usesOf(document, registry, id) {
    var _a;
    const stages = [...(0, subgraph_stages_1.subgraphGroups)(document, registry).stagesOf(id)], closure = (_a = (0, library_1.closureOrder)(document, registry, id)) !== null && _a !== void 0 ? _a : [];
    const targets = model_1.GRAPH_TARGETS.filter(target => closure.every(f => f.graph.nodes.every(n => {
        const module = registry.get(n.nodeType);
        return !module || module.supports(n, (0, node_module_1.contextFor)({ ...document, target }, f));
    })));
    return { stages, targets };
}
/** Save a definition and its closure as a Library file. A definition with a Library ID keeps it; one without gets a new one from
 * `newLibraryId`. `details` are the library fields the person gives for the subgraph itself. Scoped references cannot be written yet:
 * a file names its definitions only by Library ID, which is not a scope name (refused, not guessed).
 * 把一份定義連同閉包存成資源庫檔。已有 Library ID 的保留；沒有的由 newLibraryId 給新的。details 是使用者給子圖本身的資源庫欄位。scoped 參照
 * 暫時寫不出來：檔裡只用 Library ID 指定義，而它不是 scope 名稱（拒絕，不猜）。 */
function saveLibraryFile(document, registry, rootId, newLibraryId, details = {}) {
    const order = (0, library_1.closureOrder)(document, registry, rootId);
    if (!order)
        throw fail('The subgraph uses a definition that is missing');
    const ids = new Map(order.map(f => { var _a; return [f.id, (_a = f.libraryId) !== null && _a !== void 0 ? _a : newLibraryId()]; }));
    if (![...ids.values()].every(library_1.validLibraryId) || new Set(ids.values()).size !== ids.size)
        throw fail('Invalid or repeated Library ID');
    const entries = order.map((f, i) => {
        let scoped = false;
        scope_references_1.ScopeReferences.walk(f, (_, old) => { scoped = true; return old; }, false);
        if (scoped)
            throw fail('A Library file cannot hold scoped references yet');
        // Provenance travels with the definition (C6: saved and kept; Codex R121-3); only the in-graph ID and derived fields stay behind.
        // 出處跟著定義走（C6：會存檔、一直保留）；只留下圖內 ID 與推算欄位。
        const { id: _id, descriptionKey: _d, libraryId: _l, stages: _s, targets: _t, title, inputs, outputs, graph, ...rest } = (0, model_1.copy)(f);
        graph.nodes = graph.nodes.map(n => {
            const ref = referenceOf(registry, n), module = registry.get(n.nodeType);
            return ref === undefined || !(module === null || module === void 0 ? void 0 : module.reference) ? n : { ...n, params: { ...n.params, ...module.reference(ids.get(ref)) } };
        });
        return { libraryId: ids.get(f.id), title, ...rest, ...(i === 0 ? (0, model_1.copy)(details) : {}), inputs, outputs, graph, ...usesOf(document, registry, f.id) };
    });
    return { format: exports.LIBRARY_FORMAT, version: exports.LIBRARY_VERSION, subgraph: entries[0], dependencies: entries.slice(1) };
}
/** Read a Library file into a shelf: a graph holding its definitions (in-graph IDs L0, L1, … in file order; L0 is the subgraph), each
 * checked as a graph's definition is. Refused: another format or a newer version, a repeated or malformed Library ID, a nested
 * instance naming a definition the file lacks, a dependency nothing uses, a cycle, stored stages or targets that differ from the
 * content's. 把資源庫檔讀成一個架子：一張放著它各份定義的圖（圖內 ID 依檔內順序 L0、L1…，L0 是子圖本身），每份照圖的定義驗。拒絕：
 * 別的格式或較新的版本、重複或格式不對的 Library ID、巢狀實例指到檔裡沒有的定義、沒人用的依賴、循環、存著的 stages／targets 和內容算出的不同。 */
function readLibraryFile(value, registry) {
    var _a, _b, _c;
    const file = value;
    if (!file || typeof file !== 'object' || file.format !== exports.LIBRARY_FORMAT)
        throw fail('This is not a grape-subgraph file');
    if (!Number.isSafeInteger(file.version) || file.version < 1)
        throw fail('The file version is missing or invalid');
    if (file.version > exports.LIBRARY_VERSION)
        throw fail('This file was saved by a newer Grape; update Grape to read it');
    if (!file.subgraph || typeof file.subgraph !== 'object' || (file.dependencies !== undefined && !Array.isArray(file.dependencies)))
        throw fail('The file has no subgraph');
    const entries = [file.subgraph, ...((_a = file.dependencies) !== null && _a !== void 0 ? _a : [])];
    const shelfIds = new Map();
    entries.forEach((e, i) => {
        if (!e || typeof e !== 'object' || !(0, library_1.validLibraryId)(e.libraryId) || shelfIds.has(e.libraryId))
            throw fail('Invalid or repeated Library ID');
        shelfIds.set(e.libraryId, 'L' + i);
    });
    const stored = new Map();
    const subgraphs = entries.map((e, i) => {
        var _a, _b;
        const f = (0, model_1.copy)(e);
        f.id = 'L' + i;
        stored.set(f.id, { stages: e.stages, targets: e.targets });
        if (!Array.isArray((_a = f.graph) === null || _a === void 0 ? void 0 : _a.nodes) || !Array.isArray((_b = f.graph) === null || _b === void 0 ? void 0 : _b.edges))
            throw fail('A definition has no network');
        // What save refuses, read refuses too, so no file comes in that could not go back out (Codex R121-4). 存檔拒絕的，讀檔也拒絕。
        let scoped = false;
        scope_references_1.ScopeReferences.walk(f, (_, old) => { scoped = true; return old; }, false);
        if (scoped)
            throw fail('A Library file cannot hold scoped references yet');
        if (f.graph.edges.some(e => !e || typeof e.id !== 'string' || !e.id))
            throw fail('An edge is missing its id');
        f.graph.nodes = f.graph.nodes.map(n => {
            const ref = referenceOf(registry, n), module = registry.get(n.nodeType);
            if (ref === undefined || !(module === null || module === void 0 ? void 0 : module.reference))
                return n;
            const to = shelfIds.get(ref);
            if (to === undefined)
                throw fail('A nested subgraph is missing from the file: ' + ref);
            return { ...n, params: { ...n.params, ...module.reference(to) } };
        });
        (0, subgraph_operations_1.withoutStoredUse)(f);
        try {
            (0, subgraph_operations_1.validateSubgraphData)(f);
        }
        catch (error) {
            throw fail('Invalid definition ' + e.libraryId + ': ' + error.message);
        }
        return f;
    });
    const shelf = { format: model_1.GRAPH_FORMAT, version: model_1.GRAPH_VERSION, target: 'top', declarations: [], subgraphs, stages: { pixel: { nodes: [], edges: [] } } };
    // Tidied as a graph tidies a definition when it comes in, so a copy brought in equals the shelf (Codex R121-2: a default group field
    // removed on the way in made the same file read as another version). 和定義進圖時一樣整理，帶進圖的副本才會等於架子上的（預設的群組欄位
    // 在進圖時被拿掉，同一個檔就被當成另一個版本）。
    (0, groups_1.tidyGroups)(shelf);
    // Every interface uses known types and defaults its types take (Codex R121-1: a wrong default made the subgraph a ghost that the
    // build let through). 每個接口都是認得的型別、預設值是該型別接受的（錯的預設值讓子圖變成 Ghost，建置卻放行）。
    for (const f of subgraphs) {
        if (!(0, subgraph_interface_1.validInterface)(f))
            throw fail('An interface uses an unknown type: ' + f.libraryId);
        try {
            (0, subgraph_interface_1.requireSubgraph)((0, node_module_1.contextFor)(shelf, f));
        }
        catch (error) {
            throw fail('Invalid interface ' + f.libraryId + ': ' + error.message);
        }
    }
    if ((0, subgraph_stages_1.subgraphGroups)(shelf, registry).cyclic.size)
        throw fail('The file holds a cycle of subgraphs');
    if (((_c = (_b = (0, library_1.closureOrder)(shelf, registry, 'L0')) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) !== subgraphs.length)
        throw fail('The file holds a dependency nothing uses');
    for (const f of subgraphs) {
        const uses = usesOf(shelf, registry, f.id), was = stored.get(f.id);
        const same = (a, b) => Array.isArray(a) && a.length === b.length && b.every(x => a.includes(x));
        if (!same(was.stages, uses.stages) || !same(was.targets, uses.targets))
            throw fail('Stored stages or targets do not match the content: ' + f.libraryId);
    }
    return { shelf, root: 'L0' };
}
/** Bring a read file's subgraph into a graph, the way a person pulls it in: the entry rule (amendment 3 C4) with the file as the batch.
 * Returns the in-graph ID now holding the subgraph. 把讀好的檔的子圖帶進圖，和使用者拉入的方式一樣：進圖規則（附錄三 C4），檔就是那一批。
 * 回傳現在放這份子圖的圖內 ID。 */
function bringInLibraryFile(graph, read, next, choice = {}, at = (0, library_1.now)()) {
    var _a;
    const needed = ((_a = (0, library_1.closureOrder)(read.shelf, graph.registry, read.root)) !== null && _a !== void 0 ? _a : []).map(f => f.id);
    const ids = (0, library_policy_1.applyLibraryEntry)(graph, (0, library_policy_1.planLibraryEntry)(graph.document, read.shelf, needed, graph.registry, choice, at), next);
    return ids.get(read.root);
}
/** What the build checks of one built-in file, and its wire-drop row (D-2; Codex R121): read and checked; already in the form saving
 * writes (so the file packed is the file read); brought into an empty graph the way a person pulls it; compiled there with every
 * definition of its closure usable. Throws on the first failure. `empty` is the default graph; `compiler` the code generator.
 * 建置對一個內建檔的檢查與它的拉線接線列：讀檔驗證；已經是存檔寫出的樣子（打包的檔就是讀到的檔）；照使用者拉入的方式帶進空圖；在那裡產碼，
 * 閉包裡每份定義都可用。遇到第一個失敗就丟出。 */
function verifyLibraryFile(file, registry, empty, compiler, rules) {
    var _a;
    const read = readLibraryFile(file, registry);
    if (!(0, changes_1.equal)((0, model_1.copy)(saveLibraryFile(read.shelf, registry, read.root, () => { throw fail('A definition has no Library ID'); })), (0, model_1.copy)(file)))
        throw fail('The file is not in the form saving writes; save it again');
    let made = 0, root = '';
    const after = new graph_1.GraphDocument((0, model_1.copy)(empty), registry).change(m => {
        root = bringInLibraryFile(m, read, () => 'library' + ++made, {}, '2000-01-01T00:00:00.000Z');
        m.networks.get('pixel').instantiateSubgraph(root, 'probe', { x: 0, y: 0 });
    }).after;
    compiler.compile(after, rules);
    const unusable = compiler.unusableSubgraphs(after), brought = (_a = (0, library_1.closureOrder)(after, registry, root)) !== null && _a !== void 0 ? _a : [];
    if (brought.some(f => unusable.has(f.id)))
        throw fail('A definition cannot be used: ' + brought.filter(f => unusable.has(f.id)).map(f => f.libraryId).join(', '));
    const probe = after.stages.pixel.nodes.find(n => n.id === 'probe');
    return (0, wire_drop_1.wireDropRow)(registry.get(probe.nodeType), probe, [...values.types, ...values.opaque], (0, node_module_1.contextFor)(after));
}

},
"library_operations":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeLocal = makeLocal;
exports.updateFromLibrary = updateFromLibrary;
/** The legal operations that change a Library copy beyond adding and removing it (Refactor.118; basic design §3.10–3.11,
 * amendment 1 A2–A3, amendment 2 B1 revision 3): Make Local and an explicit update. Each starts from the ledger's current content,
 * makes only its own change and records what it leaves (library.ts). 加入與移除以外，改變 Library 副本的合法操作：轉為本地、明確更新。
 * 每個都從帳本目前的內容起跑、只做自己的變化、記下結果。 */
const model_1 = require("./model");
const library_1 = require("./library");
const subgraph_copies_1 = require("./subgraph_copies");
const node_names_1 = require("./node_names");
const subgraphs_1 = require("./subgraphs");
const subgraph_operations_1 = require("./subgraph_operations");
const referenceOf = (graph, n) => { var _a, _b; return (_b = (_a = graph.registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n); };
function definition(graph, id) {
    var _a;
    const f = (_a = graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.find(d => d.id === id);
    if (!f)
        throw Error('Subgraph definition no longer exists');
    return f;
}
/** Make Local (§3.10, A3): with no read-only subgraph using it, the copy drops its Library ID in place; otherwise it forks — a local
 * B′ (new ID, named by the one naming rule) takes the instances outside read-only subgraphs, and those inside keep the read-only B.
 * Either way the local one records where it came from (amendment 3 C6). Returns the ID that now holds the local content. 轉為本地：沒有唯讀子圖在用它就就地拿掉 Library ID；否則分叉——本地 B′（新 ID、照同一套
 * 命名）接手唯讀子圖以外的實例，唯讀子圖裡的仍指唯讀的 B。兩種都記下出處。回傳現在放本地內容的 ID。 */
function makeLocal(graph, id, next, at = (0, library_1.now)()) {
    var _a, _b, _c;
    graph.assertEditable();
    const f = definition(graph, id), libraryId = f.libraryId;
    if (libraryId === undefined)
        throw Error('Not a Library copy');
    (0, library_1.requireCurrent)(graph.library, f);
    const readOnlyUsers = ((_a = graph.document.subgraphs) !== null && _a !== void 0 ? _a : []).some(d => d.libraryId !== undefined && d.graph.nodes.some(n => referenceOf(graph, n) === id));
    if (!readOnlyUsers) {
        (0, library_1.localize)(f, at);
        graph.library.set(id, libraryId, { kind: 'local' });
        return id;
    }
    // The fork comes in through the ID map, so its own scoped references follow it, as in Make Single User (Codex R118-4).
    // 分叉經由 ID 對照加入，自己的 scoped 參照跟著它走，同設為唯一。
    const fork = (0, model_1.copy)(f);
    (0, library_1.localize)(fork, at);
    fork.title = (0, node_names_1.freeName)(f.title, new Set(((_b = graph.document.subgraphs) !== null && _b !== void 0 ? _b : []).map(d => d.title)), 80);
    const forkId = next();
    (0, subgraph_copies_1.appendSubgraphs)(graph, [fork], new Map([[id, forkId]]));
    const outside = [...Object.values(graph.document.stages), ...((_c = graph.document.subgraphs) !== null && _c !== void 0 ? _c : []).filter(d => d.libraryId === undefined && d.id !== forkId).map(d => d.graph)];
    for (const data of outside)
        for (const n of data.nodes)
            if (referenceOf(graph, n) === id) {
                const module = graph.registry.get(n.nodeType);
                n.params = { ...(0, model_1.copy)(n.params), ...(0, model_1.copy)(module.reference(forkId)) };
            }
    return forkId;
}
/** An explicit update (§3.11, B1 contract 2): the copy takes the Library's content whole, keeping its in-graph ID and Library ID; every
 * instance follows the new interface (values refit, wires to removed ports dropped — the same rules as an interface edit) and, when
 * the title changes, instances still named by default follow it (B1-R2-1). A read-only subgraph holding an instance passes the start
 * check first and records what it becomes. The content comes from the caller, its nested references already mapped to this graph.
 * `batch` names definitions whose content comes whole from the same source in this edit (an entry, amendment 3 C4): they already hold
 * the new version's instances, so they are not synced again (Codex R119-1).
 * 明確更新：副本整份換成 Library 的內容，保留圖內 ID 與 Library ID；每個實例跟上新接口（實例值重套、接到被拿掉接口的線刪掉——和改接口同一套），
 * title 改了的話仍是預設名的實例跟著改名。含有實例的唯讀子圖先過起點檢查、再記下結果。內容由呼叫端給，巢狀參照已對到這張圖。batch 是這次整份
 * 取自同一來源的定義（進圖）：它們的實例本來就是新版的，不再同步一次。 */
function updateFromLibrary(graph, id, content, batch = new Set()) {
    var _a, _b;
    graph.assertEditable();
    const f = definition(graph, id), libraryId = f.libraryId;
    if (libraryId === undefined || content.libraryId !== libraryId)
        throw Error('An update keeps the Library ID');
    (0, library_1.requireCurrent)(graph.library, f);
    const next = (0, subgraph_operations_1.withoutStoredUse)((0, model_1.copy)(content));
    next.id = id;
    (0, subgraph_operations_1.validateSubgraphData)(next);
    (0, subgraph_copies_1.settle)(graph, next);
    const holders = ((_a = graph.document.subgraphs) !== null && _a !== void 0 ? _a : []).filter(d => d.id !== id && d.graph.nodes.some(n => referenceOf(graph, n) === id));
    for (const d of holders)
        (0, library_1.requireCurrent)(graph.library, d);
    const list = graph.document.subgraphs, at = list.findIndex(d => d.id === id);
    list[at] = next;
    const gone = (old, now) => new Set(old.filter(p => !now.some(q => q.id === p.id)).map(p => p.id));
    const goneInputs = gone(f.inputs, next.inputs), goneOutputs = gone(f.outputs, next.outputs);
    for (const data of [...Object.values(graph.document.stages), ...((_b = graph.document.subgraphs) !== null && _b !== void 0 ? _b : []).filter(d => !batch.has(d.id)).map(d => d.graph)]) {
        const instances = new Set(), taken = (0, node_names_1.namesIn)(data);
        for (const n of data.nodes) {
            if (referenceOf(graph, n) !== id)
                continue;
            instances.add(n.id);
            if (n.inputValues)
                n.inputValues = (0, subgraphs_1.fitInstanceValues)(n.inputValues, next.inputs);
            if (next.title === f.title || n.name === undefined)
                continue;
            const number = (0, node_names_1.defaultInstanceNumber)(n.name, f.title);
            if (number === null)
                continue;
            taken.delete(n.name);
            n.name = (0, node_names_1.newInstanceName)(next.title, taken, number);
            taken.add(n.name);
        }
        if (instances.size)
            data.edges = data.edges.filter(e => !(instances.has(e.from[0]) && goneOutputs.has(e.from[1])) && !(instances.has(e.to[0]) && goneInputs.has(e.to[1])));
    }
    graph.library.set(id, libraryId, { kind: 'content', data: next });
    for (const d of holders)
        if (d.libraryId !== undefined)
            graph.library.set(d.id, d.libraryId, { kind: 'content', data: d });
}

},
"library_policy":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repairDuplicates = repairDuplicates;
exports.planLibraryEntry = planLibraryEntry;
exports.applyLibraryEntry = applyLibraryEntry;
exports.repairLibraryCopies = repairLibraryCopies;
/** The Library version policy (amendment 3, design-interview Q77; Refactor.119): one Library ID, at most one shared definition in a
 * graph; another copy with its own content stays local. Conflicts are settled where they appear, by whole plans the person chooses
 * (the editor shows them; the core only works them out and applies them), never by a search for the fewest copies (Codex R118.2-1:
 * that is NP-hard). Two entrances: opening a graph (repairLibraryCopies, C3) and bringing definitions in (planLibraryEntry, C4).
 * Library 版本政策：一個 Library ID 在圖裡至多一份共用定義；要保留另一份獨立內容就留成本地。衝突在出現的那一刻用整批方案解決，由使用者選
 * （畫面由編輯器呈現，核心只算方案與套用），不搜尋最少份數（一般化是 NP 困難）。兩個入口：開圖（C3）與進圖（C4）。 */
const model_1 = require("./model");
const graph_1 = require("./graph");
const library_1 = require("./library");
const scope_references_1 = require("./scope_references");
const subgraph_copies_1 = require("./subgraph_copies");
const library_operations_1 = require("./library_operations");
const referenceOf = (registry, n) => { var _a, _b; return (_b = (_a = registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n); };
const networksOf = (document) => { var _a; return [...Object.values(document.stages), ...((_a = document.subgraphs) !== null && _a !== void 0 ? _a : []).map(f => f.graph)]; };
/** Point every instance and scoped reference inside `value` (a document or one definition) from old IDs to new ones.
 * 把 value（整份文件或一份定義）裡的實例與 scoped 參照，從舊 ID 改指新 ID。 */
function redirect(registry, networks, value, ids) {
    var _a;
    for (const data of networks)
        for (const n of data.nodes) {
            const to = ids.get((_a = referenceOf(registry, n)) !== null && _a !== void 0 ? _a : '');
            const module = registry.get(n.nodeType);
            if (to !== undefined && (module === null || module === void 0 ? void 0 : module.reference))
                n.params = { ...n.params, ...(0, model_1.copy)(module.reference(to)) };
        }
    scope_references_1.ScopeReferences.walk(value, (ref, old) => {
        const to = ref.scope.startsWith('fn_') ? ids.get(ref.scope.slice(3)) : undefined;
        return to === undefined ? old : scope_references_1.ScopeReferences.token('fn_' + to, ref.source);
    });
}
/** `start` with every read-only definition (among `defs`) that uses one of them, however deep: a read-only subgraph may only use
 * read-only ones (A3), so they go local together (C5). start 加上 defs 中所有（不論多深）用到它們的唯讀定義：唯讀只能用唯讀，所以一起轉本地。 */
function withReadOnlyAncestors(defs, registry, start) {
    var _a, _b;
    const users = new Map();
    for (const f of defs)
        if (f.libraryId !== undefined)
            for (const ref of (0, library_1.instancesOf)(f, registry))
                ((_a = users.get(ref)) !== null && _a !== void 0 ? _a : users.set(ref, []).get(ref)).push(f);
    const set = new Set(start), queue = [...set];
    for (let id = queue.pop(); id !== undefined; id = queue.pop())
        for (const f of (_b = users.get(id)) !== null && _b !== void 0 ? _b : [])
            if (!set.has(f.id)) {
                set.add(f.id);
                queue.push(f.id);
            }
    return set;
}
/** Definitions in an order where every parent comes before its children (C5: users are made local first). 每個父都排在子前面。 */
function parentsFirst(defs, registry) {
    const byId = new Map(defs.map(f => [f.id, f])), seen = new Set(), order = [];
    const visit = (f) => {
        if (seen.has(f.id))
            return;
        seen.add(f.id);
        for (const ref of (0, library_1.instancesOf)(f, registry)) {
            const child = byId.get(ref);
            if (child)
                visit(child);
        }
        order.push(f);
    };
    defs.forEach(visit);
    return order.reverse();
}
/** How many instances point straight at each definition (amendment 1's direct count). 每份定義被幾個實例直接指到。 */
function directInstances(document, registry) {
    var _a;
    const count = new Map();
    for (const data of networksOf(document))
        for (const n of data.nodes) {
            const ref = referenceOf(registry, n);
            if (ref !== undefined)
                count.set(ref, ((_a = count.get(ref)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
    return count;
}
/** C3 step 1: the copies sharing a Library ID, settled flat at the top level. Everything is decided once, on the document as given
 * (Codex R2-2): which copy stays (one the caller prefers, else the most direct instances, else the smallest in-graph ID — never list
 * order); the others with its content merge into it (or, `separate`, go local) and those with other content go local, with every
 * read-only definition using them. Merging only redirects references; a parent's standard form may change, as the person chose.
 * Returns a new document; the given one is untouched. Only definitions in `within` take part when it is given (a pasted batch).
 * C3 第 1 步：同 Library ID 的副本在最上層平著處理。一切只在給的原稿上決定一次：留哪份（呼叫端偏好的，否則直接實例最多，再否則圖內 ID
 * 最小——不看清單順序）；同內容的併入它（或 separate 時轉本地），不同內容的轉本地，連同用到它們的唯讀定義。合併只改引用；父的標準形可能
 * 因此改變，這是使用者選的。回傳新文件，不動原本的。給了 within 時只處理其中的定義（貼上的那一批）。 */
function repairDuplicates(document, registry, options) {
    var _a, _b;
    const part = ((_a = document.subgraphs) !== null && _a !== void 0 ? _a : []).filter(f => !options.within || options.within.has(f.id));
    const byLibrary = new Map();
    for (const f of part)
        if (f.libraryId !== undefined)
            ((_b = byLibrary.get(f.libraryId)) !== null && _b !== void 0 ? _b : byLibrary.set(f.libraryId, []).get(f.libraryId)).push(f);
    const groups = [...byLibrary.values()].filter(group => group.length > 1);
    if (!groups.length)
        return { document, merged: new Map(), localized: [] };
    const count = directInstances(document, registry), forms = new Map();
    for (const group of groups)
        for (const f of group)
            forms.set(f.id, (0, library_1.standardForm)(document, registry, f.id));
    const merged = new Map(), local = new Set();
    for (const group of groups) {
        const rank = (f) => { var _a, _b; return [((_a = options.prefer) === null || _a === void 0 ? void 0 : _a.call(options, f, forms.get(f.id))) ? 1 : 0, (_b = count.get(f.id)) !== null && _b !== void 0 ? _b : 0]; };
        const keep = [...group].sort((a, b) => { const [pa, ca] = rank(a), [pb, cb] = rank(b); return pb - pa || cb - ca || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); })[0];
        const form = forms.get(keep.id);
        for (const f of group)
            if (f !== keep) {
                if (!options.separate && form !== null && forms.get(f.id) === form)
                    merged.set(f.id, keep.id);
                else
                    local.add(f.id);
            }
    }
    const out = (0, model_1.copy)(document);
    if (merged.size) {
        redirect(registry, networksOf(out), out, merged);
        out.subgraphs = out.subgraphs.filter(f => !merged.has(f.id));
    }
    const going = withReadOnlyAncestors(out.subgraphs.filter(f => !options.within || options.within.has(f.id)), registry, local);
    const localized = [];
    for (const f of out.subgraphs)
        if (going.has(f.id) && f.libraryId !== undefined) {
            (0, library_1.localize)(f, options.at);
            localized.push(f.id);
        }
    return { document: out, merged, localized };
}
/** C4: how `needed` (definitions of `source`, closed under their dependencies) come into `target`. First the batch's own duplicates
 * (C3 step 1); then each Library copy meets the one copy with its Library ID here (C2): the same standard form is reused, none comes
 * in read-only, other content follows the choice. No search: with one copy per Library ID on each side the pairing is fixed.
 * A batch without Library copies returns at once. C4：needed（source 的定義，含依賴）怎麼進 target。先處理這批自己的重複，再讓每份
 * Library 副本對上這裡唯一同 Library ID 的那份：同標準形沿用、沒有就唯讀進來、內容不同照選擇。不搜尋：兩邊各一份，對法是固定的。
 * 沒有 Library 副本的一批立即返回。 */
function planLibraryEntry(target, source, needed, registry, choice = {}, at = (0, library_1.now)()) {
    var _a, _b, _c;
    const within = new Set(needed);
    const empty = { alias: new Map(), reused: new Map(), updates: new Map(), conflicts: [], localized: [] };
    if (!((_a = source.subgraphs) !== null && _a !== void 0 ? _a : []).some(f => within.has(f.id) && f.libraryId !== undefined))
        return { source, ...empty, imported: [...needed] };
    const repair = repairDuplicates(source, registry, { separate: choice.duplicates === 'separate', within, at });
    // Always a copy: the plan may localize definitions and must never touch the caller's clip. 一定是複本：方案可能轉本地，不能動到呼叫端的剪貼簿。
    const batch = repair.document === source ? (0, model_1.copy)(source) : repair.document, byId = new Map(((_b = batch.subgraphs) !== null && _b !== void 0 ? _b : []).map(f => [f.id, f]));
    const ids = needed.filter(id => !repair.merged.has(id));
    const here = new Map();
    for (const f of (_c = target.subgraphs) !== null && _c !== void 0 ? _c : [])
        if (f.libraryId !== undefined) {
            if (here.has(f.libraryId))
                throw Object.assign(Error('This graph has a Library subgraph more than once; repair it first'), { code: 'subgraph.libraryDuplicate' });
            here.set(f.libraryId, f);
        }
    const reused = new Map(), updates = new Map(), conflicts = [];
    let imported = [];
    // Parents before children: an equal parent fixes its whole closure position by position (equal standard forms align), so its
    // children need no form of their own — a reused chain costs one closure, not one per level. 父在子前：相同的父逐位定下整個閉包
    // （標準形相同就對得齊），子不必再算——沿用一條鏈只算一次閉包，不是每層一次。
    const match = (0, library_1.libraryMatcher)(batch, target, registry);
    for (const f of parentsFirst(ids.map(id => byId.get(id)), registry)) {
        const id = f.id;
        if (reused.has(id))
            continue;
        const mine = f.libraryId === undefined ? undefined : here.get(f.libraryId);
        if (!mine) {
            imported.push(id);
            continue;
        }
        // Compared once per pair and remembered (library.ts libraryMatcher), so a chain costs one walk. 每一對只比一次並記住，一條鏈只走一次。
        if (!match.same(id, mine.id)) {
            conflicts.push(id);
            continue;
        }
        const from = (0, library_1.closureOrder)(batch, registry, id), to = (0, library_1.closureOrder)(target, registry, mine.id);
        from.forEach((g, i) => reused.set(g.id, to[i].id));
    }
    imported = ids.filter(id => imported.includes(id) && !reused.has(id));
    const localized = [...repair.localized];
    if (conflicts.length && choice.conflicts === 'incoming')
        for (const id of conflicts)
            updates.set(here.get(byId.get(id).libraryId).id, id);
    else if (conflicts.length) {
        // Keep the graph's version: the incoming copies and every read-only one using them in this batch come in local (C5); nothing here
        // changes. 保留圖裡的版本：帶進來的那幾份，連同這批裡用到它們的唯讀定義，轉本地進來；圖裡什麼都不動。
        const going = withReadOnlyAncestors(ids.map(id => byId.get(id)), registry, conflicts);
        for (const id of going) {
            const f = byId.get(id);
            if (f.libraryId !== undefined) {
                (0, library_1.localize)(f, at);
                localized.push(id);
            }
            reused.delete(id);
        }
        imported = [...imported, ...ids.filter(id => going.has(id) && !imported.includes(id))];
    }
    return { source: batch, alias: repair.merged, reused, updates, imported, conflicts, localized };
}
/** Apply an entry plan inside a transaction: the new definitions come in through the ID map (a Library copy as the legal add), then
 * each update takes its incoming content with references mapped to this graph. Returns the source ID → in-graph ID map, merged IDs
 * included, for the caller's own references. 在交易裡套用進圖方案：新定義經 ID 對照進來（Library 副本是合法的加入），再逐一更新成帶進來的
 * 內容（參照已對到這張圖）。回傳來源 ID → 圖內 ID 的對照（含被合併的），給呼叫端改自己的參照。 */
function applyLibraryEntry(graph, plan, next) {
    var _a;
    const ids = new Map([...plan.reused, ...[...plan.updates].map(([to, from]) => [from, to])]);
    for (const id of plan.imported)
        ids.set(id, next());
    for (const [from, to] of plan.alias) {
        const at = ids.get(to);
        if (at !== undefined)
            ids.set(from, at);
    }
    const byId = new Map(((_a = plan.source.subgraphs) !== null && _a !== void 0 ? _a : []).map(f => [f.id, f]));
    if (plan.imported.length)
        (0, subgraph_copies_1.appendSubgraphs)(graph, plan.imported.map(id => byId.get(id)), ids);
    // Everything this entry brings in whole already holds the new version's instances: an update syncs only what was here before
    // (Codex R119-1). 這次整份帶進來的定義，實例本來就是新版的：更新只同步原本就在這裡的。
    const batch = new Set([...plan.imported.map(id => ids.get(id)), ...plan.updates.keys()]);
    for (const [to, from] of plan.updates) {
        const content = (0, model_1.copy)(byId.get(from));
        redirect(graph.registry, [content.graph], content, ids);
        content.id = to;
        (0, library_operations_1.updateFromLibrary)(graph, to, content, batch);
    }
    return ids;
}
/** C3, opening a graph: first its duplicates (step 1, flat, preferring the copy equal to the Library), then one whole choice for the
 * copies whose content differs from the Library read this time (step 2): update them all, or make them all local with every read-only
 * definition using them. `library` holds the Library definitions resolved for this graph (A7 settled by the caller, one per Library ID,
 * nested references among themselves); none means the Library was not found and only step 1 runs. Step 2 runs through change(), so
 * the result passes the same gates as any edit. Pure: returns the graph to open; the caller shows it and publishes it on confirm.
 * C3 開圖：先處理重複（第 1 步，平著做，偏好和資源庫相同的那份），再對和這次讀到的資源庫不同的副本整張圖二選一（第 2 步）：全部更新，或連同
 * 用到它們的唯讀定義全部轉本地。library 是呼叫端為這張圖解析好的資源庫定義（A7 已處理，每個 Library ID 一份，巢狀參照指彼此）；沒有就是
 * 找不到資源庫，只做第 1 步。第 2 步經過 change()，結果過同樣的關卡。純函式：回傳要打開的圖，呼叫端呈現、確認後發布。 */
function repairLibraryCopies(document, registry, library, next, choice = {}, at = (0, library_1.now)()) {
    var _a, _b, _c;
    const shelf = new Map();
    for (const f of (_a = library === null || library === void 0 ? void 0 : library.subgraphs) !== null && _a !== void 0 ? _a : [])
        if (f.libraryId !== undefined) {
            if (shelf.has(f.libraryId))
                throw Object.assign(Error('The Library holds two contents for one Library ID'), { code: 'library.conflict' });
            shelf.set(f.libraryId, f);
        }
    const forms = new Map();
    const formOf = (libraryId) => forms.has(libraryId) ? forms.get(libraryId) : (forms.set(libraryId, (0, library_1.standardForm)(library, registry, shelf.get(libraryId).id)), forms.get(libraryId));
    const step1 = repairDuplicates(document, registry, { separate: choice.duplicates === 'separate', at,
        prefer: (f, form) => form !== null && shelf.has(f.libraryId) && form === formOf(f.libraryId) });
    const base = step1.document;
    // Parents first, each pair compared once and remembered: a long chain, all the same or all different, costs one walk (R.120).
    // A Library definition with an incomplete closure is not compared. 父在子前、每一對只比一次並記住：長鏈不論全同或全不同都只走一次。
    // 閉包不完整的資源庫定義不比。
    const match = library ? (0, library_1.libraryMatcher)(base, library, registry) : undefined;
    const shelfById = new Map(((_b = library === null || library === void 0 ? void 0 : library.subgraphs) !== null && _b !== void 0 ? _b : []).map(f => [f.id, f])), whole = new Map();
    const complete = (id) => {
        if (whole.has(id))
            return whole.get(id);
        whole.set(id, false);
        const f = shelfById.get(id), ok = !!f && (0, library_1.instancesOf)(f, registry).every(complete);
        whole.set(id, ok);
        return ok;
    };
    const differing = parentsFirst((_c = base.subgraphs) !== null && _c !== void 0 ? _c : [], registry).filter(f => {
        const mine = f.libraryId === undefined ? undefined : shelf.get(f.libraryId);
        return !!mine && complete(mine.id) && !match.same(f.id, mine.id);
    }).map(f => f.id);
    const result = { document: base, merged: step1.merged, localized: [...step1.localized], differing, updated: [] };
    if (!differing.length)
        return result;
    const step = new graph_1.GraphDocument(base, registry).change(m => {
        var _a, _b;
        if (choice.versions === 'local') {
            // Every read-only user first, so each Make Local is in place and nothing forks (C5). 先轉所有唯讀使用者，每次轉本地都就地、不分叉。
            const going = withReadOnlyAncestors((_a = m.document.subgraphs) !== null && _a !== void 0 ? _a : [], registry, differing);
            for (const f of parentsFirst(((_b = m.document.subgraphs) !== null && _b !== void 0 ? _b : []).filter(d => going.has(d.id)), registry)) {
                if (f.libraryId === undefined)
                    continue;
                (0, library_operations_1.makeLocal)(m, f.id, next, at);
                result.localized.push(f.id);
            }
            return;
        }
        // Update all: the Library's closures of the differing copies come in as an entry that takes the incoming content (C4 'incoming').
        // 全部更新：不同的那幾份在資源庫裡的閉包，照「改用帶進來的」進圖。
        const wanted = new Set(), want = (id) => { if (wanted.has(id))
            return; wanted.add(id); for (const ref of (0, library_1.instancesOf)(shelfById.get(id), registry))
            want(ref); };
        for (const id of differing)
            want(shelf.get(m.document.subgraphs.find(d => d.id === id).libraryId).id);
        const plan = planLibraryEntry(m.document, library, [...wanted], registry, { conflicts: 'incoming' }, at);
        applyLibraryEntry(m, plan, next);
        result.updated = [...plan.updates.keys()];
    });
    result.document = step.after;
    return result;
}

},
"model":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRAPH_TARGETS = exports.GRAPH_VERSION = exports.GRAPH_FORMAT = void 0;
exports.object = object;
exports.copy = copy;
exports.formatProblem = formatProblem;
exports.GRAPH_FORMAT = 'grape-graph';
exports.GRAPH_VERSION = 1;
/** The graph targets a definition can be checked against. 定義能對照的圖 target。 */
exports.GRAPH_TARGETS = ['top', 'mat'];
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
        const d = module.catalog.definition, id = d.nodeType || 'sgrape.builtin.' + d.key;
        if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.key) || table.has(id))
            throw Error('Invalid or duplicate node definition: ' + id);
        if (module.signatures && !module.configure)
            throw Error('Signature module needs a configuration operation: ' + id);
        const freeze = (value) => { if (value && typeof value === 'object') {
            Object.values(value).forEach(freeze);
            Object.freeze(value);
        } };
        const catalog = JSON.parse(JSON.stringify(module.catalog));
        catalog.definition.nodeType = id;
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
"node_names":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.takesName = exports.namesIn = exports.shownName = exports.storedName = exports.typedName = exports.NAME_LIMIT = void 0;
exports.validNodeName = validNodeName;
exports.freeName = freeName;
exports.newNodeName = newNodeName;
exports.validSubgraphTitle = validSubgraphTitle;
exports.instanceNameBase = instanceNameBase;
exports.newInstanceName = newInstanceName;
exports.defaultInstanceNumber = defaultInstanceNumber;
exports.nameMissing = nameMissing;
/** Node names (Refactor.76, human 2026-10-11; design-interview Q47 supplement 6). A node's name is also its GLSL name
 * (`sg_n_<name>`), so it is an identifier: letters, digits and underscores, a letter first. People see underscores as spaces
 * and type spaces for them. Every naming — a new node, a copy, a paste, a rename that meets a taken name — goes through one
 * rule, as TD does: the number after the last underscore goes up to the next free one; with none, `_1` is added, and a new
 * node starts at `_1` (Split_1, Split_2; a type ending in a digit: Vector_2_1). Nodes that stand for a shared source take no
 * name of their own (they show the source's). Only the legacy editor's logic is followed, not its code.
 * 節點名稱（R.76，人類；Q47 補充 6）：名稱也是 GLSL 名（sg_n_<名稱>），所以是識別字：英數底線、字母開頭。給人看時底線顯示成空白，
 * 輸入的空白存成底線。新增、複製、貼上、改名撞名都走同一套（照 TD）：最後一個底線後的數字往上加到沒人用的；沒有就加 _1；
 * 新節點從 _1 開始（Split_1、Split_2；類型名結尾是數字的：Vector_2_1）。代表共用來源的節點不取自己的名字（顯示來源的名字）。
 * 只照舊產品的邏輯，不用它的程式。 */
const identifier_rules_1 = require("./identifier_rules");
const text_1 = require("./text");
/** The longest name. 名稱最長幾個字。 */
exports.NAME_LIMIT = 48;
const RESERVED_START = /^(gl_|TD|sTD|uTD|sg_|[iu]?sampler|[iu]?image|d?mat[234])/;
/** Whether a name can stand in GLSL and is not GLSL's or TD's own. 能不能當 GLSL 名、又不是 GLSL 或 TD 自己的。 */
function validNodeName(name, reserved = identifier_rules_1.identifierRules.reservedNames) {
    return /^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name) && !name.includes('__') && !RESERVED_START.test(name) && !reserved.includes(name);
}
/** What a name field keeps while typing: letters, digits, spaces and underscores; nothing else gets in (legacy).
 * 輸入時留下的字：英數、空白、底線，其他打不進去（照舊產品）。 */
const typedName = (text) => text.replace(/[^A-Za-z0-9 _]/g, '').slice(0, exports.NAME_LIMIT);
exports.typedName = typedName;
/** The name to store for what was typed: spaces become underscores. 輸入的要存成什麼：空白變底線。 */
const storedName = (text) => (0, exports.typedName)(text).trim().replace(/[ _]*( +)[ _]*/g, '_').slice(0, exports.NAME_LIMIT);
exports.storedName = storedName;
/** How a name is shown to people: underscores as spaces. 給人看的樣子：底線顯示成空白。 */
const shownName = (name) => name.replace(/_/g, ' ');
exports.shownName = shownName;
/** The candidate itself when it is free; otherwise the number after its last underscore goes up to the next free one
 * (`_1` added when there is none). 沒人用就用它；否則最後一個底線後的數字往上加到沒人用的（沒有就加 _1）。 */
function freeName(candidate, taken, limit = exports.NAME_LIMIT) {
    if (!taken.has(candidate))
        return candidate;
    const numbered = /^(.*)_(\d+)$/.exec(candidate);
    const base = (numbered ? numbered[1] : candidate).replace(/_+$/, '') || 'Node';
    for (let n = numbered ? Number(numbered[2]) + 1 : 1;; n++) {
        const suffix = '_' + n, name = base.slice(0, limit - suffix.length).replace(/_+$/, '') + suffix;
        if (!taken.has(name))
            return name;
    }
}
/** A new node's name, from its type's label: Split_1, then Split_2… A label that cannot make a valid name gives Node_1.
 * 新節點的名稱，由類型名而來：Split_1、Split_2…；類型名做不出合法名稱時用 Node_1。 */
function newNodeName(label, taken) {
    const base = label.replace(/[^A-Za-z0-9 _]/g, '').trim().replace(/[ _]+/g, '_').replace(/_+$/, '').slice(0, exports.NAME_LIMIT - 3);
    return freeName(validNodeName(base + '_1') ? base + '_1' : 'Node_1', taken);
}
/** A subgraph's title (visual notes 27, human 2026-10-14): the node-name rule, shown with its spaces — letters, digits, spaces and
 * underscores, a letter first, and as a stored name (spaces as underscores) a valid node name. 子圖的 Title（外觀意見 27，人類）：
 * 照節點名稱規則，顯示時保留空白——英數、空白、底線，字母開頭，存成名稱（空白換底線）後是合法的節點名。 */
function validSubgraphTitle(title) {
    return title.length > 0 && title === (0, exports.typedName)(title).trim() && !/ {2}/.test(title) && validNodeName((0, exports.storedName)(title));
}
/** An instance's default name for a base and a number: base + _N within the name limit — the base is shortened, never the number, and a
 * trailing underscore left by shortening is dropped. Making and recognising default names both go through here, so a name this makes is
 * always recognised (Codex R116-2). 某個底與編號的實例預設名：底＋_N，不超過名稱上限——縮短的是底、不是編號，縮短後留下的結尾底線拿掉。
 * 產生與辨認預設名都經過這裡，產生出來的一定認得回來。 */
/** The largest number a default instance name carries: the maker picks the smallest free number, so it never passes a network's node
 * count; far above that, and small enough that counting on from it stays exact. 預設實例名最大的編號：產生器取最小的空號，不會超過網路的
 * 節點數；這個值遠高於此，又小到往上數一定精確。 */
const INSTANCE_NUMBER_LIMIT = 1000000;
function composeInstanceName(base, n) {
    const suffix = '_' + n;
    return base.slice(0, exports.NAME_LIMIT - suffix.length).replace(/_+$/, '') + suffix;
}
/** The base of a subgraph instance's default name: its definition's title as a stored name without trailing underscores, or Subgraph when
 * that cannot make a name (an old graph). The check is on a composed name, so a long title is shortened rather than dropped (R116-2).
 * 子圖實例預設名的底：定義的 Title 存成名稱、去掉結尾底線；做不出名稱（舊圖）才用 Subgraph。檢查的是組好的名稱，長 Title 是縮短而不是放棄。 */
function instanceNameBase(title) {
    const base = (0, exports.storedName)(title).replace(/_+$/, '');
    return base && validNodeName(composeInstanceName(base, 1)) ? base : 'Subgraph';
}
/** A new instance's name: the base, then _1, _2… — the title's own trailing number is never counted up, so the instances of Subgraph_1 are
 * Subgraph_1_1, Subgraph_1_2 and never look like another definition (human 2026-10-14). `keep`: a renamed instance keeps its number when
 * that is free; otherwise, as for a new instance, the smallest free number from 1 — never counting on past a number, so every name made
 * here is one defaultInstanceNumber recognises (it stays at most the network's node count + 1; Codex R116.1-1). The search is bounded.
 * 新實例的名稱：底加 _1、_2…——Title 結尾的數字不往上加（人類）。keep：改名的實例編號沒人用就保留；否則和新實例一樣取從 1 起最小的空號
 * ——不從某個編號往後數，所以這裡做出的名稱一定被 defaultInstanceNumber 認得（最多是網路節點數＋1）。找的範圍有上限。 */
function newInstanceName(title, taken, keep) {
    const base = instanceNameBase(title);
    if (keep !== undefined && Number.isInteger(keep) && keep > 0 && keep <= INSTANCE_NUMBER_LIMIT) {
        const kept = composeInstanceName(base, keep);
        if (!taken.has(kept) && validNodeName(kept))
            return kept;
    }
    for (let n = 1; n <= taken.size + 1; n++) {
        const name = composeInstanceName(base, n);
        if (!taken.has(name) && validNodeName(name))
            return name;
    }
    throw Error('No free name for a subgraph instance');
}
/** The number of an instance still named by default for this title, else null: only a name the maker would have made — a plain number
 * from 1 (no leading zero, at most INSTANCE_NUMBER_LIMIT) whose composed name is exactly this one (Codex R116-1, R116-2). 仍是這個 Title 預設名的實例
 * 編號，不是就 null：只認產生器會做出的名稱——從 1 起的一般數字（無前導零、安全整數），組出來和這個名稱完全相同。 */
function defaultInstanceNumber(name, title) {
    const match = /_([1-9]\d*)$/.exec(name);
    if (!match)
        return null;
    const n = Number(match[1]);
    return n <= INSTANCE_NUMBER_LIMIT && composeInstanceName(instanceNameBase(title), n) === name ? n : null;
}
/** The names already used in one network. 一張網路裡已用的名稱。 */
const namesIn = (network) => new Set(network.nodes.flatMap(node => node.name === undefined ? [] : [node.name]));
exports.namesIn = namesIn;
/** Whether a node of this type takes a name (not one standing for a shared source; unknown types are left as stored).
 * 這種節點要不要名字（代表共用來源的不要；不認得的類型照原樣）。 */
const takesName = (registry, nodeType) => { const module = registry.get(nodeType); return !!module && !module.unnamed; };
exports.takesName = takesName;
/** Name every node that should have a name and has none, in place (opening a graph made before names were given,
 * Refactor.76). 把該有名字卻沒有的節點補上名字（在傳入的圖上改；給名字之前做的圖，R.76）。 */
function nameMissing(graph, registry) {
    var _a, _b, _c, _d, _e;
    const named = [];
    const networks = [...Object.entries(graph.stages), ...((_a = graph.subgraphs) !== null && _a !== void 0 ? _a : []).map(s => [s.id, s.graph])];
    for (const [network, data] of networks) {
        const taken = (0, exports.namesIn)(data);
        for (const node of data.nodes) {
            if (node.name !== undefined || !(0, exports.takesName)(registry, node.nodeType))
                continue;
            // A subgraph instance is named after its definition's title (visual notes 27). 子圖實例照定義的 Title 命名。
            const ref = (_c = (_b = registry.get(node.nodeType)).referencedGraph) === null || _c === void 0 ? void 0 : _c.call(_b, node), title = ref === undefined ? undefined : (_e = (_d = graph.subgraphs) === null || _d === void 0 ? void 0 : _d.find(f => f.id === ref)) === null || _e === void 0 ? void 0 : _e.title;
            const name = title !== undefined ? newInstanceName(title, taken) : newNodeName(String(registry.get(node.nodeType).catalog.definition.label), taken);
            node.name = name;
            taken.add(name);
            named.push({ network, node: node.id, name, note: (0, text_1.tr)('upgrade.named', 'Given the name {name}', { name: (0, exports.shownName)(name) }) });
        }
    }
    return named;
}

},
"node_sdk":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vectorAssembly = exports.values = exports.payload = exports.output = exports.input = exports.reshapeInputs = exports.typedNode = exports.staticNode = exports.usableTdValue = exports.componentLetters = exports.storedOr = exports.selectedType = exports.requireSubgraph = exports.validInterface = exports.subgraphPresentation = exports.subgraphPorts = exports.numericTypes = exports.fill = exports.type = exports.literal = void 0;
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
const component_names_1 = require("./component_names");
var numeric_2 = require("./numeric");
Object.defineProperty(exports, "literal", { enumerable: true, get: function () { return numeric_2.literal; } });
Object.defineProperty(exports, "type", { enumerable: true, get: function () { return numeric_2.type; } });
Object.defineProperty(exports, "fill", { enumerable: true, get: function () { return numeric_2.fill; } });
var numeric_3 = require("./numeric");
Object.defineProperty(exports, "numericTypes", { enumerable: true, get: function () { return numeric_3.types; } });
var subgraph_interface_1 = require("./subgraph_interface");
Object.defineProperty(exports, "subgraphPorts", { enumerable: true, get: function () { return subgraph_interface_1.subgraphPorts; } });
Object.defineProperty(exports, "subgraphPresentation", { enumerable: true, get: function () { return subgraph_interface_1.subgraphPresentation; } });
Object.defineProperty(exports, "validInterface", { enumerable: true, get: function () { return subgraph_interface_1.validInterface; } });
Object.defineProperty(exports, "requireSubgraph", { enumerable: true, get: function () { return subgraph_interface_1.requireSubgraph; } });
var component_names_2 = require("./component_names");
Object.defineProperty(exports, "storedOr", { enumerable: true, get: function () { return component_names_2.storedOr; } });
Object.defineProperty(exports, "componentLetters", { enumerable: true, get: function () { return component_names_2.componentLetters; } });
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
    const style = appearance.color ? 'rgba' : 'xyzw';
    return { catalog, role: 'value', colorGroup: 'constant', componentNames: () => style, supports: n => numeric(n) && (!!fixed || n.params.type === undefined || n.params.type === 'float'),
        configure: (n, s) => { var _a; const t = selectedType(n, s); if (fixed && fixed !== t)
            throw Error('Fixed literal type'); n.params.type = t; n.params.value = shape((_a = n.params.value) !== null && _a !== void 0 ? _a : 0, t); return n; },
        edit: (n, command, value) => { n.params.value = editValue(n.params.value, selected(n), command, value); return n; },
        presentation: n => ({ value: { value: n.params.value, type: selected(n), componentCommand: 'component', valueCommand: 'value', names: (0, component_names_1.componentLetters)((0, component_names_1.storedOr)(n, style), (0, numeric_1.count)(selected(n))), color: !!appearance.color, expandable: selected(n) !== 'float' } }),
        ports: n => outputPorts[selected(n)], validate: n => { (0, numeric_1.literal)(n.params.value, selected(n)); },
        emit: n => ({ outputs: { out: (0, numeric_1.literal)(n.params.value, selected(n)) }, constant }) };
}
function vectorNode(catalog) {
    return { catalog, role: 'value', inheritsComponentNames: true, supports: n => ['vec2', 'vec3', 'vec4'].includes(String(n.params.type)),
        configure: (n, s) => { n.params.type = selectedType(n, s); return n; },
        edit: (n, command, value) => {
            const t = (0, numeric_1.type)(n.params.type), components = n.params.components;
            const next = editValue(components.slice(0, (0, numeric_1.count)(t)), t, command, value);
            n.params.components = [...next, ...components.slice(next.length)];
            return n;
        },
        presentation: n => ({ value: { value: n.params.components.slice(0, (0, numeric_1.count)((0, numeric_1.type)(n.params.type))), type: String(n.params.type), componentCommand: 'component', valueCommand: 'value', names: (0, component_names_1.componentLetters)((0, component_names_1.storedOr)(n, 'xyzw'), (0, numeric_1.count)((0, numeric_1.type)(n.params.type))), expandable: true } }),
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
    const catalog = { definition: { key: spec.key, label: spec.label, inputs: { [spec.port]: 'T' }, outputs: { out: 'T' }, stages: ['vertex', 'pixel'], defaults: { type: 'float' }, descriptionKey: spec.descriptionKey, nodeType: 'sgrape.builtin.' + spec.key }, emitter: { id: spec.key, version: 1, primitive: { operator: spec.operator, port: spec.port } }, browser: spec.browser };
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
        presentation: () => ({ typeOf: Object.values(catalog.definition.outputs).includes('T') ? 'output' : 'input' }),
        emit: (_n, c) => ({ outputs: { out: call.operator + '(' + call.ports.map(key => c.input(key)).join(', ') + ')' } }) };
}
/** The one node that refers to a declaration (design-interview Q45; human 2026-10-09): what it
 * gives and whether that is a constant comes from the declaration's kind module. Missing target:
 * a ghost (ghosts.ts). Only at the top level of a stage (Q41): never inside a subgraph.
 * 引用宣告的唯一節點：給什麼、是不是常數由那筆宣告的 kind 決定；指向不存在＝Ghost；只在 stage 最外層。 */
function declarationNode(catalog) {
    const target = (n, c) => c.declaration(String(n.params.declarationId));
    const kindOf = (n, c) => { const d = target(n, c); return d && declarations_1.declarationKinds.get(d.kind); };
    return { catalog, role: 'value', unnamed: true, referencedDeclaration: n => String(n.params.declarationId),
        // A colour Uniform names its components R/G/B/A (legacy graph_ui.js:1228). 顏色 Uniform 的分量叫 R/G/B/A（照舊產品）。
        componentNames: (n, c) => { var _a; return ((_a = target(n, c)) === null || _a === void 0 ? void 0 : _a.color) === true ? 'rgba' : 'xyzw'; },
        supports: (n, c) => { var _a; return !c.owner && (!target(n, c) || !!((_a = kindOf(n, c)) === null || _a === void 0 ? void 0 : _a.types.includes(target(n, c).type))); },
        // What a reference gives comes from the kind (a TOP texture input gives three outputs).
        // 引用時給哪些輸出由 kind 決定（TOP 貼圖輸入給三個）。
        ports: (n, c) => { var _a, _b; const d = target(n, c); if (!d)
            throw Error('The declaration no longer exists'); return (_b = (_a = kindOf(n, c)) === null || _a === void 0 ? void 0 : _a.outputs) !== null && _b !== void 0 ? _b : outputPorts[(0, numeric_1.type)(d.type)]; },
        validate: () => { },
        // It switches only among declarations of the same kind: another kind gives other outputs.
        // 只在同一種宣告之間切換：別的種類給的輸出不同。
        presentation: (n, c) => {
            var _a, _b;
            const d = target(n, c), choices = (((_a = c.declarations) === null || _a === void 0 ? void 0 : _a.call(c)) || []).filter(x => declarations_1.declarationKinds.has(x.kind) && (!d || x.kind === d.kind));
            const all = ((_b = c.declarations) === null || _b === void 0 ? void 0 : _b.call(c)) || [];
            return { label: d && (0, declarations_1.declarationLabel)(all, d), inlineControls: [{ kind: 'select', key: 'declaration', label: 'declaration', literal: true, command: 'declaration', value: String(n.params.declarationId),
                        options: choices.map(x => ({ value: x.id, label: (0, declarations_1.declarationLabel)(all, x), literal: true })) }] };
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
const uvEntries = new Set(['vUV']);
// One port layout per entry, made once (an entry with outputs has several). 每一筆一份接孔排列，只做一次。
const tdValuePorts = new Map();
const tdValuePort = (entry) => {
    let p = tdValuePorts.get(entry.id);
    if (!p) {
        p = fixedPorts(entry.outputs ? entry.outputs.map(o => ({ key: o.key, direction: 'output', type: o.type })) : [out(entry.type)]);
        tdValuePorts.set(entry.id, p);
    }
    return p;
};
// Which components each output stands for, so the screen colours them as Split's (Refactor.59): U, UV, UVW.
// 每個輸出代表哪幾個分量，畫面照 Split 的方式上色：U、UV、UVW。
const componentsOf = (entry) => entry.outputs && Object.fromEntries(entry.outputs.map(o => [o.key, o.label.split('').map((_, i) => i)]));
/** Whether this build can use an entry for a target. 這個版本能不能在這個 target 用這一筆。 */
const usableTdValue = (entry, target) => {
    var _a;
    return !!entry && (!target || entry.targets.includes(target))
        && values_1.types.includes(entry.type) && !entry.expression.includes('{') && ((_a = entry.outputs) !== null && _a !== void 0 ? _a : []).every(o => values_1.types.includes(o.type));
};
exports.usableTdValue = usableTdValue;
function tdValueNode(catalog) {
    const entryOf = (n) => tdValueTable.get(String(n.params.entry));
    return { catalog, role: 'value', colorGroup: 'runtime', unnamed: true, componentNamesFixed: true,
        // Texture coordinates name their components U/V (legacy `uv` node, graph_ui.js:1229). 貼圖座標的分量叫 U/V（照舊產品）。
        componentNames: n => uvEntries.has(String(n.params.entry)) ? 'uv' : 'xyzw',
        supports: (n, c) => (0, exports.usableTdValue)(entryOf(n), c.target),
        ports: n => tdValuePort(entryOf(n)), validate: () => { },
        presentation: (n, c) => {
            const entry = entryOf(n);
            return { label: entry === null || entry === void 0 ? void 0 : entry.name,
                ...((entry === null || entry === void 0 ? void 0 : entry.outputs) ? { portLabels: { outputs: Object.fromEntries(entry.outputs.map(o => [o.key, o.label])) }, components: { outputs: componentsOf(entry) } } : {}),
                inlineControls: [{ kind: 'select', key: 'entry', label: 'entry', literal: true, command: 'entry',
                        value: String(n.params.entry), options: td_values_1.tdValues.filter(e => (0, exports.usableTdValue)(e, c.target)).map(e => ({ value: e.id, label: e.name, literal: true })) }] };
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
        emit: n => { const entry = entryOf(n); return { outputs: entry.outputs ? Object.fromEntries(entry.outputs.map(o => [o.key, o.expression])) : { out: entry.expression } }; } };
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
        "nodeType": "sgrape.builtin.add"
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
        "nodeType": "sgrape.builtin.all",
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
    presentation: () => ({ typeOf: 'input' }),
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
        "nodeType": "sgrape.builtin.any",
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
    presentation: () => ({ typeOf: 'input' }),
    emit: (_n, c) => ({ outputs: { out: 'any(' + c.input('value') + ')' } })
});

},
"nodes/boolean_operation":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const catalog = {
    "definition": {
        "key": "boolean_operation",
        "label": "Boolean Operation",
        "inputs": {
            "a": "bool",
            "b": "bool"
        },
        "outputs": {
            "out": "bool"
        },
        "stages": [
            "vertex",
            "pixel"
        ],
        "defaults": {
            "type": "bool",
            "operator": "&&"
        },
        "inputDefaults": {
            "a": false,
            "b": false
        },
        "descriptionKey": "help.boolean_operation",
        "nodeType": "sgrape.builtin.boolean_operation",
        "targets": [
            "top",
            "mat"
        ]
    },
    "emitter": {
        "id": "boolean_operation",
        "version": 1
    },
    "browser": {
        "category": "logic",
        "source": "glsl",
        "aliases": [
            "and",
            "or",
            "xor",
            "&&",
            "||",
            "^^",
            "boolean",
            "bool",
            "布林運算"
        ],
        "glslName": "&&, ||, ^^",
        "secondaryCategories": [],
        "categoryPath": [
            "logic"
        ]
    }
};
const operators = ['&&', '||', '^^'];
// Shown as words, the legacy node names' (human 2026-10-11); the graph keeps the GLSL operator. 選單顯示英文字（同舊產品節點名，人類）；圖裡存 GLSL 運算子。
const words = { '&&': 'AND', '||': 'OR', '^^': 'XOR' };
const control = (operator) => ({
    kind: 'select', key: 'operator', label: 'booleanOperation.operator', command: 'operator', value: operator,
    options: operators.map(value => ({ value, label: 'A ' + words[value] + ' B', literal: true }))
});
const operatorOf = (n) => { var _a; return String((_a = n.params.operator) !== null && _a !== void 0 ? _a : '&&'); };
// Legacy Boolean And / Or / Xor as one node with an operator menu, laid out as Compare (Refactor.82, human 2026-10-11).
// Bool vectors too, component by component (new; legacy took single bools; human: the family is fixed and in = out, so
// it stays simple). GLSL's &&, || and ^^ take no vectors, so a vector is rebuilt from its components. The title's menu
// chooses the type, as for not (Q73). 舊產品的 Boolean And／Or／Xor 合成一個節點、用選單選運算，版面同 Compare（R.82，人類）。
// 也收 bool 向量、逐分量算（新行為；舊產品只收單一 bool；人類：家族固定、進出同型別，所以單純）。GLSL 的 &&、||、^^
// 不收向量，所以向量逐分量拆開再組回。標題列選型別，同 not（Q73）。
exports.default = (0, node_sdk_1.typedNode)(catalog, {
    types: ['bool', 'bvec2', 'bvec3', 'bvec4'],
    ports: t => [(0, node_sdk_1.input)('a', t, false), (0, node_sdk_1.input)('b', t, false), (0, node_sdk_1.output)('out', t)],
    validate: n => { if (!operators.includes(operatorOf(n)))
        throw Error('Invalid boolean operator'); },
    edit: (n, command, data) => {
        const value = String((0, node_sdk_1.payload)(data));
        if (command !== 'operator' || !operators.includes(value))
            throw Error('Invalid boolean operator');
        n.params.operator = value;
        return n;
    },
    presentation: n => ({ inlineControls: [control(operatorOf(n))] }),
    emit: (n, c) => {
        var _a;
        const t = String((_a = n.params.type) !== null && _a !== void 0 ? _a : 'bool'), op = ' ' + operatorOf(n) + ' ', a = c.input('a'), b = c.input('b');
        if (t === 'bool')
            return { outputs: { out: '(' + a + op + b + ')' } };
        const parts = 'xyzw'.slice(0, node_sdk_1.values.count(t)).split('').map(k => a + '.' + k + op + b + '.' + k);
        return { outputs: { out: t + '(' + parts.join(', ') + ')' } };
    }
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
        "nodeType": "sgrape.builtin.clamp"
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
        "nodeType": "sgrape.builtin.color"
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
        "nodeType": "sgrape.builtin.combine"
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
        "nodeType": "sgrape.builtin.compare"
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
    // One operator menu, at the top of the body as legacy (human 2026-10-09: it was shown twice).
    // 一個運算選單，放在本體開頭，同舊產品（人類：原本出現兩次）。
    presentation: n => { var _a; return ({ typeOf: 'input', inlineControls: [control(String((_a = n.params.operator) !== null && _a !== void 0 ? _a : '>'))] }); },
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
        "nodeType": "sgrape.builtin.convert"
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
        selector: { value: String(n.params.toType), options: node_sdk_1.values.types.filter(t => node_sdk_1.values.explicit(String(n.params.fromType), t)), command: 'toType' },
        // The input as the shared "Input type" row, where every node has it (Refactor.81.4). 輸入是共用的「輸入型別」那一列，和每個節點同位置（R.81.4）。
        inputSelector: { value: String(n.params.fromType), options: node_sdk_1.values.types.filter(t => node_sdk_1.values.explicit(t, String(n.params.toType))), command: 'fromType' }
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
        "nodeType": "sgrape.builtin.declaration"
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
        "nodeType": "sgrape.builtin.divide"
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
        "nodeType": "sgrape.builtin.dot"
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
        "nodeType": "sgrape.builtin.equal",
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
    presentation: () => ({ typeOf: 'input' }),
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
        "nodeType": "sgrape.builtin.float"
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
"nodes/force_compile_error":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
// Force Compile Error (Refactor.63.1, human 2026-10-10: a regular node from this cycle): its GLSL calls a function nobody
// defines, so the core lets it through and TD always refuses to compile it — for trying how a compile failure is shown
// and how to get back to the last good Shader. In the Editor category, beside Router.
// 故意讓編譯失敗：產生的 GLSL 呼叫一個沒有人定義的函式，核心放行、TD 一定編不過——用來試編譯失敗怎麼呈現、怎麼回到上一個
// 能跑的 Shader。放在 Editor 分類，和 Router 一起。
exports.default = (0, node_sdk_1.unaryNode)({
    key: 'force_compile_error', label: 'Force Compile Error', descriptionKey: 'help.force_compile_error',
    operator: 'sg_force_compile_error', port: 'value',
    browser: { category: 'editor', source: 'editor', aliases: ['error', 'fail', 'compile error', 'test', '編譯錯誤'],
        glslName: 'sg_force_compile_error', secondaryCategories: [], categoryPath: ['editor'] },
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
        "nodeType": "sgrape.builtin.greaterThan",
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
    presentation: () => ({ typeOf: 'input' }),
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
        "nodeType": "sgrape.builtin.greaterThanEqual",
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
    presentation: () => ({ typeOf: 'input' }),
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
        "nodeType": "sgrape.builtin.if"
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
        "nodeType": "sgrape.builtin.isinf",
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
            command: 'output'
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
        "nodeType": "sgrape.builtin.isnan",
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
            command: 'output'
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
        "nodeType": "sgrape.builtin.length"
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
        "nodeType": "sgrape.builtin.lessThan",
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
    presentation: () => ({ typeOf: 'input' }),
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
        "nodeType": "sgrape.builtin.lessThanEqual",
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
    presentation: () => ({ typeOf: 'input' }),
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
    catalog: { definition: { key: 'math', label: 'Math', inputs: { input0: 'T', input1: 'T', input2: 'T' }, outputs: { out: 'T' }, stages: ['vertex', 'pixel'], defaults: { type: 'float', inputCount: 3, mode: 'steps', operation: 'add' }, descriptionKey: 'help.math', nodeType: 'sgrape.builtin.math' }, emitter: { id: 'math', version: 1 }, browser: { category: 'math', source: 'editor', aliases: ['chain', 'arithmetic', '連加', '連減', '連乘', '連除'], glslName: '', secondaryCategories: [], categoryPath: ['math', 'arithmetic'] } },
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
        "nodeType": "sgrape.builtin.max"
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
        "nodeType": "sgrape.builtin.min"
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
        "nodeType": "sgrape.builtin.mix"
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
        "nodeType": "sgrape.builtin.multiply"
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
        "nodeType": "sgrape.builtin.normalize"
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
        "nodeType": "sgrape.builtin.not",
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
    // Input and output are the same type, so the title's menu chooses both (Refactor.81.4, design-interview Q73).
    // 輸入輸出同型別，標題列的選單兩端一起選（R.81.4，Q73）。
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
        "nodeType": "sgrape.builtin.notEqual",
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
    presentation: () => ({ typeOf: 'input' }),
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
        "nodeType": "sgrape.builtin.pixel_out"
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
        ],
        names: ['sg_color'] // declared above, so the name leads back here (Refactor.63.4) 上面宣告的，名字帶回這裡
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
        "nodeType": "sgrape.builtin.replace"
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
        "nodeType": "sgrape.builtin.rgba"
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
// Its alpha input is the colour's fourth component (legacy graph_ui.js:1238). alpha 輸入是顏色的第四個分量（照舊產品）。
exports.default = { ...(0, node_sdk_1.staticNode)(catalog, {
        ports: () => [(0, node_sdk_1.input)('rgb', 'vec3'), (0, node_sdk_1.input)('alpha', 'float', 1), (0, node_sdk_1.output)('out', 'vec4')],
        emit: (_n, c) => ({ outputs: { out: 'vec4(' + c.input('rgb') + ', ' + c.input('alpha') + ')' } })
    }), componentNames: () => 'rgba', componentNamesFixed: true,
    presentation: () => ({ components: { inputs: { alpha: [3] } } }) };

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
        "nodeType": "sgrape.builtin.router"
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
        "nodeType": "sgrape.builtin.scalar"
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
        "nodeType": "sgrape.builtin.smoothstep"
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
        "nodeType": "sgrape.builtin.split"
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
// Its outputs r/g/b/a are colour components (legacy graph_ui.js:1238). 輸出 r/g/b/a 是顏色分量（照舊產品）。
exports.default = { ...(0, node_sdk_1.staticNode)(catalog, {
        ports: () => [(0, node_sdk_1.input)('color', 'vec4'), (0, node_sdk_1.output)('rgb', 'vec3'), ...'rgba'.split('').map(p => (0, node_sdk_1.output)(p, 'float'))],
        emit: (_n, c) => ({ outputs: Object.fromEntries(['rgb', ...'rgba'].map(p => [p, '(' + c.input('color') + ').' + p])) })
    }), componentNames: () => 'rgba', componentNamesFixed: true,
    presentation: () => ({ components: { outputs: { r: [0], g: [1], b: [2], a: [3] } } }) };

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
"nodes/subgraph_input":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const config_1 = require("../config");
// The common compiler expands this structural module using its declared role
// and graph reference. Only ordinary value modules need an emit callback.
const definition = {
    catalog: {
        definition: {
            key: 'subgraph_input',
            label: 'Subgraph Input',
            inputs: {},
            outputs: {},
            stages: ['vertex', 'pixel'],
            defaults: {},
            descriptionKey: 'help.subgraph_ports'
        },
        emitter: {
            id: 'subgraph_input',
            version: 1
        },
        browser: {}
    },
    structural: true,
    role: 'subgraph-input',
    supports: (node, context) => (0, node_sdk_1.validInterface)(context.owner),
    ports: (node, context) => (0, node_sdk_1.subgraphPorts)((0, node_sdk_1.requireSubgraph)(context), 'input'),
    // The spare grey port (basic design §3.5; legacy functions_ui.js:378-434): a wire dropped on it adds an interface port of the
    // wire's type. The command is the editor's interface edit, not a node command: the ports live on the definition.
    // 備用灰點（§3.5；照舊產品）：線放上來就新增一個那條線型別的接口。指令是編輯器的介面修改，不是節點指令：接口住在定義上。
    presentation: (node, context) => {
        const f = (0, node_sdk_1.requireSubgraph)(context);
        return { ...(0, node_sdk_1.subgraphPresentation)(f, 'input'),
            spare: { direction: 'output', key: '', type: '', command: 'interface', count: f.inputs.length, limit: config_1.CORE_CONFIG.subgraphPortsPerSide,
                label: 'subgraph.addInput', limitLabel: 'subgraph.portLimit' } };
    },
    validate: (node, context) => {
        (0, node_sdk_1.requireSubgraph)(context);
    }
};
exports.default = definition;

},
"nodes/subgraph_instance":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
// The common compiler expands this structural module using its declared role
// and graph reference. Only ordinary value modules need an emit callback.
const definition = {
    catalog: {
        definition: {
            key: 'subgraph_instance',
            label: 'Subgraph',
            inputs: {},
            outputs: {},
            stages: ['vertex', 'pixel'],
            defaults: {},
            descriptionKey: 'help.subgraph_instance'
        },
        emitter: {
            id: 'subgraph_instance',
            version: 1
        },
        browser: {}
    },
    structural: true,
    role: 'value',
    referencedGraph: node => String(node.params.subgraphId),
    reference: graphId => ({ subgraphId: graphId }),
    supports: (node, context) => { var _a; return (0, node_sdk_1.validInterface)((_a = context.subgraph) === null || _a === void 0 ? void 0 : _a.call(context, String(node.params.subgraphId))); },
    ports: (node, context) => (0, node_sdk_1.subgraphPorts)((0, node_sdk_1.requireSubgraph)(context, String(node.params.subgraphId)), 'instance'),
    presentation: (node, context) => (0, node_sdk_1.subgraphPresentation)((0, node_sdk_1.requireSubgraph)(context, String(node.params.subgraphId)), 'instance'),
    validate: (node, context) => {
        (0, node_sdk_1.requireSubgraph)(context, String(node.params.subgraphId));
    }
};
exports.default = definition;

},
"nodes/subgraph_output":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_sdk_1 = require("../node_sdk");
const config_1 = require("../config");
// The common compiler expands this structural module using its declared role
// and graph reference. Only ordinary value modules need an emit callback.
const definition = {
    catalog: {
        definition: {
            key: 'subgraph_output',
            label: 'Subgraph Output',
            inputs: {},
            outputs: {},
            stages: ['vertex', 'pixel'],
            defaults: {},
            descriptionKey: 'help.subgraph_ports'
        },
        emitter: {
            id: 'subgraph_output',
            version: 1
        },
        browser: {}
    },
    structural: true,
    role: 'subgraph-output',
    supports: (node, context) => (0, node_sdk_1.validInterface)(context.owner),
    ports: (node, context) => (0, node_sdk_1.subgraphPorts)((0, node_sdk_1.requireSubgraph)(context), 'output'),
    // The spare grey port (basic design §3.5; legacy functions_ui.js:378-434): a wire dropped on it adds an interface port of the
    // wire's type. The command is the editor's interface edit, not a node command: the ports live on the definition.
    // 備用灰點（§3.5；照舊產品）：線放上來就新增一個那條線型別的接口。指令是編輯器的介面修改，不是節點指令：接口住在定義上。
    presentation: (node, context) => {
        const f = (0, node_sdk_1.requireSubgraph)(context);
        return { ...(0, node_sdk_1.subgraphPresentation)(f, 'output'),
            spare: { direction: 'input', key: '', type: '', command: 'interface', count: f.outputs.length, limit: config_1.CORE_CONFIG.subgraphPortsPerSide,
                label: 'subgraph.addOutput', limitLabel: 'subgraph.portLimit' } };
    },
    validate: (node, context) => {
        (0, node_sdk_1.requireSubgraph)(context);
    }
};
exports.default = definition;

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
        "nodeType": "sgrape.builtin.subtract"
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
        "nodeType": "sgrape.builtin.swizzle"
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
    inheritsComponentNames: true,
    // Wired, the input takes the wire's size (Refactor.81.2, design-interview Q73): what you choose is the output (its components),
    // the input is whatever comes in. The components stay, so the output stays; a chosen component the new size lacks refuses the
    // wire (say W on a vec3). int and float stay as they are: the wire converts, and changing them would change the output (Q71).
    // 接上線時，輸入改成線的大小（R.81.2，Q73）：選的是輸出（分量），輸入接什麼就是什麼。分量不變，輸出也不變；選到的分量新大小沒有時
    // 擋下（例如 vec3 沒有 W）。int、float 不換：線上會轉，換了會改輸出（Q71）。
    wire: (n, key, source) => {
        var _a;
        if (key === 'value' && node_sdk_1.values.vectors.includes(source)) {
            const t = node_sdk_1.values.shaped(node_sdk_1.values.family(String(n.params.type)), node_sdk_1.values.count(source));
            mask(t, (_a = n.params.mask) !== null && _a !== void 0 ? _a : 'xy');
            n.params.type = t;
        }
        return { node: n, replaceInputs: ['value'] };
    },
    presentation: n => {
        var _a;
        const t = String(n.params.type), selected = mask(t, (_a = n.params.mask) !== null && _a !== void 0 ? _a : 'xy');
        const letters = (0, node_sdk_1.componentLetters)((0, node_sdk_1.storedOr)(n, 'xyzw'), node_sdk_1.values.count(t)), letter = (axis) => { var _a; return (_a = letters[axes.indexOf(axis)]) !== null && _a !== void 0 ? _a : axis.toUpperCase(); };
        const places = (0, node_sdk_1.componentLetters)((0, node_sdk_1.storedOr)(n, 'xyzw'), 4); // the output's places, up to four 輸出的位置，最多四個
        return { typeOf: 'input',
            // The output reads as the mask in the node's letters, e.g. "RG" (legacy graph_ui.js:1299). 輸出照遮罩、用節點的字母。
            portLabels: { outputs: { out: [...selected].map(letter).join('') } },
            components: { outputs: { out: [...selected].map(axis => axes.indexOf(axis)) } },
            // The output and the input are two things (Refactor.81.3, human 2026-10-11: "output 跟 input 不是一件事"): the title chooses
            // the output, how many components it has; the input type is a row of its own (typeOf 'input') and follows a wire (81.2).
            // 輸出和輸入是兩件事（R.81.3，人類）：標題列選輸出、也就是有幾個分量；輸入型別是自己的一列（typeOf 'input'），接線時跟著線（81.2）。
            selector: { value: node_sdk_1.values.shaped(node_sdk_1.values.family(t), selected.length), command: 'output',
                options: [1, 2, 3, 4].map(count => node_sdk_1.values.shaped(node_sdk_1.values.family(t), count)) },
            // Each menu is named by the output component it fills, in the node's letters and that component's colour (Refactor.80.3,
            // human 2026-10-11: not 1, 2…); it only picks which input component goes there, the title says how many (Refactor.81.3).
            // 每個選單以它填的輸出分量命名，用節點的字母與分量色（R.80.3，人類：不要 1、2…）；它只挑放哪個輸入分量，幾個由標題列決定（R.81.3）。
            controls: [{
                    kind: 'row', key: 'mask', label: 'vector.componentOrder', children: [...selected].map((value, index) => {
                        var _a;
                        return ({ kind: 'select', key: 'component' + index,
                            label: (_a = places[index]) !== null && _a !== void 0 ? _a : String(index + 1), literal: true, component: index, command: 'mask', args: { index }, value,
                            options: [...axes.slice(0, node_sdk_1.values.count(t))].map(value => ({ value, label: letter(value), literal: true })) });
                    })
                }] };
    },
    edit: (n, command, data) => {
        var _a;
        const t = String(n.params.type), previous = mask(t, (_a = n.params.mask) !== null && _a !== void 0 ? _a : 'xy');
        if (command === 'output') {
            // How many components the output has: more are filled with the next components in turn, fewer drop from the end.
            // 輸出有幾個分量：變多時依序補上下一個分量，變少時從後面拿掉。
            const count = node_sdk_1.values.count(String((0, node_sdk_1.payload)(data)));
            if (!Number.isInteger(count) || count < 1 || count > 4)
                throw Error('Invalid swizzle output');
            let next = previous.slice(0, count);
            while (next.length < count)
                next += axes[Math.min(next.length, node_sdk_1.values.count(t) - 1)];
            n.params.mask = mask(t, next);
        }
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
            "entry": "vUV"
        },
        "descriptionKey": "help.td_value",
        "nodeType": "sgrape.builtin.td_value"
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
        "nodeType": "sgrape.builtin.texture_sample"
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
        "nodeType": "sgrape.builtin.vec2"
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
        "nodeType": "sgrape.builtin.vec3"
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
        "nodeType": "sgrape.builtin.vec4"
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
        "nodeType": "sgrape.builtin.vector"
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
        inheritsComponentNames: true,
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
        presentation: n => ({ value: {
                value: n.params.components.slice(0, node_sdk_1.values.count(String(n.params.type))),
                type: String(n.params.type), componentCommand: 'component', valueCommand: 'value',
                names: (0, node_sdk_1.componentLetters)((0, node_sdk_1.storedOr)(n, 'xyzw'), node_sdk_1.values.count(String(n.params.type))), expandable: true
            } }),
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
        "nodeType": "sgrape.builtin.vector_split"
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
    inheritsComponentNames: true,
    // Each output is one component, named and coloured as the node's names say (legacy graph_ui.js:1297).
    // 每個輸出是一個分量，名稱與顏色照節點的名稱樣式（照舊產品）。
    presentation: n => {
        const t = String(n.params.type), keys = 'xyzw'.slice(0, node_sdk_1.values.count(t)).split(''), letters = (0, node_sdk_1.componentLetters)((0, node_sdk_1.storedOr)(n, 'xyzw'), keys.length);
        return { typeOf: 'input', portLabels: { outputs: Object.fromEntries(keys.map((k, i) => [k, letters[i]])) },
            components: { outputs: Object.fromEntries(keys.map((k, i) => [k, [i]])) } };
    },
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
const boundary = (module) => (module === null || module === void 0 ? void 0 : module.role) === 'subgraph-input' || (module === null || module === void 0 ? void 0 : module.role) === 'subgraph-output';
/** Nodes with a fixed identity: never offered, never deleted. 身分固定的節點：不在新增選單、不能刪。 */
const fixed = (module) => stageOutput(module) || boundary(module);
/** Whether a module may be offered for adding a new node: not one with a fixed identity, nor a structural one (a subgraph instance is made
 * from a definition — the subgraph panel, a copy — never from the palette; node_module.ts). 新增選單只提供這些：身分固定的不行，結構性的
 * 也不行（子圖實例從定義來——子圖面板、複製——不從目錄來）。 */
const offered = (module) => !fixed(module) && !module.structural;
exports.offered = offered;
/** Whether the user may delete this node. 能不能刪。 */
const removable = (module) => !fixed(module);
exports.removable = removable;
const rules = [
    { key: 'stageOutputs', role: 'output', stage: 1, subgraph: 0 },
    { key: 'subgraphInputs', role: 'subgraph-input', stage: 0, subgraph: 1 },
    { key: 'subgraphOutputs', role: 'subgraph-output', stage: 0, subgraph: 1 },
];
function counts(g, registry) {
    const count = (data, role) => data.nodes.filter(n => { var _a; return ((_a = registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.role) === role; }).length;
    return rules.flatMap(rule => [
        ...Object.entries(g.stages || {}).map(([id, data]) => ({ key: rule.key, network: id, value: count(data, rule.role), expected: rule.stage })),
        ...(g.subgraphs || []).map(f => ({ key: rule.key, network: 'subgraph:' + f.id, value: count(f.graph, rule.role), expected: rule.subgraph })),
    ]);
}
const distance = (p) => Math.abs(p.value - p.expected);
const slot = (p) => p.key + ' ' + p.network;
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
/** Refuses edits that move a network further from a rule; repairs are always allowed. */
function requireStructure(before, after, registry) {
    const previous = new Map(counts(before, registry).map(p => [slot(p), distance(p)]));
    const worse = counts(after, registry).filter(p => { var _a; return distance(p) > ((_a = previous.get(slot(p))) !== null && _a !== void 0 ? _a : 0); });
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
const capacity_1 = require("./capacity");
const node_module_1 = require("./node_module");
const subgraph_interface_1 = require("./subgraph_interface");
const subgraph_stages_1 = require("./subgraph_stages");
const values_1 = require("./values");
const declarations_1 = require("./declarations");
const node_names_1 = require("./node_names");
const relay = {
    catalog: {
        definition: { key: 'subgraph_relay', nodeType: 'grape.internal.subgraph_relay', label: 'Subgraph value', inputs: {}, outputs: {}, stages: ['pixel'], defaults: {}, descriptionKey: '' },
        emitter: { id: 'subgraph_relay', version: 1 }, browser: {}
    },
    role: 'value',
    supports: n => values_1.types.includes(String(n.params.type)) || values_1.opaque.includes(String(n.params.type)),
    ports: n => [
        { key: 'value', direction: 'input', type: String(n.params.type) },
        { key: 'out', direction: 'output', type: String(n.params.type) }
    ],
    validate: n => { if (!values_1.opaque.includes(String(n.params.type)))
        (0, values_1.type)(n.params.type); },
    // An opaque relay with nothing wired in passes "nothing" on (its output stays undefined), so the consumer inside or
    // outside sees an unconnected texture and applies its own rule, e.g. Texture 2D's opaque black (amendment B5).
    // 沒接線的 opaque 中繼把「沒有」往下傳（輸出留空），裡面或外面的使用者看到的就是未接貼圖，走它自己的規則（如 Texture 2D 的不透明黑）。
    emit: (n, c) => ({ outputs: { out: values_1.opaque.includes(String(n.params.type)) && !c.connected('value') ? undefined : c.input('value') } })
};
function createSubgraphCompiler(registry, engineFactory, config = config_1.CORE_CONFIG) {
    const engine = engineFactory((0, node_module_1.createRegistry)([...registry.modules, relay]));
    const identity = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
    const moduleOf = (node) => registry.get(node.nodeType);
    function supports(g) {
        var _a;
        if ((0, model_1.formatProblem)(g) || g.target !== 'top' || Object.keys(g.stages).join() !== 'pixel' ||
            ((_a = g.structDefinitions) === null || _a === void 0 ? void 0 : _a.length) || !Array.isArray(g.subgraphs))
            return false;
        // Declarations follow the same rule as the flat compiler (top_compiler.ts): a known kind must carry a type it supports,
        // an unknown kind is kept and never read (Q44). Texture inputs pass through subgraph interfaces as opaque ports (A8 §5 item 8).
        // 宣告規則同平面編譯器：認得的 kind 型別要合、不認得的保留不讀；貼圖輸入以 opaque 接口穿過子圖。
        if (!g.declarations.every(d => !declarations_1.declarationKinds.has(d.kind) || declarations_1.declarationKinds.get(d.kind).types.includes(d.type)))
            return false;
        const pixel = g.stages.pixel, stagesOf = stageLookup(g);
        if (!usableNetwork(g, pixel, undefined, stagesOf))
            return false;
        // Only the definitions the stage reaches through its instances are checked (amendment A8, TECH-3): an unused one never blocks the
        // graph; its problems are shown in the Subgraphs panel (unusableSubgraphs). 只檢查 Stage 經由實例走得到的定義：沒用到的不擋整張圖；
        // 它的問題在子圖面板顯示。
        // The stage table is built only when an instance reaches something (Codex 3rd check: a graph with no instances reads no definitions).
        // 有實例走得到東西才建 Stage 表（沒有實例的圖不讀任何定義）。
        const used = reachable(g, pixel, stagesOf);
        return [...used].every(id => { const f = g.subgraphs.find(item => item.id === id); return !f || usableDefinition(g, f, stagesOf); });
    }
    /** The stage table, built on first use only (Codex 3rd check: a graph whose instances reach nothing reads no definitions). Stage 表，
     * 第一次用到才建（實例走不到任何定義的圖不讀定義）。 */
    function stageLookup(g) {
        let table;
        return id => (table !== null && table !== void 0 ? table : (table = (0, subgraph_stages_1.subgraphStageTable)(g, registry)))(id);
    }
    /** A ghost (design-interview Q37 1-1; the flat compiler's rule, top_compiler.ts supports, and the editor's, connectivity.ts): a node
     * this build does not know, one that does not belong to the pixel stage, an instance whose content cannot run there, one its module does
     * not support, or one whose ports cannot be worked out. It is kept and left out of code generation, never a reason to refuse the
     * graph; its wires count as not connected. Ghost：這一版不認得的節點、不屬於 pixel 的、內容不能在那裡跑的實例、模組不支援的、算不出接孔的。
     * 保留、不產碼，絕不是拒絕整張圖的理由；接到它的線當作沒接。 */
    function ghost(g, n, owner, stagesOf) {
        var _a;
        const module = moduleOf(n);
        if (!module)
            return true;
        const own = module.catalog.definition.stages;
        if (own && !own.includes('pixel'))
            return true;
        const ref = (_a = module.referencedGraph) === null || _a === void 0 ? void 0 : _a.call(module, n);
        if (ref !== undefined && !stagesOf(ref).includes('pixel'))
            return true;
        const context = (0, node_module_1.contextFor)(g, owner);
        if (!module.supports(n, context))
            return true;
        try {
            (0, node_module_1.resolvePorts)(module, n, context);
        }
        catch (_b) {
            return true;
        }
        return false;
    }
    function usableNetwork(g, data, owner, stagesOf) {
        var _a;
        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length > config.nodesPerNetwork || data.edges.length > config.edgesPerNetwork || ((_a = data.ui) === null || _a === void 0 ? void 0 : _a.frames))
            return false;
        // Ghosts are kept but never emitted, so they do not block this path (as the flat compiler). Ghost 不產碼，不擋這條路（同平面編譯器）。
        return data.nodes.every(n => ghost(g, n, owner, stagesOf) || !n.params.requireConstant);
    }
    // Where a subgraph can run comes from its content (Q46); the target is each node's own check. 子圖能用的 Stage 由內容推算；target 由每個節點自己檢查。
    function usableDefinition(g, f, stagesOf) {
        // The whole interface is checked (types, defaults, IDs, duplicates, count), not the types alone (Codex R115-1): what code
        // generation would refuse is what the Subgraphs panel reports. 驗整個接口（型別、預設值、ID、重複、數量），不只型別：產碼會拒絕的，
        // 就是子圖面板要回報的。
        if (!(0, subgraph_interface_1.validInterface)(f))
            return false;
        try {
            (0, subgraph_interface_1.requireSubgraph)((0, node_module_1.contextFor)(g), f.id);
        }
        catch (_a) {
            return false;
        }
        return stagesOf(f.id).includes('pixel') && usableNetwork(g, f.graph, f, stagesOf);
    }
    /** The definitions the network's instances reach, nested instances followed; a ghost instance reaches nothing. 網路的實例走得到的定義，巢狀
     * 一路跟進；Ghost 實例走不到任何東西。 */
    function reachable(g, data, stagesOf) {
        var _a;
        const byId = new Map(((_a = g.subgraphs) !== null && _a !== void 0 ? _a : []).map(f => [f.id, f])), found = new Set();
        const walk = (nodes, owner) => {
            var _a, _b, _c;
            for (const n of nodes) {
                const ref = (_b = (_a = moduleOf(n)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n);
                if (ref !== undefined && !found.has(ref) && !ghost(g, n, owner, stagesOf)) {
                    found.add(ref);
                    const f = byId.get(ref);
                    if (f && Array.isArray((_c = f.graph) === null || _c === void 0 ? void 0 : _c.nodes))
                        walk(f.graph.nodes, f);
                }
            }
        };
        if (Array.isArray(data.nodes))
            walk(data.nodes, undefined);
        return found;
    }
    /** The definitions that cannot be used in this host (amendment A8): what code generation would refuse, and those on a cycle of
     * instances (R113-1: a cycle cannot be expanded). For the Subgraphs panel, never a reason to refuse the graph. 在目前 host 用不了的定義：
     * 產碼會拒絕的，以及在實例循環上的（循環展不開）。給子圖面板標示，不是拒絕整張圖的理由。 */
    function unusableSubgraphs(g) {
        var _a;
        const { stagesOf, cyclic } = (0, subgraph_stages_1.subgraphGroups)(g, registry);
        return new Set(((_a = g.subgraphs) !== null && _a !== void 0 ? _a : []).filter(f => cyclic.has(f.id) || !usableDefinition(g, f, id => [...stagesOf(id)])).map(f => f.id));
    }
    function compile(g, identifiers) {
        if (!supports(g))
            throw Error('Graph is outside the selected frontend compiler capability');
        if ((0, capacity_1.documentBytes)(g) > config.documentBytes)
            throw Error('Graph is too large');
        const definitions = new Map();
        for (const f of g.subgraphs) {
            if (!identity.test(f.id) || definitions.has(f.id))
                throw Error('Invalid or duplicate Subgraph ID');
            if (typeof f.title !== 'string' || !f.title.length || f.title.length > 80)
                throw Error('Invalid Subgraph definition');
            definitions.set(f.id, f);
        }
        const stagesOf = stageLookup(g), active = new Set(), done = new Set();
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
                if (child && !ghost(g, n, f, stagesOf))
                    visit(child);
            }
            active.delete(id);
            done.add(id);
        }
        const used = reachable(g, g.stages.pixel, stagesOf);
        // Only the definitions in use have their interface checked here (A8); the rest are the Subgraphs panel's to report.
        // 只有用到的定義在這裡驗接口（A8）；其餘由子圖面板回報。
        for (const id of used) {
            if (definitions.has(id))
                (0, subgraph_interface_1.requireSubgraph)((0, node_module_1.contextFor)(g), id);
            visit(id);
        }
        function expanded(probe) {
            const flat = { nodes: [], edges: [] }, origins = new Map();
            const used = new Set(g.stages.pixel.nodes.flatMap(n => [n.id, n.name || n.id]));
            let sequence = 0;
            const allocate = () => { let id; do {
                id = 'sgf' + ++sequence;
            } while (used.has(id)); used.add(id); return id; };
            const location = (n, path) => ({ node: n.id, stage: 'pixel', trail: [...path], ...(path.length ? { subgraphId: path[path.length - 1] } : {}) });
            const add = (n, origin) => {
                if (flat.nodes.length >= config.expandedNodes)
                    throw Error('Expanded Subgraph graph exceeds ' + config.expandedNodes + ' nodes');
                flat.nodes.push(n);
                origins.set(n.id, origin);
            };
            function expand(data, path, owner, boundary) {
                var _a, _b, _c, _d, _e;
                const context = (0, node_module_1.contextFor)(g, owner), maps = new Map(), names = new Set(), ghosts = new Set();
                let inputCount = 0, outputCount = 0;
                for (const node of data.nodes) {
                    const origin = location(node, path);
                    try {
                        if (!identity.test(node.id) || maps.has(node.id) || ghosts.has(node.id))
                            throw Error('Invalid or duplicate node ID');
                        // A ghost is kept in the graph and left out here (Q37 1-1). Ghost 留在圖裡，這裡跳過。
                        if (ghost(g, node, owner, stagesOf)) {
                            ghosts.add(node.id);
                            continue;
                        }
                        if (node.name !== undefined) {
                            if (!identifiers || !(0, node_names_1.validNodeName)(node.name, identifiers.reservedNames) || names.has(node.name))
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
                                    const endpoint = boundary.outputs[key], target = endpoint && flat.nodes.find(n => n.id === endpoint[0]);
                                    if (!target || !target.inputValues)
                                        throw Error('Invalid Subgraph port defaults');
                                    target.inputValues.value = (0, model_1.copy)(value);
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
                            if (probe) {
                                // Checking one definition on its own: an instance inside stands for its interface only — relays of the port types, outputs
                                // at their defaults — since that definition is checked on its own too. Expanding it here would expand every chain once per
                                // level (A3-4: 900 levels took 10 s). The code itself comes from the full expansion below, unchanged.
                                // 單獨檢查一份定義時，裡面的實例只代表它的接口（接口型別的中繼，輸出用預設值）——那份定義自己也會單獨檢查。在這裡展開會讓
                                // 一條鏈每層展開一次（900 層 10 秒）。產碼仍來自下面的完整展開，不變。
                                for (const direction of ['inputs', 'outputs'])
                                    for (const p of fn[direction]) {
                                        const id = allocate(), value = direction === 'inputs' ? (_c = (_b = node.inputValues) === null || _b === void 0 ? void 0 : _b[p.id]) !== null && _c !== void 0 ? _c : p.default : p.default;
                                        add({ id, nodeType: relay.catalog.definition.nodeType, params: { type: p.type }, ...(value === undefined ? {} : { inputValues: { value: (0, model_1.copy)(value) } }) }, origin);
                                        mapped[direction][p.id] = [id, direction === 'inputs' ? 'value' : 'out'];
                                    }
                                maps.set(node.id, mapped);
                                continue;
                            }
                            for (const direction of ['inputs', 'outputs'])
                                for (const p of fn[direction]) {
                                    const id = allocate(), value = direction === 'inputs' ? (_e = (_d = node.inputValues) === null || _d === void 0 ? void 0 : _d[p.id]) !== null && _e !== void 0 ? _e : p.default : p.default;
                                    add({ id, nodeType: relay.catalog.definition.nodeType, params: { type: p.type },
                                        ...(value === undefined ? {} : { inputValues: { value: (0, model_1.copy)(value) } }),
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
                    throw Object.assign(Error('Exactly one Subgraph Input and Output are required'), { stage: 'pixel', trail: path, subgraphId: owner.id });
                for (const edge of data.edges) {
                    const source = maps.get(edge.from[0]), target = maps.get(edge.to[0]);
                    // A wire from or to a ghost is a ghost wire: not connected here (Q37 1-3). 接到 Ghost 的線是 Ghost 線：這裡當作沒接。
                    if ((!source && ghosts.has(edge.from[0])) || (!target && ghosts.has(edge.to[0])))
                        continue;
                    if (!source || !target)
                        throw Object.assign(Error('Connection endpoint no longer exists'), { node: edge.to[0], stage: 'pixel', trail: path, ...(owner ? { subgraphId: owner.id } : {}) });
                    const from = source.outputs[edge.from[1]], to = target.inputs[edge.to[1]];
                    // A wire to a port its node no longer has is a ghost wire (Q37 1-3, TECH-2): kept in the graph, not connected here.
                    // 接到節點已經沒有的接孔的線是 Ghost 線：圖裡保留，這裡當作沒接。
                    if (!from || !to)
                        continue;
                    flat.edges.push({ id: 'x' + flat.edges.length, from, to });
                }
            }
            if (probe) {
                const inside = { inputs: {}, outputs: {} };
                for (const direction of ['inputs', 'outputs'])
                    for (const p of probe[direction]) {
                        const id = allocate();
                        add({ id, nodeType: relay.catalog.definition.nodeType, params: { type: p.type }, ...(p.default === undefined ? {} : { inputValues: { value: (0, model_1.copy)(p.default) } }) }, { node: '', stage: 'pixel', trail: [probe.id], subgraphId: probe.id });
                        inside[direction][p.id] = [id, direction === 'inputs' ? 'out' : 'value'];
                    }
                expand(probe.graph, [probe.id], probe, inside);
                const output = registry.modules.find(m => m.role === 'output');
                add({ id: allocate(), nodeType: output.catalog.definition.nodeType, params: (0, model_1.copy)(output.catalog.definition.defaults) }, { node: '', stage: 'pixel', trail: [] });
            }
            else
                expand(g.stages.pixel, []);
            const { subgraphs, ...rest } = g;
            const document = { ...rest, stages: { pixel: flat } };
            try {
                const result = engine.compile(document, identifiers);
                return { ...result,
                    sourceMap: { pixel: result.sourceMap.pixel.map(row => ({ ...row, ...origins.get(row.node) })),
                        // A variable inside an expanded subgraph leads to the node the person sees. 展開的子圖裡的變數找回人看得到的節點。
                        variables: Object.fromEntries(Object.entries(result.sourceMap.variables).map(([name, id]) => { var _a, _b; return [name, (_b = (_a = origins.get(id)) === null || _a === void 0 ? void 0 : _a.node) !== null && _b !== void 0 ? _b : id]; })),
                        variableTrails: Object.fromEntries(Object.entries(result.sourceMap.variables).flatMap(([name, id]) => { var _a; const trail = (_a = origins.get(id)) === null || _a === void 0 ? void 0 : _a.trail; return (trail === null || trail === void 0 ? void 0 : trail.length) ? [[name, [...trail]]] : []; })),
                        declarations: result.sourceMap.declarations },
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
        // Each reachable definition is also expanded on its own, so a problem inside is reported at the definition (an unused one is
        // the Subgraphs panel's to show, A8). 每份走得到的定義也單獨展開一次，裡面的問題在定義上回報（沒用到的由子圖面板顯示）。
        for (const id of used) {
            const fn = definitions.get(id);
            if (fn)
                expanded(fn);
        }
        return expanded();
    }
    return { supports, compile, unusableSubgraphs };
}

},
"subgraph_copies":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settle = settle;
exports.appendSubgraphs = appendSubgraphs;
exports.independentSubgraph = independentSubgraph;
const model_1 = require("./model");
const subgraph_operations_1 = require("./subgraph_operations");
const node_names_1 = require("./node_names");
const scope_references_1 = require("./scope_references");
const groups_1 = require("./groups");
const library_1 = require("./library");
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
/** A Library copy in the form the end of an edit would leave it (edge IDs given, groups tidy), so the ledger records what stays.
 * Library 副本整理成修改結束時的樣子（線有 ID、群組整理好），帳本記的就是會留下的內容。 */
function settle(graph, f) {
    for (const e of f.graph.edges)
        if (!e.id)
            e.id = graph.nextEdgeId(f.graph);
    (0, groups_1.tidyGroups)({ stages: {}, subgraphs: [f] });
}
/** Receive authored definitions, not Library files. The adapter decides which
 * versions to reuse and supplies any ID mapping. All mutation stays here. */
function appendSubgraphs(graph, definitions, ids = new Map()) {
    var _a;
    graph.assertEditable();
    const pending = definitions.map(f => (0, subgraph_operations_1.withoutStoredUse)((0, model_1.copy)(f))), used = new Set((graph.document.subgraphs || []).map(f => f.id));
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
    // A Library copy coming in is the legal "add a copy" (amendment 2 B1): an identity the ledger has never held, entered in its tidy
    // final form so the end of the edit leaves it as recorded. 帶進來的 Library 副本＝合法的「加入副本」：帳本沒見過的身分，以整理好的最後樣子入帳，
    // 修改結束時的整理不會再動它。
    for (const f of pending) {
        if (f.libraryId === undefined)
            continue;
        if (graph.library.state(f.id, f.libraryId) !== undefined)
            throw (0, library_1.readOnly)('this identity was already used in this edit');
        settle(graph, f);
        graph.library.set(f.id, f.libraryId, { kind: 'content', data: f });
    }
    if (pending.length)
        ((_a = graph.document).subgraphs || (_a.subgraphs = [])).push(...pending);
    return pending;
}
/** Make Single User (basic design §3.10): copy only this instance's definition for this one instance. Nested children remain
 * shared; the graph already owns their complete content. The copy is named by the one naming rule (node_names.ts), not
 * "… Copy". 設為唯一：只為這個實例複製一份定義；巢狀仍共用；名稱走同一套撞名規則，不加「Copy」。 */
function independentSubgraph(network, nodeId, next, at = (0, library_1.now)()) {
    var _a;
    network.assertEditable();
    const graph = network.graph, n = network.nodeData(nodeId);
    if (!n)
        throw Error('Subgraph instance no longer exists');
    const id = reference(graph, n), source = (_a = graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.find(f => f.id === id);
    if (!source)
        return null;
    // The copy of a Library copy is local (§3.10) and records where it came from (C6): read the copy as it stands, then drop the Library
    // ID. Library 副本的複本是本地的，記下出處。
    (0, library_1.requireCurrent)(graph.library, source);
    const newId = allocate(new Set(graph.document.subgraphs.map(f => f.id)), next);
    const f = (0, model_1.copy)(source);
    f.id = newId;
    (0, library_1.localize)(f, at);
    f.title = (0, node_names_1.freeName)(source.title, new Set(graph.document.subgraphs.map(d => d.title)), 80);
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
exports.validInterface = validInterface;
exports.requireSubgraph = requireSubgraph;
exports.subgraphPorts = subgraphPorts;
exports.subgraphPresentation = subgraphPresentation;
const config_1 = require("./config");
const values_1 = require("./values");
const subgraph_operations_1 = require("./subgraph_operations");
/** Whether every port carries a built-in type the host can pass (basic design §3.4, amendment A1): the numeric types and the
 * opaque ones, on both sides — under expansion an opaque port is only an alias. User structs never (§3.4); host built-in
 * structs when the type table has them. 接口型別是否都是內建型別：數值與 opaque，輸入輸出都可；自訂 struct 不上。 */
function validInterface(f) {
    return !!f && ['inputs', 'outputs'].every(key => Array.isArray(f[key]) &&
        f[key].every(p => values_1.types.includes(p.type) || values_1.opaque.includes(p.type)));
}
function requireSubgraph(context, id) {
    var _a;
    const f = id === undefined ? context.owner : (_a = context.subgraph) === null || _a === void 0 ? void 0 : _a.call(context, id);
    if (!f)
        throw Error('Missing Subgraph definition');
    for (const ports of [f.inputs, f.outputs]) {
        if (ports.length > config_1.CORE_CONFIG.subgraphPortsPerSide)
            throw Error('Subgraph supports at most ' + config_1.CORE_CONFIG.subgraphPortsPerSide + ' ports per direction');
        const seen = new Set();
        for (const p of ports) {
            if (!(0, subgraph_operations_1.validPort)(p) || seen.has(p.id))
                throw Error('Invalid or duplicate Subgraph port');
            seen.add(p.id);
            if (!values_1.opaque.includes(p.type))
                (0, values_1.literal)(p.default, (0, values_1.type)(p.type));
        }
    }
    return f;
}
function subgraphPorts(f, kind) {
    const ports = [];
    if (kind === 'instance' || kind === 'input')
        for (const p of f.inputs)
            ports.push({ key: p.id, direction: kind === 'input' ? 'output' : 'input', type: p.type, ...(p.default === undefined ? {} : { default: p.default }) });
    if (kind === 'instance' || kind === 'output')
        for (const p of f.outputs)
            ports.push({ key: p.id, direction: kind === 'output' ? 'input' : 'output', type: p.type, ...(p.default === undefined ? {} : { default: p.default }) });
    return ports;
}
function subgraphPresentation(f, kind) {
    // A port shows its label; with none, nothing but the type (§3.3: the id is never shown). 接孔顯示標籤；沒有就只剩型別。
    const names = (ports) => Object.fromEntries(ports.map(p => { var _a; return [p.id, (_a = p.label) !== null && _a !== void 0 ? _a : '']; }));
    return {
        ...(kind === 'instance' ? { label: f.title, descriptionKey: f.descriptionKey || 'help.subgraph_instance' } : {}),
        portLabels: kind === 'instance' ? { inputs: names(f.inputs), outputs: names(f.outputs) } :
            kind === 'input' ? { outputs: names(f.inputs) } : { inputs: names(f.outputs) }
    };
}

},
"subgraph_operations":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newPortId = newPortId;
exports.validPort = validPort;
exports.portEntry = portEntry;
exports.validateSubgraphData = validateSubgraphData;
exports.withoutStoredUse = withoutStoredUse;
exports.insertSubgraph = insertSubgraph;
exports.createSubgraph = createSubgraph;
exports.instantiateSubgraph = instantiateSubgraph;
exports.subgraphFromSelection = subgraphFromSelection;
exports.subgraphCycle = subgraphCycle;
exports.newSubgraphCycle = newSubgraphCycle;
exports.instanceCounts = instanceCounts;
exports.useCounts = useCounts;
exports.removeSubgraph = removeSubgraph;
exports.collectSubgraphs = collectSubgraphs;
const node_names_1 = require("./node_names");
const model_1 = require("./model");
const config_1 = require("./config");
const scope_references_1 = require("./scope_references");
const values_1 = require("./values");
const groups_1 = require("./groups");
const library_1 = require("./library");
const validId = (id) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(id);
/** A new port identity: random and unique like node and edge IDs (Q44); the number after `in`/`out` is not an identity
 * (basic design §4 row 6). 新接口的身分：和節點、接線一樣隨機、不重複；序號不是身分。 */
function newPortId(taken) {
    for (;;) {
        let id = 'p';
        for (let i = 0; i < 3; i++)
            id += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
        if (!taken.has(id))
            return id;
    }
}
const validLabel = (label) => label === undefined || (typeof label === 'string' && label.length <= 80 && !/[\x00-\x1f\x7f]/.test(label));
/** Whether one port's data is well formed: an opaque port has no default, a numeric one must have one (§3.4, amendment B5).
 * 一筆接口的資料是否完整：opaque 沒有 default、數值一定有。 */
function validPort(p) {
    return validId(p.id) && typeof p.type === 'string' && !!p.type && validLabel(p.label) &&
        (values_1.opaque.includes(p.type) ? p.default === undefined : p.default !== undefined);
}
/** Only fields the format defines, so an absent default is absent, not `undefined`. 只留格式有的欄位。 */
function portEntry(id, type, label, value) {
    return { id, ...(label === undefined ? {} : { label }), type, ...(value === undefined ? {} : { default: value }) };
}
function structural(graph, role) {
    const matches = graph.registry.modules.filter(m => m.structural &&
        (role === 'instance' ? !!m.reference : m.role === 'subgraph-' + role));
    if (matches.length !== 1)
        throw Error('Subgraph structural module is unavailable or ambiguous');
    return matches[0];
}
function authored(module, id, ui, params = {}) {
    const d = module.catalog.definition;
    return { id, nodeType: d.nodeType, params: { ...(0, model_1.copy)(d.defaults), ...params }, ui };
}
function validateSubgraphData(f) {
    if (!validId(f.id))
        throw Error('Invalid Subgraph identity');
    if (!f.title.trim() || f.title.length > 80 || /[\x00-\x1f\x7f]/.test(f.title))
        throw Error('Invalid Subgraph name');
    // Stored stages and targets are not read: the graph works them out from the content and drops them (Q46).
    // 存著的 stages／targets 不讀：圖由內容推算，並把它們拿掉。
    // A Library copy carries its Library ID, a UUID (Refactor.118); what it may become is the ledger's (library.ts).
    // Library 副本帶著 Library ID（UUID）；它能怎麼變由帳本管。
    if ('libraryId' in f && !(0, library_1.validLibraryId)(f.libraryId))
        throw Error('Invalid Library ID');
    if ('provenance' in f && !validProvenance(f.provenance))
        throw Error('Invalid Subgraph provenance');
    if (!validLibraryFields(f))
        throw Error('Invalid Subgraph category, credits or texts');
    if (f.color !== undefined && (typeof f.color !== 'string' || f.color.length > 32))
        throw Error('Invalid Subgraph color');
    for (const ports of [f.inputs, f.outputs]) {
        if (!Array.isArray(ports) || ports.length > config_1.CORE_CONFIG.subgraphPortsPerSide || new Set(ports.map(p => p.id)).size !== ports.length || !ports.every(validPort))
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
/** The library fields (D-2): a category code, credits as short text, translations of description and comment per language code.
 * 資源庫欄位：分類代號、作者資訊（短文字）、各語言的說明與 comment 翻譯。 */
function validLibraryFields(f) {
    const text = (v, max) => typeof v === 'string' && v.length <= max;
    const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    if ('category' in f && !(typeof f.category === 'string' && /^[a-z][a-z0-9]{0,31}$/.test(f.category)))
        return false;
    if ('credits' in f && !(plain(f.credits) && Object.entries(f.credits).every(([k, v]) => ['author', 'organization', 'email', 'url'].includes(k) && text(v, 200) && !/[\x00-\x1f\x7f]/.test(v))))
        return false;
    if ('texts' in f && !(plain(f.texts) && Object.entries(f.texts).every(([lang, t]) => /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(lang) &&
        plain(t) && Object.entries(t).every(([k, v]) => ['description', 'comment'].includes(k) && text(v, 4000)))))
        return false;
    return true;
}
/** The provenance list (amendment 3 C6): at most one entry of each kind; only `library` exists so far. 出處清單：每種最多一筆；目前只有 library。 */
function validProvenance(list) {
    if (!Array.isArray(list) || list.length > 1)
        return false;
    const text = (v, max) => typeof v === 'string' && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
    return list.every(p => !!p && typeof p === 'object' && Object.keys(p).sort().join() === 'at,kind,libraryId,title' &&
        p.kind === 'library' && (0, library_1.validLibraryId)(p.libraryId) && text(p.title, 80) && text(p.at, 40));
}
function validate(graph, f) {
    var _a;
    graph.assertEditable();
    if ((_a = graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.some(d => d.id === f.id))
        throw Error('Invalid or duplicate Subgraph identity');
    validateSubgraphData(f);
}
/** A definition as the graph keeps it: what it can be used in is worked out from its content, not stored (Q46).
 * 圖裡保存的定義：能用在哪裡由內容推算，不存。 */
function withoutStoredUse(f) { delete f.stages; delete f.targets; return f; }
function insertSubgraph(graph, f) {
    var _a;
    const owned = withoutStoredUse((0, model_1.copy)(f));
    validate(graph, owned);
    ((_a = graph.document).subgraphs || (_a.subgraphs = [])).push(owned);
    return owned;
}
function createSubgraph(graph, options) {
    const input = structural(graph, 'input'), output = structural(graph, 'output');
    const taken = new Set(), inId = newPortId(taken);
    taken.add(inId);
    const outId = newPortId(taken);
    return insertSubgraph(graph, {
        id: options.id, title: options.title,
        inputs: [portEntry(inId, 'vec4', 'in1', [1, 1, 1, 1])],
        outputs: [portEntry(outId, 'vec4', 'out1', [0, 0, 0, 1])],
        graph: { nodes: [{ ...authored(input, 'input', { x: 48, y: 144 }), name: 'Input' }, { ...authored(output, 'output', { x: 624, y: 144 }), name: 'Output' }],
            edges: [{ id: graph.nextEdgeId({ nodes: [], edges: [] }), from: ['input', inId], to: ['output', outId] }] }
    });
}
function instantiateSubgraph(network, definitionId, id, ui = {}) {
    var _a;
    network.assertEditable();
    const graph = network.graph, f = (_a = graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.find(f => f.id === definitionId);
    if (!f)
        throw Error('Subgraph definition no longer exists');
    const module = structural(graph, 'instance');
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
function subgraphFromSelection(network, selection, options) {
    var _a, _b, _c, _d, _e;
    network.assertEditable();
    const graph = network.graph, data = network.data;
    const chosen = data.nodes.filter(n => selection.has(n.id)), ids = new Set(chosen.map(n => n.id));
    if (!chosen.length || chosen.length !== selection.size)
        throw Error('Invalid Subgraph selection');
    if (!validId(options.instanceId) || data.nodes.some(n => n.id === options.instanceId))
        throw Error('Invalid or duplicate instance identity');
    if (chosen.some(n => {
        var _a;
        const role = (_a = graph.registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.role;
        return role && role !== 'value';
    }))
        throw Error('Stage outputs and Subgraph boundaries cannot be made into a subgraph');
    const unique = (base) => { let id = base, i = 0; while (ids.has(id))
        id = base + '_' + ++i; ids.add(id); return id; };
    const inputId = unique('input'), outputId = unique('output');
    // Boundary IDs are not members of the original selection.
    const selected = new Set(chosen.map(n => n.id));
    const inputs = [], outputs = [], edges = [], outside = [];
    // Port identities are generated; labels come from the peer port and get a number when one side repeats a label (§3.3).
    // 接口身分產生式；標籤取對端接孔名，同一邊重複時加編號。
    const portIds = new Set(), labels = { inputs: new Set(), outputs: new Set() };
    const newPort = (side, type, label, value) => {
        const id = newPortId(portIds);
        portIds.add(id);
        const text = (0, node_names_1.freeName)(label, labels[side], 80);
        labels[side].add(text);
        return portEntry(id, type, text, values_1.opaque.includes(type) ? undefined : value);
    };
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
                const value = values_1.opaque.includes(spec.type) ? undefined : (0, model_1.copy)((_c = (_b = (_a = n.inputValues) === null || _a === void 0 ? void 0 : _a[e.to[1]]) !== null && _b !== void 0 ? _b : spec.default) !== null && _c !== void 0 ? _c : defaultValue(spec.type, options));
                const p = newPort('inputs', spec.type, ((_d = options.inputName) === null || _d === void 0 ? void 0 : _d.call(options, byId.get(e.from[0]), e.from[1], e.to[1])) || e.to[1], value);
                inputs.push(p);
                incoming.set(key, p.id);
                outside.push({ ...e, to: [options.instanceId, p.id] });
            }
            edges.push({ ...e, from: [inputId, incoming.get(key)] });
        }
        else {
            const n = byId.get(e.from[0]), spec = port(n, 'output', e.from[1]), key = JSON.stringify(e.from);
            if (!outgoing.has(key)) {
                const p = newPort('outputs', spec.type, e.from[1], values_1.opaque.includes(spec.type) ? undefined : defaultValue(spec.type, options));
                outputs.push(p);
                outgoing.set(key, p.id);
                edges.push({ ...e, to: [outputId, p.id] });
            }
            outside.push({ ...e, from: [options.instanceId, outgoing.get(key)] });
        }
    }
    const coordinate = (n, key) => { var _a, _b; return Number((_b = (_a = n.ui) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : 0); };
    const x = Math.min(...chosen.map(n => coordinate(n, 'x'))), y = Math.min(...chosen.map(n => coordinate(n, 'y')));
    const nodes = chosen.map(n => ({ ...(0, model_1.copy)(n), ui: { ...(0, model_1.copy)(n.ui || {}), x: coordinate(n, 'x') - x + 288, y: coordinate(n, 'y') - y + 144 } }));
    const boundary = (role, id, ui) => {
        // Named by the one naming rule, from _1 (Refactor.76). 照同一套命名規則，從 _1 開始（R.76）。
        const n = authored(structural(graph, role), id, ui);
        n.name = (0, node_names_1.freeName)((role === 'input' ? 'Input' : 'Output') + '_1', new Set(nodes.flatMap(v => v.name === undefined ? [] : [v.name])));
        nodes.push(n);
    };
    boundary('input', inputId, { x: 24, y: 144 });
    boundary('output', outputId, { x: Math.max(...nodes.map(n => Number(n.ui.x))) + 288, y: 144 });
    // A group whose members all move goes with them, as it is (amendment A8: complete groups and their text come along; a partial
    // group stays outside with what is left of it — the tidy at the end of the change drops the moved members). 成員全被選的群組原樣跟著
    // 進去（A8：完整群組與內文一起進；部分群組留在外面、剩下的成員還在——修改結束時的整理會拿掉搬走的成員）。
    const groups = (0, groups_1.completeGroups)((0, groups_1.groupsOf)(data), selected);
    const f = { id: options.id, title: options.title, inputs, outputs,
        graph: { nodes, edges, ...(options.ui || groups.length ? { ui: { ...(0, model_1.copy)(options.ui || {}), ...(groups.length ? { groups: (0, model_1.copy)(groups) } : {}) } } : {}) } };
    validate(graph, f);
    const instanceModule = structural(graph, 'instance');
    const instance = authored(instanceModule, options.instanceId, { x, y }, instanceModule.reference(f.id));
    const owner = (_e = graph.document.subgraphs) === null || _e === void 0 ? void 0 : _e.find(f => f.graph === data), oldScope = owner ? 'fn_' + owner.id : network.id;
    insertSubgraph(graph, f);
    // A move must not collect definitions used by the nodes it is moving.
    data.nodes = data.nodes.filter(n => !selected.has(n.id));
    data.nodes.push(instance);
    data.edges = outside;
    scope_references_1.ScopeReferences.walk(graph.document, (ref, old) => ref.scope === oldScope && selected.has(ref.source[0]) ?
        scope_references_1.ScopeReferences.token('fn_' + f.id, ref.source) : old);
    return instance;
}
/** The first definition that, through its instances, reaches itself; null when none does (a cycle cannot be expanded, subgraph_compiler.ts;
 * a paste or an instance placed inside a definition could make one, legacy clipboard.cycle). 第一份經由實例回到自己的定義；沒有就是 null
 * （循環展不開；貼上或在定義裡放實例可能造成，照舊產品 clipboard.cycle）。 */
function subgraphCycle(g, registry) {
    const definitions = new Map((g.subgraphs || []).map(f => [f.id, f])), active = new Set(), done = new Set();
    const visit = (id) => {
        var _a, _b;
        if (active.has(id))
            return id;
        if (done.has(id))
            return null;
        const f = definitions.get(id);
        if (!f)
            return null;
        active.add(id);
        for (const n of f.graph.nodes) {
            const child = (_b = (_a = registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n);
            if (child) {
                const found = visit(child);
                if (found)
                    return found;
            }
        }
        active.delete(id);
        done.add(id);
        return null;
    };
    for (const id of definitions.keys()) {
        const found = visit(id);
        if (found)
            return found;
    }
    return null;
}
/** Which definitions each definition instantiates: the (parent, child) edges of the document's definitions. 每份定義含有哪些定義的實例：父→子的邊。 */
function instanceEdges(g, registry) {
    var _a, _b;
    const edges = new Map();
    for (const f of g.subgraphs || []) {
        const children = new Set();
        for (const n of f.graph.nodes) {
            const child = (_b = (_a = registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n);
            if (child !== undefined)
                children.add(child);
        }
        edges.set(f.id, children);
    }
    return edges;
}
/** A cycle this edit makes (technical review TECH-8): the parent of the first new (parent, child) edge whose child reaches back to
 * it, a self-instance included; null when no new edge lies on a cycle. Cycles already there do not let new ones in, and an edit that
 * removes an old cycle while adding edges passes when those edges close none. 這次修改造成的循環：第一條新的父→子邊，子能走回父（含自己
 * 實例自己）就回傳那個父；新邊都不在循環上就是 null。已有的循環不會放行新的；拆掉舊循環、新邊不成環的修改照樣通過。 */
function newSubgraphCycle(before, after, registry) {
    var _a;
    const old = instanceEdges(before, registry), now = instanceEdges(after, registry);
    const reaches = (from, to) => {
        var _a;
        const seen = new Set(), stack = [from];
        while (stack.length) {
            const id = stack.pop();
            if (id === to)
                return true;
            if (seen.has(id))
                continue;
            seen.add(id);
            stack.push(...((_a = now.get(id)) !== null && _a !== void 0 ? _a : []));
        }
        return false;
    };
    for (const [parent, children] of now)
        for (const child of children)
            if (!((_a = old.get(parent)) === null || _a === void 0 ? void 0 : _a.has(child)) && reaches(child, parent))
                return parent;
    return null;
}
/** How many instances point at each definition, over every network of the document (the "×N" of basic design §3.6: direct
 * instances, not expanded uses). 每份定義被幾個實例指著，算遍文件的每張網路（§3.6 的「×N」：直接實例數，不是展開後的使用數）。 */
function instanceCounts(graph) {
    var _a, _b, _c;
    const counts = new Map();
    for (const data of [...Object.values(graph.document.stages), ...(graph.document.subgraphs || []).map(f => f.graph)])
        for (const n of data.nodes) {
            const ref = (_b = (_a = graph.registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n);
            if (ref)
                counts.set(ref, ((_c = counts.get(ref)) !== null && _c !== void 0 ? _c : 0) + 1);
        }
    return counts;
}
/** Each definition's uses (visual notes 2026-10-14, ×N): `direct` = how many instances point at it anywhere; `expanded` = how many
 * times it is in effect once every enclosing instance is expanded (an instance inside P counts P's own expanded uses). One scan of every network;
 * the gate keeps the instance graph acyclic, and a cycle found anyway counts once. 每份定義的使用數：direct＝幾個實例指著它；expanded＝
 * 展開所有外層實例後實際用到幾次（P 裡的實例算 P 自己的展開數）。掃每張網路一次；關卡保證無循環，萬一有就只算一次。 */
function useCounts(graph) {
    var _a, _b, _c, _d, _e, _f;
    const stage = new Map(), inside = new Map();
    const bump = (m, id) => { var _a; return m.set(id, ((_a = m.get(id)) !== null && _a !== void 0 ? _a : 0) + 1); };
    for (const data of Object.values(graph.document.stages))
        for (const n of data.nodes) {
            const ref = (_b = (_a = graph.registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n);
            if (ref)
                bump(stage, ref);
        }
    for (const f of graph.document.subgraphs || []) {
        const instances = new Map();
        for (const n of f.graph.nodes) {
            const ref = (_d = (_c = graph.registry.get(n.nodeType)) === null || _c === void 0 ? void 0 : _c.referencedGraph) === null || _d === void 0 ? void 0 : _d.call(_c, n);
            if (ref)
                bump(instances, ref);
        }
        if (instances.size)
            inside.set(f.id, instances);
    }
    const parents = new Map();
    for (const [parent, instances] of inside)
        for (const [child, count] of instances)
            ((_e = parents.get(child)) !== null && _e !== void 0 ? _e : parents.set(child, []).get(child)).push({ parent, count });
    const expanded = new Map(), active = new Set();
    const total = (id) => {
        var _a, _b;
        const known = expanded.get(id);
        if (known !== undefined)
            return known;
        if (active.has(id))
            return 0;
        active.add(id);
        let n = (_a = stage.get(id)) !== null && _a !== void 0 ? _a : 0;
        for (const { parent, count } of (_b = parents.get(id)) !== null && _b !== void 0 ? _b : [])
            n += count * total(parent);
        active.delete(id);
        expanded.set(id, n);
        return n;
    };
    const result = new Map();
    for (const f of graph.document.subgraphs || []) {
        const direct = ((_f = stage.get(f.id)) !== null && _f !== void 0 ? _f : 0) + [...inside.values()].reduce((sum, instances) => { var _a; return sum + ((_a = instances.get(f.id)) !== null && _a !== void 0 ? _a : 0); }, 0);
        result.set(f.id, { direct, expanded: total(f.id) });
    }
    return result;
}
/** Remove a definition with no instances (the subgraph panel's Delete on a zero-use card, basic design §3.9); one that still has instances is
 * refused. 刪掉沒有實例的定義（子圖面板上 0 個引用的卡片的刪除，§3.9）；還有實例的拒絕。 */
function removeSubgraph(graph, id) {
    graph.assertEditable();
    const definitions = graph.document.subgraphs || [];
    if (!definitions.some(f => f.id === id))
        throw Error('Subgraph definition no longer exists');
    if (instanceCounts(graph).get(id))
        throw Object.assign(Error('The Subgraph definition is still in use'), { code: 'subgraph.inUse' });
    removed(graph, definitions.filter(f => f.id === id));
    graph.document.subgraphs = definitions.filter(f => f.id !== id);
}
/** A legal removal (amendment 2 B1): a Library copy passes the start check and its identity becomes removed; a definition made local
 * earlier in this edit is removed under the identity it had. 合法移除：Library 副本過起點檢查、身分記成已移除；這筆修改裡剛轉為本地的，用它原本的身分記。 */
function removed(graph, going) {
    for (const f of going) {
        if (f.libraryId !== undefined) {
            (0, library_1.requireCurrent)(graph.library, f);
            graph.library.set(f.id, f.libraryId, { kind: 'removed' });
            continue;
        }
        if (!graph.libraryInUse)
            continue;
        for (const entry of graph.library.entries())
            if (entry.id === f.id && entry.state.kind === 'local')
                graph.library.set(f.id, entry.libraryId, { kind: 'removed' });
    }
}
/** Collect, among the dependency closure of removed instances, only definitions the caller names as collectible: Library
 * copies that can be brought back whole (basic design §3.9, amendments A4/B2; the caller resolves them, the core never reads a
 * Library). A local definition is never collected: deleting an instance must not lose the person's work; it stays listed in the
 * subgraph panel with zero uses. Other reusable definitions and the active scope remain untouched.
 * 刪掉實例後只回收呼叫端指名「可回收」的定義（能整份拉回來的 Library 副本；由呼叫端解析，核心不讀 Library）。本地定義永不回收：
 * 刪錯實例不該把人做的子圖弄丟，它留在子圖面板、顯示 0 個引用。 */
function collectSubgraphs(graph, roots, active, collectible) {
    if (!roots.length || !collectible.size)
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
    const go = (f) => candidates.has(f.id) && !keep.has(f.id) && collectible.has(f.id);
    removed(graph, (graph.document.subgraphs || []).filter(go));
    graph.document.subgraphs = (graph.document.subgraphs || []).filter(f => !go(f));
}

},
"subgraph_stages":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBGRAPH_STAGES = void 0;
exports.subgraphStages = subgraphStages;
exports.subgraphStageTable = subgraphStageTable;
exports.subgraphGroups = subgraphGroups;
/** The stages a subgraph can be used in, worked out from what is inside it (design-interview Q46): the stages every
 * node inside allows, nested subgraphs followed. Nothing is stored in the graph; a saved definition (library, export,
 * clipboard) writes the result and is recomputed on load. Nodes this build does not know add no limit: they are ghosts
 * and left out of code generation anyway. A cycle is not followed again (cycles are refused where subgraphs change).
 * The target needs no such rule: every node inside is checked against the graph's own target.
 * 子圖能用在哪些 Stage，由內容推算（Q46）：裡面每個節點都允許的 Stage，巢狀子圖一路跟進。圖裡不存；存成定義（個人庫、
 * 匯出、剪貼簿）時才寫出結果、載入時重算。不認得的節點不加限制（它是 Ghost、本來就不產碼）。循環不重複走。
 * target 不需要這條：裡面每個節點本來就照圖的 target 檢查。 */
exports.SUBGRAPH_STAGES = ['vertex', 'pixel'];
function subgraphStages(graph, id, registry) {
    return subgraphStageTable(graph, registry)(id);
}
/** The same answer for many definitions at once (technical review TECH-3, R113-1): the definitions are grouped into the sets that
 * reach each other (strongly connected components; a definition containing an instance of itself is one), and each set is worked out once, after the
 * sets it instantiates. A definition's answer is every node it reaches, so the members of one cycle share an answer, and a graph opened
 * with a cycle costs the same as one without. 一次回答多份定義：定義先分成「彼此走得到」的組（強連通分量；包含自己的實例也算一組），
 * 每組在它用到的組之後算一次。定義的答案是它走得到的每個節點，所以同一個循環的成員答案相同；開著循環的圖和沒有循環的一樣花費。 */
function subgraphStageTable(graph, registry) {
    const { stagesOf } = subgraphGroups(graph, registry);
    return id => [...stagesOf(id)];
}
/** The strongly connected components of the definitions' instances (Tarjan), with each one's stages, and which definitions lie on a
 * cycle (they cannot be expanded; amendment A8 shows them in the Subgraphs panel). 定義之間的實例關係的強連通分量（Tarjan）與各自的 Stage，
 * 以及哪些定義在循環上（展不開；A8 在子圖面板顯示）。 */
function subgraphGroups(graph, registry) {
    var _a, _b, _c, _d;
    const byId = new Map(((_a = graph.subgraphs) !== null && _a !== void 0 ? _a : []).map(item => [item.id, item]));
    const own = new Map(), instances = new Map();
    for (const [id, subgraph] of byId) {
        let stages = [...exports.SUBGRAPH_STAGES];
        const children = [];
        for (const node of (_c = (_b = subgraph.graph) === null || _b === void 0 ? void 0 : _b.nodes) !== null && _c !== void 0 ? _c : []) {
            const module = registry.get(node.nodeType);
            if (!module)
                continue;
            const limit = module.catalog.definition.stages;
            if (limit)
                stages = stages.filter(stage => limit.includes(stage));
            const child = (_d = module.referencedGraph) === null || _d === void 0 ? void 0 : _d.call(module, node);
            if (child !== undefined && byId.has(child))
                children.push(child);
        }
        own.set(id, stages);
        instances.set(id, children);
    }
    const index = new Map(), low = new Map(), stack = [], onStack = new Set();
    const groupOf = new Map(), groupStages = [], cyclic = new Set();
    let counter = 0;
    const connect = (id) => {
        index.set(id, counter);
        low.set(id, counter);
        counter++;
        stack.push(id);
        onStack.add(id);
        for (const child of instances.get(id)) {
            if (!index.has(child)) {
                connect(child);
                low.set(id, Math.min(low.get(id), low.get(child)));
            }
            else if (onStack.has(child))
                low.set(id, Math.min(low.get(id), index.get(child)));
        }
        if (low.get(id) !== index.get(id))
            return;
        const members = [];
        let member;
        do {
            member = stack.pop();
            onStack.delete(member);
            members.push(member);
        } while (member !== id);
        // Components finish children first, so every set this one instantiates already has its answer. 子分量先完成，這組用到的組都已有答案。
        const group = groupStages.length, inside = new Set(members);
        let stages = [...exports.SUBGRAPH_STAGES];
        for (const m of members) {
            stages = stages.filter(stage => own.get(m).includes(stage));
            for (const child of instances.get(m))
                if (!inside.has(child))
                    stages = stages.filter(stage => groupStages[groupOf.get(child)].includes(stage));
            groupOf.set(m, group);
        }
        groupStages.push(stages);
        if (members.length > 1 || instances.get(id).includes(id))
            for (const m of members)
                cyclic.add(m);
    };
    for (const id of byId.keys())
        if (!index.has(id))
            connect(id);
    return { stagesOf: id => byId.has(id) ? groupStages[groupOf.get(id)] : exports.SUBGRAPH_STAGES, cyclic };
}

},
"subgraphs":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subgraph = void 0;
exports.fitInstanceValues = fitInstanceValues;
const model_1 = require("./model");
const values_1 = require("./values");
const subgraph_operations_1 = require("./subgraph_operations");
const config_1 = require("./config");
const node_names_1 = require("./node_names");
/** One graph-owned definition and all its instances. Every definition in a graph is editable until the Library round adds
 * read-only copies (Refactor.109). 圖裡的定義與它的所有引用；Library 那一輪之前每份定義都可改。 */
class Subgraph {
    constructor(graph, id) {
        this.graph = graph;
        this.id = id;
    }
    get data() {
        var _a;
        return (_a = this.graph.document.subgraphs) === null || _a === void 0 ? void 0 : _a.find(f => f.id === this.id);
    }
    /** The definition's colour (basic design §3.14): a hex colour as a group's, every instance shows it; null takes it away (the default
     * colour group draws it). 定義的顏色（§3.14）：和群組一樣的色碼，每個實例都顯示；null 拿掉（畫面用預設顏色組）。 */
    recolor(color) {
        this.graph.assertEditable();
        const f = this.data;
        if (!f)
            throw Error('Subgraph definition no longer exists');
        if (color !== null && !/^#[0-9a-f]{6}$/.test(color))
            throw Error('Invalid Subgraph color');
        if (color === null)
            delete f.color;
        else
            f.color = color;
    }
    /** A new title, by the node-name rule (visual notes 27, human 2026-10-14). Calls still named by default for the old title follow it,
     * keeping their number when it is free (Gain_2 → Blur_2); instances named by hand stay. Old graphs may hold a title outside the rule;
     * it is checked only when it changes. 新的 Title，照節點名稱規則（外觀意見 27，人類）。仍是舊 Title 預設名的實例跟著改，編號沒人用就保留
     * （Gain_2 → Blur_2）；手動取名的不動。舊圖的 Title 可能不合規則，只在改的時候檢查。 */
    rename(title) {
        var _a, _b;
        this.graph.assertEditable();
        const f = this.data;
        if (!f)
            throw Error('Subgraph definition no longer exists');
        if (!(0, node_names_1.validSubgraphTitle)(title))
            throw Object.assign(Error('A subgraph title uses letters, digits, spaces and underscores, and starts with a letter'), { code: 'subgraph.title' });
        const old = f.title;
        f.title = title;
        const networks = [...Object.values(this.graph.document.stages), ...(this.graph.document.subgraphs || []).map(d => d.graph)];
        for (const data of networks) {
            const taken = (0, node_names_1.namesIn)(data);
            for (const n of data.nodes) {
                if (n.name === undefined || ((_b = (_a = this.graph.registry.get(n.nodeType)) === null || _a === void 0 ? void 0 : _a.referencedGraph) === null || _b === void 0 ? void 0 : _b.call(_a, n)) !== this.id)
                    continue;
                const number = (0, node_names_1.defaultInstanceNumber)(n.name, old);
                if (number === null)
                    continue;
                taken.delete(n.name);
                n.name = (0, node_names_1.newInstanceName)(title, taken, number);
                taken.add(n.name);
            }
        }
    }
    editInterface(direction, edit) {
        this.graph.assertEditable();
        const f = this.data;
        if (!f)
            throw Error('Subgraph definition no longer exists');
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
            if (Object.keys(edit.patch).some(k => !['label', 'type', 'default'].includes(k)))
                throw Error('Interface edit cannot change port identity');
            const p = next[index];
            const previous = p.type;
            Object.assign(p, (0, model_1.copy)(edit.patch));
            if (edit.patch.label === '')
                delete p.label;
            // A type change keeps the default in shape; an opaque port has none (§3.4). 換型別時預設值跟著換形狀；opaque 沒有預設值。
            if (values_1.opaque.includes(p.type)) {
                if (edit.patch.default !== undefined)
                    throw Error('An opaque Subgraph port has no default');
                delete p.default;
            }
            else if (p.type !== previous && edit.patch.default === undefined)
                p.default = values_1.opaque.includes(previous) ? (0, values_1.fill)(0, p.type) : (0, values_1.reshape)(p.default, p.type);
        }
        if (next.length > config_1.CORE_CONFIG.subgraphPortsPerSide)
            throw Error('Subgraph supports at most ' + config_1.CORE_CONFIG.subgraphPortsPerSide + ' ports per direction');
        const seen = new Set();
        for (const p of next) {
            if (!(0, subgraph_operations_1.validPort)(p) || seen.has(p.id))
                throw Error('Invalid or duplicate Subgraph port');
            seen.add(p.id);
            if (!values_1.opaque.includes(p.type))
                (0, values_1.literal)(p.default, (0, values_1.type)(p.type));
        }
        // Prepare every patch before mutation, including instance defaults.
        const patches = [];
        const removed = edit.kind === 'remove' ? edit.id : null;
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
                // An instance value follows the new interface (fitInstanceValues). 實例值跟著新接口。
                patches.push({ node: n, values: fitInstanceValues(n.inputValues, next) });
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
/** An instance's explicit values fitted to its definition's current inputs (technical review TECH-2): a value whose port is gone is
 * dropped, an opaque port keeps none, a numeric value takes its port's shape, and one that cannot falls back to the port default.
 * Values not given stay not given. One rule for an interface edit and for pasting an instance copied before the interface changed.
 * 實例的實例值對齊定義目前的輸入：接口不在就拿掉、opaque 接口不留值、數值換成接口的形狀，換不了就退回接口預設；沒給的維持沒給。
 * 改接口與貼上舊實例用同一條規則。 */
function fitInstanceValues(values, ports) {
    const fitted = {};
    for (const [key, value] of Object.entries(values)) {
        const p = ports.find(port => port.id === key);
        if (!p || values_1.opaque.includes(p.type))
            continue;
        try {
            fitted[key] = (0, values_1.reshape)(value, p.type);
        }
        catch ( /* the port default applies 用接口預設 */_a) { /* the port default applies 用接口預設 */ }
    }
    return fitted;
}

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
    // One UV node, three outputs (Refactor.64, human 2026-10-10; was vUV vec3 and vUV.st vec2 as two entries): U for 1D lookups such
    // as sTDSineLookup, UV for 2D, UVW for 3D, Cube and 2D Array. 一個 UV 節點、三個輸出（原本 vUV 與 vUV.st 兩筆）：U 給 1D、UV 給 2D、
    // UVW 給 3D／Cube／2D Array。
    { "id": "vUV", "name": "vUV", "expression": "vUV", "type": "vec3", "targets": ["top"], "stages": ["pixel"], "category": ["common", "coordinates"], "hint": "Texture coordinates of this pixel, from 0 to 1: U for 1D, UV for 2D, UVW for 3D, Cube and 2D Array textures.", "helpUrl": "https://derivative.ca/UserGuide/Write_a_GLSL_TOP", "common": "uv", "outputs": [{ "key": "u", "label": "U", "expression": "vUV.s", "type": "float" }, { "key": "uv", "label": "UV", "expression": "vUV.st", "type": "vec2" }, { "key": "uvw", "label": "UVW", "expression": "vUV.stp", "type": "vec3" }] },
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
const capacity_1 = require("./capacity");
const subgraph_compiler_1 = require("./subgraph_compiler");
/** Whole-graph orchestration. Concrete node modules are injected by composition. */
const graph_1 = require("./graph");
const model_1 = require("./model");
const values_1 = require("./values");
const comments_1 = require("./comments");
const ghosts_1 = require("./ghosts");
const declarations_1 = require("./declarations");
const node_names_1 = require("./node_names");
const identifier_rules_1 = require("./identifier_rules");
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
        var _a, _b;
        let errorNode;
        try {
            if (!supports(g))
                throw Error('Graph is outside the selected frontend compiler capability');
            // Catalog provenance is checked by the delivery adapter, not graph traversal.
            const { catalogSnapshot, ...document } = g;
            const model = new graph_1.GraphDocument(document, registry), network = model.networks.get('pixel');
            const data = model.document.stages.pixel;
            if (data.nodes.length > limits.nodes || data.edges.length > limits.edges || (0, capacity_1.documentBytes)(g) > limits.bytes)
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
                    if (!identifiers || !(0, node_names_1.validNodeName)(n.name, identifiers.reservedNames) || authoredNames.has(n.name))
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
            // Which node each variable belongs to (Refactor.63): a name in the GLSL leads back to its node without guessing from
            // the text. 每個變數屬於哪個節點：GLSL 裡的名字不必從文字猜就能找回節點。
            const variables = {};
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
                // Connected means a wire whose source emitted something: an opaque relay with nothing wired in emits nothing, so what
                // it feeds counts as unconnected (subgraph_compiler.ts). 「有接」＝有線且來源有東西：沒接的 opaque 中繼沒有輸出，它餵的接孔算沒接。
                const connected = (key) => { const edge = links.get(node.port('input', key)); return !!edge && expressions.get(edge.from) !== undefined; };
                const emission = d.emit(n, { ...model.context, ports: p, input, connected, useDeclaration, referenceDeclaration });
                if (Object.keys(emission.outputs).sort().join() !== Object.keys(p.outputs).sort().join())
                    throw Error('Module emitted a different output interface');
                if (emission.statements)
                    lines.push(...emission.statements);
                for (const name of (_b = emission.names) !== null && _b !== void 0 ? _b : [])
                    variables[name] = id;
                let passed = false;
                for (const [port, expression] of Object.entries(emission.outputs)) {
                    // An opaque value cannot live in a local variable: its expression is written where it is used.
                    // 不透明的值不能放進區域變數：直接代入使用的地方。
                    if (values_1.opaque.includes(p.outputs[port].type)) {
                        if (expression !== undefined)
                            expressions.set(node.port('output', port), expression);
                        passed = true;
                        continue;
                    }
                    if (expression === undefined)
                        throw Error('Node emitted no expression for ' + port);
                    const symbol = 'sg_n_' + (n.name || id) + (port === 'out' ? '' : '_' + port);
                    lines.push('    ' + (emission.constant ? 'const ' : '') + p.outputs[port].type + ' ' + symbol + ' = ' + expression + ';');
                    expressions.set(node.port('output', port), symbol);
                    variables[symbol] = id;
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
            // Names in the GLSL that lead somewhere (Refactor.63.4): a declaration written at file scope leads to its declaration;
            // the stage's output (written by this template) leads to the stage output node. GLSL 裡能帶到別處的名字：檔頭寫出的
            // 宣告帶回宣告；Stage 的輸出（這個樣板寫的）帶回 Stage 輸出節點。
            const declarationNames = Object.fromEntries(usedDeclarations.filter(d => declarations_1.declarationKinds.get(d.kind).header).map(d => [d.name, d.id]));
            variables.fragColor = outputs[0].id;
            const pixel = [...headers, 'layout(location=0) out vec4 fragColor;', 'void main() {', '    vec2 sg_uv = vUV.st;', ...lines, '}', ''].join('\n');
            const diagnostics = [
                ...data.nodes.filter(n => !visited.has(n.id) && !ghosts.nodes.has(n.id)).sort((a, b) => a.id < b.id ? -1 : 1).map(n => ({ node: n.id, stage: 'pixel', message: 'Disconnected node is not emitted' })),
                ...[...ghosts.nodes].sort(([a], [b]) => a < b ? -1 : 1).map(([node, kind]) => ({ node, stage: 'pixel', message: 'Ghost node (' + kind + ') is kept but not emitted' })),
                ...data.edges.filter(e => ghosts.edgeData.has(e)).map(e => ({ node: e.to[0], stage: 'pixel', message: 'Ghost wire to ' + e.to[1] + ' is treated as not connected' }))
            ];
            const sourceMap = { pixel: lineNodes.map((node, i) => ({ node, stage: 'pixel', trail: [], line: headers.length + 4 + i })), variables, declarations: declarationNames };
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
 * edge `ui` (Link／Wire style) never reach GLSL, nor do description／comment／userVersion (Q44) or savedBy (Refactor.66).
 * Equal keys must mean the same program apart from comment lines; tests/unit/test_codegen_key.cjs
 * checks this on random edit sequences.
 * 產碼指紋：產出的程式所依賴的一切，扣掉版面與註記。節點 ui、comment 只帶來版面與 GLSL 註解（規則 B，不在鏈路）；
 * 線的 id 與樣式、作品說明不進 GLSL。指紋相同＝除註解行外程式相同，由隨機編輯的性質測試把關。 */
function codegenKey(g) {
    const network = (data) => data && { ...data,
        nodes: (data.nodes || []).map(n => ({ ...n, ui: undefined, comment: undefined })),
        edges: (data.edges || []).map(e => ({ ...e, id: undefined, ui: undefined })) };
    return JSON.stringify({ ...g, description: undefined, comment: undefined, userVersion: undefined, savedBy: undefined,
        stages: Object.fromEntries(Object.entries(g.stages || {}).map(([k, v]) => [k, network(v)])),
        subgraphs: (g.subgraphs || []).map(f => ({ ...f, description: undefined, comment: undefined, userVersion: undefined, graph: network(f.graph) })) });
}
function createCompiler(registry, config = config_1.CORE_CONFIG) {
    const flat = createFlatCompiler(registry, { nodes: config.nodesPerNetwork, edges: config.edgesPerNetwork, bytes: config.documentBytes });
    // The expanded graph is built here for code generation, never sent to the host: it keeps the expanded node and edge limits but not
    // the document's byte limit, which the subgraph compiler has checked on the graph itself (Codex R120-2: a note copied into every
    // instance made a 33 KB graph read as 610 KB). 展開圖只為產碼而建、不送宿主：保留展開後的節點與接線上限，不套文件位元組上限——子圖產碼器
    // 已對圖本身檢查過（每個實例複製一份註記，33 KB 的圖被當成 610 KB）。
    const subgraphs = (0, subgraph_compiler_1.createSubgraphCompiler)(registry, r => createFlatCompiler(r, { nodes: config.expandedNodes, edges: config.expandedEdges, bytes: Infinity }), config);
    return Object.freeze({ protocol: exports.protocol, key: codegenKey,
        supports: (g) => { var _a; return ((_a = g.subgraphs) === null || _a === void 0 ? void 0 : _a.length) ? subgraphs.supports(g) : flat.supports(g); },
        // The core's own identifier rules unless given (Refactor.76: every node now has a name, so a name always meets them).
        // 沒給就用核心自己的識別字規則（R.76：現在每個節點都有名字，名字一律照它檢查）。
        compile: (g, identifiers = identifier_rules_1.identifierRules) => { var _a; return ((_a = g.subgraphs) === null || _a === void 0 ? void 0 : _a.length) ? subgraphs.compile(g, identifiers) : flat.compile(g, identifiers); },
        // Definitions this host cannot use (A8), for the Subgraphs panel. 這個 host 用不了的定義，給子圖面板。
        unusableSubgraphs: (g) => { var _a; return ((_a = g.subgraphs) === null || _a === void 0 ? void 0 : _a.length) ? subgraphs.unusableSubgraphs(g) : new Set(); }
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
"upgrades":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeUpgrades = void 0;
exports.upgradeGraph = upgradeGraph;
/** Node upgrades (Refactor.65, human 2026-10-10): when a release changes what a graph stores for a node — its type, a
 * setting's code, or a port's key — one rule here says how the old shape becomes the new one. Rules look at what the
 * graph holds, never at a version number, so they apply to a graph from any earlier release, and a chain of renames is
 * followed to its end. Two rules keep that sound: a retired code is never used again, and a change of meaning gets a new
 * code (then the old one becomes a rule here). Graphs of another format are not upgraded: they belong to the importer
 * (Q40, Q44). What nothing here covers stays a ghost (Q37).
 * 節點升級（人類 10-10）：發布後若改了圖裡存的節點寫法（節點種類、設定的代號、接孔），在這裡寫一條「舊的長這樣→換成新的」。
 * 規則看圖裡存的內容、不看版本號，所以任何舊版存的圖都適用，連續改名也會一路換到底。兩條規則讓它成立：拿掉的代號永不再用；
 * 意思改了就換新代號（舊代號變成這裡的一條）。別的格式不在這裡升級，交給匯入器（Q40、Q44）。這裡沒寫到的照舊是 Ghost（Q37）。 */
const model_1 = require("./model");
const node_names_1 = require("./node_names");
const text_1 = require("./text");
const TD_VALUE = 'sgrape.builtin.td_value';
/** The rules, oldest first. Never remove one that shipped: a graph saved long ago may still need it. A rule added before the first
 * release (for development graphs only) carries 【發布前清理】 and is removed before release (human 2026-10-16).
 * 規則，舊的在前；發布過的不要刪，很久以前存的圖可能還用得到。第一次發布前加的（只為開發中的圖）標【發布前清理】，發布前拿掉（人類 10-16）。 */
exports.nodeUpgrades = Object.freeze([
    // 【發布前清理】Refactor.64: vUV.st folded into vUV, which has U, UV and UVW outputs. vUV.st 併進 vUV（U、UV、UVW 三個輸出）。
    { id: 'td-value-vuv-st', nodeType: TD_VALUE, params: { entry: 'vUVSt' }, set: { params: { entry: 'vUV' } }, outputs: { out: 'uv' },
        note: (0, text_1.tr)('upgrade.vUVSt', 'vUV.st became vUV; its wires now leave from the UV output') },
    { id: 'td-value-vuv-out', nodeType: TD_VALUE, params: { entry: 'vUV' }, outputs: { out: 'uvw' },
        note: (0, text_1.tr)('upgrade.vUVOut', 'vUV now has U, UV and UVW outputs; its wires now leave from the UVW output') },
    // 【發布前清理】Refactor.117: a subgraph's node is an instance, not a call (human 2026-10-16: the name came from the early "subgraph =
    // function" idea, dropped when subgraphs became expansions). 子圖節點是實例、不是呼叫（名字來自早期「子圖＝函式」的構想）。
    { id: 'subgraph-instance', nodeType: 'sgrape.builtin.subgraph_call', set: { nodeType: 'sgrape.builtin.subgraph_instance' },
        note: (0, text_1.tr)('upgrade.subgraphInstance', 'Subgraph nodes are now called instances') },
]);
const matches = (node, rule) => {
    var _a;
    return node.nodeType === rule.nodeType
        && Object.entries((_a = rule.params) !== null && _a !== void 0 ? _a : {}).every(([key, value]) => { var _a; return JSON.stringify((_a = node.params) === null || _a === void 0 ? void 0 : _a[key]) === JSON.stringify(value); });
};
/** Apply one rule to one network, in place on a copy; returns the changes. 對一張網路套用一條規則（在複本上改）。 */
function upgradeNetwork(network, name, rule) {
    var _a, _b, _c, _d, _e;
    const changes = [];
    for (const node of network.nodes) {
        if (!matches(node, rule))
            continue;
        let changed = false, wires = 0;
        if (((_a = rule.set) === null || _a === void 0 ? void 0 : _a.nodeType) && rule.set.nodeType !== node.nodeType) {
            node.nodeType = rule.set.nodeType;
            changed = true;
        }
        for (const [key, value] of Object.entries((_c = (_b = rule.set) === null || _b === void 0 ? void 0 : _b.params) !== null && _c !== void 0 ? _c : {}))
            if (JSON.stringify(node.params[key]) !== JSON.stringify(value)) {
                node.params[key] = (0, model_1.copy)(value);
                changed = true;
            }
        for (const edge of network.edges) {
            const out = edge.from[0] === node.id ? (_d = rule.outputs) === null || _d === void 0 ? void 0 : _d[edge.from[1]] : undefined;
            const into = edge.to[0] === node.id ? (_e = rule.inputs) === null || _e === void 0 ? void 0 : _e[edge.to[1]] : undefined;
            if (out === undefined && into === undefined)
                continue;
            if (out !== undefined)
                edge.from = [node.id, out];
            if (into !== undefined)
                edge.to = [node.id, into];
            wires++;
        }
        if (changed || wires)
            changes.push({ network: name, node: node.id, rule: rule.id, note: rule.note, wires });
    }
    return changes;
}
/** Bring a stored graph up to the current node shapes. The input is never changed; a graph of another format (or a
 * malformed one) comes back as it is, for the importer or the format check. Rules are applied until none matches, so a
 * chain of renames is followed; a rule table that never settles is a programming error.
 * 把存著的圖升級成目前的節點寫法。不改輸入；別的格式（或壞掉的）原樣回傳，交給匯入器或格式檢查。規則一直套到沒有可換為止；
 * 停不下來代表規則表寫錯了。 */
// 【發布前清理】With the registry, nodes that should have a name and have none are named too (Refactor.76, human 2026-10-11: graphs made
// before names were given get them once, said like any upgrade). 有 registry 時，也替該有名字卻沒有的節點補名（R.76，人類：
// 給名字之前做的圖補一次，和其他升級一樣會說）。
function upgradeGraph(value, rules = exports.nodeUpgrades, registry) {
    var _a, _b;
    if ((0, model_1.formatProblem)(value))
        return { graph: value, changes: [] };
    const graph = (0, model_1.copy)(value);
    // Networks are named as everywhere else: the stage, or 'subgraph:'+id (graph.ts networkEntries). 網路名稱與他處一致。
    const networks = [...Object.entries(graph.stages), ...((_a = graph.subgraphs) !== null && _a !== void 0 ? _a : []).map(s => ['subgraph:' + s.id, s.graph])];
    const changes = [];
    // 【發布前清理】Refactor.117.3 (human 2026-10-16): a subgraph's own name is its `title`; `name` is what a subgraph instance is
    // called in the graph. Development graphs stored the title as `name`. 子圖自己的名稱是 title；name 是子圖實例在圖裡的名稱。開發中的圖把
    // Title 存在 name。
    for (const definition of (_b = graph.subgraphs) !== null && _b !== void 0 ? _b : []) {
        const stored = definition;
        if (typeof stored.name !== 'string' || stored.title !== undefined)
            continue;
        stored.title = stored.name;
        delete stored.name;
        changes.push({ network: 'subgraph:' + definition.id, node: '', rule: 'subgraph-title', wires: 0,
            note: (0, text_1.tr)('upgrade.subgraphTitle', 'Subgraph {title}: its title is now stored as a title', { title: definition.title }) });
    }
    for (let pass = 0;; pass++) {
        if (pass > rules.length)
            throw Error('Node upgrade rules do not settle');
        let found = 0;
        for (const rule of rules)
            for (const [name, network] of networks) {
                const step = upgradeNetwork(network, name, rule);
                found += step.length;
                changes.push(...step);
            }
        if (!found)
            break;
    }
    if (registry)
        for (const named of (0, node_names_1.nameMissing)(graph, registry))
            changes.push({ network: named.network, node: named.node, rule: 'node-name', note: named.note, wires: 0 });
    return changes.length ? { graph, changes } : { graph: value, changes: [] };
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
        edit: spec.edit, emit: spec.emit, creations: spec.creations, componentNames: spec.componentNames, inheritsComponentNames: spec.inheritsComponentNames,
        ...(spec.wire ? { wire: spec.wire } : {}),
        ...(spec.fixed ? { entries: () => [{ key: '', label: catalog.definition.label, params: {} },
                ...spec.types.map(t => ({ key: t, label: t, literal: true, params: { type: t, fixedType: t, ...spec.fixed(t) } }))] } : {}),
        // A fixed node is titled by its type and has no type menu (Refactor.17.2). 固定型別的節點以型別為標題、沒有型別選單。
        presentation: n => {
            var _a;
            return ({ typeOf: 'output', ...(_a = spec.presentation) === null || _a === void 0 ? void 0 : _a.call(spec, n),
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
const component_names_1 = require("./component_names");
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
    // Made from a wire, an assembly is one size bigger than the wire, so there is a component left to fill (legacy
    // graph_ui.js:2314 kept this in the editor for Combine; here the module says it). Replace takes the whole wire as its value.
    // 由一條線拉出新增時，組合節點比那條線大一號，才有分量可以補（舊產品寫在編輯器裡、只認 Combine；這裡由模組自己說）。Replace 整條線當值。
    const preferFor = inherit ? undefined : (wireType, side) => {
        if (side !== 'output' || !value_nodes_1.values.types.includes(wireType))
            return undefined;
        const type = value_nodes_1.values.shaped(value_nodes_1.values.family(wireType), Math.min(4, value_nodes_1.values.count(wireType) + 1));
        return value_nodes_1.values.vectors.includes(type) ? { type } : undefined;
    };
    return { catalog, role: 'value', inheritsComponentNames: true, ...(preferFor ? { preferFor } : {}), supports: n => value_nodes_1.values.vectors.includes(String(n.params.type)), ports,
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
        // Each component input reads as the letters it covers, e.g. "RG" for a group (legacy graph_ui.js:1293).
        // 每個分量輸入顯示它涵蓋的字母，例如分組時「RG」（照舊產品）。
        presentation: n => {
            const parts = layout(n), letters = (0, component_names_1.componentLetters)((0, component_names_1.storedOr)(n, 'xyzw'), value_nodes_1.values.count(String(n.params.type)));
            return { typeOf: 'output',
                portLabels: { inputs: Object.fromEntries(parts.map(p => [p.key, letters.slice(p.start, p.start + p.size)])) },
                components: { inputs: Object.fromEntries(parts.map(p => [p.key, Array.from({ length: p.size }, (_, i) => p.start + i)])) } };
        },
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
"wire_drop":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wireDropTable = wireDropTable;
exports.wireDropRow = wireDropRow;
/** The wire-drop table (Refactor.77; design-interview Q37 1-5 supplement, human 2026-10-11). A wire dropped on the blank
 * canvas lists the nodes that can take it. Which ones, in which configuration and on which port, is decided here once, when
 * the build writes the editor contract, by the same rules as a real edit: the module's own `wire` (Combine, Replace) and the
 * same planner the network uses. The editor only looks it up; adding still goes through the real edit, so a wrong row can
 * only list a node that then fails to connect, never make a wrong wire.
 * Assumes what a fresh node accepts depends only on the node and the wire's type, never on the rest of the graph (true for
 * every module now). Things only a document knows (user structs, subgraphs, declarations) are for the same function called
 * with that document's types and context later.
 * 拉線新增的表（R.77；Q37 1-5 補充，人類）：線放到空白處時列出接得住它的節點。哪些節點、用什麼設定、接哪個接孔，在建置寫出
 * 編輯器合約時用真正的規則算一次：模組自己的 `wire`（Combine、Replace）與網路同一個規劃函式。編輯器只查表；新增仍走真正的修改，
 * 表有誤最多列出一個接不上的節點，不會接出錯的線。前提：全新節點接不接得住只看節點本身與線的型別、不看圖的其他部分（目前每個模組都是）。
 * 只有作品知道的東西（自訂結構、子圖、宣告）之後用同一個函式帶那份作品的型別與 context 再算。 */
const model_1 = require("./model");
const node_module_1 = require("./node_module");
const wire_planning_1 = require("./wire_planning");
const structure_1 = require("./structure");
const values = require("./values");
const WIRE = 'wire', NEW = 'new', END = 'end';
function wireDropTable(registry, types, target = 'top', context = { target, declaration: () => undefined }) {
    var _a, _b;
    const table = {};
    for (const module of registry.modules) {
        const definition = module.catalog.definition;
        // What the add menu can offer: placed in a pixel network, not a stage output, not a reference to a declaration.
        // 新增選單能提供的：放在 pixel 網路、不是階段輸出、不是宣告的引用。
        if (module.structural || !(0, structure_1.offered)(module) || !definition.stages.includes('pixel') || module.referencedDeclaration)
            continue;
        for (const entry of (_b = (_a = module.entries) === null || _a === void 0 ? void 0 : _a.call(module)) !== null && _b !== void 0 ? _b : [{ key: '', label: definition.label, params: {} }]) {
            const base = { id: NEW, nodeType: definition.nodeType, params: { ...(0, model_1.copy)(definition.defaults), ...(0, model_1.copy)(entry.params) } };
            if (!module.supports(base, context))
                continue;
            table[definition.nodeType + ':' + entry.key] = wireDropRow(module, base, types, context);
        }
    }
    return table;
}
/** One row for a node only a document knows — a Library subgraph's instance, worked out on the graph it was brought into (D-2): the
 * same rules as the built-in rows, with that document's context. 只有作品知道的節點的一列——資源庫子圖的實例，在它被帶進的那張圖上算：
 * 和內建列同一套規則，用那份作品的 context。 */
function wireDropRow(module, node, types, context) {
    const configurations = configurationsOf(module, node, types, context), row = { output: {}, input: {} };
    for (const type of types)
        for (const side of ['output', 'input']) {
            const fit = best(module, configurations, type, side, context);
            if (fit)
                row[side][type] = fit;
        }
    return row;
}
/** Whether one score comes first, compared item by item. 兩個分數逐項比，哪個在前。 */
const before = (a, b) => { for (let i = 0; i < a.length; i++)
    if (a[i] !== b[i])
        return a[i] < b[i]; return false; };
/** The node as its entry makes it, then each other type it can be set to, unless the entry fixes its type.
 * 入口原樣的節點，再加上它能設成的其他型別；入口固定型別時不換。 */
function configurationsOf(module, base, types, context) {
    const options = [{ node: base, order: -1 }];
    if (!module.configure || typeof base.params.type !== 'string' || base.params.fixedType)
        return options;
    types.forEach((type, order) => {
        if (type === base.params.type)
            return;
        try {
            options.push({ node: (0, node_module_1.configureNode)(module, base, { type }, context), configure: { type }, order });
        }
        catch ( /* not a type it takes 不接受的型別 */_a) { /* not a type it takes 不接受的型別 */ }
    });
    return options;
}
/** The best place for a wire of this type, by the module's preference, then a port of exactly the wire's type, then the
 * node as its entry makes it, then the order of types and ports. 這個型別的線最好接哪裡：模組偏好、型別完全相同的接孔、入口原樣、
 * 型別與接孔順序。 */
function best(module, options, type, side, context) {
    var _a;
    const preferred = (_a = module.preferFor) === null || _a === void 0 ? void 0 : _a.call(module, type, side);
    let found;
    for (const option of options) {
        const ports = (0, node_module_1.resolvePorts)(module, option.node, context).types();
        Object.keys(side === 'output' ? ports.inputs : ports.outputs).forEach((port, index) => {
            const portType = fits(module, option.node, port, type, side, context);
            if (portType === undefined)
                return;
            const score = [Number(!(preferred && 'type' in preferred && option.node.params.type === preferred.type)), Number(portType !== type), option.order + 1, index];
            if (!found || before(score, found.score))
                found = { fit: { port, type: portType, ...(option.configure ? { configure: option.configure } : {}) }, score };
        });
    }
    return found === null || found === void 0 ? void 0 : found.fit;
}
/** Whether a wire of this type connects to this port of a fresh node, rehearsed as the network does (the module's `wire`,
 * then the planner); the port's type once connected. 這個型別的線能不能接到全新節點的這個接孔，照網路的做法預演（模組的 `wire`，
 * 再交給規劃）；接上後接孔的型別。 */
function fits(module, node, port, type, side, context) {
    var _a, _b;
    let prepared = node;
    if (side === 'output' && module.wire) {
        try {
            prepared = (0, node_module_1.prepareNodeWire)(module, node, port, type, context).node;
        }
        catch (_c) {
            return undefined;
        }
    }
    const stored = (0, node_module_1.resolvePorts)(module, prepared, context).types();
    const created = { id: NEW, definition: node.nodeType, stored, ...(module.signatures ? { variants: module.signatures(node, context) } : {}) };
    const result = side === 'output'
        ? (0, wire_planning_1.plan)({ nodes: [{ id: WIRE, definition: WIRE, stored: { inputs: {}, outputs: { out: type } } }, created], edges: [] }, values.policy, { kind: 'wire', from: { node: WIRE, port: 'out' }, to: { node: NEW, port } })
        : (0, wire_planning_1.plan)({ nodes: [created, { id: END, definition: END, stored: { inputs: { in: type }, outputs: {} } }], edges: [] }, values.policy, { kind: 'wire', from: { node: NEW, port }, to: { node: END, port: 'in' } });
    if (!result.ok)
        return undefined;
    return side === 'output' ? (_b = (_a = result.inference.ports.get(NEW)) === null || _a === void 0 ? void 0 : _a.inputs[port]) !== null && _b !== void 0 ? _b : stored.inputs[port] : stored.outputs[port];
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
function resolve(graph, c, only, counts = () => true) {
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
        // Only the wires in effect constrain the node (Refactor.103.1). 只有接通的線限制節點（R.103.1）。
        const links = (incoming.get(n.id) || []).filter(counts);
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
/** `inEffect`: the stored wires in effect (connectivity.ts); one not in effect (a ghost wire) is kept as it is but never constrains a
 * node — it is broken between the wire and the port (Q37 1-3, Q72; Refactor.103.1, human 2026-10-12: a node with one ghost wire refused
 * every other wire). Without it every wire counts. inEffect：接通的線（connectivity.ts）；沒接通的（Ghost 線）原樣保留，但從不限制節點——
 * 它斷在線和接孔之間（Q37 1-3、Q72；R.103.1，人類 10-12：節點上有一條 Ghost 線，其他線都接不上）。沒給就每條都算。 */
function plan(graph, c, intent, inEffect) {
    var _a, _b;
    let candidate = graph, displaced = [], fresh;
    if (intent.kind === 'wire') {
        const source = graph.nodes.find(n => n.id === intent.from.node), target = graph.nodes.find(n => n.id === intent.to.node);
        if (!(source === null || source === void 0 ? void 0 : source.stored.outputs[intent.from.port]) || !(target === null || target === void 0 ? void 0 : target.stored.inputs[intent.to.port]))
            return { ok: false, diagnostic: { code: 'missing-port' } };
        displaced = graph.edges.filter(e => e.to[0] === intent.to.node && e.to[1] === intent.to.port);
        fresh = { from: [intent.from.node, intent.from.port], to: [intent.to.node, intent.to.port] };
        candidate = { nodes: graph.nodes, edges: [...graph.edges.filter(e => !displaced.includes(e)), fresh] };
    }
    const counts = (e) => !inEffect || inEffect.has(e) || e === fresh;
    const inference = resolve(candidate, c, intent.kind === 'wire' ? [intent.to.node] : intent.nodes, counts);
    if ('code' in inference)
        return { ok: false, diagnostic: inference };
    if (intent.kind === 'wire') {
        const issue = inference.issues.get(intent.to.node);
        if (issue)
            return { ok: false, diagnostic: issue };
        // Other nodes' interfaces never change. Validate only the target's inputs;
        // unrelated missing/incompatible draft edges remain editable.
        for (const e of candidate.edges)
            if (e.to[0] === intent.to.node && counts(e)) {
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
