import { NextResponse } from "next/server";
import { getRecentOrders } from "@/lib/shopify";
import { calculateOrderWeight } from "@/lib/weights";

export async function GET() {
  const orders = await getRecentOrders();
  const order = orders[0];
  const calculatedWeight = calculateOrderWeight(order.lineItems.nodes);

  return NextResponse.json({
    order: order.name,
    calculateOrderWeight: calculatedWeight,
  });
}
