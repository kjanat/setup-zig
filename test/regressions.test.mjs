import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as minisign from '../minisign.mjs';
import { load } from './helpers.mjs';

test('manifest version ignores commented-out fields', async () => {
  const ctx = await load('common.mjs', {
    'fs': { promises: { readFile: async () => '// .minimum_zig_version = "0.11.0",\n.{ .minimum_zig_version = "0.15.2" }' } },
    '@actions/core': { getInput: () => '', info: () => {} },
  });
  assert.equal(await ctx.getVersion(), '0.15.2');
});

test('signature parser rejects trailing bytes', () => {
  const info = Buffer.alloc(74).toString('base64');
  const signature = Buffer.alloc(64).toString('base64');
  assert.throws(() => minisign.parseSignature(Buffer.from(`untrusted comment: test\n${info}\ntrusted comment: test\n${signature}\nJUNK`)), /trailing/);
});

test('unreadable cache size is unknown rather than zero', async () => {
  const warnings = [];
  const ctx = await load('post.mjs', {
    'node:fs/promises': { default: {
      readdir: async () => [{ isFile: () => true, parentPath: '/cache', name: 'file' }],
      stat: async () => { throw new Error('simulated stat failure'); },
    } },
    '@actions/core': { warning: message => warnings.push(message) },
  });
  assert.equal(await ctx.dirSize('/cache'), null);
  assert.match(warnings.join('\n'), /simulated stat failure/);
});
