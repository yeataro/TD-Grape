// Prism's core alone, without the languages its main file bundles (Refactor.63: only GLSL is needed, kept light; Refactor.102 adds JSON).
// 只用 Prism 的核心，不帶主檔附的其他語言（只需要 GLSL，保持輕量；R.102 加上 JSON）。
declare module 'prismjs/components/prism-core' {
  import Prism from 'prismjs';
  export default Prism;
}
declare module 'prismjs/components/prism-clike';
declare module 'prismjs/components/prism-c';
declare module 'prismjs/components/prism-glsl';
declare module 'prismjs/components/prism-json';
