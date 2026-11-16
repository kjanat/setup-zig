import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { load } from './helpers.mjs';

function logger(inputs = {}, state = {}) {
	const warnings = [], failures = [], outputs = {}, variables = {};
	return {
		warnings,
		failures,
		outputs,
		variables,
		state,
		info() {},
		warning: m => warnings.push(m),
		setFailed: m => failures.push(m),
		getInput: n => inputs[n] ?? '',
		getBooleanInput: n => inputs[n] !== 'false',
		saveState: (n, v) => {
			state[n] = String(v);
		},
		getState: n => state[n] ?? '',
		addPath() {},
		setOutput: (n, v) => {
			outputs[n] = v;
		},
		exportVariable: (n, v) => {
			variables[n] = v;
		},
	};
}

async function directory(t) {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'setup-zig-test-'));
	t.after(() => fs.rm(dir, { recursive: true, force: true }));
	return dir;
}

for (const useCache of ['true', 'false']) {
	test(`setup tolerates build-cache failure with use-cache=${useCache}`, async t => {
		const dir = await directory(t);
		const core = logger({ 'use-cache': useCache });
		const ctx = await load('main.ts', {
			'@actions/core': core,
			'@actions/tool-cache': { find: () => dir },
			'@actions/exec': {
				getExecOutput: async executable => {
					assert.equal(executable, `"${path.join(dir, process.platform === 'win32' ? 'zig.exe' : 'zig')}"`);
					return { stdout: '0.15.2\n' };
				},
			},
			'@actions/cache': {
				isFeatureAvailable: () => true,
				restoreCache: async () => {
					throw new Error('cache offline');
				},
			},
			'./common.ts': {
				getVersion: async () => '0.15.2',
				getCacheSizeLimit: () => 1024,
				getZigCachePath: () => dir,
				getCachePrefix: async () => 'original-version-',
			},
		});
		await ctx.main();
		assert.deepEqual(core.failures, []);
		assert.equal(core.outputs.version, '0.15.2');
		assert.equal(core.outputs.path, dir);
		assert.equal(core.variables.ZIG_GLOBAL_CACHE_DIR, dir);
		assert.equal(core.state['cache-prefix'], useCache === 'true' ? 'original-version-' : undefined);
		assert.equal(core.warnings.length, useCache === 'true' ? 1 : 0);
	});
}

test('archive-cache failures still return the downloaded compiler', async t => {
	const dir = await directory(t);
	const downloaded = path.join(dir, 'download');
	await fs.writeFile(downloaded, 'verified archive');
	const core = logger({ mirror: 'https://example.com/zig' });
	const ctx = await load(
		'main.ts',
		{
			'@actions/core': core,
			'@actions/cache': {
				isFeatureAvailable: () => true,
				restoreCache: async () => {
					throw new Error('restore offline');
				},
				saveCache: async () => {
					throw new Error('save offline');
				},
			},
			'./common.ts': { getVersion: async () => '0.15.2' },
			'./network.ts': {
				downloadFile: async () => downloaded,
				fetchResponse: async () => ({ arrayBuffer: async () => Buffer.alloc(0) }),
			},
			'./minisign.ts': {
				parseKey() {},
				parseSignature: () => ({ trusted_comment: Buffer.from('timestamp:123 file:zig-test.tar.xz hashed') }),
				verifySignature: async () => true,
			},
		},
		{ process: { env: { RUNNER_TEMP: dir } } },
	);
	const result = await ctx.retrieveTarball('zig-test', '.tar.xz');
	assert.equal(await fs.readFile(result, 'utf8'), 'verified archive');
	assert.equal(core.warnings.length, 2);
	await assert.rejects(fs.access(downloaded));
});

test('mirror-list HTTP failure uses the fallback list', async t => {
	const dir = await directory(t);
	const downloaded = path.join(dir, 'download');
	await fs.writeFile(downloaded, 'archive');
	let attempted;
	const ctx = await load('main.ts', {
		'@actions/core': logger(),
		'./network.ts': {
			downloadFile: async url => {
				attempted = url;
				return downloaded;
			},
			fetchResponse: async url => {
				if (url.endsWith('community-mirrors.txt')) throw new Error('HTTP 503');
				return { arrayBuffer: async () => Buffer.alloc(0) };
			},
		},
		'./minisign.ts': {
			parseKey() {},
			parseSignature: () => ({ trusted_comment: Buffer.from('timestamp:123 file:zig-test.tar.xz hashed') }),
			verifySignature: async () => true,
		},
	});
	assert.equal(await ctx.downloadTarball('zig-test.tar.xz'), downloaded);
	assert.match(attempted, /^https:\/\//);
	assert.ok(!attempted.startsWith('https://ziglang.org/'));
});

test('signed archive with the wrong filename is rejected and removed', async t => {
	const dir = await directory(t);
	const downloaded = path.join(dir, 'download');
	await fs.writeFile(downloaded, 'archive');
	const ctx = await load('main.ts', {
		'./network.ts': {
			downloadFile: async () => downloaded,
			fetchResponse: async () => ({ arrayBuffer: async () => Buffer.alloc(0) }),
		},
		'./minisign.ts': {
			parseKey() {},
			parseSignature: () => ({ trusted_comment: Buffer.from('timestamp:123 file:wrong.tar.xz hashed') }),
			verifySignature: async () => true,
		},
	});
	await assert.rejects(
		ctx.downloadFromMirror('https://example.com', 'expected.tar.xz'),
		/filename verification failed/,
	);
	await assert.rejects(fs.access(downloaded));
});

for (const limit of [0, 1]) {
	test(`post uses saved identity and handles cache size limit ${limit}`, async t => {
		const dir = await directory(t);
		await fs.writeFile(path.join(dir, 'artifact'), 'some cache bytes');
		const core = logger(
			{},
			{ 'cache-path': dir, 'cache-prefix': 'original-version-', 'cache-size-limit': String(limit) },
		);
		let savedKey;
		const ctx = await load(
			'post.ts',
			{
				'@actions/core': core,
				'@actions/cache': {
					saveCache: async (paths, key) => {
						savedKey = key;
						assert.deepEqual(Array.from(paths), [dir]);
						const entries = await fs.readdir(dir);
						assert.equal(entries.length, limit === 0 ? 1 : 0);
						throw new Error('save unavailable');
					},
				},
			},
			{ process: { env: { GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2' } } },
		);
		await ctx.main();
		assert.equal(savedKey, 'original-version-123-2');
		assert.deepEqual(core.failures, []);
		assert.match(core.warnings.join('\n'), /save unavailable/);
	});
}

test('post skips saving after setup never reached cache initialization', async () => {
	const ctx = await load('post.ts', {
		'@actions/core': logger(),
		'@actions/cache': { saveCache: () => assert.fail('should not save') },
	});
	await ctx.main();
});
