import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { validateLockfile } from './validate-lockfile.js';

validateLockfile(JSON.parse(await readFile('package-lock.json', 'utf8')));

for (const directory of ['src', 'scripts', 'tests']) {
  for (const name of await readdir(directory, { recursive: true })) {
    if (!name.endsWith('.js')) continue;
    const result = spawnSync(process.execPath, ['--check', path.join(directory, name)], { stdio: 'inherit' });
    if (result.status) process.exit(result.status);
  }
}
const html = await readFile('index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML IDs');
for (const name of ['src/app.js', 'src/ui.js']) {
  const source = await readFile(name, 'utf8');
  for (const match of source.matchAll(/\$\('([^']+)'\)/g)) {
    if (!ids.includes(match[1])) throw new Error(`Missing HTML control ${match[1]} in ${name}`);
  }
}
console.log('JavaScript syntax and HTML control references verified.');
