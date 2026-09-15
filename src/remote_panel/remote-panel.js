// Reusable browser surface. No Grape state, routing, framework, or global DOM IDs.
export class TDRemotePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;position:relative;background:#101014;overflow:hidden;min-height:160px;aspect-ratio:16/9}
      video{display:block;width:100%;height:100%;object-fit:contain;outline:none;user-select:none;-webkit-user-drag:none}
      .message{position:absolute;inset:0;display:grid;place-items:center;padding:24px;pointer-events:none;color:#c9c5d7;font:14px/1.6 system-ui;text-align:center}
      .message[hidden]{display:none}
    </style><video autoplay muted playsinline tabindex="0" aria-label="TouchDesigner remote panel"></video><div class="message">Connect to the TD panel.</div>`;
    this.video = this.shadowRoot.querySelector('video');
    this.message = this.shadowRoot.querySelector('.message');
    this.revision = 0;
    this.state = 'disconnected';
    this.lastPoint = {u: .5, v: .5};
    this.buttons = 0;
    this.onBlur = () => this.release();
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      this.video.addEventListener(type, e => this.pointer(e));
    }
    this.video.addEventListener('contextmenu', e => e.preventDefault());
    this.video.addEventListener('dragstart', e => e.preventDefault());
    this.video.addEventListener('wheel', e => {
      const point = this.point(e);
      if (!point || this.channel?.readyState !== 'open') return;
      e.preventDefault();
      const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.video.clientHeight : 1);
      this.sendMouse(point, 0, -Math.max(-10, Math.min(10, pixels / 100)));
    }, {passive: false});
    this.video.addEventListener('playing', () => { this.message.hidden = true; });
    this.video.addEventListener('resize', () => {
      this.dispatchEvent(new CustomEvent('panel-format', {
        detail: {width: this.video.videoWidth, height: this.video.videoHeight}
      }));
    });
  }

  connectedCallback() {
    window.addEventListener('blur', this.onBlur);
    if (this.hasAttribute('autoconnect')) this.connect();
  }

  disconnectedCallback() {
    window.removeEventListener('blur', this.onBlur);
    this.disconnect();
  }

  report(state, message = '') {
    this.state = state;
    if (message) { this.message.textContent = message; this.message.hidden = false; }
    this.dispatchEvent(new CustomEvent('panel-state', {detail: {state, message}}));
  }

  async connect() {
    this.disconnect(false);
    this.report('connecting', 'Connecting to TouchDesigner…');
    const base = new URL(this.getAttribute('endpoint') || '/', location.href);
    const signal = new URL('signal', base);
    signal.protocol = signal.protocol === 'https:' ? 'wss:' : 'ws:';
    const pc = this.pc = new RTCPeerConnection({iceServers: []});
    const ws = this.ws = new WebSocket(signal);
    let candidates = [];
    let incoming = Promise.resolve();
    let lastPong = Date.now();
    const current = () => this.pc === pc && this.ws === ws;
    const send = data => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
    const fail = message => {
      if (!current()) return;
      this.disconnect(false);
      this.report('error', message);
    };
    this.timeout = setTimeout(() => fail('Connection timed out. Check that TD is running and Cooking is enabled.'), 20000);
    pc.onicecandidate = e => { if (e.candidate) send({type: 'ice', candidate: e.candidate.toJSON()}); };
    pc.ontrack = e => {
      if (!current()) return;
      this.video.srcObject = e.streams[0] || new MediaStream([e.track]);
      this.video.play().catch(() => this.report('connected', 'Click the panel to play.'));
    };
    pc.ondatachannel = e => {
      if (e.channel.label !== 'control') return;
      this.channel = e.channel;
      e.channel.onopen = () => {
        if (!current()) return;
        clearTimeout(this.timeout);
        this.report('connected');
      };
    };
    pc.onconnectionstatechange = () => {
      if (!current()) return;
      if (pc.connectionState === 'failed') fail('The video connection failed. Reconnect to try again.');
      if (pc.connectionState === 'disconnected') this.report('connecting', 'Connection interrupted…');
      if (pc.connectionState === 'connected') {
        clearTimeout(this.timeout);
        this.report('connected');
      }
    };
    ws.onopen = () => {
      if (!current()) return;
      this.heartbeat = setInterval(() => {
        if (Date.now() - lastPong > 16000) {
          fail('TouchDesigner is not responding. Check Cooking, then reconnect.');
          return;
        }
        send({type: 'ping'});
      }, 5000);
    };
    ws.onmessage = e => {
      incoming = incoming.then(async () => {
        if (!current()) return;
        const message = JSON.parse(e.data);
        if (message.type === 'source') {
          this.release();
          this.revision = message.revision;
          this.video.style.transform = message.mirrorX ? 'scaleX(-1)' : '';
          this.style.aspectRatio = `${message.width} / ${message.height}`;
          this.dispatchEvent(new CustomEvent('panel-source', {detail: message}));
          if (message.error) this.report('error', message.error);
          else if (pc.connectionState === 'connected') {
            this.message.hidden = true;
            this.report('connected');
          }
        } else if (message.type === 'offer') {
          await pc.setRemoteDescription({type: 'offer', sdp: message.sdp});
          for (const ice of candidates) await pc.addIceCandidate(ice);
          candidates = [];
          await pc.setLocalDescription(await pc.createAnswer());
          if (current()) send({type: 'answer', sdp: pc.localDescription.sdp});
        } else if (message.type === 'ice') {
          if (pc.remoteDescription) await pc.addIceCandidate(message.candidate);
          else candidates.push(message.candidate);
        } else if (message.type === 'busy') {
          this.disconnect(false);
          this.report('busy', message.message);
        } else if (message.type === 'error') {
          fail(message.message);
        } else if (message.type === 'pong') {
          lastPong = Date.now();
        }
      }).catch(error => fail(error.message));
    };
    ws.onerror = () => fail('Cannot reach the TD panel service. Check its Active setting and address.');
    ws.onclose = () => {
      if (!current()) return;
      this.disconnect(false);
      this.report('disconnected', 'Disconnected. Connect to try again.');
    };
  }

  disconnect(notify = true) {
    this.release();
    clearTimeout(this.timeout);
    clearInterval(this.heartbeat);
    const ws = this.ws, pc = this.pc;
    this.ws = this.pc = this.channel = null;
    if (ws) { ws.onclose = ws.onerror = null; ws.close(); }
    if (pc) pc.close();
    this.video.srcObject = null;
    if (notify) this.report('disconnected', 'Disconnected.');
  }

  point(event, allowOutside = false) {
    const r = this.video.getBoundingClientRect();
    const ratio = this.video.videoWidth / this.video.videoHeight || r.width / r.height;
    const width = Math.min(r.width, r.height * ratio), height = width / ratio;
    const u = (event.clientX - r.left - (r.width - width) / 2) / width;
    const v = 1 - (event.clientY - r.top - (r.height - height) / 2) / height;
    if (!allowOutside && (u < 0 || u > 1 || v < 0 || v > 1)) return null;
    return {u: Math.max(-1, Math.min(2, u)), v: Math.max(-1, Math.min(2, v))};
  }

  pointer(event) {
    if (event.pointerType !== 'mouse') return; // Touch gestures are a later, separate translation layer.
    if (event.type === 'pointercancel' || event.type === 'lostpointercapture') { this.release(); return; }
    const point = this.point(event, Boolean(this.buttons));
    if (!point) return;
    if (event.type === 'pointerdown') {
      event.preventDefault();
      this.video.focus({preventScroll: true});
      this.video.play().catch(() => {});
      this.video.setPointerCapture(event.pointerId);
    }
    this.lastPoint = point;
    this.buttons = event.buttons;
    this.sendMouse(point, event.buttons);
    if (event.type === 'pointerup' && this.video.hasPointerCapture(event.pointerId)) this.video.releasePointerCapture(event.pointerId);
  }

  sendMouse(point, buttons, wheel = 0) {
    if (this.channel?.readyState === 'open') {
      this.channel.send(JSON.stringify({type: 'mouse', revision: this.revision, ...point, buttons, wheel}));
    }
  }

  release() {
    if (this.buttons) this.sendMouse(this.lastPoint, 0);
    this.buttons = 0;
  }
}

if (!customElements.get('td-remote-panel')) customElements.define('td-remote-panel', TDRemotePanel);
