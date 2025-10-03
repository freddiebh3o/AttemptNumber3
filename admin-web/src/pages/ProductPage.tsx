// admin-web/src/pages/ProductPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Group, Loader, Paper, Stack, Tabs, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuthStore } from "../stores/auth";
import { handlePageError } from "../utils/pageError";
import {
  createProductApiRequest,
  getProductApiRequest,
  updateProductApiRequest,
} from "../api/products";

import { ProductOverviewTab } from "../components/products/ProductOverviewTab";
import { ProductStockLevelsTab } from "../components/products/ProductStockLevelsTab";
import { ProductFifoTab } from "../components/products/ProductFifoTab";

export default function ProductPage() {
  const { tenantSlug, productId } = useParams<{ tenantSlug: string; productId?: string }>();
  const isEdit = Boolean(productId);
  const navigate = useNavigate();
  const canWriteProducts = useAuthStore((s) => s.hasPerm("products:write"));

  // Product form state
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [entityVersion, setEntityVersion] = useState<number | null>(null);

  const [loadingProduct, setLoadingProduct] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Load product on edit
  useEffect(() => {
    if (!isEdit || !productId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingProduct(true);
        const res = await getProductApiRequest({ productId });
        if (!cancelled && res.success) {
          const p = res.data.product;
          setName(p.productName);
          setSku(p.productSku);
          setPrice(p.productPriceCents);
          setEntityVersion(p.entityVersion);
        }
      } catch (e) {
        handlePageError(e, { title: "Failed to load product" });
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, productId]);

  async function handleSave() {
    if (!name.trim()) {
      notifications.show({ color: "red", message: "Name is required" });
      return;
    }
    if (!isEdit && !sku.trim()) {
      notifications.show({ color: "red", message: "SKU is required" });
      return;
    }
    if (price === "" || price < 0) {
      notifications.show({ color: "red", message: "Price (cents) required" });
      return;
    }

    setSaving(true);
    try {
      const key = (crypto as any)?.randomUUID?.() ?? String(Date.now());

      if (!isEdit) {
        const res = await createProductApiRequest({
          productName: name.trim(),
          productSku: sku.trim(),
          productPriceCents: Number(price),
          idempotencyKeyOptional: key,
        });
        if (res.success) {
          notifications.show({ color: "green", message: "Product created." });
          navigate(`/${tenantSlug}/products`);
        }
      } else {
        if (!productId || entityVersion == null) return;
        const res = await updateProductApiRequest({
          productId,
          ...(name.trim() ? { productName: name.trim() } : {}),
          ...(typeof price === "number" ? { productPriceCents: Number(price) } : {}),
          currentEntityVersion: entityVersion,
          idempotencyKeyOptional: key,
        });
        if (res.success) {
          notifications.show({ color: "green", message: "Product updated." });
          navigate(`/${tenantSlug}/products`);
        }
      }
    } catch (e) {
      handlePageError(e, { title: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || loadingProduct;

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between" align="start">
        <Title order={2}>{isEdit ? "Edit product" : "New product"}</Title>
        <Group>
          <Button variant="default" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={busy} disabled={!canWriteProducts}>
            Save
          </Button>
        </Group>
      </Group>

      <Paper withBorder radius="md" p="md" className="bg-white">
        {busy && isEdit ? (
          <Group gap="sm">
            <Loader size="sm" />
            <Text>Loading…</Text>
          </Group>
        ) : (
          <Tabs defaultValue="overview" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              {isEdit && <Tabs.Tab value="levels">Stock levels</Tabs.Tab>}
              {isEdit && <Tabs.Tab value="fifo">FIFO</Tabs.Tab>}
            </Tabs.List>

            <Tabs.Panel value="overview" pt="md">
              <ProductOverviewTab
                isEdit={isEdit}
                name={name}
                sku={sku}
                price={price}
                entityVersion={entityVersion}
                onChangeName={setName}
                onChangeSku={setSku}
                onChangePrice={setPrice}
              />
              {isEdit && entityVersion != null && (
                <Text size="sm" c="dimmed" mt="sm">
                  Current version: <Badge>{entityVersion}</Badge>
                </Text>
              )}
            </Tabs.Panel>

            {isEdit && productId && (
              <Tabs.Panel value="levels" pt="md">
                <ProductStockLevelsTab productId={productId} />
              </Tabs.Panel>
            )}

            {isEdit && productId && (
              <Tabs.Panel value="fifo" pt="md">
                <ProductFifoTab
                  productId={productId}
                  canWriteProducts={canWriteProducts}
                />
              </Tabs.Panel>
            )}
          </Tabs>
        )}
      </Paper>
    </Stack>
  );
}
