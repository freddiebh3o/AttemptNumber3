// admin-web/src/pages/tabs/products/ProductOverviewTab.tsx
import { NumberInput, Stack, TextInput, Select } from "@mantine/core";
import React from "react";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";

type Props = {
  isEdit: boolean;
  name: string;
  sku: string;
  /** Still pence in parent state; we convert to/from pounds only for the UI */
  price: number | "";
  barcode: string;
  barcodeType: string;
  entityVersion: number | null;
  onChangeName: (v: string) => void;
  onChangeSku: (v: string) => void;
  /** Pass pence back to parent (or "" when cleared) */
  onChangePrice: (v: number | "") => void;
  onChangeBarcode: (v: string) => void;
  onChangeBarcodeType: (v: string) => void;
};

export const ProductOverviewTab: React.FC<Props> = ({
  isEdit,
  name,
  sku,
  price,
  barcode,
  barcodeType,
  onChangeName,
  onChangeSku,
  onChangePrice,
  onChangeBarcode,
  onChangeBarcodeType,
}) => {
  const barcodeScanningEnabled = useFeatureFlag("barcodeScanningEnabled");

  const barcodeTypeOptions = [
    { value: "", label: "None" },
    { value: "EAN13", label: "EAN-13" },
    { value: "UPCA", label: "UPC-A" },
    { value: "CODE128", label: "Code 128" },
    { value: "QR", label: "QR Code" },
  ];

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

      {barcodeScanningEnabled && (
        <>
          <Select
            label="Barcode Type"
            placeholder="Select barcode type"
            value={barcodeType}
            onChange={(v) => onChangeBarcodeType(v || "")}
            data={barcodeTypeOptions}
            clearable
          />

          <TextInput
            label="Barcode"
            placeholder="e.g. 5012345678900"
            value={barcode}
            onChange={(e) => onChangeBarcode(e.currentTarget.value)}
            description={barcodeType ? `Enter ${barcodeType} barcode value` : "Select barcode type first"}
          />
        </>
      )}
    </Stack>
  );
};
