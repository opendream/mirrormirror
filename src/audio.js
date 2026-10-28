import { stopStream } from './capture.js';

/** Combines sources into exactly one audio track; never connects to speakers. */
export class AudioMixer {
  constructor(AudioContext, screen, camera) {
    this.context = new AudioContext();
    try {
      this.destination = this.context.createMediaStreamDestination();
      this.micGain = this.context.createGain();
      this.screenGain = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.samples = new Float32Array(this.analyser.fftSize);
      const mic = this.context.createMediaStreamSource(new MediaStream(camera.getAudioTracks()));
      mic.connect(this.micGain);
      this.micGain.connect(this.analyser);
      this.micGain.connect(this.destination);
      if (screen.getAudioTracks().length) {
        const shared = this.context.createMediaStreamSource(new MediaStream(screen.getAudioTracks()));
        shared.connect(this.screenGain);
        this.screenGain.connect(this.destination);
      }
    } catch (error) { this.dispose(); throw error; }
  }

  get stream() { return this.destination.stream; }
  resume() { return this.context.resume(); }
  update({ microphone, sharedAudio, sharedVolume }) {
    this.micGain.gain.value = microphone ? 1 : 0;
    this.screenGain.gain.value = sharedAudio ? sharedVolume / 100 : 0;
  }
  level() {
    this.analyser.getFloatTimeDomainData(this.samples);
    const rms = Math.sqrt(this.samples.reduce((sum, value) => sum + value * value, 0) / this.samples.length);
    return Math.min(1, rms * 4);
  }
  dispose() {
    stopStream(this.destination?.stream);
    if (this.context.state !== 'closed') return this.context.close().catch(() => {});
  }
}
