import { d as info, g as warning, r as saveCache, u as getState } from "./cache-BNgf87Wy.mjs";
import * as path from "path";
import fs from "node:fs/promises";
// src/post.ts
async function main() {
	try {
		const cache_path = getState("cache-path");
		const prefix = getState("cache-prefix");
		if (cache_path && prefix) {
			let accessible = true;
			try {
				await fs.access(cache_path, fs.constants.R_OK);
			} catch {
				accessible = false;
			}
			if (accessible) {
				info(`Checking size of cache directory at ${cache_path}`);
				const size = await dirSize(cache_path);
				const size_limit = Number(getState("cache-size-limit"));
				if (size === null) {
					warning("Skipping Zig cache save because its size could not be determined");
					return;
				}
				if (size_limit !== 0 && size > size_limit) {
					info(`Cache directory reached ${size} bytes, exceeding limit of ${size_limit} bytes; clearing cache`);
					await rmDirContents(cache_path);
				} else info(`Cache directory is ${size} bytes, below limit of ${size_limit} bytes; keeping intact`);
				const name = `${prefix}${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
				info(`Saving Zig cache with key '${name}'`);
				await saveCache([cache_path], name);
			} else info("Zig cache directory is inaccessible; nothing to save");
		}
	} catch (err) {
		warning(`Could not save Zig build cache: ${err instanceof Error ? err.message : String(err)}`);
	}
}
async function dirSize(dir_path) {
	try {
		let total = 0;
		for (const ent of await fs.readdir(dir_path, {
			withFileTypes: true,
			recursive: true
		})) if (ent.isFile()) {
			const p = path.join(ent.parentPath, ent.name);
			try {
				const stat = await fs.stat(p);
				total += stat.size;
			} catch (err) {
				warning(`Failed to stat ${p}: ${err}`);
				return null;
			}
		}
		return total;
	} catch (err) {
		warning(`Failed to compute size of '${dir_path}': ${err}`);
		return null;
	}
}
async function rmDirContents(dir) {
	const entries = await fs.readdir(dir);
	await Promise.all(entries.map((e) => fs.rm(path.join(dir, e), {
		recursive: true,
		force: true
	})));
}
main();
export { dirSize, main };
