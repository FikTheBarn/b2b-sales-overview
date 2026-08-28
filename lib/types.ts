export type WeightUnit = "GRAMS" | "KILOGRAMS";

export type LineItemWeight = {
  unit: WeightUnit;
  value: number;
};

export type LineItemNode = {
  id: string;
  quantity: number;
  product: {
    productType: string;
    title: string;
  } | null;
  variant: {
    sku: string;
    title: string;
    inventoryItem: {
      measurement: {
        weight: LineItemWeight | null;
      };
    } | null;
  } | null;
};
