import type { Logger } from 'pino';
import type { AuthActor } from '$lib/server/domain/entities/AuthActor';
import type { SearchProviderId } from '$lib/types/Search/Provider';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		interface PageData {
			searchEnabled: boolean;
			activeSearchProviders: SearchProviderId[];
		}
		// interface PageState {}
		// interface Platform {}
		interface Locals {
			zuser?: {
				userId: string;
				userKey: string;
			};
			auth?: AuthActor;
			requestId?: string;
			logger?: Logger;
		}
	}
}

declare module '*.module.scss' {
	const classes: Record<string, string>;
	export default classes;
}

export {};
