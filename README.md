# B2B Sales Overview

Request-driven Shopify sales dashboard built with Next.js. The app fetches orders on demand for a selected date range, preserves the existing Shopify authentication flow, and compares the current structured weight calculation against the legacy Shopify Flow-compatible calculation.

## Environment

Set these values in `.env.local`:

```bash
SHOPIFY_SHOP=your-shop-subdomain
SHOPIFY_CLIENT_ID=your-client-id
SHOPIFY_CLIENT_SECRET=your-client-secret
```

## Local Run

Install dependencies if needed, then start the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What The App Does

- Uses native date inputs and a `Load Orders` action instead of background syncing or storage.
- Calls `/api/orders?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.
- Validates the requested date range and returns controlled `400` errors for bad input.
- Fetches Shopify orders with cursor pagination.
- Fetches additional line-item pages per order when Shopify truncates the nested line-item connection.
- Returns normalized order data with company, customer, country, revenue, both weight calculations, and line-item detail.
- Filters results in the browser by company, customer, country, and text search.
- Supports table sorting for the main order fields.

## Verification

These checks should pass:

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

## Example API Requests

Successful request:

```bash
curl "http://localhost:3000/api/orders?startDate=2026-08-01&endDate=2026-08-31"
```

Validation error example:

```bash
curl "http://localhost:3000/api/orders?startDate=2026-08-31"
```

## Current Limitations

- The dashboard only keeps data in memory for the current browser session.
- Revenue is summarized by currency; mixed-currency ranges are shown as separate totals instead of one combined figure.
- Filtering happens on the returned dataset in the browser. There is no server-side persistence, webhook sync, or Postgres layer yet.
