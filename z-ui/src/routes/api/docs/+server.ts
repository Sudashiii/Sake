import { getApiRouteCatalog } from '$lib/server/http/routeCatalog';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import { toLogError } from '$lib/server/infrastructure/logging/logger';
import type { RequestHandler } from './$types';

async function renderHtml(): Promise<string> {
	const rows = (await getApiRouteCatalog())
		.map((route) => {
			const methods = route.methods
				.map((method) => `<span class="method">${method}</span>`)
				.join('');

			return `<tr><td><code>${route.path}</code></td><td>${methods}</td></tr>`;
		})
		.join('');

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Z-UI API Routes</title>
<style>
body { margin: 0; font-family: system-ui, sans-serif; background: #0a1422; color: #e6f0ff; }
main { max-width: 920px; margin: 0 auto; padding: 1.5rem; }
h1 { margin: 0 0 0.5rem; font-size: 1.4rem; }
p { margin: 0 0 1rem; color: #a8bdd8; }
table { width: 100%; border-collapse: collapse; background: #10203a; border: 1px solid #274467; border-radius: 10px; overflow: hidden; }
th, td { text-align: left; padding: 0.7rem 0.8rem; border-bottom: 1px solid #274467; vertical-align: top; }
th { background: #132848; font-size: 0.85rem; }
tr:last-child td { border-bottom: none; }
code { color: #cfe6ff; font-size: 0.85rem; }
.method { display: inline-block; margin: 0 0.35rem 0.35rem 0; padding: 0.2rem 0.45rem; border: 1px solid #4f86bb; border-radius: 6px; font-size: 0.75rem; color: #b5d8ff; }
a { color: #7fc2ff; }
</style>
</head>
<body>
<main>
<h1>API Route Catalog</h1>
<p>JSON version: <a href="/api/_routes"><code>/api/_routes</code></a></p>
<p>App version: <a href="/api/app/version"><code>/api/app/version</code></a></p>
<table>
<thead><tr><th>Path</th><th>Methods</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</main>
</body>
</html>`;
}

export const GET: RequestHandler = async ({ locals }) => {
	const requestLogger = getRequestLogger(locals);
	try {
		return new Response(await renderHtml(), {
			headers: {
				'content-type': 'text/html; charset=utf-8'
			}
		});
	} catch (err: unknown) {
		requestLogger.error({ event: 'api.docs.render.failed', error: toLogError(err) }, 'Failed to render API docs page');
		return errorResponse('Failed to render API docs page', 500);
	}
};
