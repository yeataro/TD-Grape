import './remote-panel.js';
const panel = document.querySelector('td-remote-panel');
const button = document.querySelector('#connection');
const state = document.querySelector('#state');
const format = document.querySelector('#format');
const controls = document.querySelector('#controls');
let focused = false;
let sourceFormat;
let receivedFormat;
function updateControls() {
  if (panel.state !== 'connected') controls.textContent = 'Mouse & touch · one connected browser';
  else if (sourceFormat?.shortcuts?.includes('reset-viewer')) {
    const touch = sourceFormat.touchNavigation === '3d' ? 'Drag to rotate · Two fingers to pan · Pinch to zoom' : 'Tap or drag to interact';
    controls.textContent = `${touch} · ${focused ? 'H reset view · Tab leave panel' : 'Focus panel for H reset'}`;
  } else controls.textContent = 'Tap or drag to interact · Mouse controls available';
}
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
  state.textContent = e.detail.state === 'replaced' ? 'Taken over' : e.detail.state[0].toUpperCase() + e.detail.state.slice(1);
  state.dataset.state = e.detail.state;
  button.textContent = ['connected', 'connecting'].includes(e.detail.state) ? 'Disconnect' : 'Connect';
  updateControls();
});
panel.addEventListener('panel-source', e => {
  document.querySelector('#target').textContent = e.detail.source;
  sourceFormat = e.detail;
  updateFormat();
  updateControls();
});
panel.addEventListener('panel-focus', e => { focused = e.detail.focused; updateControls(); });
panel.addEventListener('panel-format', e => { receivedFormat = e.detail; updateFormat(); });
panel.connect();
