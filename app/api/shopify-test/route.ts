import { NextResponse } from "next/server";
import { getShopifyAccessToken } from "@/lib/shopify";

export async function GET() {
  try {
    const token = await getShopifyAccessToken();

    return NextResponse.json({
      success: true,
      message: "Successfully authenticated with Shopify",
      tokenReceived: Boolean(token),
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