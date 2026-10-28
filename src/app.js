import { CaptureSession } from './capture.js';
import { AudioMixer } from './audio.js';
import { Compositor } from './compositor.js';
import { startRecording } from './recording.js';
import { extensionFor, formatDuration, recordingFilename, RecordingClock } from './format.js';
import { friendlyError } from './errors.js';
import { audioSettings, faceSettings, populateDevices, renderState } from './ui.js';

/** Coordinates setup → ready → countdown → recording/paused → saving → review. */
export function createRecorderApp(document = window.document) {
  const view = document.defaultView;
  const $ = id => document.getElementById(id);
  const canvas = $('canvas');
  const clock = new RecordingClock();
  const capture = new CaptureSession(document, view.navigator.mediaDevices, captureEnded);
  const compositor = new Compositor(canvas, capture, () => faceSettings($), () => {
    if (mixer) $('micMeter').value = mixer.level();
  });
  let state = 'idle', mixer, recording, recordingUrl;
  let countdownInterval, clockInterval;
  let finishMessage = '', takeHadHidden = false, unsaved = false;
  let selectedCamera = '', selectedMic = '';

  function setState(next, message) {
    state = next;
    renderState($, state, capture.hasScreenAudio, message);
  }
  function updateTimer() { $('timer').textContent = formatDuration(clock.read()); }
  function updateAudio() { mixer?.update(audioSettings($)); }
  function updateSharedAudioInfo() {
    $('audioInfo').textContent = capture.hasScreenAudio
      ? 'Shared audio is available. Adjust its level below.'
      : 'No shared audio was provided. Your microphone can still be recorded.';
  }
  function sizeCanvas() {
    if (!capture.screenVideo) return;
    const size = compositor.resize(Number($('quality').value));
    $('sourceInfo').textContent = `${capture.screen.getVideoTracks()[0].label || 'Shared screen'} · ${size.width} × ${size.height}`;
  }
  function releaseCapture() {
    clearInterval(countdownInterval);
    clearInterval(clockInterval);
    $('countdown').hidden = true;
    compositor.clear();
    capture.dispose();
    mixer?.dispose();
    mixer = undefined;
    $('micMeter').value = 0;
    $('sourceInfo').textContent = 'No active capture';
    $('audioInfo').textContent = 'Camera, microphone, and screen capture are off.';
    $('placeholder').hidden = false;
  }
  function setupFailed(error) {
    releaseCapture();
    selectedCamera = selectedMic = '';
    setState(recordingUrl ? 'review' : 'idle', friendlyError(error));
  }
  function captureEnded({ name, sharedAudio }) {
    if (sharedAudio) {
      updateSharedAudioInfo();
      setState(state, 'Shared audio ended. Screen and microphone capture can continue.');
    } else if (['recording', 'paused'].includes(state)) {
      finishTake(`${name} ended. The available recording has been kept; review it before saving.`);
    } else if (['ready', 'countdown'].includes(state)) {
      releaseCapture();
      setState(recordingUrl ? 'review' : 'idle', `${name} ended. Set up again to record.`);
    }
    // During async setup, assertLive() below handles an ended device.
  }
  async function createMixer() {
    mixer = new AudioMixer(view.AudioContext || view.webkitAudioContext, capture.screen, capture.camera);
    updateAudio();
    await mixer.resume();
  }
  async function setup() {
    if (!['idle', 'review'].includes(state)) return;
    setState('setting-up', 'Choose your presentation screen, then allow camera and microphone access.');
    $('playback').pause();
    $('visibilityWarning').hidden = true;
    try {
      await capture.open(selectedCamera, selectedMic);
      await createMixer();
      await populateDevices($, view.navigator.mediaDevices, capture, document);
      capture.assertLive();
      sizeCanvas();
      updateSharedAudioInfo();
      $('placeholder').hidden = true;
      clock.reset();
      updateTimer();
      compositor.start();
      setState('ready', 'Check your framing and microphone level. Record starts with a 3-second countdown.');
    } catch (error) { setupFailed(error); }
  }
  async function changeDevices() {
    if (state !== 'ready') return;
    selectedCamera = $('cameraSelect').value;
    selectedMic = $('micSelect').value;
    setState('setting-up', 'Switching camera or microphone…');
    try {
      await capture.changeDevices(selectedCamera, selectedMic);
      await mixer.dispose();
      mixer = undefined;
      await createMixer();
      await populateDevices($, view.navigator.mediaDevices, capture, document);
      capture.assertLive();
      setState('ready', 'Device changed. Check your framing and microphone level.');
    } catch (error) { setupFailed(error); }
  }
  async function countdown() {
    if (state !== 'ready') return;
    setState('countdown', 'Get ready…');
    try { await mixer.resume(); }
    catch (error) { setupFailed(error); return; }
    if (state !== 'countdown') return;
    let remaining = 3;
    $('countdown').textContent = remaining;
    $('countdown').hidden = false;
    countdownInterval = setInterval(() => {
      remaining--;
      if (remaining > 0) $('countdown').textContent = remaining;
      else {
        clearInterval(countdownInterval);
        $('countdown').hidden = true;
        beginRecording();
      }
    }, 1000);
  }
  function beginRecording() {
    if (state !== 'countdown') return;
    try {
      capture.assertLive();
      compositor.draw();
      recording = startRecording({
        canvas,
        audioStream: mixer.stream,
        quality: Number($('quality').value),
        Recorder: view.MediaRecorder,
        onComplete: completeTake,
        onError: error => finishTake(`Recording was interrupted: ${friendlyError(error)} Any available video is kept below.`),
      });
      clock.reset();
      clock.resume();
      finishMessage = '';
      takeHadHidden = document.hidden;
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      recordingUrl = undefined;
      $('playback').removeAttribute('src');
      $('playback').load();
      $('review').hidden = true;
      unsaved = true;
      setState('recording', 'Recording your screen, face, and selected audio. Keep this window visible.');
      $('visibilityWarning').hidden = !takeHadHidden;
      updateTimer();
      clockInterval = setInterval(updateTimer, 250);
    } catch (error) { setupFailed(error); }
  }
  function pauseOrResume() {
    try {
      if (state === 'recording') {
        recording.pause();
        clock.pause();
        setState('paused', 'Paused. Preview is live, but video and audio are not being added to your take.');
      } else if (state === 'paused') {
        recording.resume();
        clock.resume();
        setState('recording', 'Recording resumed.');
      }
      updateTimer();
    } catch (error) { finishTake(friendlyError(error)); }
  }
  function finishTake(message = '') {
    if (!['recording', 'paused'].includes(state)) return;
    clock.pause();
    finishMessage = message;
    setState('saving', 'Finishing your recording…');
    clearInterval(clockInterval);
    updateTimer();
    // Sources stay alive until MediaRecorder delivers its final chunk and stop event.
    try { recording.stop(); }
    catch (error) {
      finishMessage = `Could not finish normally: ${friendlyError(error)} Review the recovered video.`;
      recording.recover();
    }
  }
  function completeTake(blob) {
    clock.pause();
    recording = undefined;
    releaseCapture();
    if (!blob.size) {
      unsaved = false;
      setState('idle', finishMessage || 'No video data was captured. Please set up and try again.');
      return;
    }
    recordingUrl = URL.createObjectURL(blob);
    $('playback').src = recordingUrl;
    $('downloadBtn').href = recordingUrl;
    $('downloadBtn').download = recordingFilename(blob.type);
    $('resultInfo').textContent = `${formatDuration(clock.read())} · ${(blob.size / 1024 / 1024).toFixed(1)} MB · ${extensionFor(blob.type).toUpperCase()}${takeHadHidden ? ' · Recorder was hidden: check for frozen video.' : ''}`;
    $('review').hidden = false;
    unsaved = true;
    setState('review', finishMessage || 'Your take is ready to review. Camera, microphone, and screen capture are off.');
    updateTimer();
  }

  $('shareBtn').onclick = setup;
  $('retakeBtn').onclick = setup;
  $('recBtn').onclick = countdown;
  $('pauseBtn').onclick = pauseOrResume;
  $('stopBtn').onclick = () => {
    if (['ready', 'countdown'].includes(state)) {
      releaseCapture();
      setState(recordingUrl ? 'review' : 'idle', 'Setup cancelled. All capture devices are off.');
    } else finishTake();
  };
  $('cameraSelect').onchange = changeDevices;
  $('micSelect').onchange = changeDevices;
  $('micEnabled').onchange = updateAudio;
  $('screenAudioEnabled').onchange = updateAudio;
  $('screenVolume').oninput = updateAudio;
  $('quality').onchange = () => { sizeCanvas(); compositor.draw(); };
  $('faceSize').oninput = () => { $('sizeLabel').textContent = `${$('faceSize').value}%`; compositor.draw(); };
  $('position').onchange = () => compositor.draw();
  $('showFace').onchange = () => compositor.draw();
  $('downloadBtn').onclick = () => {
    unsaved = false;
    $('status').textContent = 'Save requested. Check your browser’s downloads before closing this page.';
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ['countdown', 'recording', 'paused'].includes(state)) {
      takeHadHidden = true;
      $('visibilityWarning').hidden = false;
    }
  });
  view.addEventListener('beforeunload', event => {
    if (unsaved || ['recording', 'paused', 'saving'].includes(state)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  view.addEventListener('pagehide', () => {
    releaseCapture();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  });
  const supported = view.isSecureContext && view.navigator.mediaDevices?.getDisplayMedia
    && view.navigator.mediaDevices?.getUserMedia && view.MediaRecorder && canvas.captureStream
    && (view.AudioContext || view.webkitAudioContext);
  if (!supported) {
    setState('idle', 'Screen recording is unavailable here. Open this page in a current desktop browser using localhost or HTTPS.');
    $('shareBtn').disabled = true;
  }
}
