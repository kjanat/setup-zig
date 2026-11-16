import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

async function fetchResponse(url, timeout = 15000) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error.message}`);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response;
}

async function fetchJson(url) {
  const response = await fetchResponse(url);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to read JSON from ${url}: ${error.message}`);
  }
}

async function downloadFile(url) {
  const response = await fetchResponse(url, 120000);
  const destination = path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), `setup-zig-${randomUUID()}`);
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(destination, { flags: 'wx' }));
    return destination;
  } catch (error) {
    await fs.rm(destination, { force: true });
    throw new Error(`Failed to download ${url}: ${error.message}`);
  }
}

export { fetchResponse, fetchJson, downloadFile };
