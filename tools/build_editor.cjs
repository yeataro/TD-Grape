/* Assemble deployable static assets. No test catalogs or fabricated host state. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const index = process.argv.indexOf('--out');
if (index < 0 || !process.argv[index + 1]) throw Error('Usage: node tools/build_editor.cjs --out OUTPUT_FOLDER');
const out = path.resolve(process.argv[index + 1]);
const sources = path.join(root, 'src');
if (out === sources || out.startsWith(sources + path.sep) || sources.startsWith(out + path.sep)) {
  throw Error('Build output must be separate from source directories');
}
const files = new Map();
const notices = new Map();
async function main() {
  // The new editor is the only entry (Refactor.25): its page is index.html; static files come from
  // src/editor-react/static/ and the core's generated files from src/generated/, all published at the root.
  // 新編輯器是唯一入口：頁面為 index.html；靜態檔來自 static/，核心產物來自 src/generated/，都放在網址根目錄。
  const { build } = await import('vite');
  const react = await build({ configFile: false, root: path.join(root, 'src/editor-react'), base: '/', publicDir: false,
    logLevel: 'error', build: { write: false, minify: true, rolldownOptions: {
      input: path.join(root, 'src/editor-react/index.html') } } });
  for (const output of (Array.isArray(react) ? react : [react])) {
    for (const asset of output.output) {
      files.set(asset.fileName, Buffer.from(asset.type === 'chunk' ? asset.code : asset.source));
      // Ship notices for dependencies actually included in the browser bundle.
      // 只收真正打包的依賴授權；開發用 Vite／TypeScript 不放進前端。
      if (asset.type !== 'chunk') continue;
      for (const id of Object.keys(asset.modules)) {
        const folder = id.replaceAll('\\', '/').match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//)?.[1];
        if (!folder || notices.has(folder)) continue;
        const license = fs.readdirSync(folder).find(name => /^(license|copying)(\.|$)/i.test(name));
        if (!license) throw Error('Missing bundled dependency license: ' + folder);
        const pkg = JSON.parse(fs.readFileSync(path.join(folder, 'package.json')));
        notices.set(folder, pkg.name + ' ' + pkg.version + '\n' + fs.readFileSync(path.join(folder, license), 'utf8'));
      }
    }
  }
  function collect(folder, prefix = '') {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === '__pycache__' || entry.name === 'README.md') continue;
      const source = path.join(folder, entry.name), name = prefix + entry.name;
      if (entry.isDirectory()) collect(source, name + '/');
      else if (entry.isFile()) files.set(name, fs.readFileSync(source));
    }
  }
  files.set('react-third-party-notices.txt', Buffer.from([...notices.values()].sort().join('\n\n-----\n\n')));
  collect(path.join(root, 'src/editor-react/static'));
  collect(path.join(root, 'src/generated'));
  for (const name of ['remote-panel.js', 'touch-gestures.js', 'panel-size.js']) {
    files.set(name, fs.readFileSync(path.join(root, 'src/remote_panel', name)));
  }
  // One product version, in src/version.json (Refactor.25). 產品版本只有一處：src/version.json。
  const version = JSON.parse(fs.readFileSync(path.join(root, 'src/version.json'), 'utf8')).version;
  if (!version || !files.has('index.html')) throw Error('Editor version or page not found');
  const assets = Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) =>
    [name, createHash('sha256').update(data).digest('hex')]));
  const metadata = { schemaVersion: 1, version, assets };
  files.set('build-info.json', Buffer.from(JSON.stringify(metadata, null, 2) + '\n'));
  fs.mkdirSync(out, { recursive: true });
  const metadataPath = path.join(out, 'build-info.json');
  const previous = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')).assets || {} : {};
  for (const [name, data] of files) {
    const destination = path.join(out, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, data);
  }
  // Only remove files owned by the previous build, never arbitrary folder content.
  for (const name of Object.keys(previous)) {
    const destination = path.resolve(out, name);
    if (!destination.startsWith(out + path.sep)) throw Error('Invalid previous asset path');
    if (!files.has(name) && fs.existsSync(destination)) fs.unlinkSync(destination);
  }
  console.log(JSON.stringify({ output: out, version, files: files.size }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
