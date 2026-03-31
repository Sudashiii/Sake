import { observeWebappLogsUseCase } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';
import type { WebappLogEntry, WebappLogSnapshot } from '$lib/types/Logs/WebappLogEntry';
import type { RequestHandler } from './$types';

const HEARTBEAT_INTERVAL_MS = 15000;
const RETRY_INTERVAL_MS = 2000;

function encodeSseEvent(event: string, payload: WebappLogSnapshot | WebappLogEntry): string {
	return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export const GET: RequestHandler = async ({ locals, request }) => {
	const requestLogger = getRequestLogger(locals);

	if (locals.auth?.type !== 'session') {
		return errorResponse('Authentication required', 401);
	}

	const result = await observeWebappLogsUseCase.execute();
	if (!result.ok) {
		requestLogger.warn(
			{
				event: 'logs.webapp.observe.use_case_failed',
				statusCode: result.error.status,
				reason: result.error.message
			},
			'Observe webapp logs rejected'
		);
		return errorResponse(result.error.message, result.error.status);
	}

	const encoder = new TextEncoder();
	const observation = result.value;
	let cleanup = () => {};

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let closed = false;

			const close = () => {
				if (closed) {
					return;
				}
				closed = true;
				cleanup();
				try {
					controller.close();
				} catch {
					// Controller may already be closed during cancellation.
				}
			};

			const send = (event: string, payload: WebappLogSnapshot | WebappLogEntry) => {
				if (closed) {
					return;
				}

				try {
					controller.enqueue(encoder.encode(encodeSseEvent(event, payload)));
				} catch {
					close();
				}
			};

			const unsubscribe = observation.subscribe((entry) => {
				send('entry', entry);
			});
			const heartbeatInterval = setInterval(() => {
				send('heartbeat', { entries: [] });
			}, HEARTBEAT_INTERVAL_MS);
			const handleAbort = () => {
				close();
			};

			request.signal.addEventListener('abort', handleAbort);

			cleanup = () => {
				clearInterval(heartbeatInterval);
				unsubscribe();
				request.signal.removeEventListener('abort', handleAbort);
			};

			controller.enqueue(encoder.encode(`retry: ${RETRY_INTERVAL_MS}\n\n`));
			send('snapshot', { entries: observation.snapshot });
		},
		cancel() {
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
