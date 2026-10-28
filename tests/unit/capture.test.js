import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptureSession, makeVideo } from '../../src/capture.js';

test('already-loaded video metadata does not wait for an event that has passed', async () => {
  let played = false;
  const video = { readyState: 1, setAttribute() {}, async play() { played = true; } };
  const document = { createElement: () => video, body: { appendChild() {} } };
  assert.equal(await makeVideo({}, document), video);
  assert.ok(played);
});
test('camera permission rejection releases a successful screen capture', async () => {
  const track = { stopped: false, stop() { this.stopped = true; } };
  const capture = new CaptureSession({}, {
    getDisplayMedia: async () => ({ getTracks: () => [track] }),
    getUserMedia: async () => { throw new Error('Permission denied'); },
  }, () => {});
  await assert.rejects(capture.open(), /Permission denied/);
  assert.ok(track.stopped);
  assert.equal(capture.screen, undefined);
});
