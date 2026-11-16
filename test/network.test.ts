import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import { test } from 'node:test';
import { downloadFile, fetchJson, fetchResponse } from '../src/network.ts';

test('HTTP errors, invalid JSON, timeouts, and streamed downloads', async t => {
	const server = http.createServer((req, res) => {
		if (req.url === '/error') {
			res.writeHead(503);
			res.end('unavailable');
		} else if (req.url === '/invalid') res.end('{');
		else if (req.url === '/slow') { /* Client timeout closes this connection. */ }
		else res.end('download fixture');
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	t.after(() => {
		server.closeAllConnections();
		server.close();
	});
	const address = server.address();
	assert.ok(address !== null && typeof address === 'object');
	const base = `http://127.0.0.1:${address.port}`;
	await assert.rejects(fetchResponse(`${base}/error`), /HTTP 503/);
	await assert.rejects(fetchJson(`${base}/invalid`), /Failed to read JSON/);
	await assert.rejects(fetchResponse(`${base}/slow`, 20), /timeout|timed out/i);
	const downloaded = await downloadFile(base);
	t.after(() => fs.rm(downloaded, { force: true }));
	assert.equal(await fs.readFile(downloaded, 'utf8'), 'download fixture');
});
