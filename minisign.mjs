import * as crypto from 'node:crypto';

// Parse a minisign key represented as a base64 string.
// Throws exceptions on invalid keys.
async function parseKey(key_str) {
  const key_info = decodeBase64(key_str, 42);
  if (key_info.subarray(0, 2).toString() !== 'Ed') throw new Error('invalid public key algorithm');

  const id = key_info.subarray(2, 10);
  const key = key_info.subarray(10);

  if (key.byteLength !== 32) {
    throw new Error('invalid public key given');
  }

  return {
    id: id,
    key: await crypto.subtle.importKey('raw', key, 'Ed25519', false, ['verify']),
  };
}

// Parse a buffer containing the contents of a minisign signature file.
// Throws exceptions on invalid signature files.
function parseSignature(sig_buf) {
  const lines = sig_buf.toString('utf8').replaceAll('\r\n', '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length > 4) throw new Error('invalid minisign signature: trailing bytes');
  if (lines.length !== 4) throw new Error('invalid minisign signature: expected four lines');
  if (!lines[0].startsWith('untrusted comment: ')) {
    throw new Error('invalid minisign signature: bad untrusted comment header');
  }
  if (!lines[2].startsWith('trusted comment: ')) {
    throw new Error('invalid minisign signature: bad trusted comment header');
  }
  const sig_info = decodeBase64(lines[1], 74);
  const global_signature = decodeBase64(lines[3], 64);
  return {
    algorithm: sig_info.subarray(0, 2),
    key_id: sig_info.subarray(2, 10),
    signature: sig_info.subarray(10),
    trusted_comment: Buffer.from(lines[2].slice('trusted comment: '.length)),
    global_signature,
  };
}

// Given a parsed key, parsed signature file, and raw file content, verifies the signature,
// including the global signature (hence validating the trusted comment). Does not throw.
// Returns 'true' if the signature is valid for this file, 'false' otherwise.
async function verifySignature(pubkey, signature, file_content) {
  if (!signature.key_id.equals(pubkey.id)) {
    return false; // wrong key
  }

  let signed_content;
  if (signature.algorithm.equals(Buffer.from('ED'))) {
    const hash = crypto.createHash('BLAKE2b512');
    hash.update(file_content);
    signed_content = hash.digest();
  } else if (signature.algorithm.equals(Buffer.from('Ed'))) {
    signed_content = file_content;
  } else {
    return false; // unsupported algorithm
  }

  if (!await crypto.subtle.verify('Ed25519', pubkey.key, signature.signature, signed_content)) {
    return false; // signature verification failure
  }

  const global_signed_content = Buffer.concat([signature.signature, signature.trusted_comment]);
  if (!await crypto.subtle.verify('Ed25519', pubkey.key, signature.global_signature, global_signed_content)) {
    return false; // signature verification failure
  }

  return true;
}

function decodeBase64(text, length) {
  const data = Buffer.from(text, 'base64');
  if (data.length !== length || data.toString('base64') !== text) {
    throw new Error('invalid minisign base64 or field length');
  }
  return data;
}

export { parseKey, parseSignature, verifySignature };
