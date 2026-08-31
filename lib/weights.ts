import {
  LineItemNode,
  type NormalizedLineItem,
  type NormalizedOrder,
  type OrderNode,
  type OrdersApiSuccess,
  type WeightUnit,
} from "@/lib/types";

export function weightToKg(value: number, unit: WeightUnit) {
  if (unit === "GRAMS") {
    return value / 1000;
  }
  if (unit === "KILOGRAMS") {
    return value;
  }
  return 0;
}

export function isCoffeeProduct(
  productType: string | null,
  productTitle: string | null,
) {
  if (productType === null) {
    return false;
  } else if (
    productType === "Filter Coffee" ||
    productType === "Espresso Coffee" ||
    productType === "Milk Espresso"
  ) {
    return true;
  } else if (productTitle?.includes("Samples")) {
    return true;
  }
  return false;
}

export function calculateLineItemWeight(
  productType: string,
  productTitle: string,
  productQuantity: number,
  value: number,
  unit: WeightUnit,
) {
  if (!isCoffeeProduct(productType, productTitle)) {
    return 0;
  }

  const totalWeight = productQuantity * weightToKg(value, unit);
  return totalWeight;
}

export function calculateOrderWeight(lineItems: LineItemNode[]) {
  let orderWeight = 0;

  for (const lineItem of lineItems) {
    if (lineItem.product === null) {
      continue;
    }

    const weight = lineItem.variant?.inventoryItem?.measurement.weight;

    if (!weight) {
      continue;
    }

    const lineItemWeight = calculateLineItemWeight(
      lineItem.product.productType,
      lineItem.product.title,
      lineItem.quantity,
      weight.value,
      weight.unit,
    );

    orderWeight += lineItemWeight;
  }

  return orderWeight;
}

export function getStructuredLineItemWeightKg(lineItem: LineItemNode) {
  const weight = lineItem.variant?.inventoryItem?.measurement.weight;

  if (!weight) {
    return 0;
  }

  return weightToKg(weight.value, weight.unit);
}

function getLegacyVariantWeightKg(variantTitle: string) {
  const normalizedTitle = variantTitle.toLowerCase();
  const kgMatch = normalizedTitle.match(/(\d+(?:\.\d+)?)\s*kg\b/);

  if (kgMatch) {
    return parseFloat(kgMatch[1]);
  }

  const gramsMatch = normalizedTitle.match(/(\d+(?:\.\d+)?)\s*g\b/);

  if (gramsMatch) {
    return parseFloat(gramsMatch[1]) / 1000;
  }

  return 0;
}

export function legacyCalculateLineItemWeight(lineItem: LineItemNode) {
  if (lineItem.product === null || lineItem.variant === null) {
    return 0;
  }

  if (
    !isCoffeeProduct(lineItem.product.productType, lineItem.product.title)
  ) {
    return 0;
  }

  const parsedWeightKg = getLegacyVariantWeightKg(lineItem.variant.title);
  const unitWeightKg =
    parsedWeightKg > 0
      ? parsedWeightKg
      : getStructuredLineItemWeightKg(lineItem);

  return lineItem.quantity * unitWeightKg;
}

export function legacyOrderWeight(lineItems: LineItemNode[]) {
  let orderWeight = 0;

  for (const lineItem of lineItems) {
    orderWeight += legacyCalculateLineItemWeight(lineItem);
  }

  return orderWeight;
}

function getMoneyAmount(
  moneySet:
    | {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      }
    | null
    | undefined,
) {
  if (!moneySet) {
    return null;
  }

  const amount = Number.parseFloat(moneySet.shopMoney.amount);

  return Number.isFinite(amount) ? amount : null;
}

export function normalizeLineItem(lineItem: LineItemNode): NormalizedLineItem {
  const weight = lineItem.variant?.inventoryItem?.measurement.weight;
  const standardWeightKg =
    lineItem.product && weight
      ? calculateLineItemWeight(
          lineItem.product.productType,
          lineItem.product.title,
          lineItem.quantity,
          weight.value,
          weight.unit,
        )
      : 0;

  return {
    id: lineItem.id,
    name: lineItem.name,
    quantity: lineItem.quantity,
    productType: lineItem.product?.productType ?? null,
    productTitle: lineItem.product?.title ?? null,
    sku: lineItem.variant?.sku ?? null,
    variantTitle: lineItem.variant?.title ?? null,
    unitPrice: getMoneyAmount(lineItem.originalUnitPriceSet),
    discountedUnitPrice: getMoneyAmount(lineItem.discountedUnitPriceSet),
    currencyCode:
      lineItem.discountedUnitPriceSet?.shopMoney.currencyCode ??
      lineItem.originalUnitPriceSet?.shopMoney.currencyCode ??
      null,
    unitWeightKg: weight ? weightToKg(weight.value, weight.unit) : null,
    standardWeightKg,
    legacyWeightKg: legacyCalculateLineItemWeight(lineItem),
  };
}

export function normalizeOrder(order: OrderNode): NormalizedOrder {
  const lineItems = order.lineItems.nodes.map(normalizeLineItem);
  const standardWeightKg = calculateOrderWeight(order.lineItems.nodes);
  const legacyWeightKg = legacyOrderWeight(order.lineItems.nodes);
  const differenceKg = standardWeightKg - legacyWeightKg;
  const totalRevenue = Number.parseFloat(order.totalPriceSet.shopMoney.amount);

  return {
    id: order.id,
    name: order.name,
    createdAt: order.createdAt,
    company: order.billingAddress?.company ?? null,
    customer: order.customer?.displayName ?? null,
    country: order.billingAddress?.country ?? null,
    totalRevenue: Number.isFinite(totalRevenue) ? totalRevenue : 0,
    currencyCode: order.totalPriceSet.shopMoney.currencyCode,
    standardWeightKg,
    legacyWeightKg,
    differenceKg,
    lineItems,
  };
}

export function buildOrdersSummary(
  orders: NormalizedOrder[],
): OrdersApiSuccess["summary"] {
  const revenueByCurrency = new Map<string, number>();

  for (const order of orders) {
    revenueByCurrency.set(
      order.currencyCode,
      (revenueByCurrency.get(order.currencyCode) ?? 0) + order.totalRevenue,
    );
  }

  const currencyBreakdown = Array.from(revenueByCurrency.entries())
    .map(([currencyCode, totalRevenue]) => ({
      currencyCode,
      totalRevenue,
    }))
    .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));

  const singleCurrency =
    currencyBreakdown.length === 1 ? currencyBreakdown[0].currencyCode : null;

  return {
    orderCount: orders.length,
    totalRevenue:
      currencyBreakdown.length === 1 ? currencyBreakdown[0].totalRevenue : null,
    totalStandardWeightKg: orders.reduce(
      (sum, order) => sum + order.standardWeightKg,
      0,
    ),
    totalLegacyWeightKg: orders.reduce(
      (sum, order) => sum + order.legacyWeightKg,
      0,
    ),
    totalDifferenceKg: orders.reduce(
      (sum, order) => sum + order.differenceKg,
      0,
    ),
    currencyCode: singleCurrency,
    currencyBreakdown,
  };
}
