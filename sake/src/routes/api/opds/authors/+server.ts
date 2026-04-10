import type { RequestHandler } from "@sveltejs/kit";
import { requireBasicAuth } from "../auth";
import { listLibraryUseCase } from "$lib/server/application/composition";
import { renderNavigationFeed } from "../feedBuilder";
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

    const books = result.value.books;

    const authorsSet = new Set<string>();
    for (const book of books) {
      if (book.author) {
        authorsSet.add(book.author);
      }
    }

    const authors = Array.from(authorsSet).sort();

    const selfUrl = `/api/opds/authors`;

    const entries = authors.map((author) => ({
      title: author,
      id: `urn:sake:opds:author:${encodeURIComponent(author)}`,
      url: `${encodeURIComponent(author)}`,
    }));

    const xml = renderNavigationFeed(
      "Authors",
      "urn:sake:opds:authors",
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
      { event: "opds.authors.failed", error: err },
      "Failed to generate authors feed",
    );
    return errorResponse("Internal Server Error", 500);
  }
};
