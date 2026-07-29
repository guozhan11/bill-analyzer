import type { BillIdentity, LegalNode } from "./types.ts";

interface XmlElement {
  name: string;
  children: Array<XmlElement | string>;
  parent?: XmlElement;
}

const STRUCTURAL_TYPES: Record<string, string> = {
  division: "division",
  title: "title",
  subtitle: "subtitle",
  section: "section",
  subsection: "subsection",
  paragraph: "paragraph",
  subparagraph: "subparagraph",
  clause: "clause",
  subclause: "subclause",
  item: "list"
};

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.toLowerCase().startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

function normalize(value: string) {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: "root", children: [] };
  const stack = [root];
  const tokens = xml.match(/<!--[\s\S]*?-->|<\?[^>]*\?>|<![^>]*>|<[^>]+>|[^<]+/g) ?? [];
  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<?") || token.startsWith("<!")) continue;
    if (token.startsWith("</")) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (token.startsWith("<")) {
      const match = token.match(/^<\s*([^\s/>]+)/);
      if (!match) continue;
      const element: XmlElement = { name: match[1].toLowerCase(), children: [], parent: stack.at(-1) };
      stack.at(-1)!.children.push(element);
      if (!/\/\s*>$/.test(token)) stack.push(element);
      continue;
    }
    if (token.trim()) stack.at(-1)!.children.push(token);
  }
  return root;
}

function elements(element: XmlElement, name?: string): XmlElement[] {
  const found: XmlElement[] = [];
  for (const child of element.children) {
    if (typeof child === "string") continue;
    if (!name || child.name === name) found.push(child);
    found.push(...elements(child, name));
  }
  return found;
}

function fullText(element: XmlElement): string {
  return normalize(element.children.map((child) => typeof child === "string" ? child : fullText(child)).join(" "));
}

function childText(element: XmlElement, childName: string): string | undefined {
  const child = element.children.find((item): item is XmlElement => typeof item !== "string" && item.name === childName);
  const value = child ? fullText(child) : "";
  return value || undefined;
}

function ownText(element: XmlElement): string {
  const parts: string[] = [];
  for (const child of element.children) {
    if (typeof child !== "string" && (STRUCTURAL_TYPES[child.name] || child.name === "quoted-block")) break;
    parts.push(typeof child === "string" ? child : fullText(child));
  }
  return normalize(parts.join(" "));
}

function structuralParent(element: XmlElement): XmlElement | undefined {
  let parent = element.parent;
  while (parent && !STRUCTURAL_TYPES[parent.name]) parent = parent.parent;
  return parent;
}

function inQuotedBlock(element: XmlElement): boolean {
  let parent = element.parent;
  while (parent) {
    if (parent.name === "quoted-block") return true;
    parent = parent.parent;
  }
  return false;
}

function cleanLabel(label?: string) {
  return label?.replace(/[.\s]+$/g, "").trim();
}

function buildCitation(element: XmlElement): string {
  const chain: Array<{ name: string; label?: string }> = [];
  let current: XmlElement | undefined = element;
  while (current) {
    if (STRUCTURAL_TYPES[current.name]) chain.unshift({ name: current.name, label: cleanLabel(childText(current, "enum")) });
    current = structuralParent(current);
  }
  const parts: string[] = [];
  for (const item of chain) {
    if (!item.label) continue;
    if (item.name === "section") parts.push(`Sec. ${item.label}`);
    else if (["subsection", "paragraph", "subparagraph", "clause", "subclause"].includes(item.name)) parts.push(item.label);
    else parts.push(`${item.name[0].toUpperCase()}${item.name.slice(1)} ${item.label}`);
  }
  return parts.join(" ") || "Bill text";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "node";
}

export function parseUslmBill(input: {
  xml: string;
  normalizedText: string;
  identity: BillIdentity;
  versionCode: string;
  sourceSnapshotId: string;
}): { nodes: LegalNode[]; warnings: string[] } {
  const tree = parseXml(input.xml);
  const body = elements(tree, "legis-body")[0] ?? tree;
  const candidates = elements(body).filter((element) => Boolean(STRUCTURAL_TYPES[element.name]));
  const nodeByElement = new Map<XmlElement, LegalNode>();
  const warnings: string[] = [];
  let ordinal = 0;

  for (const element of candidates) {
    const label = childText(element, "enum");
    const heading = childText(element, "header");
    const text = ownText(element) || normalize([label, heading].filter(Boolean).join(" "));
    if (!text) continue;
    const parentElement = structuralParent(element);
    const parentNode = parentElement ? nodeByElement.get(parentElement) : undefined;
    const classifications: LegalNode["classifications"] = [];
    if (/\bdefinitions?\b/i.test(heading ?? "") || /\bthe term\b[\s\S]{0,160}\bmeans\b/i.test(text)) classifications.push("definition");
    if (/\b(is|are) amended\b|\bamendment(s)? to\b|\bstrike\b[\s\S]{0,80}\binsert\b/i.test(text)) classifications.push("amendatory_instruction");
    if (inQuotedBlock(element)) classifications.push("quoted_statutory_text");

    const searchStart = parentNode?.charStart ?? 0;
    const located = input.normalizedText.indexOf(text, searchStart);
    const charStart = located >= 0 ? located : searchStart;
    const charEnd = Math.max(charStart + text.length, charStart + 1);
    if (located < 0) warnings.push(`Could not exactly align ${buildCitation(element)} to normalized text.`);
    const citation = buildCitation(element);
    const idPart = slug(`${citation}-${heading ?? ""}`);
    const node: LegalNode = {
      nodeId: `${input.identity.canonicalId}:${input.versionCode}:${String(ordinal).padStart(4, "0")}:${idPart}`,
      billId: input.identity.canonicalId,
      versionCode: input.versionCode,
      nodeType: STRUCTURAL_TYPES[element.name],
      ...(label ? { label } : {}),
      ...(heading ? { heading } : {}),
      citation,
      text,
      ...(parentNode ? { parentId: parentNode.nodeId } : {}),
      ordinal,
      sourceSnapshotId: input.sourceSnapshotId,
      charStart,
      charEnd,
      depth: parentNode ? parentNode.depth + 1 : 0,
      classifications
    };
    nodeByElement.set(element, node);
    ordinal += 1;
  }
  return { nodes: [...nodeByElement.values()], warnings: [...new Set(warnings)].slice(0, 20) };
}
