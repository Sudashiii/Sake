export interface AnnaArchiveMirrorSettingsPort {
	get(): Promise<readonly string[]>;
	replace(urls: readonly string[]): Promise<readonly string[]>;
}
