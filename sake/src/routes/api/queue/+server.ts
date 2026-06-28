import { getQueueStatusResponse } from '$lib/server/http/getQueueStatusResponse';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => getQueueStatusResponse(locals);
