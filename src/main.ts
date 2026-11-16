import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import fs from 'node:fs/promises';
import * as path from 'path';
import * as common from './common.ts';
import * as minisign from './minisign.ts';
import { downloadFile, fetchResponse } from './network.ts';

// Upstream's minisign key, from https://ziglang.org/download
const MINISIGN_KEY = 'RWSGOq2NVecA2UPNdBUZykf1CCb147pkmdtYxgb3Ti+JO/wCYvhbAb/U';

// The base URL of the official builds of Zig. This is only used as a fallback, if all mirrors fail.
const CANONICAL_DEV = 'https://ziglang.org/builds';
const CANONICAL_RELEASE = 'https://ziglang.org/download';

// The URL of the mirror list. This should be an ASCII-encoded text file, with one mirror per LF-separated line.
const MIRRORS_URL = 'https://ziglang.org/download/community-mirrors.txt';

async function downloadFromMirror(mirror: string, tarball_filename: string) {
	const tarball_path = await downloadFile(`${mirror}/${tarball_filename}?source=github-kjanat-setup-zig`);

	try {
		const signature_response = await fetchResponse(
			`${mirror}/${tarball_filename}.minisig?source=github-kjanat-setup-zig`,
		);
		const signature_data = Buffer.from(await signature_response.arrayBuffer());

		const tarball_data = await fs.readFile(tarball_path);

		const key = await minisign.parseKey(MINISIGN_KEY);
		const signature = minisign.parseSignature(signature_data);
		if (!await minisign.verifySignature(key, signature, tarball_data)) {
			throw new Error(`signature verification failed for '${mirror}/${tarball_filename}'`);
		}

		// Parse the trusted comment to validate the tarball name.
		// This prevents a malicious actor from trying to pass off one signed tarball as another.
		const match = /^timestamp:\d+\s+file:([^\s]+)\s+hashed$/.exec(signature.trusted_comment.toString());
		if (match === null || match[1] !== tarball_filename) {
			throw new Error(`filename verification failed for '${mirror}/${tarball_filename}'`);
		}

		return tarball_path;
	} catch (error) {
		await fs.rm(tarball_path, { force: true });
		throw error;
	}
}

async function downloadTarball(tarball_filename: string) {
	const preferred_mirror = core.getInput('mirror');
	if (preferred_mirror) {
		const url = new URL(preferred_mirror);
		if (url.protocol !== 'https:' || url.username || url.password) {
			throw new Error('Mirror override must be an HTTPS URL without credentials');
		}
		if (url.hostname === 'ziglang.org') {
			throw new Error("'https://ziglang.org' cannot be used as mirror override; see README.md");
		}
		core.info(`Using mirror: ${preferred_mirror}`);
		return await downloadFromMirror(preferred_mirror.replace(/\/$/, ''), tarball_filename);
	}

	let mirrors;
	try {
		// Fetch an up-to-date list of available mirrors from ziglang.org.
		const mirrors_response = await fetchResponse(MIRRORS_URL);
		mirrors = (await mirrors_response.text()).split('\n').map(url => url.trim()).filter(Boolean);
		if (!mirrors.length) throw new Error('Empty mirror list');
		mirrors = mirrors.map(mirror => {
			const url = new URL(mirror);
			if (url.protocol !== 'https:') throw new Error('Mirror list must use HTTPS');
			return url.href.replace(/\/$/, '');
		});
	} catch {
		// ziglang.org itself is inaccessible. As a fallback (so that ziglang.org outages don't break
		// this Action), use a hardcoded mirror list. This was manually fetched from ziglang.org, and I
		// expect that at least some of these mirrors will continue working. It only needs to be updated
		// if the upstream list changes *significantly*.
		mirrors = [
			'https://pkg.machengine.org/zig',
			'https://zigmirror.hryx.net/zig',
			'https://zig.linus.dev/zig',
			'https://zig.squirl.dev',
			'https://zig.florent.dev',
			'https://zig.mirror.mschae23.de/zig',
			'https://zigmirror.meox.dev',
			'https://ziglang.freetls.fastly.net',
			'https://zig.tilok.dev',
			'https://zig-mirror.tsimnet.eu/zig',
			'https://zig.karearl.com/zig',
			'https://pkg.earth/zig',
			'https://fs.liujiacai.net/zigbuilds',
		];
	}

	core.info(`Available mirrors: ${mirrors.join(', ')}`);

	// We will attempt all mirrors before making a last-ditch attempt to the official download.
	// To avoid hammering a single mirror, we first randomize the array.
	const shuffled_mirrors = mirrors.map(mirror => ({ mirror, order: Math.random() })).sort((a, b) => a.order - b.order)
		.map(item => item.mirror);
	for (const mirror of shuffled_mirrors) {
		core.info(`Attempting mirror: ${mirror}`);
		try {
			return await downloadFromMirror(mirror, tarball_filename);
		} catch (e) {
			core.info(`Mirror failed with error: ${e}`);
			// continue loop to next mirror
		}
	}

	// As a fallback, attempt ziglang.org.
	const zig_version = tarball_filename.match(/\d+\.\d+\.\d+(-dev\.\d+\+[0-9a-f]+)?/)?.[0];
	if (!zig_version) throw new Error(`Invalid archive filename: ${tarball_filename}`);
	const canonical = zig_version.includes('-dev') ? CANONICAL_DEV : `${CANONICAL_RELEASE}/${zig_version}`;
	core.info(`Attempting official: ${canonical}`);
	return await downloadFromMirror(canonical, tarball_filename);
}

async function retrieveTarball(tarball_name: string, tarball_ext: string) {
	const cache_key = `setup-zig-tarball-${tarball_name}`;
	const tarball_basename = `${tarball_name}${tarball_ext}`;
	const runner_temp = process.env.RUNNER_TEMP;
	if (!runner_temp) throw new Error('RUNNER_TEMP is required');
	const tarball_cache_path = path.join(runner_temp, tarball_basename);

	try {
		if (cache.isFeatureAvailable() && await cache.restoreCache([tarball_cache_path], cache_key)) {
			return tarball_cache_path;
		}
	} catch (error) {
		core.warning(`Could not restore Zig archive cache: ${(error instanceof Error ? error.message : String(error))}`);
	}

	core.info(`Cache miss. Fetching Zig ${await common.getVersion()}`);
	const downloaded_path = await downloadTarball(tarball_basename);
	try {
		await fs.copyFile(downloaded_path, tarball_cache_path);
	} finally {
		await fs.rm(downloaded_path, { force: true });
	}
	try {
		if (cache.isFeatureAvailable()) await cache.saveCache([tarball_cache_path], cache_key);
	} catch (error) {
		core.warning(`Could not save Zig archive cache: ${(error instanceof Error ? error.message : String(error))}`);
	}
	return tarball_cache_path;
}

async function main() {
	try {
		const size_limit = common.getCacheSizeLimit();
		const requested_version = await common.getVersion();
		// We will check whether Zig is stored in the cache. We use two separate caches.
		// * 'tool-cache' caches the final extracted directory if the same Zig build is used multiple
		//   times by one job. We have this dependency anyway for archive extraction.
		// * 'cache' only caches the unextracted archive, but it does so across runs. It's a little
		//   less efficient, but still much preferable to fetching Zig from a mirror. We have this
		//   dependency anyway for caching the global Zig cache.
		//
		// Unfortunately, tool-cache can lead to serious performance problems on GitHub-hosted Actions
		// runners -- or their Windows ones at least, because the tool cache is stored on a slow drive.
		// There are even hacky workarounds for this in official Actions:
		//
		// https://github.com/actions/setup-go/blob/d35c59abb061a4a6fb18e82ac0862c26744d6ab5/src/installer.ts#L174
		//
		// Since tool-cache is only really useful on self-hosted runners, let's just disable it by
		// default on GitHub-hosted runners, and hence execute Zig straight out of its extracted dir.
		const tool_cache_input = core.getInput('use-tool-cache');
		let use_tool_cache: boolean;
		if (tool_cache_input === 'true') {
			use_tool_cache = true;
		} else if (tool_cache_input === 'false') {
			use_tool_cache = false;
		} else if (tool_cache_input === '') {
			use_tool_cache = process.env['RUNNER_ENVIRONMENT'] !== 'github-hosted';
		} else {
			throw new Error("Invalid 'use-tool-cache' value. Valid values: 'true', 'false'");
		}
		core.info(`Using tool-cache: ${use_tool_cache}`);

		let zig_dir;
		if (use_tool_cache) {
			zig_dir = tc.find('zig', await common.getVersion());
		}
		if (zig_dir) {
			core.info('Using cached Zig installation from tool-cache');
		} else {
			const tarball_name = await common.getTarballName();
			const tarball_ext = await common.getTarballExt();

			core.info(`Fetching ${tarball_name}${tarball_ext}`);
			const fetch_start = Date.now();
			const tarball_path = await retrieveTarball(tarball_name, tarball_ext);
			core.info(`Fetch took ${Date.now() - fetch_start} ms`);

			core.info(`Extracting tarball ${tarball_name}${tarball_ext}`);

			const extract_start = Date.now();
			const zig_parent_dir = tarball_ext === '.zip'
				? await tc.extractZip(tarball_path)
				: await tc.extractTar(tarball_path, undefined, 'xJ'); // J for xz
			core.info(`Extract took ${Date.now() - extract_start} ms`);

			const zig_inner_dir = path.join(zig_parent_dir, tarball_name);
			if (use_tool_cache) {
				core.info('Copying Zig installation to tool-cache');
				zig_dir = await tc.cacheDir(zig_inner_dir, 'zig', await common.getVersion());
			} else {
				zig_dir = zig_inner_dir;
			}
		}

		core.addPath(zig_dir);
		const zig_version =
			(await exec.getExecOutput(`"${path.join(zig_dir, process.platform === 'win32' ? 'zig.exe' : 'zig')}"`, [
				'version',
			])).stdout.trim();
		if (zig_version !== requested_version) {
			throw new Error(`Zig version mismatch: expected ${requested_version}, got ${zig_version}`);
		}
		core.info(`Resolved Zig version ${zig_version}`);
		core.setOutput('version', zig_version);
		core.setOutput('path', zig_dir);

		const cache_path = common.getZigCachePath();
		core.exportVariable('ZIG_GLOBAL_CACHE_DIR', cache_path);
		core.exportVariable('ZIG_LOCAL_CACHE_DIR', cache_path);

		if (core.getBooleanInput('use-cache') && cache.isFeatureAvailable()) {
			const cache_prefix = await common.getCachePrefix();
			core.info(`Attempting restore of Zig cache with prefix '${cache_prefix}'`);
			core.saveState('cache-path', cache_path);
			core.saveState('cache-prefix', cache_prefix);
			core.saveState('cache-size-limit', size_limit);
			let hit;
			try {
				hit = await cache.restoreCache([cache_path], cache_prefix);
			} catch (error) {
				core.warning(`Could not restore Zig build cache: ${(error instanceof Error ? error.message : String(error))}`);
			}
			if (hit === undefined) {
				core.info(`Cache miss: leaving Zig cache directory at ${cache_path} unpopulated`);
			} else {
				core.info(`Cache hit (key '${hit}'): populating Zig cache directory at ${cache_path}`);
			}
		}
	} catch (err) {
		core.setFailed(err instanceof Error ? err.message : String(err));
	}
}

export { downloadFromMirror, downloadTarball, main, retrieveTarball };
main();
