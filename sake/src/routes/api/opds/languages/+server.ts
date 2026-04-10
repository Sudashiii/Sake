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

    const languagesSet = new Set<string>();
    for (const book of books) {
      if (book.language) {
        languagesSet.add(book.language);
      }
    }

    const languages = Array.from(languagesSet).sort();

    const selfUrl = `/api/opds/languages`;

    const entries = languages.map((lang) => ({
      title: lang.toUpperCase(),
      id: `urn:sake:opds:language:${encodeURIComponent(lang)}`,
      url: `${encodeURIComponent(lang)}`,
    }));

    const xml = renderNavigationFeed(
      "Languages",
      "urn:sake:opds:languages",
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
      { event: "opds.languages.failed", error: err },
      "Failed to generate languages feed",
    );
    return errorResponse("Internal Server Error", 500);
  }
};
