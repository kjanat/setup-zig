import license from 'rollup-plugin-license';
import { defineConfig, type UserConfig } from 'tsdown';

export default defineConfig(['main', 'post'].map((entry): UserConfig => ({
	entry: [`src/${entry}.ts`],
	outDir: 'dist',
	format: 'esm',
	fixedExtension: true,
	platform: 'node',
	target: 'node24',
	dts: false,
	clean: false,
	minify: true,
	shims: true,
	deps: { alwaysBundle: [/.*/], onlyBundle: false },
	plugins: [license({ banner: '<%= dependencies.map(dependency => dependency.text()).join("\\n\\n") %>' })],
	outputOptions: { codeSplitting: false, comments: { legal: true } },
})));
