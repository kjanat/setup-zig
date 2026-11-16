# setup-zig

Install a verified Zig compiler in GitHub Actions or Forgejo Actions and preserve Zig build caches between runs.

This fork is maintained at [kjanat/setup-zig](https://github.com/kjanat/setup-zig), based on [Matthew Lugg's setup-zig](https://codeberg.org/mlugg/setup-zig). Report issues and propose changes in this fork's GitHub repository.

## Usage

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: kjanat/setup-zig@master
  - run: zig build test
```

Pin the action to a full commit SHA for reproducible workflows. The examples use `master` to follow this fork's current development.

With no explicit version, the action reads `build.zig.zon` in the workspace. It uses the top-level `mach_zig_version` field first, then `minimum_zig_version`. Comments and nested dependency fields are ignored. A missing manifest or absent version field selects the latest stable release. A malformed manifest, invalid version, or failed version lookup fails setup with an error.

For a project in a subdirectory:

```yaml
- uses: kjanat/setup-zig@master
  with:
    manifest-path: packages/example/build.zig.zon
```

An explicit `version` takes precedence over the manifest:

```yaml
- uses: kjanat/setup-zig@master
  id: zig
  with:
    version: "0.15.2"
- run: zig version
```

Supported selectors are a release such as `0.15.2`, a specific nightly such as `0.14.0-dev.2+0884a4341`, `master` for the latest nightly, `latest` for the latest stable release, or a [Mach nominated version](https://machengine.org/about/nominated-zig/) such as `2024.5.0-mach`. Mirrors may remove older nightlies, making those versions unavailable.

On Forgejo, use the full repository URL if required by your runner, for example `https://github.com/kjanat/setup-zig@master`. The action runs on Node 24 and requires a runner that supports that action runtime.

## Inputs

| Input              | Default         | Purpose                                                                |
| ------------------ | --------------- | ---------------------------------------------------------------------- |
| `version`          | empty           | Compiler version or selector. Empty reads the manifest.                |
| `manifest-path`    | `build.zig.zon` | Manifest path relative to the workspace. Used when `version` is empty. |
| `mirror`           | empty           | Use one HTTPS download mirror instead of automatic mirror selection.   |
| `use-cache`        | `true`          | Restore and save Zig build caches.                                     |
| `cache-key`        | empty           | Additional build-cache key component, useful for matrix jobs.          |
| `cache-size-limit` | `2048`          | Maximum build-cache size in MiB. Zero disables the limit.              |
| `use-tool-cache`   | automatic       | Reuse extracted compiler installations on the runner.                  |

`use-tool-cache` defaults to `false` on GitHub-hosted runners and `true` elsewhere. Set it explicitly to `true` or `false` to override that choice.

## Outputs

| Output    | Purpose                                                  |
| --------- | -------------------------------------------------------- |
| `version` | The concrete version reported by the installed compiler. |
| `path`    | The directory containing the installed Zig executable.   |

The compiler directory is added to `PATH`. Setup verifies that `zig version` matches the resolved version before exporting outputs.

## Caching

The action uses three caches:

- Compiler archives are cached through the Actions cache service independently of `use-cache`.
- Extracted installations can be reused through the runner's tool cache when `use-tool-cache` is enabled.
- Zig build artifacts are restored and saved when `use-cache` is enabled. Both `ZIG_GLOBAL_CACHE_DIR` and `ZIG_LOCAL_CACHE_DIR` point to the workspace's `.zig-cache` directory.

Build-cache keys include the job name, compiler version, OS, architecture, and `cache-key`. Add matrix dimensions that distinguish builds, such as optimization mode, to `cache-key`. The OS and architecture are included automatically.

Cache-service failures produce warnings so installation and successful builds can continue. The post step saves using the cache identity resolved during setup, without looking up the version again. When the build cache exceeds `cache-size-limit`, its contents are cleared before saving an empty replacement. An unreadable cache size skips saving with a warning.

## Downloads and verification

Automatic downloads use the [Zig community mirror list](https://ziglang.org/download/community-mirrors/), tried in random order, with the official Zig website as a final fallback. If the mirror list cannot be fetched or validated, a built-in fallback list is used. Metadata and signature requests have a 15-second deadline; each archive download has a 120-second deadline.

Every newly downloaded archive is verified against Zig's minisign public key. The signed filename must also match the requested archive, preventing substitution with another signed build. Failed downloads and rejected archives are removed. Cached archives reuse the archive verified before saving.

To select a specific mirror:

```yaml
- uses: kjanat/setup-zig@master
  with:
    mirror: https://pkg.machengine.org/zig
```

Use automatic mirror selection where possible to distribute load. Overrides must use HTTPS without credentials. The official `ziglang.org` host is reserved for automatic fallback.

To add a community mirror, follow the Zig website's [mirror documentation](https://github.com/ziglang/www.ziglang.org/blob/main/MIRRORS.md).

## Development

Use Node 24 and the Bun version declared in `package.json`:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
node scripts/smoke.mjs 0.15.2 false
node scripts/smoke.mjs 0.15.2 true
```

TypeScript source modules live in `src/`. The distribution entry points are native ESM (`.mjs`). tsdown bundles runtime dependencies into `dist/`; `node_modules` is excluded from version control. Commit updated distribution files alongside source changes. `bun run check:dist` verifies that rebuilding reproduces the checked-in distribution.

Tests cover manifest parsing, historical archive naming, minisign verification and malformed input, HTTP errors and timeouts, optional-cache failures, and post-step state. The smoke script runs the bundled action from an isolated directory without `node_modules`, downloads Zig, and runs `zig init` and `zig build test`.

GitHub CI runs tests, checks the distribution and action metadata, and exercises installation on Linux x64/ARM64, Windows, and macOS with both tool-cache settings. Additional jobs check historical archive names and moving version selectors.
