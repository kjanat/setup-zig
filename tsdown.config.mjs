import { defineConfig } from 'tsdown';
import license from 'rollup-plugin-license';

export default defineConfig({
  entry: ['main.mjs', 'post.mjs'],
  outDir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node24',
  dts: false,
  clean: true,
  shims: true,
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
  plugins: [license({ thirdParty: { output: 'dist/THIRD_PARTY_LICENSES.txt' } })],
  outputOptions: { comments: { legal: true } },
});
