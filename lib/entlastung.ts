import type { EntlastungBucket, EntlastungSummary, NormalizedOrder } from "@/lib/types";

const GERMANY = "Germany";

const EU_COUNTRIES = new Set<string>([
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Czechia",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
]);

function normalizeCountry(country: string | null) {
  return country?.trim() ?? null;
}

export function getEntlastungBucket(country: string | null): EntlastungBucket {
  const normalizedCountry = normalizeCountry(country);

  if (normalizedCountry === GERMANY) {
    return "DE";
  }

  if (normalizedCountry && EU_COUNTRIES.has(normalizedCountry)) {
    return "EU";
  }

  return "WORLD_WIDE";
}

export function buildEntlastungSummary(
  orders: NormalizedOrder[],
): EntlastungSummary {
  const summary: EntlastungSummary = {
    DE: 0,
    EU: 0,
    WORLD_WIDE: 0,
  };

  for (const order of orders) {
    summary[getEntlastungBucket(order.country)] += order.legacyWeightKg;
  }

  return summary;
}
