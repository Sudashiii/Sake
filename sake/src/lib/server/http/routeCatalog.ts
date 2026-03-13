import { promises as fs } from 'node:fs';
import path from 'node:path';
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

export interface ApiRouteEntry {
	path: string;
	methods: string[];
}

async function walkDir(dirPath: string): Promise<string[]> {
	const entries = await fs.readdir(dirPath, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkDir(fullPath)));
			continue;
		}

		if (entry.isFile() && entry.name === '+server.ts') {
			files.push(fullPath);
		}
	}

	return files;
}

function filePathToApiPath(filePath: string, apiRoot: string): string {
	const routePart = filePath
		.replace(apiRoot, '')
		.replaceAll(path.sep, '/')
		.replace('/+server.ts', '');

	return routePart.length > 0 ? `/api${routePart}` : '/api';
}

function extractMethods(fileContent: string): string[] {
	const methods = new Set<string>();
	for (const method of HTTP_METHODS) {
		const re = new RegExp(`export\\s+const\\s+${method}\\b`);
		if (re.test(fileContent)) {
			methods.add(method);
		}
	}
	return [...methods];
}

export async function getApiRouteCatalog(): Promise<ApiRouteEntry[]> {
	const apiRoot = path.join(process.cwd(), 'src', 'routes', 'api');
	const files = await walkDir(apiRoot);
	const routes: ApiRouteEntry[] = [];

	for (const filePath of files) {
		const content = await fs.readFile(filePath, 'utf8');
		routes.push({
			path: filePathToApiPath(filePath, apiRoot),
			methods: extractMethods(content)
		});
	}

	return routes.sort((a, b) => a.path.localeCompare(b.path));
}
