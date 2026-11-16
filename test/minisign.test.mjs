import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { parseKey, parseSignature, verifySignature } from '../minisign.mjs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const id = Buffer.from('12345678');
const keyText = Buffer.concat([Buffer.from('Ed'), id, publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)]).toString('base64');
const content = Buffer.from('signed compiler fixture');
function fixture(algorithm = 'ED', comment = 'timestamp:123 file:zig-test.tar.xz hashed') {
  const signature = sign(null, algorithm === 'ED' ? createHash('blake2b512').update(content).digest() : content, privateKey);
  const global = sign(null, Buffer.concat([signature, Buffer.from(comment)]), privateKey);
  return `untrusted comment: test\n${Buffer.concat([Buffer.from(algorithm), id, signature]).toString('base64')}\ntrusted comment: ${comment}\n${global.toString('base64')}\n`;
}

for (const algorithm of ['ED', 'Ed']) test(`verifies ${algorithm} signatures and rejects tampered content and filename`, async () => {
  const key = await parseKey(keyText);
  const text = fixture(algorithm);
  assert.equal(await verifySignature(key, parseSignature(Buffer.from(text)), content), true);
  assert.equal(await verifySignature(key, parseSignature(Buffer.from(text)), Buffer.from('tampered')), false);
  assert.equal(await verifySignature(key, parseSignature(Buffer.from(text.replace('zig-test', 'zig-other'))), content), false);
});

test('accepts CRLF and a missing final newline', async () => {
  const key = await parseKey(keyText);
  for (const text of [fixture().replaceAll('\n', '\r\n'), fixture().trimEnd()]) {
    assert.equal(await verifySignature(key, parseSignature(Buffer.from(text)), content), true);
  }
});

test('rejects wrong signing keys', async () => {
  const key = await parseKey(keyText);
  key.id = Buffer.alloc(8);
  assert.equal(await verifySignature(key, parseSignature(Buffer.from(fixture())), content), false);
});

test('rejects truncated, malformed, and extra signature fields', () => {
  for (const text of [fixture().split('\n').slice(0, 3).join('\n'), fixture() + '\n', fixture().replace(/^untrusted/, 'invalid'), fixture().replace(/\n[^\n]+\ntrusted/, '\nAA==\ntrusted'), fixture().replace(/\n([^\n]+)\ntrusted/, '\n!$1\ntrusted')]) {
    assert.throws(() => parseSignature(Buffer.from(text)), /invalid minisign/);
  }
});
