import fs from 'node:fs';
import vm from 'node:vm';
import type * as Common from '../src/common.ts';
import type * as Main from '../src/main.ts';
import type * as Post from '../src/post.ts';

interface Modules {
	'common.ts': typeof Common;
	'main.ts': typeof Main;
	'post.ts': typeof Post;
}

const exportsOf: { [F in keyof Modules]: { [K in keyof Modules[F]]: true } } = {
	'common.ts': {
		getCachePrefix: true,
		getCacheSizeLimit: true,
		getTarballExt: true,
		getTarballName: true,
		getVersion: true,
		getZigCachePath: true,
	},
	'main.ts': { downloadFromMirror: true, downloadTarball: true, main: true, retrieveTarball: true },
	'post.ts': { dirSize: true, main: true },
};

function isModule<F extends keyof Modules>(file: F, namespace: object): namespace is Modules[F] {
	return Object.keys(exportsOf[file]).every(name => typeof Reflect.get(namespace, name) === 'function');
}

export async function load<F extends keyof Modules>(
	file: F,
	dependencies: Record<string, object> = {},
	globals: Record<string, unknown> = {},
): Promise<Modules[F]> {
	const url = new URL(`../src/${file}`, import.meta.url);
	const context = vm.createContext({
		process: { env: {}, platform: process.platform, cwd: process.cwd },
		Buffer,
		URL,
		AbortSignal,
		fetch,
		...globals,
	});
	const text = fs.readFileSync(url, 'utf8');
	const javascript = process.versions.bun
		? new Bun.Transpiler({ loader: 'ts', target: 'node' }).transformSync(text)
		: (await import('node:module')).stripTypeScriptTypes(text);
	const source = javascript.replace(/main\(\);\s*$/, '');
	const module = new vm.SourceTextModule(source, { context, identifier: url.href });
	await module.link(async specifier => {
		const dependency: object = dependencies[specifier]
			?? await import(specifier.startsWith('.') ? new URL(specifier, url).href : specifier);
		return new vm.SyntheticModule(Object.keys(dependency), function() {
			for (const [key, value] of Object.entries(dependency)) this.setExport(key, value);
		}, { context });
	});
	await module.evaluate();
	if (!isModule(file, module.namespace)) throw new Error(`${file} is missing expected exports`);
	return module.namespace;
}
