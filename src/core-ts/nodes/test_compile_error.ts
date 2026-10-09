import { unaryNode } from '../node_sdk';

// A node whose GLSL never compiles in TD, for testing how a compile failure is shown (Refactor.63, human 2026-10-10:
// "make a node that is sure to fail"). It calls a function nobody defines. Offered in the add menu only with the
// grape-test-nodes flag (editor-react/core.ts); remove before release.
// 測試用：產生的 GLSL 在 TD 一定編譯失敗（呼叫一個沒有人定義的函式），用來測編譯失敗怎麼呈現（人類：做一個必定出錯的節點）。
// 只有帶 grape-test-nodes 旗標時才出現在新增選單；發布前拿掉。
export default unaryNode({
  key: 'test_compile_error', label: 'Compile Error (test)', descriptionKey: 'help.test_compile_error',
  operator: 'sg_test_undefined_function', port: 'value',
  browser: { category: 'debug', source: 'editor', aliases: ['test', 'error', 'fail'], glslName: 'sg_test_undefined_function',
    secondaryCategories: [], categoryPath: ['debug'], testOnly: true },
});
