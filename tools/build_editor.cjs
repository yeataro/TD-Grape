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
function collect(folder, prefix = '') {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '__pycache__') continue;
    const source = path.join(folder, entry.name), name = prefix + entry.name;
    if (entry.isDirectory()) collect(source, name + '/');
    else if (entry.isFile()) files.set(name, fs.readFileSync(source));
  }
}
collect(path.join(root, 'src/editor'));
for (const name of ['remote-panel.js', 'touch-gestures.js', 'panel-size.js']) {
  files.set(name, fs.readFileSync(path.join(root, 'src/remote_panel', name)));
}
const version = files.get('index.html').toString('utf8').match(/class="brand-version"[^>]*>([^<]+)/)?.[1].trim();
if (!version) throw Error('Editor version not found');
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
