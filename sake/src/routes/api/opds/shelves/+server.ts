import type { RequestHandler } from "@sveltejs/kit";
import { requireBasicAuth } from "../auth";
import { listShelvesUseCase } from "$lib/server/application/composition";
import { renderNavigationFeed } from "../feedBuilder";
import { errorResponse } from "$lib/server/http/api";
import { getRequestLogger } from "$lib/server/http/requestLogger";

export const GET: RequestHandler = async (event) => {
  const authResponse = await requireBasicAuth(event);
  if (authResponse) return authResponse;

  const { locals, url } = event;
  const requestLogger = getRequestLogger(locals);

  try {
    const result = await listShelvesUseCase.execute();
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }

    const shelves = result.value.shelves.sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    const selfUrl = `/api/opds/shelves`;

    const entries = shelves.map((shelf) => ({
      title: shelf.name,
      id: `urn:sake:opds:shelf:${shelf.id}`,
      url: `${shelf.id}`,
    }));

    const xml = renderNavigationFeed(
      "Shelves",
      "urn:sake:opds:shelves",
      entries,
      selfUrl,
    );

    return new Response(xml, {
      headers: {
        "Content-Type": "application/atom+xml;charset=utf-8",
      },
    });
  } catch (err: unknown) {
    requestLogger.error(
      { event: "opds.shelves.failed", error: err },
      "Failed to generate shelves feed",
    );
    return errorResponse("Internal Server Error", 500);
  }
};
