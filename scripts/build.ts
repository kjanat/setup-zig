import assert from 'node:assert/strict';
import { readdir, rm } from 'node:fs/promises';
import { build } from 'tsdown';

const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await build({ config: 'tsdown.config.ts' });
assert.deepEqual((await readdir(output)).sort(), ['main.mjs', 'post.mjs']);
