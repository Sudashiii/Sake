import type { RequestHandler } from "@sveltejs/kit";
import { requireBasicAuth } from "./auth";
import { renderNavigationFeed } from "./feedBuilder";
import { errorResponse } from "$lib/server/http/api";
import { getRequestLogger } from "$lib/server/http/requestLogger";

export const GET: RequestHandler = async (event) => {
  const authResponse = await requireBasicAuth(event);
  if (authResponse) return authResponse;

  const { locals, url } = event;
  const requestLogger = getRequestLogger(locals);

  try {
    const selfUrl = `/api/opds`;

    const entries = [
      {
        title: "All Books (Alphabetical)",
        id: "urn:sake:opds:alphabetical",
        url: `alphabetical`,
        description:
          "All books in the library, sorted alphabetically by title.",
      },
      {
        title: "Random Books",
        id: "urn:sake:opds:random",
        url: `random`,
        description: "Browse random books.",
      },
      {
        title: "Read Books",
        id: "urn:sake:opds:read",
        url: `read`,
        description: "Browse read books.",
      },
      {
        title: "Unread Books",
        id: "urn:sake:opds:unread",
        url: `unread`,
        description: "Browse unread books.",
      },
      {
        title: "Authors",
        id: "urn:sake:opds:authors",
        url: `authors`,
        description: "Browse books by author.",
      },
      {
        title: "Series",
        id: "urn:sake:opds:series",
        url: `series`,
        description: "Browse books by series.",
      },
      {
        title: "Publishers",
        id: "urn:sake:opds:publishers",
        url: `publishers`,
        description: "Browse books by publisher.",
      },
      {
        title: "Languages",
        id: "urn:sake:opds:languages",
        url: `languages`,
        description: "Browse books by language.",
      },
      {
        title: "Shelves",
        id: "urn:sake:opds:shelves",
        url: `shelves`,
        description: "Browse books by shelf.",
      },
    ];

    const xml = renderNavigationFeed(
      "Sake OPDS Catalog",
      "urn:sake:opds:root",
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
      { event: "opds.feed.failed", error: err },
      "Failed to generate OPDS feed",
    );
    return errorResponse("Internal Server Error", 500);
  }
};
