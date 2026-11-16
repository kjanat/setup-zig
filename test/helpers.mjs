import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

export async function load(file, dependencies = {}, globals = {}) {
	const url = new URL(`../src/${file}`, import.meta.url);
	const context = vm.createContext({
		process: { env: {}, platform: process.platform, cwd: process.cwd },
		Buffer,
		URL,
		AbortSignal,
		fetch,
		...globals,
	});
	const source = stripTypeScriptTypes(fs.readFileSync(url, 'utf8')).replace(/main\(\);\s*$/, '');
	const module = new vm.SourceTextModule(source, { context, identifier: url.href });
	await module.link(async specifier => {
		const dependency = dependencies[specifier]
			?? await import(specifier.startsWith('.') ? new URL(specifier, url).href : specifier);
		return new vm.SyntheticModule(Object.keys(dependency), function() {
			for (const [key, value] of Object.entries(dependency)) this.setExport(key, value);
		}, { context });
	});
	await module.evaluate();
	return module.namespace;
}
