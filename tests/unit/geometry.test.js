import test from 'node:test';
import assert from 'node:assert/strict';
import { faceRectangle, fitInside, outputSize } from '../../src/geometry.js';

test('output limits 4K and ultrawide captures without upscaling smaller sources', () => {
  assert.deepEqual(outputSize(3840, 2160), { width: 1920, height: 1080 });
  assert.deepEqual(outputSize(3840, 2160, 720), { width: 1280, height: 720 });
  assert.deepEqual(outputSize(640, 480), { width: 640, height: 480 });
  const wide = outputSize(3440, 1440);
  assert.equal(wide.width, 1920);
  assert.ok(wide.height <= 1080 && wide.height % 2 === 0);
});
test('resized presentation content is letterboxed instead of distorted', () => {
  assert.deepEqual(fitInside(1000, 1000, 1920, 1080), { x: 420, y: 0, width: 1080, height: 1080 });
});
test('portrait cameras remain inside the output at every corner', () => {
  for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
    const box = faceRectangle(1280, 720, 3, 38, position);
    assert.ok(box.x >= 0 && box.y >= 0);
    assert.ok(box.x + box.width <= 1280 && box.y + box.height <= 720);
  }
  const left = faceRectangle(1280, 720, .75, 22, 'top-left');
  const right = faceRectangle(1280, 720, .75, 22, 'bottom-right');
  assert.ok(right.x > left.x && right.y > left.y);
});
