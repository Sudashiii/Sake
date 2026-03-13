import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

function parseAllowedHosts(raw: string | undefined): string[] {
	return String(raw ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), 'VITE_');
	const allowedHosts = ['localhost', '127.0.0.1', ...parseAllowedHosts(env.VITE_ALLOWED_HOSTS)];

	return {
		plugins: [sveltekit()],
		server: {
			allowedHosts
		}
	};
});
