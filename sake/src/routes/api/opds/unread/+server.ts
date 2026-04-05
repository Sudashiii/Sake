import type { RequestHandler } from "@sveltejs/kit";
import { requireBasicAuth } from "../auth";
import { listLibraryUseCase } from "$lib/server/application/composition";
import { renderAcquisitionFeed } from "../feedBuilder";
import { errorResponse } from "$lib/server/http/api";
import { getRequestLogger } from "$lib/server/http/requestLogger";

export const GET: RequestHandler = async (event) => {
  const authResponse = await requireBasicAuth(event);
  if (authResponse) return authResponse;

  const { locals, url } = event;
  const requestLogger = getRequestLogger(locals);

  try {
    const result = await listLibraryUseCase.execute();
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }

    const books = result.value.books
      .filter((book) => book.read_at === null)
      .sort((a, b) => a.title.localeCompare(b.title));

    const selfUrl = `/api/opds/unread`;

    const xml = renderAcquisitionFeed(
      `Unread Books`,
      `urn:sake:opds:unread`,
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
      { event: "opds.unread.books.failed", error: err },
      "Failed to generate unread books feed",
    );
    return errorResponse("Internal Server Error", 500);
  }
};
