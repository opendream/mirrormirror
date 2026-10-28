const labels = { idle: 'Not capturing', 'setting-up': 'Setting up', ready: 'Preview only', countdown: 'Starting soon', recording: '● Recording', paused: 'Paused', saving: 'Finishing', review: 'Capture stopped' };

/** Single place for the controls enabled by each recording state. */
export function renderState($, state, hasScreenAudio, message) {
  if (message) $('status').textContent = message;
  const recording = state === 'recording' || state === 'paused';
  const busy = state === 'setting-up' || state === 'saving';
  $('shareBtn').disabled = !['idle', 'review'].includes(state);
  $('recBtn').disabled = state !== 'ready';
  $('pauseBtn').disabled = !recording;
  $('pauseBtn').textContent = state === 'paused' ? 'Resume' : 'Pause';
  $('stopBtn').disabled = !['ready', 'countdown', 'recording', 'paused'].includes(state);
  $('stopBtn').textContent = state === 'ready' || state === 'countdown' ? 'Cancel setup' : 'Stop';
  $('cameraSelect').disabled = state !== 'ready';
  $('micSelect').disabled = state !== 'ready';
  $('quality').disabled = !['idle', 'ready', 'review'].includes(state);
  $('retakeBtn').disabled = !['idle', 'review'].includes(state);
  $('micEnabled').disabled = busy || state === 'countdown';
  $('screenAudioEnabled').disabled = !hasScreenAudio || busy;
  $('screenVolume').disabled = !hasScreenAudio || busy;
  $('stateLabel').textContent = labels[state];
  $('stateLabel').dataset.state = state;
}

export function audioSettings($) {
  return { microphone: $('micEnabled').checked, sharedAudio: $('screenAudioEnabled').checked, sharedVolume: Number($('screenVolume').value) };
}
export function faceSettings($) {
  return { showFace: $('showFace').checked, faceSize: Number($('faceSize').value), position: $('position').value };
}

export async function populateDevices($, mediaDevices, capture, document) {
  if (!mediaDevices.enumerateDevices) return;
  try {
    const devices = await mediaDevices.enumerateDevices();
    for (const [id, kind, track, fallback] of [
      ['cameraSelect', 'videoinput', capture.camera.getVideoTracks()[0], 'Camera'],
      ['micSelect', 'audioinput', capture.camera.getAudioTracks()[0], 'Microphone'],
    ]) {
      const select = $(id), actual = track?.getSettings().deviceId || '';
      const option = (label, value) => {
        const element = document.createElement('option'); element.textContent = label; element.value = value; return element;
      };
      select.replaceChildren(option('System default', ''));
      devices.filter(device => device.kind === kind).forEach((device, index) => select.add(option(device.label || `${fallback} ${index + 1}`, device.deviceId)));
      select.value = actual;
      if (select.selectedIndex < 0) select.value = '';
    }
  } catch { /* Enumeration is optional; capture can proceed without labels. */ }
}
