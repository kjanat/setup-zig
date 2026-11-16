import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './helpers.ts';

interface Options {
	source?: string;
	version?: string;
	platform?: string;
	arch?: string;
	json?: unknown;
	missing?: boolean;
	inputs?: Record<string, string>;
}

async function common(
	{ source, version = '', platform = 'linux', arch = 'x64', json, missing = false, inputs = {} }: Options = {},
) {
	return load('common.ts', {
		fs: {
			promises: {
				readFile: async () => {
					if (missing) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
					return source ?? '.{}';
				},
			},
		},
		os: { arch: () => arch, platform: () => platform, endianness: () => 'LE' },
		'@actions/core': {
			getInput: (name: string): string => ({ version, ...inputs })[name] ?? '',
			info() {},
		},
		'./network.ts': {
			fetchJson: async () => {
				if (json instanceof Error) throw json;
				return json;
			},
		},
	});
}

for (const [version, expected] of [
	['0.14.0', 'zig-linux-x86_64-0.14.0'],
	['0.14.1', 'zig-x86_64-linux-0.14.1'],
	['0.15.0-dev.630+abcdef', 'zig-linux-x86_64-0.15.0-dev.630+abcdef'],
	['0.15.0-dev.631+9a3540d61', 'zig-x86_64-linux-0.15.0-dev.631+9a3540d61'],
]) {
	test(`archive naming for ${version}`, async () => {
		assert.equal(await (await common({ version })).getTarballName(), expected);
	});
}

for (const [version, arch] of [['0.15.0', 'armv7a'], ['0.15.1', 'arm']]) {
	test(`ARM archive naming for ${version}`, async () => {
		assert.equal(await (await common({ version, arch: 'arm' })).getTarballName(), `zig-${arch}-linux-${version}`);
	});
}

test('Windows archive extension and macOS architecture', async () => {
	assert.equal(await (await common({ version: '0.15.2', platform: 'win32' })).getTarballExt(), '.zip');
	assert.equal(
		await (await common({ version: '0.15.2', platform: 'darwin', arch: 'arm64' })).getTarballName(),
		'zig-aarch64-macos-0.15.2',
	);
});

test('manifest only uses top-level fields and decodes strings', async () => {
	const source =
		'.{ .dependencies = .{ .dep = .{ .minimum_zig_version = "0.11.0" } }, .minimum_zig_version = "0.15.\\x32" }';
	assert.equal(await (await common({ source })).getVersion(), '0.15.2');
});

test('malformed manifest fails instead of using latest', async () => {
	await assert.rejects(
		(await common({ source: '.{ .name = "oops" .minimum_zig_version = "0.15.2" }' })).getVersion(),
		/Failed to parse/,
	);
});

test('missing manifest and absent version use latest stable release', async () => {
	for (const missing of [true, false]) {
		const ctx = await common({
			missing,
			json: { master: { version: '0.17.0-dev.1+abc' }, '0.15.2': {}, '0.16.0': {}, '0.17.0-dev.1+abc': {} },
		});
		assert.equal(await ctx.getVersion(), '0.16.0');
	}
});

test('Mach field takes precedence and lookup errors remain errors', async () => {
	const source = '.{ .mach_zig_version = "2024.5.0-mach", .minimum_zig_version = "0.11.0" }';
	assert.equal(
		await (await common({ source, json: { '2024.5.0-mach': { version: '0.14.0-dev.1+abc' } } })).getVersion(),
		'0.14.0-dev.1+abc',
	);
	await assert.rejects((await common({ source, json: new Error('lookup failed') })).getVersion(), /lookup failed/);
});

test('master resolves a concrete nightly', async () => {
	assert.equal(
		await (await common({ version: 'master', json: { master: { version: '0.16.0-dev.1+abc' } } })).getVersion(),
		'0.16.0-dev.1+abc',
	);
});

for (const version of ['garbage', '../0.15.2', '0.15.0-dev.1+', '0.15']) {
	test(`reject invalid version ${version}`, async () => {
		await assert.rejects((await common({ version })).getVersion(), /Invalid/);
	});
}

test('unsupported platform fails before downloading', async () => {
	await assert.rejects((await common({ version: '0.15.2', platform: 'unknown' })).getTarballName(), /Unsupported/);
});

for (const value of ['-1', 'NaN', 'Infinity', '1e999']) {
	test(`reject invalid cache limit ${value}`, async () => {
		assert.throws((await common({ inputs: { 'cache-size-limit': value } })).getCacheSizeLimit, /nonnegative finite/);
	});
}

test('cache limits support the default, zero, and MiB conversion', async () => {
	assert.equal((await common()).getCacheSizeLimit(), 2048 * 1024 ** 2);
	assert.equal((await common({ inputs: { 'cache-size-limit': '0' } })).getCacheSizeLimit(), 0);
	assert.equal((await common({ inputs: { 'cache-size-limit': '1.5' } })).getCacheSizeLimit(), 1.5 * 1024 ** 2);
});
