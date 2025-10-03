// admin-web/src/pages/tabs/products/ProductOverviewTab.tsx  
import { NumberInput, Stack, TextInput } from "@mantine/core";
import React from "react";

type Props = {
  isEdit: boolean;
  name: string;
  sku: string;
  /** Still pence in parent state; we convert to/from pounds only for the UI */
  price: number | "";
  entityVersion: number | null;
  onChangeName: (v: string) => void;
  onChangeSku: (v: string) => void;
  /** Pass pence back to parent (or "" when cleared) */
  onChangePrice: (v: number | "") => void;
};

export const ProductOverviewTab: React.FC<Props> = ({
  isEdit,
  name,
  sku,
  price,
  onChangeName,
  onChangeSku,
  onChangePrice,
}) => {
  // Convert pence → pounds for display
  const pricePounds = price === "" ? "" : price / 100;

  return (
    <Stack gap="md">
      <TextInput
        label="Product name"
        required
        value={name}
        onChange={(e) => onChangeName(e.currentTarget.value)}
      />

      <TextInput
        label="SKU"
        required={!isEdit}
        value={sku}
        onChange={(e) => onChangeSku(e.currentTarget.value)}
        disabled={isEdit}
      />

      <NumberInput
        label="Price (GBP)"
        placeholder="e.g. 12.99"
        min={0}
        step={0.01}
        value={price === "" ? "" : price / 100}     // pence -> pounds
        onChange={(v) => {
          if (v === "") return onChangePrice("");
          const n = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(n)) return;
          onChangePrice(Math.round(n * 100));       // pounds -> pence
        }}
        leftSection="£"
        leftSectionPointerEvents="none"
      />
    </Stack>
  );
};
