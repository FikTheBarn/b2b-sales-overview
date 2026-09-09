import type { NormalizedOrder } from "./types";

export type WeeklyCustomerRow = {
  company: string;
  country: string;
  totalLegacyWeightKg: number;
  weeklyWeights: Record<number, number>;
};

export type WeeklyMonthGroup = {
  month: string;
  colSpan: number;
};

export function getIsoWeekNumber(dateValue: string) {
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

function getIsoWeekStartDate(year: number, weekNumber: number) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const isoDay = januaryFourth.getUTCDay() || 7;

  januaryFourth.setUTCDate(januaryFourth.getUTCDate() - isoDay + 1);
  januaryFourth.setUTCDate(
    januaryFourth.getUTCDate() + (weekNumber - 1) * 7,
  );

  return januaryFourth;
}

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
});

export function buildWeeklyMonthGroups(year: number): WeeklyMonthGroup[] {
  const groups: WeeklyMonthGroup[] = [];

  for (let weekNumber = 1; weekNumber <= getIsoWeeksInYear(year); weekNumber += 1) {
    const weekAnchor = getIsoWeekStartDate(year, weekNumber);

    // ISO weeks belong to the year containing their Thursday.
    weekAnchor.setUTCDate(weekAnchor.getUTCDate() + 3);
    const month = monthFormatter.format(weekAnchor);
    const currentGroup = groups.at(-1);

    if (currentGroup?.month === month) {
      currentGroup.colSpan += 1;
    } else {
      groups.push({ month, colSpan: 1 });
    }
  }

  return groups;
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
