import type {
  LineItemNode,
  NormalizedOrder,
  OrderConnection,
  OrderNode,
  ShopifyPageInfo,
} from "@/lib/types";
import { normalizeOrder } from "@/lib/weights";

const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOPIFY_API_VERSION = "2026-07";
const SHOPIFY_API_URL = `https://${SHOPIFY_SHOP}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
const ORDER_PAGE_SIZE = 50;
const LINE_ITEM_PAGE_SIZE = 100;

type ShopifyGraphQLError = {
  message: string;
};

type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: ShopifyGraphQLError[];
};

function getRequiredEnvVar(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function addOneDay(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
}

function buildDateRangeQuery(startDate: string, endDate: string) {
  const endExclusive = addOneDay(endDate);

  return `created_at:>=${startDate}T00:00:00Z AND created_at:<${endExclusive}T00:00:00Z`;
}

async function shopifyGraphQL<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
) {
  const response = await fetch(SHOPIFY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify request failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as ShopifyGraphQLResponse<T>;

  if (payload.errors?.length) {
    throw new Error(
      payload.errors.map((error) => error.message).join("; "),
    );
  }

  if (!payload.data) {
    throw new Error("Shopify response did not include data.");
  }

  return payload.data;
}

const LINE_ITEM_FIELDS = `
  id
  name
  quantity
  product {
    productType
    title
  }
  variant {
    sku
    title
    inventoryItem {
      measurement {
        weight {
          value
          unit
        }
      }
    }
  }
  originalUnitPriceSet {
    shopMoney {
      amount
      currencyCode
    }
  }
  discountedUnitPriceSet {
    shopMoney {
      amount
      currencyCode
    }
  }
`;

const ORDER_FIELDS = `
  id
  name
  createdAt
  billingAddress {
    company
    country
  }
  customer {
    displayName
  }
  totalPriceSet {
    shopMoney {
      amount
      currencyCode
    }
  }
  lineItems(first: ${LINE_ITEM_PAGE_SIZE}) {
    nodes {
      ${LINE_ITEM_FIELDS}
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
`;

async function getOrdersPage(
  accessToken: string,
  searchQuery: string,
  after: string | null,
) {
  const query = `
    query GetOrders($first: Int!, $after: String, $searchQuery: String!) {
      orders(
        first: $first
        after: $after
        reverse: true
        sortKey: CREATED_AT
        query: $searchQuery
      ) {
        nodes {
          ${ORDER_FIELDS}
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const data = await shopifyGraphQL<{ orders: OrderConnection }>(
    accessToken,
    query,
    {
      first: ORDER_PAGE_SIZE,
      after,
      searchQuery,
    },
  );

  return data.orders;
}

async function getOrderLineItemsPage(
  accessToken: string,
  orderId: string,
  after: string | null,
) {
  const query = `
    query GetOrderLineItems($orderId: ID!, $first: Int!, $after: String) {
      node(id: $orderId) {
        ... on Order {
          lineItems(first: $first, after: $after) {
            nodes {
              ${LINE_ITEM_FIELDS}
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  `;

  const data = await shopifyGraphQL<{
    node:
      | {
          lineItems: {
            nodes: LineItemNode[];
            pageInfo: ShopifyPageInfo;
          };
        }
      | null;
  }>(accessToken, query, {
    orderId,
    first: LINE_ITEM_PAGE_SIZE,
    after,
  });

  if (!data.node) {
    throw new Error(`Shopify order not found while paging line items: ${orderId}`);
  }

  return data.node.lineItems;
}

async function getAllOrderLineItems(
  accessToken: string,
  order: OrderNode,
): Promise<LineItemNode[]> {
  const allLineItems = [...order.lineItems.nodes];
  let hasNextPage = order.lineItems.pageInfo.hasNextPage;
  let cursor = order.lineItems.pageInfo.endCursor;
  let pageCount = 0;

  while (hasNextPage) {
    if (!cursor) {
      throw new Error(
        `Shopify line item pagination ended without a cursor for order ${order.id}.`,
      );
    }

    pageCount += 1;

    if (pageCount > 200) {
      throw new Error(`Shopify line item pagination exceeded limits for ${order.id}.`);
    }

    const page = await getOrderLineItemsPage(accessToken, order.id, cursor);
    allLineItems.push(...page.nodes);
    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return allLineItems;
}

async function hydrateOrders(
  accessToken: string,
  orders: OrderNode[],
): Promise<OrderNode[]> {
  const hydratedOrders: OrderNode[] = [];

  for (const order of orders) {
    if (!order.lineItems.pageInfo.hasNextPage) {
      hydratedOrders.push(order);
      continue;
    }

    hydratedOrders.push({
      ...order,
      lineItems: {
        nodes: await getAllOrderLineItems(accessToken, order),
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      },
    });
  }

  return hydratedOrders;
}

export async function getShopifyAccessToken() {
  const shop = getRequiredEnvVar("SHOPIFY_SHOP", SHOPIFY_SHOP);
  const clientId = getRequiredEnvVar("SHOPIFY_CLIENT_ID", SHOPIFY_CLIENT_ID);
  const clientSecret = getRequiredEnvVar(
    "SHOPIFY_CLIENT_SECRET",
    SHOPIFY_CLIENT_SECRET,
  );

  const response = await fetch(
    `https://${shop}.myshopify.com/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify authentication failed: ${errorText}`);
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new Error("Shopify authentication response did not include an access token.");
  }

  return data.access_token;
}

export async function getShopName() {
  const accessToken = await getShopifyAccessToken();
  const data = await shopifyGraphQL<{ shop: { name: string } }>(
    accessToken,
    `
      query GetShopName {
        shop {
          name
        }
      }
    `,
  );

  return data.shop.name;
}

export async function getRecentOrders() {
  const accessToken = await getShopifyAccessToken();
  const orders = await getOrdersPage(accessToken, "", null);

  return hydrateOrders(accessToken, orders.nodes.slice(0, 2));
}

export async function getOrdersByDateRange(
  startDate: string,
  endDate: string,
): Promise<NormalizedOrder[]> {
  const accessToken = await getShopifyAccessToken();
  const searchQuery = buildDateRangeQuery(startDate, endDate);
  const allOrders: OrderNode[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  let pageCount = 0;

  while (hasNextPage) {
    pageCount += 1;

    if (pageCount > 500) {
      throw new Error("Shopify order pagination exceeded limits.");
    }

    const page = await getOrdersPage(accessToken, searchQuery, cursor);
    const hydratedOrders = await hydrateOrders(accessToken, page.nodes);

    allOrders.push(...hydratedOrders);
    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;

    if (hasNextPage && !cursor) {
      throw new Error("Shopify order pagination ended without a cursor.");
    }
  }

  return allOrders.map(normalizeOrder);
}
