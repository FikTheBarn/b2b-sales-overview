import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "B2B Sales Overview",
  description: "Request-driven Shopify sales overview for B2B reporting.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
