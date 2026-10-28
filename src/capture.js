export function stopStream(stream) { stream?.getTracks().forEach(track => track.stop()); }

export function removeVideo(video) {
  if (!video) return;
  video.pause();
  video.srcObject = null;
  video.remove();
}

/** Wait before playing: loadedmetadata may already have fired. */
export async function makeVideo(stream, document) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.className = 'source-video';
  video.setAttribute('aria-hidden', 'true');
  document.body.appendChild(video);
  video.srcObject = stream;
  try {
    if (video.readyState < 1) {
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', loaded);
          video.removeEventListener('error', failed);
        };
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('The video source could not be opened.')); };
        const timeout = setTimeout(() => {
          cleanup(); reject(new Error('The video source did not become ready. Try setup again.'));
        }, 15000);
        video.addEventListener('loadedmetadata', loaded, { once: true });
        video.addEventListener('error', failed, { once: true });
      });
    }
    await video.play();
    return video;
  } catch (error) { removeVideo(video); throw error; }
}

function userConstraints(camera, mic) {
  return {
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...(camera ? { deviceId: { exact: camera } } : {}) },
    audio: { echoCancellation: true, noiseSuppression: true, ...(mic ? { deviceId: { exact: mic } } : {}) },
  };
}

/** Owns the raw devices and their muted source videos. */
export class CaptureSession {
  constructor(document, mediaDevices, onEnded) {
    this.document = document;
    this.mediaDevices = mediaDevices;
    this.onEnded = onEnded;
  }

  async open(camera = '', mic = '') {
    try {
      // Called synchronously from the user's setup click, before any other await.
      this.screen = await this.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 } }, audio: true });
      this.camera = await this.mediaDevices.getUserMedia(userConstraints(camera, mic));
      this.screenVideo = await makeVideo(this.screen, this.document);
      this.cameraVideo = await makeVideo(this.camera, this.document);
      this.assertLive();
      this.watch(this.screen, 'Screen sharing');
      this.watch(this.camera, 'Camera or microphone capture');
    } catch (error) { this.dispose(); throw error; }
  }

  async changeDevices(camera, mic) {
    let replacement, video;
    try {
      replacement = await this.mediaDevices.getUserMedia(userConstraints(camera, mic));
      video = await makeVideo(replacement, this.document);
      const oldStream = this.camera, oldVideo = this.cameraVideo;
      this.camera = replacement;
      this.cameraVideo = video;
      stopStream(oldStream);
      removeVideo(oldVideo);
      this.watch(this.camera, 'Camera or microphone capture');
      this.assertLive();
    } catch (error) {
      if (replacement !== this.camera) { stopStream(replacement); removeVideo(video); }
      throw error;
    }
  }

  assertLive() {
    if (!this.screen || !this.camera || ![...this.screen.getVideoTracks(), ...this.camera.getTracks()].every(track => track.readyState === 'live')) {
      throw new Error('Capture ended during setup. Please try again.');
    }
  }

  watch(stream, name) {
    stream.getTracks().forEach(track => track.addEventListener('ended', () => {
      if (stream !== this.screen && stream !== this.camera) return;
      this.onEnded({ name, sharedAudio: stream === this.screen && track.kind === 'audio' });
    }));
  }

  get hasScreenAudio() { return !!this.screen?.getAudioTracks().some(track => track.readyState === 'live'); }

  dispose() {
    [this.screen, this.camera].forEach(stopStream);
    [this.screenVideo, this.cameraVideo].forEach(removeVideo);
    this.screen = this.camera = this.screenVideo = this.cameraVideo = undefined;
  }
}
