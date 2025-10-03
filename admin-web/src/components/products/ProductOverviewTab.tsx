// admin-web/src/pages/tabs/products/ProductOverviewTab.tsx  
import { NumberInput, Stack, TextInput } from "@mantine/core";
import React from "react";

type Props = {
  isEdit: boolean;
  name: string;
  sku: string;
  price: number | "";
  entityVersion: number | null;
  onChangeName: (v: string) => void;
  onChangeSku: (v: string) => void;
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
        label="Price (cents)"
        min={0}
        required
        value={price}
        onChange={(v) => onChangePrice(typeof v === "number" ? v : v === "" ? "" : Number(v))}
      />
    </Stack>
  );
};
