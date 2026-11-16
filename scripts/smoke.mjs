import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run the shipped action in isolation, with no node_modules or cache service.
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'setup-zig-smoke-'));
try {
	const action = path.join(root, 'action');
	await fs.cp(fileURLToPath(new URL('../dist', import.meta.url)), action, { recursive: true });
	const env = {
		PATH: process.env.PATH,
		HOME: os.homedir(),
		RUNNER_TEMP: root,
		RUNNER_TOOL_CACHE: path.join(root, 'tools'),
		GITHUB_WORKSPACE: root,
		GITHUB_JOB: 'smoke',
		GITHUB_RUN_ID: '1',
		GITHUB_RUN_ATTEMPT: '1',
		INPUT_VERSION: process.argv[2] || '0.15.2',
		'INPUT_USE-CACHE': 'false',
		'INPUT_CACHE-SIZE-LIMIT': '2048',
		'INPUT_USE-TOOL-CACHE': process.argv[3] || 'false',
	};
	for (const name of ['GITHUB_PATH', 'GITHUB_ENV', 'GITHUB_OUTPUT', 'GITHUB_STATE']) {
		env[name] = path.join(root, name);
		await fs.writeFile(env[name], '');
	}
	function run(executable, args, cwd = root) {
		const result = spawnSync(executable, args, { env, cwd, encoding: 'utf8', timeout: 300000 });
		process.stdout.write(result.stdout || '');
		process.stderr.write(result.stderr || '');
		if (result.error) throw result.error;
		if (result.status !== 0) throw new Error(`${executable} exited ${result.status}`);
	}
	run(process.execPath, [path.join(action, 'main.mjs')]);
	const output = await fs.readFile(env.GITHUB_OUTPUT, 'utf8');
	const zigDir = /^path<<[^\n]+\n([^\n]+)\n/m.exec(output)?.[1];
	if (!zigDir) throw new Error('Missing installation path output');
	const zig = path.join(zigDir, process.platform === 'win32' ? 'zig.exe' : 'zig');
	run(zig, ['version']);
	const project = path.join(root, 'project');
	await fs.mkdir(project);
	run(zig, ['init'], project);
	run(zig, ['build', 'test'], project);
	run(process.execPath, [path.join(action, 'post.mjs')]);
	if (env['INPUT_USE-TOOL-CACHE'] === 'true') run(process.execPath, [path.join(action, 'main.mjs')]);
	console.log('Bundled action installed Zig and built a generated project successfully.');
} finally {
	await fs.rm(root, { recursive: true, force: true });
}
