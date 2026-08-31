import { NextResponse } from "next/server";

import { getOrdersByDateRange } from "@/lib/shopify";
import { buildOrdersSummary } from "@/lib/weights";

export const dynamic = "force-dynamic";

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function errorResponse(status: number, error: string, details?: string) {
  return NextResponse.json(
    {
      error,
      details,
    },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!startDate || !endDate) {
      return errorResponse(
        400,
        "Missing required date range.",
        "Provide both startDate and endDate in YYYY-MM-DD format.",
      );
    }

    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      return errorResponse(
        400,
        "Invalid date format.",
        "Dates must use YYYY-MM-DD and be real calendar dates.",
      );
    }

    if (startDate > endDate) {
      return errorResponse(
        400,
        "Invalid date range.",
        "startDate must be on or before endDate.",
      );
    }

    const orders = await getOrdersByDateRange(startDate, endDate);

    return NextResponse.json({
      orders,
      summary: buildOrdersSummary(orders),
    });
  } catch (error) {
    console.error(error);

    return errorResponse(
      502,
      "Failed to load orders from Shopify.",
      error instanceof Error ? error.message : "Unknown upstream error.",
    );
  }
}
