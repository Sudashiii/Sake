import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function parseDotEnv(content) {
	const env = {};
	const lines = content.split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		const equalsIndex = trimmed.indexOf('=');
		if (equalsIndex === -1) {
			continue;
		}

		const key = trimmed.slice(0, equalsIndex).trim();
		let value = trimmed.slice(equalsIndex + 1).trim();
		if (!key) {
			continue;
		}

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		env[key] = value;
	}

	return env;
}

function loadProjectEnv(cwd) {
	const envPath = path.join(cwd, '.env');
	if (!fs.existsSync(envPath)) {
		return {};
	}
	return parseDotEnv(fs.readFileSync(envPath, 'utf8'));
}

function mergeBuildEnv(projectEnv, currentEnv) {
	const mergedEnv = { ...projectEnv };

	for (const [key, value] of Object.entries(currentEnv)) {
		if (value !== '') {
			mergedEnv[key] = value;
			continue;
		}

		if (!(key in mergedEnv)) {
			mergedEnv[key] = value;
		}
	}

	return mergedEnv;
}

async function main() {
	const cwd = process.cwd();
	const projectEnv = loadProjectEnv(cwd);
	const childEnv = mergeBuildEnv(projectEnv, process.env);

	const child = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', 'build'], {
		cwd,
		env: childEnv,
		stdio: 'inherit'
	});

	child.on('exit', (code, signal) => {
		if (signal) {
			console.error(`Process terminated by signal: ${signal}`);
			process.exit(1);
		}
		process.exit(code ?? 1);
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
