import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';

export interface KoreaderPluginArtifact {
	version: string;
	fileName: string;
	storageKey: string;
	contentType: string;
	sha256: string;
	bytes: Buffer;
	pluginDir: string;
	metaPath: string;
}

const PLUGIN_META_FILE = '_meta.lua';
const PLUGIN_PREFIX = 'plugins/koreader';

export class KoreaderPluginArtifactService {
	private readonly pluginDirCandidates: string[];
	private readonly serviceLogger = createChildLogger({ service: 'KoreaderPluginArtifactService' });

	constructor(pluginDirCandidates?: string[]) {
		this.pluginDirCandidates = pluginDirCandidates ?? [
			process.env.KOREADER_PLUGIN_DIR ?? '',
			path.resolve(process.cwd(), 'koreaderPlugins/sake.koplugin'),
			path.resolve(process.cwd(), '../koreaderPlugins/sake.koplugin')
		].filter((candidate) => candidate.length > 0);
	}

	async buildArtifact(): Promise<KoreaderPluginArtifact> {
		const pluginDir = await this.resolvePluginDir();
		const { version, metaPath } = await this.readVersion(pluginDir);
		const bytes = await this.buildZip(pluginDir);
		const fileName = `sake-koplugin-v${version}.zip`;
		const storageKey = `${PLUGIN_PREFIX}/${fileName}`;
		const sha256 = createHash('sha256').update(bytes).digest('hex');
		this.serviceLogger.info(
			{
				event: 'plugin.artifact.built',
				version,
				pluginDir,
				metaPath,
				fileName,
				storageKey,
				sizeBytes: bytes.byteLength,
				sha256
			},
			'Built KOReader plugin artifact'
		);

		return {
			version,
			fileName,
			storageKey,
			contentType: 'application/zip',
			sha256,
			bytes,
			pluginDir,
			metaPath
		};
	}

	private async resolvePluginDir(): Promise<string> {
		for (const candidate of this.pluginDirCandidates) {
			if (!candidate) {
				continue;
			}

			try {
				const candidateStat = await stat(candidate);
				if (candidateStat.isDirectory()) {
					this.serviceLogger.info(
						{ event: 'plugin.directory.found', pluginDir: candidate },
						'Found KOReader plugin directory'
					);
					return candidate;
				}
			} catch {
				// Try next candidate.
			}
		}

		throw new Error(
			`KOReader plugin directory not found. Tried: ${this.pluginDirCandidates.join(', ')}`
		);
	}

	private async readVersion(pluginDir: string): Promise<{ version: string; metaPath: string }> {
		const metaPath = path.join(pluginDir, PLUGIN_META_FILE);
		const content = await readFile(metaPath, 'utf8');
		const match = content.match(/version\s*=\s*"([^"]+)"/);
		const version = match?.[1]?.trim();

		if (!version) {
			throw new Error(`Could not parse plugin version from ${metaPath}`);
		}
		this.serviceLogger.info(
			{ event: 'plugin.version.detected', version, metaPath },
			'Detected KOReader plugin version'
		);

		return { version, metaPath };
	}

	private async buildZip(pluginDir: string): Promise<Buffer> {
		const zip = new JSZip();
		await this.addDirectoryToZip(zip, pluginDir, pluginDir);
		const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
		return Buffer.from(out);
	}

	private async addDirectoryToZip(zip: JSZip, rootDir: string, currentDir: string): Promise<void> {
		const entries = await readdir(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const absolutePath = path.join(currentDir, entry.name);
			const relative = path.relative(rootDir, absolutePath);
			const zipPath = relative.split(path.sep).join('/');

			if (entry.isDirectory()) {
				await this.addDirectoryToZip(zip, rootDir, absolutePath);
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			const content = await readFile(absolutePath);
			zip.file(zipPath, content);
		}
	}
}
