import type { RequestHandler } from "@sveltejs/kit";
import { requireBasicAuth } from "../auth";
import { listLibraryUseCase } from "$lib/server/application/composition";
import { renderNavigationFeed } from "../feedBuilder";
import { errorResponse } from "$lib/server/http/api";
import { getRequestLogger } from "$lib/server/http/requestLogger";

export const GET: RequestHandler = async (event) => {
  const authResponse = await requireBasicAuth(event);
  if (authResponse) return authResponse;

  const { locals } = event;
  const requestLogger = getRequestLogger(locals);

  try {
    const result = await listLibraryUseCase.execute();
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }

    const books = result.value.books;

    const publishersSet = new Set<string>();
    for (const book of books) {
      if (book.publisher) {
        publishersSet.add(book.publisher);
      }
    }

    const publishers = Array.from(publishersSet).sort();

    const selfUrl = `/api/opds/publishers`;

    const entries = publishers.map((pub) => ({
      title: pub,
      id: `urn:sake:opds:publisher:${encodeURIComponent(pub)}`,
      url: `${encodeURIComponent(pub)}`,
    }));

    const xml = renderNavigationFeed(
      "Publishers",
      "urn:sake:opds:publishers",
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
      { event: "opds.publishers.failed", error: err },
      "Failed to generate publishers feed",
    );
    return errorResponse("Internal Server Error", 500);
  }
};
