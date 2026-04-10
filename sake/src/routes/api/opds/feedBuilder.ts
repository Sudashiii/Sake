import type { Book } from "$lib/server/domain/entities/Book";
import { mimeTypes } from "$lib/server/constants/mimeTypes";

function escapeXml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderAcquisitionFeed(
  title: string,
  feedId: string,
  books: Book[],
  selfUrl: string,
): string {
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:dc="http://purl.org/dc/terms/"
      xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>${escapeXml(feedId)}</id>
  <title>${escapeXml(title)}</title>
  <updated>${now}</updated>
  <author><name>Sake</name></author>
  <link rel="self" href="${escapeXml(selfUrl)}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  <link rel="start" href="/api/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
`;

  for (const book of books) {
    const bookUrl = `/api/opds/download/${encodeURIComponent(book.s3_storage_key)}`;

    let coverUrl: string | null = null;
    let coverMimeType = mimeTypes.default;

    if (book.cover) {
      const parts = book.cover.split("?");
      const basePath = parts[0] || "";
      const queryParams = parts.length > 1 ? `?${parts[1]}` : "";

      const filename = basePath.split("/").pop() || "";
      coverUrl = `/api/opds/covers/${encodeURIComponent(filename)}${queryParams}`;

      const coverExt = filename.split(".").pop()?.toLowerCase() || "";
      coverMimeType = mimeTypes[coverExt] || "image/jpeg";
    }

    const mimeType =
      mimeTypes[book.extension?.toLowerCase() || ""] || mimeTypes.default;
    const bookUpdated = book.createdAt || now;

    xml += `  <entry>
    <id>urn:sake:book:${book.id}</id>
    <title>${escapeXml(book.title)}</title>
    <updated>${bookUpdated}</updated>
    <author><name>${escapeXml(book.author || "Unknown author")}</name></author>
    ${book.language ? `<dc:language>${escapeXml(book.language)}</dc:language>` : ""}
    ${book.publisher ? `<dc:publisher>${escapeXml(book.publisher)}</dc:publisher>` : ""}
    <summary>${escapeXml(book.description || "")}</summary>
    <link rel="http://opds-spec.org/acquisition" href="${escapeXml(bookUrl)}" type="${escapeXml(mimeType)}"/>`;

    if (coverUrl) {
      xml += `
    <link rel="http://opds-spec.org/image" href="${escapeXml(coverUrl)}" type="${escapeXml(coverMimeType)}"/>
    <link rel="http://opds-spec.org/image/thumbnail" href="${escapeXml(coverUrl)}" type="${escapeXml(coverMimeType)}"/>`;
    }

    xml += `
  </entry>
`;
  }

  xml += `</feed>`;
  return xml;
}

export function renderNavigationFeed(
  title: string,
  feedId: string,
  entries: { title: string; id: string; url: string; description?: string }[],
  selfUrl: string,
): string {
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:dc="http://purl.org/dc/terms/"
      xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>${escapeXml(feedId)}</id>
  <title>${escapeXml(title)}</title>
  <updated>${now}</updated>
  <author><name>Sake</name></author>
  <link rel="self" href="${escapeXml(selfUrl)}" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="/api/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
`;

  for (const entry of entries) {
    xml += `  <entry>
    <title>${escapeXml(entry.title)}</title>
    <id>${escapeXml(entry.id)}</id>
    <link rel="subsection" href="${escapeXml(selfUrl + "/" + entry.url)}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
    ${entry.description ? `<summary>${escapeXml(entry.description)}</summary>` : ""}
    <updated>${now}</updated>
  </entry>
`;
  }

  xml += `</feed>`;
  return xml;
}
