# Vendored browser dependencies

## qrcode-generator 2.0.4

- Author: Kazuhiko Arase.
- License: MIT; the complete notice is in `qrcode-LICENSE.txt` and appended to the
  browser asset so embedded copies also retain it.
- Browser asset: `../qrcode.js`; no runtime packages, CDN, remote QR service, or
  network requests are required to encode a URL.
- Official repository: https://github.com/kazuhikoarase/qrcode-generator
- Pinned release: `js2.0.4`.
- Pinned commit: `83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8`.
- Upstream source: https://github.com/kazuhikoarase/qrcode-generator/blob/83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8/js/dist/qrcode.js
- Upstream license: https://github.com/kazuhikoarase/qrcode-generator/blob/83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8/LICENSE
- Upstream source SHA-256: `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c`.
- Distributed asset SHA-256: `bb28d975a4ac4196a156330d7147c6ba3b55717a7e38fbc82db27d9c8c631238`.

The upstream JavaScript is unchanged. The only addition is the complete MIT
notice as a trailing comment. Keep the original header and full notice when
updating the asset, then update the pinned commit and hashes here.

The classic browser script exposes `qrcode`. The editor supplies an ASCII URL
(including percent-encoded paths and the session-token fragment):

```js
const code = qrcode(0, 'M'); // Automatic version, medium error correction.
code.addData(url, 'Byte');
code.make();
const size = code.getModuleCount();
const dark = code.isDark(row, column);
```

`getModuleCount()` excludes the quiet zone. Render at least four white modules
around the matrix. Do not pass unescaped Unicode text to the default byte
encoder; normalized browser URL strings are ASCII. The upstream UTF-8 converter
is available as `qrcode.stringToBytesFuncs['UTF-8']` if a future use requires it.

### Offline round-trip verification

`tests/browser/test_qrcode_roundtrip.cjs` loads the asset as a classic script in
an offline Chromium page, then independently decodes generated pixels with
[jsQR](https://github.com/cozmo/jsQR) 1.4.0. jsQR is a test-only dependency and is
not included in the editor or TOE. Pass its installed `dist/jsQR.js` path:

```text
node tests/browser/test_qrcode_roundtrip.cjs src/editor/qrcode.js <jsQR.js> <report-directory>
```

Use the same `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` settings as the other
browser checks. Test URLs contain synthetic tokens only. The checks cover long
URL paths, percent escapes, fragments, automatic QR versions and rotation.
