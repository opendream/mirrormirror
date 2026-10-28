/** Choose a container supported by this browser; empty means use its default. */
export function chooseMimeType(isSupported) {
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    .find(type => isSupported(type)) || '';
}

export function extensionFor(type) {
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('webm')) return 'webm';
  return 'bin';
}

export function recordingFilename(type, date = new Date()) {
  return `mirror-mirror-${date.toISOString().replace(/[:.]/g, '-')}.${extensionFor(type)}`;
}

export function formatDuration(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(seconds / 3600);
  return (hours ? `${hours}:` : '')
    + `${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Monotonic elapsed time; pauses and countdowns never enter the result. */
export class RecordingClock {
  constructor(now = () => performance.now()) { this.now = now; this.reset(); }
  reset() { this.elapsed = 0; this.startedAt = null; }
  resume() { if (this.startedAt === null) this.startedAt = this.now(); }
  pause() {
    if (this.startedAt !== null) this.elapsed += this.now() - this.startedAt;
    this.startedAt = null;
  }
  read() { return this.elapsed + (this.startedAt === null ? 0 : this.now() - this.startedAt); }
}
