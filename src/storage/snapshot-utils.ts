export interface SaveSnapshotInput {
  sourceUrl: string;
  body: string;
  mediaType: string;
  parserVersion: string;
  upstreamUpdatedAt?: string;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " "
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

export function normalizeSourceText(body: string, mediaType: string): string {
  if (mediaType.includes("xml") || mediaType.includes("html")) {
    return decodeEntities(
      body
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    ).replace(/\s+/g, " ").trim();
  }
  return body.replace(/\r\n/g, "\n").trim();
}

export function extensionFor(mediaType: string, sourceUrl: string): string {
  const pathname = new URL(sourceUrl).pathname;
  const filename = pathname.slice(pathname.lastIndexOf("/") + 1);
  const dot = filename.lastIndexOf(".");
  const urlExtension = dot >= 0 ? filename.slice(dot) : "";
  if (urlExtension && urlExtension.length <= 6) return urlExtension;
  if (mediaType.includes("json")) return ".json";
  if (mediaType.includes("xml")) return ".xml";
  if (mediaType.includes("html")) return ".html";
  if (mediaType.includes("pdf")) return ".pdf";
  return ".txt";
}

