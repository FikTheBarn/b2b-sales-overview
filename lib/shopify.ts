const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP!;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

export async function getShopifyAccessToken() {
  const response = await fetch(
    `https://${SHOPIFY_SHOP}.myshopify.com/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
      }),
    }
  );
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Shopify authentication failed: ${error}`);
    }

  const data = await response.json();

  return data.access_token;
}

export async function getRecentOrders() {
  const token = await getShopifyAccessToken();
    const query = `
      {
        orders(first: 2, reverse: true) {
          nodes {
            id
            name
            createdAt
            billingAddress {
              company
              country
            }
            lineItems(first: 10) {
              nodes {
                id
                quantity
                product {
                  productType
                  title
                }
                variant {
                  sku
                  title
                  inventoryItem {
                    measurement{
                      weight{
                        unit
                        value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${SHOPIFY_SHOP}.myshopify.com/admin/api/2026-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Shopify orders request failed: ${error}`);
    }

    return response.json();
}
    