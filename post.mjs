import * as path from 'path';
import fs from 'node:fs/promises';
import * as core from '@actions/core';
import * as cache from '@actions/cache';

async function main() {
  try {
    const cache_path = core.getState('cache-path');
    const prefix = core.getState('cache-prefix');
    if (cache_path && prefix) {
      let accessible = true;
      try {
        await fs.access(cache_path, fs.constants.R_OK);
      } catch {
        accessible = false;
      }

      if (accessible) {
        core.info(`Checking size of cache directory at ${cache_path}`);
        const size = await dirSize(cache_path);
        const size_limit = Number(core.getState('cache-size-limit'));
        if (size === null) {
          core.warning('Skipping Zig cache save because its size could not be determined');
          return;
        }
        if (size_limit !== 0 && size > size_limit) {
          core.info(`Cache directory reached ${size} bytes, exceeding limit of ${size_limit} bytes; clearing cache`);
          // We want to clear the cache and start over. Unfortunately, we can't programmatically
          // remove the old cache entries, so we instead want to save an empty cache directory.
          // To do this, delete all the contents of the cache directory before saving the cache.
          await rmDirContents(cache_path);
        } else {
          core.info(`Cache directory is ${size} bytes, below limit of ${size_limit} bytes; keeping intact`);
        }

        const name = `${prefix}${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
        core.info(`Saving Zig cache with key '${name}'`);
        await cache.saveCache([cache_path], name);
      } else {
        core.info('Zig cache directory is inaccessible; nothing to save');
      }
    }
  } catch (err) {
    core.warning(`Could not save Zig build cache: ${err.message}`);
  }
}

async function dirSize(dir_path) {
  try {
    let total = 0;
    for (const ent of await fs.readdir(dir_path, { withFileTypes: true, recursive: true })) {
      if (ent.isFile()) {
        const p = path.join(ent.parentPath, ent.name);
        try {
          const stat = await fs.stat(p);
          total += stat.size;
        } catch (err) {
          core.warning(`Failed to stat ${p}: ${err}`);
          return null;
        }
      }
    }
    return total;
  } catch (err) {
    core.warning(`Failed to compute size of '${dir_path}': ${err}`);
    return null;
  }
}

async function rmDirContents(dir) {
  const entries = await fs.readdir(dir);
  await Promise.all(entries.map(e => fs.rm(path.join(dir, e), { recursive: true, force: true })));
}

export { main, dirSize };
main();
