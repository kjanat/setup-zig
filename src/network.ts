import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

async function fetchResponse(url: string, timeout = 15000) {
	let response;
	try {
		response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
	} catch (error) {
		throw new Error(`Failed to fetch ${url}: ${(error instanceof Error ? error.message : String(error))}`);
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(`HTTP ${response.status} fetching ${url}`);
	}
	return response;
}

async function fetchJson(url: string): Promise<unknown> {
	const response = await fetchResponse(url);
	try {
		return await response.json();
	} catch (error) {
		throw new Error(`Failed to read JSON from ${url}: ${(error instanceof Error ? error.message : String(error))}`);
	}
}

async function downloadFile(url: string) {
	const response = await fetchResponse(url, 120000);
	const destination = path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), `setup-zig-${randomUUID()}`);
	try {
		if (!response.body) throw new Error('Empty response body');
		await pipeline(Readable.fromWeb(response.body), createWriteStream(destination, { flags: 'wx' }));
		return destination;
	} catch (error) {
		await fs.rm(destination, { force: true });
		throw new Error(`Failed to download ${url}: ${(error instanceof Error ? error.message : String(error))}`);
	}
}

export { downloadFile, fetchJson, fetchResponse };
