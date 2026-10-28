const results = document.getElementById('results');
const log = message => { results.textContent += message + '\n'; };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (condition, description, ms = 8000) => {
  const end = performance.now() + ms;
  while (!condition()) { if (performance.now() > end) throw new Error('Timed out: ' + description); await delay(50); }
};
function syntheticInputs() {
  const harness = window.harness = { streams: [], videos: [], audioContexts: [], failUser: false, failDisplay: false, withoutAudio: false, recorders: [], realRecorder: window.MediaRecorder };
  const NativeRecorder = window.MediaRecorder;
  harness.realRecorder = class extends NativeRecorder {
    constructor(...args) { super(...args); harness.recorders.push(this); }
  };
  window.MediaRecorder = harness.realRecorder;
  function videoStream(face) {
    const source = document.createElement('canvas');
    source.width = face ? 640 : 1920; source.height = face ? 480 : 1080;
    const context = source.getContext('2d'); let frame = 0;
    const paint = () => {
      frame++;
      context.fillStyle = face ? '#3454aa' : '#206c43'; context.fillRect(0, 0, source.width, source.height);
      context.fillStyle = '#fff'; context.font = face ? '70px sans-serif' : '90px sans-serif';
      context.fillText(face ? 'FACE ' + frame : 'PRESENTATION ' + frame, 35, 130);
      context.fillStyle = frame % 2 ? '#ffd35c' : '#ed609e';
      context.fillRect((frame * 15) % (source.width - 150), 200, 150, 150);
    };
    paint(); const timer = setInterval(paint, 33); const stream = source.captureStream(30);
    harness.videos.push({ source, timer }); return stream;
  }
  function audioStream(frequency) {
    const context = new AudioContext(), destination = context.createMediaStreamDestination();
    const tone = context.createOscillator(), gain = context.createGain();
    tone.frequency.value = frequency; gain.gain.value = .08;
    tone.connect(gain); gain.connect(destination); tone.start(); context.resume();
    harness.audioContexts.push(context); return destination.stream;
  }
  Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { configurable: true, value: async () => {
    if (harness.failDisplay) throw new DOMException('Cancelled', 'NotAllowedError');
    const stream = videoStream(false);
    if (!harness.withoutAudio) stream.addTrack(audioStream(440).getAudioTracks()[0]);
    harness.streams.push(stream); return stream;
  }});
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
    if (harness.failUser) throw new DOMException('Denied', 'NotAllowedError');
    const stream = videoStream(true); stream.addTrack(audioStream(880).getAudioTracks()[0]);
    harness.streams.push(stream); return stream;
  }});
  Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { configurable: true, value: async () => [
    {kind:'videoinput',deviceId:'fake-camera',label:'Generated camera'},
    {kind:'audioinput',deviceId:'fake-mic',label:'Generated microphone'}
  ]});
  harness.cleanup = () => {
    harness.streams.forEach(s => s.getTracks().forEach(t => t.stop()));
    harness.videos.forEach(v => clearInterval(v.timer));
    harness.audioContexts.forEach(c => c.close());
  };
}
document.getElementById('run').onclick = async () => {
  document.getElementById('run').disabled = true; results.textContent = ''; results.className = '';
  let w;
  try {
    const html = await (await fetch('../index.html')).text();
    const frame = document.createElement('iframe'); document.getElementById('host').replaceChildren(frame);
    const inject = '<script>(' + syntheticInputs.toString() + ')();<\/script>';
    frame.srcdoc = html.replace('<head>', `<head><base href="${new URL('../', location.href).href}">`)
      .replace('<script type="module" src="/src/main.js"></script>', inject + '<script type="module" src="/src/main.js"><\/script>');
    await new Promise(resolve => frame.onload = resolve);
    w = frame.contentWindow;
    const el = id => w.document.getElementById(id);
    const state = () => el('stateLabel').dataset.state;
    const check = (condition, message) => { if (!condition) throw new Error(message); log('PASS: ' + message); };
    const click = id => el(id).click();
    const setup = async () => { click('shareBtn'); await waitFor(() => state() === 'ready', 'setup'); };
    const record = async () => { click('recBtn'); await waitFor(() => state() === 'recording', 'countdown and record'); };
    const finish = async () => { click('stopBtn'); await waitFor(() => state() === 'review', 'finish'); };
    await setup();
    check(el('canvas').width === 1920 && el('canvas').height === 1080, '1080p output and metadata readiness');
    check(!el('screenAudioEnabled').disabled, 'Shared audio is detected');
    await record();
    check(w.harness.recorders.at(-1).stream.getAudioTracks().length === 1, 'Microphone and presentation audio use one mixed track');
    await delay(1400);
    click('pauseBtn'); const pausedTime = el('timer').textContent; await delay(1100);
    check(state() === 'paused' && el('timer').textContent === pausedTime, 'Pause freezes recorded duration');
    click('pauseBtn'); await delay(1300); await finish();
    check(w.harness.streams.every(s => s.getTracks().every(t => t.readyState === 'ended')), 'Stop releases all capture tracks');
    check(el('downloadBtn').download.endsWith('.webm') || el('downloadBtn').download.endsWith('.mp4'), 'Download extension matches a supported recording format');
    const firstUrl = el('playback').src;
    await waitFor(() => el('playback').readyState >= 2, 'recorded video decodes');
    const playback = el('playback');
    // Analyse encoded audio while sending silence to speakers.
    const analysisContext = new w.AudioContext(); await analysisContext.resume();
    const audioSource = analysisContext.createMediaElementSource(playback), spectrum = analysisContext.createAnalyser(), silent = analysisContext.createGain();
    spectrum.fftSize = 8192; silent.gain.value = 0;
    audioSource.connect(spectrum); spectrum.connect(silent); silent.connect(analysisContext.destination);
    await playback.play(); await delay(400);
    const bins = new Float32Array(spectrum.frequencyBinCount); spectrum.getFloatFrequencyData(bins);
    const peakAt = hz => { const bin = Math.round(hz / (analysisContext.sampleRate / spectrum.fftSize)); return Math.max(...bins.slice(bin - 2, bin + 3)); };
    check(peakAt(440) > -55 && peakAt(880) > -55, 'Recorded playback contains both presentation and microphone tones');
    const probe = w.document.createElement('canvas'); probe.width = 192; probe.height = 108;
    const pc = probe.getContext('2d');
    pc.drawImage(playback, 0, 0, 192, 108); const firstFrame = pc.getImageData(0, 0, 192, 108).data.slice();
    await delay(400); pc.drawImage(playback, 0, 0, 192, 108); const secondFrame = pc.getImageData(0, 0, 192, 108).data;
    check(firstFrame.some((value, i) => value !== secondFrame[i]), 'Encoded playback contains moving video');
    const facePixel = pc.getImageData(177, 100, 1, 1).data;
    check(facePixel[2] > facePixel[0] * 1.5, 'Face overlay is included in the encoded video');
    playback.pause(); await analysisContext.close();
    // A replacement take must draw again, resize, and survive an interrupted share.
    await setup(); el('quality').value = '720'; el('quality').dispatchEvent(new w.Event('change'));
    el('position').value = 'top-left'; el('position').dispatchEvent(new w.Event('change'));
    check(el('canvas').width === 1280 && el('canvas').height === 720, '720p output preserves proportions');
    await record(); await delay(1300);
    const track = w.harness.streams.at(-2).getVideoTracks()[0]; track.stop(); track.dispatchEvent(new w.Event('ended'));
    await waitFor(() => state() === 'review', 'interrupted share finalizes');
    check(el('playback').src !== firstUrl && el('status').textContent.includes('ended'), 'Second take survives external Stop sharing');
    await waitFor(() => playback.readyState >= 2, 'second recording decodes');
    playback.muted = true; await playback.play(); await delay(200); pc.drawImage(playback, 0, 0, 192, 108);
    const movedFace = pc.getImageData(5, 5, 1, 1).data;
    check(movedFace[2] > movedFace[0] * 1.5, 'Second take draws the face at its new corner'); playback.pause();
    const retained = playback.src;
    w.harness.failUser = true; click('shareBtn'); await waitFor(() => state() === 'review', 'permission rejection recovery');
    check(playback.src === retained && w.harness.streams.every(s => s.getTracks().every(t => t.readyState === 'ended')), 'Permission rejection releases screen and preserves preceding take');
    w.harness.failUser = false; w.harness.withoutAudio = true;
    await setup(); check(el('screenAudioEnabled').disabled && el('audioInfo').textContent.includes('No shared audio'), 'Microphone-only setup handles absent shared audio');
    click('recBtn'); await waitFor(() => state() === 'countdown', 'countdown starts'); click('stopBtn'); await delay(3200);
    check(state() === 'review' && playback.src === retained, 'Cancelling countdown never starts recording or loses preceding take');
    await setup();
    // Cover constructor/start failures without changing production code.
    w.MediaRecorder = class { static isTypeSupported() { return true; } constructor() { throw new DOMException('Unsupported', 'NotSupportedError'); } };
    click('recBtn'); await waitFor(() => state() === 'review', 'recorder failure recovery');
    check(playback.src === retained && w.harness.streams.every(s => s.getTracks().every(t => t.readyState === 'ended')), 'Recorder construction failure releases sources and retains previous take');
    w.MediaRecorder = w.harness.realRecorder;
    await setup();
    const oldCamera = w.harness.streams.at(-1);
    el('cameraSelect').value = 'fake-camera'; el('cameraSelect').dispatchEvent(new w.Event('change'));
    await waitFor(() => state() === 'ready', 'device switch');
    check(oldCamera.getTracks().every(t => t.readyState === 'ended') && w.harness.streams.at(-1) !== oldCamera, 'Device switching replaces and releases the old camera/microphone');
    await record(); await delay(1300);
    const failingRecorder = w.harness.recorders.at(-1);
    failingRecorder.onerror({error:new DOMException('Synthetic encoding interruption', 'UnknownError')});
    await waitFor(() => state() === 'review', 'encoder error recovery');
    check(el('status').textContent.includes('interrupted') && w.harness.streams.every(s => s.getTracks().every(t => t.readyState === 'ended')), 'Encoder error finalizes available data and releases devices');
    results.className = 'pass'; log('\nALL CHECKS PASSED. Real device permissions and five-minute window-switching rehearsal remain manual.');
  } catch (error) { results.className = 'fail'; log('FAIL: ' + error.stack); }
  finally { w?.harness.cleanup(); document.getElementById('run').disabled = false; }
};
