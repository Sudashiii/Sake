import type { RequestEvent } from '@sveltejs/kit';
import { requireBasicAuth as requireRouteBasicAuth } from '../basicAuth';

export async function requireBasicAuth(
	event: RequestEvent
): Promise<Response | null> {
	return requireRouteBasicAuth(event, 'OPDS Catalog');
}
