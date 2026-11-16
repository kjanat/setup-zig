import * as core from '@actions/core';
import { jsonic } from '@tabnas/jsonic';
import { Tabnas } from '@tabnas/parser';
import { Zon } from '@tabnas/zon';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { fetchJson } from './network.ts';

const zonParser = new Tabnas().use(jsonic).use(Zon);

const VERSIONS_JSON = 'https://ziglang.org/download/index.json';
const MACH_VERSIONS_JSON = 'https://pkg.machengine.org/zig/index.json';

let _cached_version: string | null = null;
async function getVersion() {
	if (_cached_version !== null) return _cached_version;
	let raw = core.getInput('version');
	if (raw === '') {
		const manifest = core.getInput('manifest-path') || 'build.zig.zon';
		let source;
		try {
			source = await fs.promises.readFile(manifest, 'utf8');
		} catch (error) {
			if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'ENOENT') throw error;
			core.info(`${manifest} not found (using latest)`);
		}
		if (source !== undefined) {
			let zon: unknown;
			try {
				zon = zonParser.parse(source);
			} catch (error) {
				throw new Error(`Failed to parse ${manifest}: ${(error instanceof Error ? error.message : String(error))}`);
			}
			if (!zon || (Array.isArray(zon) && zon.length !== 0) || typeof zon !== 'object') {
				throw new Error(`${manifest} must contain a ZON struct`);
			}
			const mach = 'mach_zig_version' in zon ? zon.mach_zig_version : undefined;
			const minimum = 'minimum_zig_version' in zon ? zon.minimum_zig_version : undefined;
			const candidate = mach ?? minimum ?? '';
			if (typeof candidate !== 'string') throw new Error(`Zig version in ${manifest} must be a string`);
			raw = candidate;
			if (raw === '') core.info(`No Zig version specified in ${manifest} (using latest)`);
		}
		if (raw === '') raw = 'latest';
	}
	let version;
	if (raw === 'master') {
		const versions = await fetchJson(VERSIONS_JSON);
		version = versionFromIndex(versions, 'master');
	} else if (raw === 'latest') {
		const versions = await fetchJson(VERSIONS_JSON);
		if (typeof versions !== 'object' || versions === null) throw new Error('Invalid Zig version index');
		const releases = Object.keys(versions).filter(v => /^\d+\.\d+\.\d+$/.test(v));
		version = releases.sort((a, b) => versionLessThan(a, b) ? 1 : versionLessThan(b, a) ? -1 : 0)[0];
	} else if (/^\d+\.\d+\.\d+-mach$/.test(raw)) {
		const versions = await fetchJson(MACH_VERSIONS_JSON);
		version = versionFromIndex(versions, raw);
		if (!version) throw new Error(`Mach nominated version '${raw}' not found`);
	} else {
		version = raw;
	}
	if (typeof version !== 'string' || parseVersion(version) === null) {
		throw new Error(`Invalid or unavailable Zig version: ${version ?? raw}`);
	}
	_cached_version = version;
	return version;
}

async function getTarballName() {
	const version = await getVersion();

	const architectures: Record<string, string> = {
		arm: 'arm',
		arm64: 'aarch64',
		loong64: 'loongarch64',
		mips: 'mips',
		mipsel: 'mipsel',
		mips64: 'mips64',
		mips64el: 'mips64el',
		ppc64: 'powerpc64',
		riscv64: 'riscv64',
		s390x: 's390x',
		ia32: 'x86',
		x64: 'x86_64',
	};
	let arch = architectures[os.arch()];

	// For some incomprehensible reason, Node.js's brain-damaged build system explicitly throws away
	// the knowledge that it is building for ppc64le, so os.arch() will identify it as ppc64 even on
	// little endian.
	if (arch === 'powerpc64' && os.endianness() === 'LE') {
		arch = 'powerpc64le';
	}

	// Before 0.15.1, Zig used 'armv7a' as the arch name for ARM binaries.
	if (arch === 'arm' && versionLessThan(version, '0.15.1')) {
		arch = 'armv7a';
	}

	const platforms: Record<string, string> = {
		android: 'android',
		freebsd: 'freebsd',
		sunos: 'illumos',
		linux: 'linux',
		darwin: 'macos',
		netbsd: 'netbsd',
		openbsd: 'openbsd',
		win32: 'windows',
	};
	const platform = platforms[os.platform()];

	if (!arch || !platform) {
		throw new Error(`Unsupported Zig platform: ${os.platform()}/${os.arch()}`);
	}

	// Before 0.14.1, Zig tarballs were named like 'zig-linux-x86_64-0.14.0', with the arch
	// and OS fields reversed from the order we use today.
	if (
		versionLessThan(version, '0.14.1')
		|| (!versionLessThan(version, '0.15.0-dev.0+0') && versionLessThan(version, '0.15.0-dev.631+9a3540d61'))
	) {
		return `zig-${platform}-${arch}-${version}`;
	}

	return `zig-${arch}-${platform}-${version}`;
}

// Returns `true` if `cur_ver` represents a version less then (i.e. older than) `min_ver`.
// Otherwise, returns `false`.
// If `cur_ver` or `min_ver` is malformed, returns `false`.
function versionLessThan(cur_ver: string, min_ver: string) {
	const cur = parseVersion(cur_ver);
	const min = parseVersion(min_ver);
	if (cur === null || min === null) return false;
	// Treating 0.1.2 as 0.1.2-dev+INF makes the comparisons easy!
	const cur_dev = cur.dev === null ? Infinity : cur.dev;
	const min_dev = min.dev === null ? Infinity : min.dev;

	if (cur.major != min.major) return cur.major < min.major;
	if (cur.minor != min.minor) return cur.minor < min.minor;
	if (cur.patch != min.patch) return cur.patch < min.patch;
	return cur_dev < min_dev;
}

// Returns object with keys 'major', 'minor', 'patch', and 'dev'.
// 'dev' is `null` if `str` was not a dev version.
// On failure, returns `null`.
function parseVersion(str: string) {
	const match = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-dev\.(?<dev>\d+)\+[0-9a-f]+)?$/.exec(str);
	if (match?.groups === undefined) return null;
	return {
		major: Number(match.groups['major']),
		minor: Number(match.groups['minor']),
		patch: Number(match.groups['patch']),
		dev: match.groups['dev'] === undefined ? null : Number(match.groups['dev']),
	};
}

async function getTarballExt() {
	if (os.platform() == 'win32') return '.zip';
	return '.tar.xz';
}

async function getCachePrefix() {
	const tarball_name = await getTarballName();
	const job_name = (process.env.GITHUB_JOB || 'zig').replaceAll(/[^\w]/g, '_');
	const user_key = core.getInput('cache-key');

	return `setup-zig-cache-v2-${job_name}-${tarball_name}-${user_key}-`;
}

function getZigCachePath() {
	return path.join(process.env['GITHUB_WORKSPACE'] ?? process.cwd(), '.zig-cache');
}

function getCacheSizeLimit() {
	const raw = core.getInput('cache-size-limit');
	const mib = raw === '' ? 2048 : Number(raw);
	const bytes = mib * 1024 * 1024;
	if (!Number.isFinite(bytes) || bytes < 0) {
		throw new Error("'cache-size-limit' must be a nonnegative finite number of MiB");
	}
	return bytes;
}

function versionFromIndex(index: unknown, key: string): string | undefined {
	if (typeof index !== 'object' || index === null || !(key in index)) return undefined;
	const entry: unknown = Reflect.get(index, key);
	if (typeof entry !== 'object' || entry === null || !('version' in entry)) return undefined;
	return typeof entry.version === 'string' ? entry.version : undefined;
}

export { getCachePrefix, getCacheSizeLimit, getTarballExt, getTarballName, getVersion, getZigCachePath };
