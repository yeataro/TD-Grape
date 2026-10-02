/* Shared, state-independent RGB/RGBA editor.
 * GrapeColorPicker.open({ anchor, value, live=false, onPreview, onCommit,
 *   onFinish, isValid=()=>true, translate, labels }) returns { close, dispose }.
 * `value` is copied; it must contain exactly 3 or 4 finite numbers. RGB/alpha
 * remain exact, including HDR values, until explicitly edited. Display-only
 * clamping/rounding never changes the draft. No callback occurs on opening.
 * Non-live: Apply calls onCommit(copy) once if changed; outside/X/Escape cancel.
 * Live: effective edits call onPreview(copy); outside accepts, X/Escape cancel.
 * onFinish(accepted) always runs once, including invalidation, for adapter cleanup.
 * The live adapter owns restoration of the opening value on onFinish(false),
 * coalescing, permission checks, and history. The picker never writes host state.
 * close(accepted=false) follows these rules; dispose() is close(false). Opening
 * another picker cancels the previous one. Enter normalizes the focused input,
 * never applies. Invalid non-live drafts cannot be applied. Palette saves are
 * shared in-memory session state, independent of accepting/cancelling a color.
 * `labels` may override full color.picker.* keys; translate(key) is optional.
 */
(function (global) {
  'use strict';
  const PRESETS = [
    '#FF0000','#FF8B00','#E9FF00','#5DFF00','#00FF2D','#00FFB9','#00BBFF','#002FFF','#5B00FF','#E700FF','#FF008D',
    '#FF7F80','#FFC57F','#F4FF7F','#AEFF7F','#7FFF96','#7FFFDC','#7FDDFF','#7F97FF','#AD7FFF','#F37FFF','#FF7FC6',
    '#7F0000','#7F4500','#747F00','#2E7F00','#007F16','#007F5C','#005D7F','#00177F','#2D007F','#73007F','#7F0046',
    '#000000','#191919','#333333','#4C4C4C','#666666','#7F7F7F','#999999','#B2B2B2','#CCCCCC','#E5E5E5','#FFFFFF'
  ];
  const TEXT = {
    title: 'Color', apply: 'Apply', cancel: 'Cancel', views: 'Color controls',
    swatches: 'Color swatches', plane: 'Color plane', eyedropper: 'Pick a screen color',
    eyedropperUnavailable: 'Screen color picking is unavailable in this browser.',
    eyedropperFailed: 'Screen color picking could not be completed.',
    eyedropperPending: 'Choose a screen color; Escape cancels screen picking.',
    shapes: 'Color plane shape', square: 'Saturation and value square',
    circle: 'Hue and saturation circle', triangle: 'Saturation and value triangle',
    planeSV: 'Saturation and value; left/right adjusts saturation, up/down adjusts value',
    planeHS: 'Hue and saturation; left/right adjusts hue, up/down adjusts saturation',
    preview: 'Current color', save: 'Save current color to session swatches',
    saved: 'Session swatches', empty: 'Empty session swatch', preset: 'Color swatch',
    hexRGB: 'RGB hexadecimal color: six digits',
    hexRGBA: 'RGBA hexadecimal color: six digits preserves alpha; eight digits includes alpha',
    hsv: 'Hue, saturation and value', rgb: 'Red, green and blue',
    h: 'Hue, 0 to 360 degrees', s: 'Saturation, 0 to 1', v: 'Value, 0 to 1',
    r: 'Red', g: 'Green', b: 'Blue', a: 'Alpha, 0 to 1',
    invalid: 'Correct the value, or press Escape to cancel this color edit.',
    savedNotice: 'Color saved to session swatches'
  };
  const PATHS = {
    swatches: '<path d="M3 3h7v18H3zM10 6l6-3 7 16-6 3M10 12h10M3 8h7M3 13h7M3 18h7"/>',
    plane: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7c-.7-.4-.4-1.5.4-1.5H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3Z"/><circle cx="7.5" cy="10" r=".7"/><circle cx="11" cy="7" r=".7"/><circle cx="15.5" cy="8" r=".7"/>',
    eyedropper: '<path d="m15 5 4 4M14 6l4 4M13 7 4 16l-1 5 5-1 9-9M14 6l3-3a2.8 2.8 0 0 1 4 4l-3 3M4 16l4 4"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="1"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    triangle: '<path d="M12 3 22 21H2Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
  const equal = (a, b) => a.length === b.length && a.every((n, i) => Object.is(n, b[i]));
  const hexOf = value => '#' + value.map(n => Math.round(clamp(n) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  const rgbOfHex = text => text.replace(/^#/, '').match(/../g).map(n => parseInt(n, 16) / 255);
  const cssColor = value => `rgba(${value.slice(0, 3).map(n => clamp(n) * 255).join(',')},${clamp(value.length === 4 ? value[3] : 1)})`;
  function hsvRGB(h, s, v) {
    h = ((h % 360) + 360) % 360 / 60;
    const c = v * s, x = c * (1 - Math.abs(h % 2 - 1)), m = v - c;
    return (h < 1 ? [c,x,0] : h < 2 ? [x,c,0] : h < 3 ? [0,c,x] : h < 4 ? [0,x,c] : h < 5 ? [x,0,c] : [c,0,x]).map(n => n + m);
  }
  function presentedHSV(value, previous) {
    const [r,g,b] = value.slice(0, 3).map(n => clamp(n));
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = previous.h;
    if (d > 1e-12) h = (((max === r ? (g-b)/d : max === g ? (b-r)/d+2 : (r-g)/d+4) * 60) + 360) % 360;
    return { h, s: max === 0 ? previous.s : d / max, v: max };
  }
  let current = null;
  let saved = [];
  function open(options) {
    const { anchor, live = false } = options || {};
    if (!anchor || !anchor.ownerDocument) throw new TypeError('Color picker requires an anchor element.');
    const initial = options.value;
    if (!Array.isArray(initial) || ![3,4].includes(initial.length) || !initial.every(n => typeof n === 'number' && Number.isFinite(n))) {
      throw new TypeError('Color picker value must be exactly three or four finite numbers.');
    }
    if (current) current.dispose();
    const doc = anchor.ownerDocument, win = doc.defaultView;
    const lifecycle = new win.AbortController();
    const basis = initial.slice(), rgba = basis.length === 4;
    let value = basis.slice(), hsv = presentedHSV(value, { h: 0, s: 0, v: 0 });
    let closed = false, invalid = null, shape = 'square', planeOpen = false;
    let eyeController = null, eyeSerial = 0, drag = null, observer = null, resizeObserver = null;
    let cachedPixels = null, cachedPlane = '', width = 0, height = 0, geometry = null;
    const label = key => {
      const full = 'color.picker.' + key;
      const custom = options.labels && (options.labels[full] || options.labels[key]);
      if (custom) return String(custom);
      const translated = typeof options.translate === 'function' ? options.translate(full) : null;
      return translated && translated !== full ? String(translated) : TEXT[key] || key;
    };
    const el = (tag, className, text) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const listen = (node, event, handler, extra) => node.addEventListener(event, handler, { ...extra, signal: lifecycle.signal });
    const iconButton = (name, labelKey, className) => {
      const button = el('button', 'gcp-icon ' + (className || ''));
      button.type = 'button'; button.title = label(labelKey); button.setAttribute('aria-label', label(labelKey));
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + PATHS[name] + '</svg>';
      return button;
    };
    const root = el('div', 'grape-color-picker');
    root.dataset.colorPicker = ''; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', label('title'));
    root.tabIndex = -1;
    const header = el('div', 'gcp-header'), title = el('span', 'gcp-title', label('title'));
    const tools = el('div', 'gcp-header-tools'), actions = el('div', 'gcp-header-actions');
    tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', label('views'));
    const swatchesButton = iconButton('swatches', 'swatches', 'gcp-view-button'); swatchesButton.dataset.view = 'swatches';
    const planeButton = iconButton('plane', 'plane', 'gcp-view-button'); planeButton.dataset.view = 'plane';
    const eyeButton = iconButton('eyedropper', 'eyedropper', 'gcp-eyedropper');
    const apply = el('button', 'gcp-apply', label('apply')); apply.type = 'button'; apply.hidden = live; apply.dataset.action = 'apply';
    const cancel = iconButton('close', 'cancel', 'gcp-close'); cancel.dataset.action = 'cancel';
    tools.append(swatchesButton, planeButton, eyeButton); actions.append(apply, cancel); header.append(title, tools, actions);
    const topRegion = el('div', 'gcp-top-region'), top = el('div', 'gcp-top');
    const checker = el('div', 'gcp-preview-checker'), preview = el('div', 'gcp-preview'); preview.setAttribute('role', 'img');
    const add = iconButton('plus', 'save', 'gcp-add'); add.dataset.action = 'save';
    checker.append(preview, add);
    const paletteWrap = el('div', 'gcp-palette'), palette = el('div', 'gcp-swatches');
    palette.setAttribute('role', 'group'); palette.setAttribute('aria-label', label('swatches')); paletteWrap.append(palette); top.append(checker, paletteWrap);
    const plane = el('div', 'gcp-plane'), shapes = el('div', 'gcp-shapes'), surface = el('button', 'gcp-surface');
    shapes.setAttribute('role', 'group'); shapes.setAttribute('aria-label', label('shapes')); surface.type = 'button';
    const shapeButtons = ['square','circle','triangle'].map(name => {
      const button = iconButton(name, name); button.dataset.shape = name; shapes.append(button); return button;
    });
    const canvas = el('canvas'); surface.append(canvas); plane.append(shapes, surface); topRegion.append(top, plane);
    const context = canvas.getContext('2d');
    const hexRow = el('div', 'gcp-hex-row'), hexControl = el('label', 'gcp-hex-control'), hex = el('input', 'gcp-hex');
    hex.type = 'text'; hex.spellcheck = false; hex.autocomplete = 'off'; hex.dataset.channel = 'hex';
    hex.setAttribute('aria-label', label(rgba ? 'hexRGBA' : 'hexRGB')); hex.title = rgba ? '#RRGGBB / #RRGGBBAA' : '#RRGGBB';
    hexControl.append(el('span', '', 'HEX'), hex);
    const savedWrap = el('div', 'gcp-saved'); savedWrap.setAttribute('role', 'group'); savedWrap.setAttribute('aria-label', label('saved'));
    hexRow.append(hexControl, savedWrap);
    const hsvRows = el('div', 'gcp-channels gcp-hsv'), rgbRows = el('div', 'gcp-channels gcp-rgb'), alphaRow = el('div', 'gcp-alpha-row');
    hsvRows.setAttribute('role', 'group'); hsvRows.setAttribute('aria-label', label('hsv')); rgbRows.setAttribute('role', 'group'); rgbRows.setAttribute('aria-label', label('rgb'));
    const channels = (rgba ? ['h','s','v','r','g','b','a'] : ['h','s','v','r','g','b']).map(name => {
      const row = el('label', 'gcp-channel'), range = el('input'), number = el('input');
      range.type = 'range'; number.type = 'number';
      range.min = '0'; range.max = name === 'h' ? '360' : '1'; range.step = name === 'h' ? '.1' : '.001';
      number.step = 'any';
      if (!['r','g','b'].includes(name)) { number.min = '0'; number.max = range.max; }
      for (const input of [range, number]) { input.dataset.channel = name; input.setAttribute('aria-label', label(name)); }
      row.append(el('span', '', name.toUpperCase()), range, number);
      (['h','s','v'].includes(name) ? hsvRows : name === 'a' ? alphaRow : rgbRows).append(row);
      return { name, range, number };
    });
    const notice = el('div', 'gcp-notice'), status = el('span', 'gcp-sr gcp-status');
    notice.hidden = true; notice.setAttribute('role', 'status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    root.append(header, topRegion, hexRow, hsvRows, rgbRows);
    if (rgba) root.append(alphaRow);
    root.append(notice, status);
    const dialog = anchor.closest('dialog[open]');
    (dialog || doc.body).append(root);
    const isLive = () => {
      if (closed || !anchor.isConnected || !root.isConnected || (dialog && !dialog.open)) return false;
      try { return typeof options.isValid !== 'function' || options.isValid() !== false; } catch (_) { return false; }
    };
    const handle = {
      close(accepted = false) { return finish(Boolean(accepted)); },
      dispose() { return finish(false); }
    };
    current = handle;
    function finish(accepted, focusAnchor = false) {
      if (closed) return false;
      const valid = isLive();
      if (accepted && !live && invalid && valid) { invalid.focus(); return false; }
      accepted = accepted && valid;
      closed = true;
      eyeSerial++;
      if (eyeController) eyeController.abort();
      lifecycle.abort();
      if (observer) observer.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      if (drag && surface.hasPointerCapture(drag.id)) surface.releasePointerCapture(drag.id);
      drag = null;
      root.remove();
      if (current === handle) current = null;
      if (focusAnchor && anchor.isConnected) anchor.focus({ preventScroll: true });
      try {
        if (accepted && !live && !equal(value, basis) && typeof options.onCommit === 'function') options.onCommit(value.slice());
      } finally {
        if (typeof options.onFinish === 'function') options.onFinish(accepted);
      }
      return true;
    }
    function active() {
      if (isLive()) return true;
      if (!closed) finish(false);
      return false;
    }
    function setDraft(next, preserve, keepHSV = false) {
      if (!active()) return;
      const changed = !equal(next, value);
      value = next.slice();
      if (!keepHSV) hsv = presentedHSV(value, hsv);
      render(preserve);
      if (changed && live && active() && typeof options.onPreview === 'function') options.onPreview(value.slice());
    }
    function setRGB(rgb, preserve, explicitAlpha, keepHSV) {
      const next = rgb.slice(0, 3);
      if (rgba) next.push(explicitAlpha === undefined ? value[3] : explicitAlpha);
      setDraft(next, preserve, keepHSV);
    }
    function fromHex(text, preserve) {
      const parts = rgbOfHex(text);
      setRGB(parts, preserve, rgba && parts.length === 4 ? parts[3] : undefined);
    }
    function channelValue(name) { return name in hsv ? hsv[name] : value[{r:0,g:1,b:2,a:3}[name]]; }
    function announce(message) { status.textContent = message || ((rgba ? 'RGBA ' : 'RGB ') + hexOf(value)); }
    function updateEnabled() {
      const busy = !!eyeController;
      root.querySelectorAll('input').forEach(input => { input.disabled = busy || (!!invalid && input !== invalid); });
      root.querySelectorAll('button').forEach(button => {
        button.disabled = button !== cancel && (busy || !!invalid || button.classList.contains('gcp-empty'));
      });
      if (typeof win.EyeDropper !== 'function') {
        eyeButton.disabled = true; eyeButton.title = label('eyedropperUnavailable'); eyeButton.setAttribute('aria-label', label('eyedropperUnavailable'));
      }
    }
    function validation(input, valid) {
      if (valid) { input.removeAttribute('aria-invalid'); if (invalid === input) invalid = null; }
      else { invalid = input; input.setAttribute('aria-invalid', 'true'); announce(label('invalid')); }
      updateEnabled();
    }
    function makeSwatch(color, container, isSaved) {
      const button = el('button', 'gcp-swatch'); button.type = 'button';
      button.dataset.swatch = isSaved ? 'saved' : 'preset'; button.title = hexOf(color);
      button.setAttribute('aria-label', label('preset') + ' ' + hexOf(color));
      button.style.setProperty('--gcp-swatch', cssColor(color)); button.append(el('span'));
      button._gcpValue = color;
      listen(button, 'click', () => { if (!invalid && !eyeController && active()) { setRGB(color, null, rgba && color.length === 4 ? color[3] : undefined); announce(); } });
      container.append(button);
    }
    function renderSaved() {
      savedWrap.replaceChildren();
      saved.forEach(color => makeSwatch(color, savedWrap, true));
      for (let i = saved.length; i < 6; i++) {
        const empty = el('button', 'gcp-swatch gcp-empty'); empty.type = 'button'; empty.disabled = true; empty.title = label('empty'); empty.setAttribute('aria-label', label('empty')); savedWrap.append(empty);
      }
    }
    function render(preserve) {
      if (closed) return;
      plane.hidden = !planeOpen; top.hidden = planeOpen;
      swatchesButton.setAttribute('aria-pressed', String(!planeOpen)); planeButton.setAttribute('aria-pressed', String(planeOpen));
      preview.style.background = cssColor(value); preview.setAttribute('aria-label', label('preview') + ' ' + hexOf(value));
      if (hex !== preserve) hex.value = hexOf(value);
      shapeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.shape === shape)));
      channels.forEach(({name,range,number}) => {
        const n = channelValue(name);
        if (range !== preserve) range.value = String(clamp(n, 0, name === 'h' ? 360 : 1));
        if (number !== preserve) number.value = String(n);
      });
      const rgb = value.slice(0,3).map(n => clamp(n));
      channels[0].range.style.background = 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)';
      channels[1].range.style.background = `linear-gradient(90deg,${cssColor(hsvRGB(hsv.h,0,hsv.v))},${cssColor(hsvRGB(hsv.h,1,hsv.v))})`;
      channels[2].range.style.background = `linear-gradient(90deg,#000,${cssColor(hsvRGB(hsv.h,hsv.s,1))})`;
      for (let i=0; i<3; i++) {
        const a=rgb.slice(), b=rgb.slice(); a[i]=0; b[i]=1;
        channels[i+3].range.style.background = `linear-gradient(90deg,${cssColor(a)},${cssColor(b)})`;
      }
      if (rgba) channels[6].range.style.background = `linear-gradient(90deg,${cssColor([...rgb,0])},${cssColor(rgb)}),repeating-conic-gradient(#74717b 0% 25%,#45424c 0% 50%) 0/8px 8px`;
      root.querySelectorAll('.gcp-swatch').forEach(button => {
        const color = button._gcpValue;
        if (color) button.setAttribute('aria-pressed', String(color.every((n,i) => value[i] === n)));
      });
      surface.setAttribute('aria-label', label(shape === 'circle' ? 'planeHS' : 'planeSV'));
      draw(); updateEnabled();
    }
    function position() {
      if (!active()) return;
      const bounds = anchor.getBoundingClientRect();
      root.style.left = '0px'; root.style.top = '0px';
      const measured = root.getBoundingClientRect();
      const scaleX = measured.width / (root.offsetWidth || measured.width) || 1;
      const scaleY = measured.height / (root.offsetHeight || measured.height) || 1;
      const viewportWidth = doc.documentElement.clientWidth || win.innerWidth;
      const viewportHeight = win.innerHeight;
      const left = clamp(bounds.left, 8, Math.max(8, viewportWidth - measured.width - 8));
      const below = bounds.bottom + 6;
      const topPosition = below + measured.height <= viewportHeight - 8 ? below : Math.max(8, bounds.top - measured.height - 6);
      root.style.left = (left - measured.left) / scaleX + 'px';
      root.style.top = (topPosition - measured.top) / scaleY + 'px';
    }
    function getGeometry() {
      const th = Math.max(1, Math.min(height - 24, (width - 24) * Math.sqrt(3) / 2));
      const topY = (height - th) / 2, bottom = topY + th;
      return { A:{x:width/2,y:topY}, B:{x:width/2-th/Math.sqrt(3),y:bottom}, C:{x:width/2+th/Math.sqrt(3),y:bottom}, radius:Math.max(1,Math.min(width,height)/2-10) };
    }
    function bary(x,y) {
      const {A,B,C} = geometry;
      const a = (B.y-y)/(B.y-A.y), c = (x-A.x*a-B.x*(1-a))/(C.x-B.x);
      return [a,1-a-c,c];
    }
    function draw() {
      if (!planeOpen || !context || closed) return;
      const bounds = surface.getBoundingClientRect(), ratio = Math.min(2,win.devicePixelRatio || 1);
      const w = Math.max(1,Math.round(bounds.width*ratio)), h = Math.max(1,Math.round(bounds.height*ratio));
      if (w !== width || h !== height) { width=w; height=h; canvas.width=w; canvas.height=h; geometry=getGeometry(); cachedPlane=''; }
      const key = [shape,width,height,shape === 'circle' ? hsv.v : hsv.h].join(':');
      if (key !== cachedPlane) {
        const pixels = context.createImageData(width,height), data=pixels.data, pure=hsvRGB(hsv.h,1,1);
        for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
          let rgb, inside=true;
          if (shape === 'square') rgb=hsvRGB(hsv.h,x/Math.max(1,width-1),1-y/Math.max(1,height-1));
          else if (shape === 'circle') {
            const dx=x-width/2,dy=y-height/2,r=Math.hypot(dx,dy)/geometry.radius;
            inside=r<=1; rgb=hsvRGB((Math.atan2(dy,dx)*180/Math.PI+360)%360,clamp(r),hsv.v);
          } else { const weights=bary(x,y); inside=weights.every(n=>n>=0); rgb=pure.map(n=>weights[0]*n+weights[2]); }
          if (inside) { const i=(y*width+x)*4; data[i]=clamp(rgb[0])*255; data[i+1]=clamp(rgb[1])*255; data[i+2]=clamp(rgb[2])*255; data[i+3]=255; }
        }
        cachedPixels=pixels; cachedPlane=key;
      }
      context.putImageData(cachedPixels,0,0);
      let x,y;
      if (shape === 'square') { x=hsv.s*(width-1); y=(1-hsv.v)*(height-1); }
      else if (shape === 'circle') { x=width/2+Math.cos(hsv.h*Math.PI/180)*hsv.s*geometry.radius; y=height/2+Math.sin(hsv.h*Math.PI/180)*hsv.s*geometry.radius; }
      else { const a=hsv.v*hsv.s,b=1-hsv.v,c=hsv.v*(1-hsv.s),{A,B,C}=geometry; x=a*A.x+b*B.x+c*C.x; y=a*A.y+b*B.y+c*C.y; }
      const marker=3.5*ratio;
      context.beginPath(); context.arc(clamp(x,marker,width-marker),clamp(y,marker,height-marker),marker,0,Math.PI*2);
      context.strokeStyle='#16121b'; context.lineWidth=2.5*ratio; context.stroke(); context.strokeStyle='#f9f4ff'; context.lineWidth=1.25*ratio; context.stroke();
    }
    function choosePoint(event, initialPoint) {
      if (!active() || !geometry) return false;
      const rect=surface.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*width,y=(event.clientY-rect.top)/rect.height*height;
      if (shape === 'square') { hsv.s=clamp(x/Math.max(1,width-1)); hsv.v=clamp(1-y/Math.max(1,height-1)); }
      else if (shape === 'circle') {
        const dx=x-width/2,dy=y-height/2,d=Math.hypot(dx,dy)/geometry.radius;
        if (initialPoint && d>1) return false;
        if (d>1e-6) hsv.h=(Math.atan2(dy,dx)*180/Math.PI+360)%360;
        hsv.s=clamp(d);
      } else {
        let weights=bary(x,y); if (initialPoint && weights.some(n=>n<0)) return false;
        weights=weights.map(n=>Math.max(0,n)); const sum=weights.reduce((a,b)=>a+b,0); weights=weights.map(n=>n/sum);
        hsv.v=weights[0]+weights[2]; if (hsv.v>0) hsv.s=weights[0]/hsv.v;
      }
      setRGB(hsvRGB(hsv.h,hsv.s,hsv.v),null,undefined,true); return true;
    }
    function endDrag(revert) {
      if (!drag) return;
      const previous=drag; drag=null;
      if (surface.hasPointerCapture(previous.id)) surface.releasePointerCapture(previous.id);
      if (revert) { hsv={...previous.hsv}; setDraft(previous.value,null,true); }
      announce();
    }
    channels.forEach(({name,range,number}) => {
      for (const input of [range,number]) {
        listen(input,'input',()=>{
          if (!active() || (invalid && invalid !== input) || eyeController) return;
          const n=Number(input.value), bounded=!['r','g','b'].includes(name), max=name==='h'?360:1;
          const valid=input.value.trim()!=='' && Number.isFinite(n) && (!bounded || (n>=0 && n<=max));
          validation(input,valid); if (!valid) return;
          if (name in hsv) { hsv[name]=n; setRGB(hsvRGB(hsv.h,hsv.s,hsv.v),input,undefined,true); }
          else { const next=value.slice(); next[{r:0,g:1,b:2,a:3}[name]]=n; setDraft(next,input); }
        });
        listen(input,'change',()=>{ if (!invalid && active()) { render(); announce(); } });
        listen(input,'blur',()=>{ if (!invalid && active()) render(); });
      }
    });
    listen(hex,'input',()=>{
      if (!active() || (invalid && invalid !== hex) || eyeController) return;
      const pattern=rgba?/^#?[\da-f]{6}([\da-f]{2})?$/i:/^#?[\da-f]{6}$/i;
      const valid=pattern.test(hex.value); validation(hex,valid); if (valid) fromHex(hex.value,hex);
    });
    listen(hex,'blur',()=>{ if (!invalid && active()) { render(); announce(); } });
    listen(root,'keydown',event=>{
      event.stopPropagation();
      if (event.key==='Escape') { event.preventDefault(); event.stopPropagation(); finish(false,true); return; }
      if (event.key==='Enter' && event.target.tagName==='INPUT') { event.preventDefault(); event.stopPropagation(); if (!invalid) { render(); announce(); } return; }
      if (event.key==='Tab') {
        const focusable=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(node=>node.getClientRects().length);
        const first=focusable[0], last=focusable[focusable.length-1];
        if (!first) { event.preventDefault(); root.focus(); }
        else if (event.shiftKey && (doc.activeElement===first || doc.activeElement===root)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (doc.activeElement===last || doc.activeElement===root)) { event.preventDefault(); first.focus(); }
      }
    });
    shapeButtons.forEach(button=>listen(button,'click',()=>{ if (active() && !invalid && !eyeController) { endDrag(true); shape=button.dataset.shape; render(); announce(); } }));
    for (const button of [swatchesButton,planeButton]) listen(button,'click',()=>{ if (active() && !invalid && !eyeController) { endDrag(true); planeOpen=button===planeButton; render(); position(); announce(); } });
    listen(surface,'pointerdown',event=>{
      if (!active() || invalid || eyeController || !planeOpen || event.button!==0 || drag) return;
      const previous={id:event.pointerId,value:value.slice(),hsv:{...hsv}};
      if (!choosePoint(event,true)) return;
      if (closed) return;
      event.preventDefault(); surface.focus(); drag=previous; surface.setPointerCapture(event.pointerId);
    });
    listen(surface,'pointermove',event=>{ if (drag && drag.id===event.pointerId && !invalid) choosePoint(event,false); });
    listen(surface,'pointerup',event=>{ if (drag && drag.id===event.pointerId) { choosePoint(event,false); endDrag(false); } });
    for (const name of ['pointercancel','lostpointercapture']) listen(surface,name,event=>{ if (drag && drag.id===event.pointerId) endDrag(true); });
    listen(surface,'keydown',event=>{
      if (!active() || invalid || eyeController || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const dx=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0,dy=event.key==='ArrowUp'?1:event.key==='ArrowDown'?-1:0;
      if (shape==='circle') { hsv.h=(hsv.h+dx*2+360)%360; hsv.s=clamp(hsv.s+dy*.01); }
      else { hsv.s=clamp(hsv.s+dx*.01); hsv.v=clamp(hsv.v+dy*.01); }
      setRGB(hsvRGB(hsv.h,hsv.s,hsv.v),null,undefined,true); announce();
    });
    listen(add,'click',()=>{
      if (!active() || invalid || eyeController) return;
      saved=[value.slice(),...saved.filter(color=>!equal(color,value))].slice(0,6);
      renderSaved(); render(); announce(label('savedNotice')+' '+hexOf(value));
    });
    listen(apply,'click',()=>finish(true,true));
    listen(cancel,'click',()=>finish(false,true));
    listen(eyeButton,'click',async()=>{
      if (!active() || invalid || eyeController || typeof win.EyeDropper!=='function') return;
      const controller=new win.AbortController(), serial=++eyeSerial; eyeController=controller;
      notice.textContent=label('eyedropperPending'); notice.hidden=false; updateEnabled();
      try {
        const result=await new win.EyeDropper().open({signal:controller.signal});
        if (closed || serial!==eyeSerial || controller.signal.aborted || !active()) return;
        eyeController=null; notice.hidden=true;
        if (!result || !/^#[\da-f]{6}$/i.test(result.sRGBHex)) throw new Error('Invalid screen color');
        fromHex(result.sRGBHex); announce();
      } catch (error) {
        if (closed || serial!==eyeSerial || !active()) return;
        if (error && error.name==='AbortError') notice.hidden=true;
        else { notice.textContent=label('eyedropperFailed'); notice.hidden=false; }
      } finally {
        if (!closed && serial===eyeSerial) { eyeController=null; updateEnabled(); if (active()) eyeButton.focus({preventScroll:true}); }
      }
    });
    listen(doc,'pointerdown',event=>{
      if (closed || root.contains(event.target) || anchor.contains(event.target)) return;
      finish(live);
    },{capture:true});
    listen(win,'resize',()=>{ if (active()) { position(); draw(); } });
    listen(doc,'scroll',event=>{ if (!root.contains(event.target)) position(); },{capture:true});
    if (dialog) listen(dialog,'close',()=>finish(false));
    if (typeof win.MutationObserver==='function') {
      observer=new win.MutationObserver(()=>{ if (!closed && !isLive()) finish(false); });
      observer.observe(doc.documentElement,{childList:true,subtree:true});
      if (dialog) observer.observe(dialog,{attributes:true,attributeFilter:['open']});
    }
    if (typeof win.ResizeObserver==='function') {
      resizeObserver=new win.ResizeObserver(()=>{ if (active()) { draw(); position(); } });
      resizeObserver.observe(root); resizeObserver.observe(surface);
    }
    PRESETS.forEach(color=>makeSwatch(rgbOfHex(color),palette,false));
    renderSaved(); render();
    if (active()) { position(); root.focus({preventScroll:true}); }
    return handle;
  }
  global.GrapeColorPicker = Object.freeze({ open });
})(typeof window === 'undefined' ? globalThis : window);
