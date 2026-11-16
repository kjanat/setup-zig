import license from 'rollup-plugin-license';
import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/main.ts', 'src/post.ts'],
	outDir: 'dist',
	format: 'esm',
	fixedExtension: true,
	platform: 'node',
	target: 'node24',
	dts: false,
	clean: true,
	shims: true,
	deps: { alwaysBundle: [/.*/], onlyBundle: false },
	plugins: [license({ thirdParty: { output: 'dist/THIRD_PARTY_LICENSES.txt' } })],
	outputOptions: { comments: { legal: true } },
});
