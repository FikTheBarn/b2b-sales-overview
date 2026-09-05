import type { NormalizedOrder, getw } from "./types";

export type WeeklyCustomerRow = {
  company: string;
  country: string;
  totalLegacyWeightKg: number;
  weeklyWeights: Record<number, number>;
};

function getIsoWeekNumber(dateValue: string) {
  const date = new Date(dateValue);
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  const isoDay = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - isoDay);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));

  return Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
}

export function getIsoWeeksInYear(year: number) {
  const lastIsoWeekDate = `${year}-12-28`;
  return getIsoWeekNumber(lastIsoWeekDate);
}

export function buildWeeklyCustomerRows(
  orders: NormalizedOrder[],
): WeeklyCustomerRow[] {
  const rowsByKey = new Map<string, WeeklyCustomerRow>();
  for (const order of orders) {
    const company = order.company ?? order.customer ?? "Unknown Company";
    const country = order.country ?? "Unknown Country";
    const rowKey = `${company}|${country}`;

    if (!rowsByKey.has(rowKey)) {
      rowsByKey.set(rowKey, {
        company,
        country,
        totalLegacyWeightKg: 0,
        weeklyWeights: {},
      });
    }
    const row = rowsByKey.get(rowKey)!;
    row.totalLegacyWeightKg += order.legacyWeightKg;

    const weekNumber = getIsoWeekNumber(order.createdAt);
    row.weeklyWeights[weekNumber] =
      (row.weeklyWeights[weekNumber] ?? 0) + order.legacyWeightKg;
  }

  return Array.from(rowsByKey.values());
}
