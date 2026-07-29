import type { BillIdentity, BillType } from "./types.ts";

const SUPPORTED_BILL_TYPES = new Set<BillType>(["hr", "s", "hjres", "sjres"]);

function normalizeBillType(value: string): BillType | null {
  const normalized = value.toLowerCase().replaceAll(".", "").replaceAll(" ", "");
  return SUPPORTED_BILL_TYPES.has(normalized as BillType) ? (normalized as BillType) : null;
}

function createIdentity(congress: number, billType: BillType, billNumber: number): BillIdentity {
  if (!Number.isInteger(congress) || congress < 1) {
    throw new Error("Congress number must be a positive integer.");
  }
  if (!Number.isInteger(billNumber) || billNumber < 1) {
    throw new Error("Bill number must be a positive integer.");
  }
  return {
    congress,
    billType,
    billNumber,
    canonicalId: `bill:${congress}:${billType}:${billNumber}`,
    canonicalUrl: `https://www.congress.gov/bill/${congress}th-congress/${
      billType === "hr" ? "house-bill" :
      billType === "s" ? "senate-bill" :
      billType === "hjres" ? "house-joint-resolution" :
      "senate-joint-resolution"
    }/${billNumber}`
  };
}

export function parseBillInput(input: string, explicitCongress?: number): BillIdentity {
  const value = input.trim();
  if (!value) throw new Error("Bill input is required.");

  const urlMatch = value.match(
    /^https?:\/\/(?:www\.)?congress\.gov\/bill\/(\d+)(?:st|nd|rd|th)-congress\/(house-bill|senate-bill|house-joint-resolution|senate-joint-resolution)\/(\d+)(?:\/.*)?$/i
  );
  if (urlMatch) {
    const urlTypes: Record<string, BillType> = {
      "house-bill": "hr",
      "senate-bill": "s",
      "house-joint-resolution": "hjres",
      "senate-joint-resolution": "sjres"
    };
    return createIdentity(Number(urlMatch[1]), urlTypes[urlMatch[2].toLowerCase()], Number(urlMatch[3]));
  }

  const textMatch = value.match(/^(h\.?\s*r\.?|s\.?|h\.?\s*j\.?\s*res\.?|s\.?\s*j\.?\s*res\.?)\s*(\d+)$/i);
  if (!textMatch) {
    throw new Error("Use a Congress.gov bill URL or a bill number such as H.R. 1234 or S. 42.");
  }
  if (explicitCongress === undefined) {
    throw new Error("Congress number is required when the input is not a Congress.gov URL.");
  }
  const billType = normalizeBillType(textMatch[1]);
  if (!billType) throw new Error(`Unsupported bill type: ${textMatch[1]}`);
  return createIdentity(explicitCongress, billType, Number(textMatch[2]));
}
