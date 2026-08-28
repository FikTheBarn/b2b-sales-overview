import { LineItemNode, WeightUnit } from "@/lib/types";

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
