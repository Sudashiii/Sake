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
  const seriesName = params.series;

  if (!seriesName) {
    return errorResponse("Missing series parameter", 400);
  }

  try {
    const result = await listLibraryUseCase.execute();
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }

    const books = result.value.books
      .filter((book) => book.series === seriesName)
      .sort((a, b) => {
        const indexA = a.series_index ?? Number.MAX_VALUE;
        const indexB = b.series_index ?? Number.MAX_VALUE;
        if (indexA !== indexB) {
          return indexA - indexB;
        }
        return a.title.localeCompare(b.title);
      });

    const selfUrl = `/api/opds/series/${encodeURIComponent(seriesName)}`;

    const xml = renderAcquisitionFeed(
      `Series: ${seriesName}`,
      `urn:sake:opds:series:${encodeURIComponent(seriesName)}`,
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
      { event: "opds.series.books.failed", error: err },
      "Failed to generate series books feed",
    );
    return errorResponse("Internal Server Error", 500);
  }
};
