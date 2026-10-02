/* Numerical smoke test of the real staged compiler's Preview GLSL.
 * No TD bridge, editor API, network, or saved project is touched.
 * node tests/browser/test_pixel_preview_gpu.cjs [REPORT_DIR]
 * Optional: PLAYWRIGHT_MODULE, CHROME_EXECUTABLE, PYTHON_EXECUTABLE.
 * This is isolated WebGL2 evidence, not native TD/GPU qualification.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const reportDir = path.resolve(process.argv[2] || path.join(root, 'report-gpu'));

async function main() {
  fs.mkdirSync(reportDir, {recursive: true});
  let browser;
  const report = {
    scope: 'Real compiler output in isolated WebGL2, without TouchDesigner',
    passed: false, nativeTD: 'NOT_RUN',
    limitations: [
      'Software/ANGLE WebGL2 results do not qualify TD desktop GLSL, native driver behavior, or cross-platform browsers.',
      'Double types receive compiler checks only; native TD execution is required.',
      'MAT MRT probe disables finishing and supplies a no-op TDCheckDiscard; it is intended to test output routing only, not TD discard or finishing. This run did not qualify MAT MRT.',
    ],
  };
  try {
    const generated = spawnSync(process.env.PYTHON_EXECUTABLE || 'python',
      [path.join(root, 'tests/unit/pixel_preview_fixture.py')], {cwd: root, encoding: 'utf8'});
    if (generated.error || generated.status !== 0) throw new Error('Real-core fixture generation failed: ' + (generated.error || generated.stderr));
    const fixtures = JSON.parse(generated.stdout);
    fs.writeFileSync(path.join(reportDir, 'compiler-fixtures.json'), JSON.stringify(fixtures, null, 2));
    report.compilerSha256 = fixtures.compilerSha256;
    report.nativeOnlyCases = fixtures.nativeOnlyCases.map(({id, type, compilerCheck, gpuStatus, reason}) => ({id, type, compilerCheck, gpuStatus, reason}));
    browser = await playwright.chromium.launch({headless: true,
      ...(process.env.CHROME_EXECUTABLE ? {executablePath: process.env.CHROME_EXECUTABLE} : {}),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
    report.browserVersion = browser.version();
    const page = await browser.newPage();
    await page.setContent('<!doctype html><canvas width="1" height="1"></canvas>');
    const result = await page.evaluate(({webglCases, mrtCase}) => {
      const gl = document.querySelector('canvas').getContext('webgl2', {
        antialias: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true,
      });
      if (!gl) throw new Error('WebGL2 is unavailable; no GPU cases were executed.');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable; float32 output preservation cannot be qualified.');
      const environment = {
        version: gl.getParameter(gl.VERSION), shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
        renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
        maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
        framebufferFormat: 'RGBA32F', readbackFormat: 'RGBA/FLOAT', tolerance: 0.000001,
      };
      function run(test) {
        const resources = {shaders: [], program: null, framebuffer: null, textures: [], vao: null};
        const result = {id: test.id, type: test.type, passed: false};
        try {
          const mat = test.target === 'mat';
          const varying = mat ? 'sg_uv' : 'vUV';
          const vertex = '#version 300 es\nprecision highp float;\nout vec2 ' + varying + ';\n' +
            'void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); ' +
            varying + ' = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }';
          const shim = '#version 300 es\nprecision highp float;\nprecision highp int;\n' +
            (mat ? '#define TD_NUM_COLOR_BUFFERS 2\nvoid TDCheckDiscard() {}\n' : 'in vec2 vUV;\n') +
            'vec4 TDOutputSwizzle(vec4 value) { return value; }\n';
          const fragment = shim + test.pixel;
          function shader(type, source) {
            const item = gl.createShader(type); resources.shaders.push(item);
            gl.shaderSource(item, source); gl.compileShader(item);
            if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(item) + '\n' + source);
            return item;
          }
          const program = resources.program = gl.createProgram();
          gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
          gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
          gl.linkProgram(program);
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
          gl.useProgram(program);
          resources.vao = gl.createVertexArray(); gl.bindVertexArray(resources.vao);
          resources.framebuffer = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
          const attachmentCount = mat ? 2 : 1;
          const attachments = [];
          for (let index = 0; index < attachmentCount; index++) {
            const texture = gl.createTexture(); resources.textures.push(texture);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, null);
            const attachment = gl.COLOR_ATTACHMENT0 + index; attachments.push(attachment);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);
          }
          gl.drawBuffers(attachments);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete framebuffer');
          gl.disable(gl.DITHER); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.viewport(0, 0, 1, 1);
          gl.clearColor(.91, .87, .83, .79); gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          const expectations = mat ? test.expected : [test.expected];
          result.attachments = expectations.map((expected, index) => {
            gl.readBuffer(gl.COLOR_ATTACHMENT0 + index);
            const rgba = new Float32Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, rgba);
            const actual = Array.from(rgba);
            return {index, actual, expected,
              passed: actual.every((value, channel) => Number.isFinite(value) && Math.abs(value - expected[channel]) <= 0.000001)};
          });
          const error = gl.getError();
          if (error !== gl.NO_ERROR) throw new Error('GL error ' + error);
          result.passed = result.attachments.every(attachment => attachment.passed);
          result.status = result.passed ? 'PASS' : 'FAIL';
          if (!result.passed) result.error = 'Numerical RGBA mismatch (tolerance: 0.000001 per channel)';
        } catch (error) {
          result.error = String(error.stack || error);
          result.status = test.target === 'mat' && result.error.includes('array indexes for fragment outputs must be constant integral expressions')
            ? 'UNSUPPORTED_WEBGL2_DYNAMIC_FRAGMENT_OUTPUT_INDEX' : 'FAIL';
        } finally {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(null); gl.useProgram(null);
          for (const texture of resources.textures) gl.deleteTexture(texture);
          if (resources.framebuffer) gl.deleteFramebuffer(resources.framebuffer);
          if (resources.vao) gl.deleteVertexArray(resources.vao);
          if (resources.program) gl.deleteProgram(resources.program);
          for (const shader of resources.shaders) gl.deleteShader(shader);
        }
        return result;
      }
      return {environment, cases: webglCases.map(run), mrt: run(mrtCase)};
    }, fixtures);
    Object.assign(report, result);
    // A precisely identified desktop-GLSL/ESSL limitation is recorded, never counted as MRT passage.
    report.passed = result.cases.length === 16 && result.cases.every(test => test.passed) &&
      (result.mrt.passed || result.mrt.status === 'UNSUPPORTED_WEBGL2_DYNAMIC_FRAGMENT_OUTPUT_INDEX');
    report.mrtNativeStatus = result.mrt.passed ? 'NOT_RUN_WEBGL_ROUTING_ONLY' : 'NOT_RUN_REQUIRES_NATIVE_TD';
    report.counts = {webglTypesPassed: result.cases.filter(test => test.passed).length,
      webglTypesTotal: 16, mrtPassed: Number(result.mrt.passed),
      mrtUnsupportedInWebGL: Number(result.mrt.status === 'UNSUPPORTED_WEBGL2_DYNAMIC_FRAGMENT_OUTPUT_INDEX'),
      doubleCompilerChecksPassed: report.nativeOnlyCases.filter(test => test.compilerCheck === 'PASS').length,
      nativeTDTypesExecuted: 0};
  } catch (error) {
    report.error = String(error.stack || error);
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify({passed: report.passed, counts: report.counts, error: report.error,
    report: path.join(reportDir, 'results.json')}, null, 2));
  if (!report.passed) process.exitCode = 1;
}
main().catch(error => {console.error(error); process.exitCode = 1;});
