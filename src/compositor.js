import { faceRectangle, fitInside, outputSize } from './geometry.js';

/** Draws screen + face into the one video track used by MediaRecorder. */
export class Compositor {
  constructor(canvas, capture, settings, onFrame) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.capture = capture;
    this.settings = settings;
    this.onFrame = onFrame;
  }
  resize(maxHeight) {
    const source = this.capture.screenVideo;
    const size = outputSize(source.videoWidth || 1280, source.videoHeight || 720, maxHeight);
    Object.assign(this.canvas, size);
    return size;
  }
  draw() {
    const { screenVideo: screen, cameraVideo: face } = this.capture;
    if (!screen || !face) return;
    const { width, height } = this.canvas, ctx = this.context;
    const settings = this.settings();
    ctx.fillStyle = '#080a0b';
    ctx.fillRect(0, 0, width, height);
    if (screen.readyState >= 2 && screen.videoWidth && screen.videoHeight) {
      const rect = fitInside(screen.videoWidth, screen.videoHeight, width, height);
      ctx.drawImage(screen, rect.x, rect.y, rect.width, rect.height);
    }
    if (settings.showFace && face.readyState >= 2 && face.videoWidth && face.videoHeight) {
      const rect = faceRectangle(width, height, face.videoHeight / face.videoWidth, settings.faceSize, settings.position);
      ctx.drawImage(face, rect.x, rect.y, rect.width, rect.height);
      ctx.strokeStyle = '#e8c975';
      ctx.lineWidth = Math.max(2, width / 640);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    this.onFrame();
  }
  start() {
    this.stop();
    this.draw();
    // Background timers can throttle. The app explicitly requires a visible window.
    this.interval = setInterval(() => this.draw(), 1000 / 30);
  }
  stop() { clearInterval(this.interval); }
  clear() { this.stop(); this.context.clearRect(0, 0, this.canvas.width, this.canvas.height); }
}
