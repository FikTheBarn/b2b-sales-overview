import { NextResponse } from "next/server";
import { getRecentOrders } from "@/lib/shopify";
import { calculateOrderWeight, legacyOrderWeight } from "@/lib/weights";

export async function GET() {
  try {
    const orders = await getRecentOrders();
    const order = orders[0];

    if (!order) {
      return NextResponse.json({
        order: null,
        message: "No recent orders were returned by Shopify.",
      });
    }

    const standardWeightKg = calculateOrderWeight(order.lineItems.nodes);
    const legacyWeightKg = legacyOrderWeight(order.lineItems.nodes);

    return NextResponse.json({
      orderName: order.name,
      standardWeightKg,
      legacyWeightKg,
      differenceKg: standardWeightKg - legacyWeightKg,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load recent orders.",
      },
      { status: 500 },
    );
  }
}
