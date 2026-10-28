import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Check all platforms, including optional packages not installed on this machine. */
export function validateLockfile(lock) {
  if (lock.lockfileVersion !== 3 || !lock.packages) throw new Error('Expected a version 3 npm lockfile with package metadata.');
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path || entry.link) continue;
    if (typeof entry.version !== 'string' || !entry.version.trim()) {
      throw new Error(`Lockfile entry ${path} has no version. Regenerate its metadata before committing.`);
    }
    if (!entry.resolved || !entry.integrity) {
      throw new Error(`Lockfile entry ${path} is missing its download URL or integrity hash.`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  validateLockfile(JSON.parse(await readFile('package-lock.json', 'utf8')));
  console.log('Lockfile metadata verified for every platform.');
}
