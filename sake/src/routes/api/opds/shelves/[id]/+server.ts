import type { RequestHandler } from "@sveltejs/kit";
import { requireBasicAuth } from "../../auth";
import {
  listLibraryUseCase,
  listShelvesUseCase,
} from "$lib/server/application/composition";
import { renderAcquisitionFeed } from "../../feedBuilder";
import { errorResponse } from "$lib/server/http/api";
import { getRequestLogger } from "$lib/server/http/requestLogger";

export const GET: RequestHandler = async (event) => {
  const authResponse = await requireBasicAuth(event);
  if (authResponse) return authResponse;

  const { params, locals, url } = event;
  const requestLogger = getRequestLogger(locals);
  const shelfIdParam = params.id;

  if (!shelfIdParam) {
    return errorResponse("Missing shelf ID parameter", 400);
  }

  const shelfId = parseInt(shelfIdParam, 10);
  if (isNaN(shelfId)) {
    return errorResponse("Invalid shelf ID parameter", 400);
  }

  try {
    const shelvesResult = await listShelvesUseCase.execute();
    if (!shelvesResult.ok) {
      return errorResponse(
        shelvesResult.error.message,
        shelvesResult.error.status,
      );
    }

    const shelf = shelvesResult.value.shelves.find((s) => s.id === shelfId);
    if (!shelf) {
      return errorResponse("Shelf not found", 404);
    }

    const result = await listLibraryUseCase.execute();
    if (!result.ok) {
      return errorResponse(result.error.message, result.error.status);
    }

    const books = result.value.books
      .filter((book) => book.shelfIds.includes(shelfId))
      .sort((a, b) => a.title.localeCompare(b.title));

    const selfUrl = `/api/opds/shelves/${shelfId}`;

    const xml = renderAcquisitionFeed(
      `Shelf: ${shelf.name}`,
      `urn:sake:opds:shelf:${shelfId}`,
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
      { event: "opds.shelf.books.failed", error: err },
      "Failed to generate shelf books feed",
    );
    return errorResponse("Internal Server Error", 500);
  }
};
