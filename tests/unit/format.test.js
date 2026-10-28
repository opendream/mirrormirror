import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMimeType, extensionFor, recordingFilename, formatDuration, RecordingClock } from '../../src/format.js';

test('container selection falls back to MP4 or the browser default', () => {
  assert.equal(chooseMimeType(type => type === 'video/mp4'), 'video/mp4');
  assert.equal(chooseMimeType(() => false), '');
  assert.equal(chooseMimeType(() => true), 'video/webm;codecs=vp9,opus');
});
test('download filename reflects the encoded type and has filesystem-safe UTC time', () => {
  const date = new Date('2026-10-27T12:34:56.789Z');
  assert.equal(recordingFilename('video/mp4;codecs=avc1', date), 'mirror-mirror-2026-10-27T12-34-56-789Z.mp4');
  assert.equal(extensionFor('video/webm;codecs=vp8,opus'), 'webm');
  assert.equal(extensionFor('application/octet-stream'), 'bin');
});
test('duration handles minute and hour boundaries', () => {
  assert.equal(formatDuration(59999), '00:59');
  assert.equal(formatDuration(60000), '01:00');
  assert.equal(formatDuration(3600000), '1:00:00');
});
test('clock excludes setup and paused time and resets for the next take', () => {
  let now = 10000;
  const clock = new RecordingClock(() => now);
  assert.equal(clock.read(), 0);
  clock.resume(); now += 1400; clock.pause();
  now += 12000; assert.equal(clock.read(), 1400);
  clock.resume(); now += 600; clock.resume();
  assert.equal(clock.read(), 2000);
  clock.pause(); clock.pause(); assert.equal(clock.read(), 2000);
  clock.reset(); now += 500; assert.equal(clock.read(), 0);
});
