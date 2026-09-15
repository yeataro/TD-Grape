import './remote-panel.js';
const panel = document.querySelector('td-remote-panel');
const button = document.querySelector('#connection');
const state = document.querySelector('#state');
const format = document.querySelector('#format');
let sourceFormat;
let receivedFormat;
function updateFormat() {
  if (!sourceFormat) return;
  const size = receivedFormat?.width ? receivedFormat : sourceFormat;
  format.textContent = `${size.width} × ${size.height} · up to ${sourceFormat.fps} fps`;
  format.title = `Source: ${sourceFormat.width} × ${sourceFormat.height}. WebRTC may adapt the received resolution.`;
}
button.addEventListener('click', () => {
  if (panel.state === 'connected' || panel.state === 'connecting') panel.disconnect();
  else panel.connect();
});
panel.addEventListener('panel-state', e => {
  state.textContent = e.detail.state[0].toUpperCase() + e.detail.state.slice(1);
  state.dataset.state = e.detail.state;
  button.textContent = ['connected', 'connecting'].includes(e.detail.state) ? 'Disconnect' : 'Connect';
});
panel.addEventListener('panel-source', e => {
  document.querySelector('#target').textContent = e.detail.source;
  sourceFormat = e.detail;
  updateFormat();
});
panel.addEventListener('panel-format', e => { receivedFormat = e.detail; updateFormat(); });
panel.connect();
