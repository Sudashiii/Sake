import type { RequestHandler } from "@sveltejs/kit";
import { requireBasicAuth } from "../../auth";
import { listLibraryUseCase } from "$lib/server/application/composition";
import { renderAcquisitionFeed } from "../../feedBuilder";
import { errorResponse } from "$lib/server/http/api";
import { getRequestLogger } from "$lib/server/http/requestLogger";

export const GET: RequestHandler = async (event) => {
  const authResponse = await requireBasicAuth(event);
  if (authResponse) return authResponse;

  const { params, locals } = event;
  const requestLogger = getRequestLogger(locals);
  const publisherName = params.publisher;

  if (!publisherName) {
    return errorResponse("Missing publisher parameter", 400);
  }

  try {
    const result = await listLibraryUseCase.execute();
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }

    const books = result.value.books
      .filter((book) => book.publisher === publisherName)
      .sort((a, b) => a.title.localeCompare(b.title));

    const selfUrl = `/api/opds/publishers/${encodeURIComponent(publisherName)}`;

    const xml = renderAcquisitionFeed(
      `Books from ${publisherName}`,
      `urn:sake:opds:publisher:${encodeURIComponent(publisherName)}`,
      books,
      selfUrl,
    );

    return new Response(xml, {
      headers: {
        "Content-Type": "application/atom+xml;charset=utf-8",
      },
    });
  } catch (err: unknown) {
    requestLogger.error(
      { event: "opds.publisher.books.failed", error: err },
      "Failed to generate publisher books feed",
    );
    return errorResponse("Internal Server Error", 500);
  }
};
