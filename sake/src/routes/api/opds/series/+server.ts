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

    const seriesSet = new Set<string>();
    for (const book of books) {
      if (book.series) {
        seriesSet.add(book.series);
      }
    }

    const seriesList = Array.from(seriesSet).sort();

    const selfUrl = `/api/opds/series`;

    const entries = seriesList.map((series) => ({
      title: series,
      id: `urn:sake:opds:series:${encodeURIComponent(series)}`,
      url: `${encodeURIComponent(series)}`,
    }));

    const xml = renderNavigationFeed(
      "Series",
      "urn:sake:opds:series",
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
      { event: "opds.series.failed", error: err },
      "Failed to generate series feed",
    );
    return errorResponse("Internal Server Error", 500);
  }
};
