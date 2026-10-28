import { chooseMimeType } from './format.js';
import { stopStream } from './capture.js';

/** Owns one encoded take, including its canvas track and final chunk delivery. */
export function startRecording({ canvas, audioStream, quality, onComplete, onError, Recorder = MediaRecorder }) {
  const videoStream = canvas.captureStream(30);
  let recorder;
  const chunks = [];
  let completed = false;
  const complete = () => {
    if (completed) return;
    completed = true;
    stopStream(videoStream);
    const type = recorder.mimeType || chunks[0]?.type || 'application/octet-stream';
    const blob = new Blob(chunks, { type });
    chunks.length = 0;
    onComplete(blob);
  };
  try {
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
    const mimeType = chooseMimeType(type => Recorder.isTypeSupported(type));
    recorder = new Recorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: quality === 1080 ? 5000000 : 2500000,
      audioBitsPerSecond: 128000,
    });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = event => onError(event.error || new Error('Encoding failed.'));
    recorder.onstop = complete;
    recorder.start(1000);
  } catch (error) {
    if (recorder) { recorder.onstop = null; recorder.onerror = null; }
    stopStream(videoStream);
    throw error;
  }
  return {
    pause: () => recorder.pause(),
    resume: () => recorder.resume(),
    stop() { if (recorder.state !== 'inactive') recorder.stop(); },
    recover: complete,
  };
}
