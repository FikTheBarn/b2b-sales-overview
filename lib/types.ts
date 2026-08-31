export type WeightUnit = "GRAMS" | "KILOGRAMS";

export type LineItemWeight = {
  unit: WeightUnit;
  value: number;
};

export type Money = {
  amount: string;
  currencyCode: string;
};

export type ProductNode = {
  productType: string;
  title: string;
} | null;

export type VariantNode = {
  sku: string | null;
  title: string;
  inventoryItem: {
    measurement: {
      weight: LineItemWeight | null;
    };
  } | null;
} | null;

export type LineItemNode = {
  id: string;
  name: string;
  quantity: number;
  product: ProductNode;
  variant: VariantNode;
  originalUnitPriceSet: {
    shopMoney: Money;
  } | null;
  discountedUnitPriceSet: {
    shopMoney: Money;
  } | null;
};

export type ShopifyPageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

export type OrderNode = {
  id: string;
  name: string;
  createdAt: string;
  billingAddress: {
    company: string | null;
    country: string | null;
  } | null;
  customer: {
    displayName: string | null;
  } | null;
  totalPriceSet: {
    shopMoney: Money;
  };
  lineItems: {
    nodes: LineItemNode[];
    pageInfo: ShopifyPageInfo;
  };
};

export type OrderConnection = {
  nodes: OrderNode[];
  pageInfo: ShopifyPageInfo;
};

export type NormalizedLineItem = {
  id: string;
  name: string;
  quantity: number;
  productType: string | null;
  productTitle: string | null;
  sku: string | null;
  variantTitle: string | null;
  unitPrice: number | null;
  discountedUnitPrice: number | null;
  currencyCode: string | null;
  unitWeightKg: number | null;
  standardWeightKg: number;
  legacyWeightKg: number;
};

export type NormalizedOrder = {
  id: string;
  name: string;
  createdAt: string;
  company: string | null;
  customer: string | null;
  country: string | null;
  totalRevenue: number;
  currencyCode: string;
  standardWeightKg: number;
  legacyWeightKg: number;
  differenceKg: number;
  lineItems: NormalizedLineItem[];
};

export type EntlastungBucket = "DE" | "EU" | "WORLD_WIDE";

export type EntlastungSummary = Record<EntlastungBucket, number>;

export type OrdersApiSuccess = {
  orders: NormalizedOrder[];
  summary: {
    orderCount: number;
    totalRevenue: number | null;
    totalStandardWeightKg: number;
    totalLegacyWeightKg: number;
    totalDifferenceKg: number;
    currencyCode: string | null;
    currencyBreakdown: Array<{
      currencyCode: string;
      totalRevenue: number;
    }>;
  };
};

export type OrdersApiError = {
  error: string;
  details?: string;
};
