import { NextResponse } from "next/server";
import { getShopifyAccessToken, getShopName, getRecentOrders } from "@/lib/shopify";

export async function GET() {
  try {
    const token = await getShopifyAccessToken();
     const shopName = await getShopName();
     const orders = await getRecentOrders();

    return NextResponse.json({
      success: true,
      message: "Successfully authenticated with Shopify",
      tokenReceived: Boolean(token),
      shopName,
      orders,

    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
 
}
