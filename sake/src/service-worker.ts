import { build, files, version } from "$service-worker";

const CACHE = `sake-static-${version}`;
const STATIC_ASSETS = Array.from(new Set([...build, ...files]));

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			await Promise.all(
				keys
					.filter((key) => key.startsWith("sake-static-") && key !== CACHE)
					.map((key) => caches.delete(key))
			);
		})
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") {
		return;
	}

	const url = new URL(request.url);
	if (url.pathname.startsWith("/api/")) {
		return;
	}

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request).catch(async () => {
				const cached = await caches.match(request);
				return cached ?? Response.error();
			})
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cached) => cached ?? fetch(request))
	);
});
