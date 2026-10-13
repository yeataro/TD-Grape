/* A fake host for browser checks (Refactor.108; shared by benchmark_scaling.cjs and check_touch.cjs): serves an editor build and
 * answers the host API from memory — one graph, accepted as it is sent, no TD, no GPU. 瀏覽器檢查用的假宿主（R.108；benchmark_scaling.cjs
 * 與 check_touch.cjs 共用）：提供編輯器建置、在記憶體裡回答宿主 API——一張圖、送來就收下、沒有 TD、沒有 GPU。 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');

const TARGET = '2'.repeat(32);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/** Serve `built` with `graph` as the host's document. 用 graph 當宿主的文件，提供 built。 */
async function serve(built, graph, target = TARGET) {
  built = path.resolve(built);
  const bootstrap = JSON.parse(fs.readFileSync(path.join(built, 'editor-bootstrap.json')));
  let state = { graph, revision: 1 };
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/')) {
        const action = req.url.split('?')[0].split('/').at(-1); let raw = ''; for await (const chunk of req) raw += chunk;
        const body = raw && JSON.parse(raw); res.setHeader('Content-Type', 'application/json');
        const wire = { document: JSON.stringify(state.graph), revision: state.revision, targetId: target };
        if (action === 'state') return res.end(JSON.stringify({ state: wire, format: 'grape-next-1', target: '/test/fake', shaderKind: 'top',
          frontendCompiler: { protocol: 'grape.top.ts.1', catalogHash: bootstrap.catalogHash, required: true } }));
        if (action === 'save') return res.end(JSON.stringify({ saved: 'fake.toe' }));
        if (action === 'identity') return res.end(JSON.stringify({ targetId: target }));
        if (req.method === 'GET' || !raw) return res.end('{}');
        if (!body || body.revision !== state.revision) { res.statusCode = 409; return res.end(JSON.stringify({ error: 'Conflict' })); }
        state = { graph: JSON.parse(body.document), revision: state.revision + 1 };
        return res.end(JSON.stringify({ state: { document: body.document, revision: state.revision, targetId: target } }));
      }
      const asked = decodeURIComponent(req.url.split('?')[0]);
      const name = asked === '/' || /^\/shader\/[a-f0-9]{32}\/$/.test(asked) ? '/index.html' : asked;
      const file = path.resolve(built, '.' + name);
      if (!file.startsWith(built + path.sep)) throw Error('outside build');
      res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
      res.end(fs.readFileSync(file));
    } catch (e) { res.statusCode = 404; res.end(String(e)); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/shader/${target}/`, bootstrap, target,
    /** The next page opens on this graph. 下一個頁面開在這張圖上。 */
    setGraph: next => { state = { graph: next, revision: 1 }; },
    close: () => server.close(),
  };
}

module.exports = { serve, TARGET };
