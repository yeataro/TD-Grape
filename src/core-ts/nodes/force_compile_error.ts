import { unaryNode } from '../node_sdk';

// Force Compile Error (Refactor.63.1, human 2026-10-10: a regular node from this cycle): its GLSL calls a function nobody
// defines, so the core lets it through and TD always refuses to compile it — for trying how a compile failure is shown
// and how to get back to the last good Shader. In the Editor category, beside Router.
// 故意讓編譯失敗：產生的 GLSL 呼叫一個沒有人定義的函式，核心放行、TD 一定編不過——用來試編譯失敗怎麼呈現、怎麼回到上一個
// 能跑的 Shader。放在 Editor 分類，和 Router 一起。
export default unaryNode({
  key: 'force_compile_error', label: 'Force Compile Error', descriptionKey: 'help.force_compile_error',
  operator: 'sg_force_compile_error', port: 'value',
  browser: { category: 'editor', source: 'editor', aliases: ['error', 'fail', 'compile error', 'test', '編譯錯誤'],
    glslName: 'sg_force_compile_error', secondaryCategories: [], categoryPath: ['editor'] },
});
