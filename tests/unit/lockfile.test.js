import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateLockfile } from '../../scripts/validate-lockfile.js';

const optionalPath = 'node_modules/rollup/node_modules/@napi-rs/lzma-linux-x64-gnu';

test('rejects a versionless optional Linux package even on macOS', () => {
  const broken = { lockfileVersion: 3, packages: { [optionalPath]: { dev: true, optional: true } } };
  assert.throws(() => validateLockfile(broken), /lzma-linux-x64-gnu has no version/);
});

test('rejects incomplete download metadata', () => {
  for (const missing of ['resolved', 'integrity']) {
    const entry = { version: '1.5.1', resolved: 'https://registry.npmjs.org/example.tgz', integrity: 'sha512-example' };
    delete entry[missing];
    assert.throws(() => validateLockfile({ lockfileVersion: 3, packages: { [optionalPath]: entry } }), /missing its download URL or integrity hash/);
  }
});

test('committed lockfile has complete metadata for every platform', async () => {
  const lock = JSON.parse(await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'));
  validateLockfile(lock);
});
