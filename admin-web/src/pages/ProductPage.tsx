// admin-web/src/pages/ProductPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge, Button, Group, Loader, Stack, Tabs, Text, Title, Alert, Paper } from "@mantine/core";
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
import { ProductActivityTab } from "../components/products/ProductActivityTab";

type TabKey = "overview" | "levels" | "fifo" | "activity";

export default function ProductPage() {
  const { tenantSlug, productId } = useParams<{ tenantSlug: string; productId?: string }>();
  const isEdit = Boolean(productId);
  const navigate = useNavigate();
  const canWriteProducts = useAuthStore((s) => s.hasPerm("products:write"));

  // URL query params (drive the active tab + welcome banner)
  const [searchParams, setSearchParams] = useSearchParams();
  const qpTab = (searchParams.get("tab") as TabKey | null) ?? (isEdit ? "overview" : "overview");
  const [activeTab, setActiveTab] = useState<TabKey>(qpTab);

  // Keep local tab state in sync if the URL changes (e.g. back/forward)
  useEffect(() => {
    setActiveTab(qpTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qpTab]);

  const showFifoWelcome = useMemo(() => {
    return activeTab === "fifo" && searchParams.get("welcome") === "fifo";
  }, [activeTab, searchParams]);

  function setTabInUrl(tab: TabKey, opts?: { welcome?: boolean }) {
    const next = new URLSearchParams();

    next.set("tab", tab);

    if (opts?.welcome && tab === "fifo") {
      next.set("welcome", "fifo");
    }

    setSearchParams(next, { replace: false });
  }

  // Product form state
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [barcode, setBarcode] = useState("");
  const [barcodeType, setBarcodeType] = useState<string>("");
  const [entityVersion, setEntityVersion] = useState<number | null>(null);

  const [loadingProduct, setLoadingProduct] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // A simple tick to trigger a refetch of the product after updates
  const [refreshTick, setRefreshTick] = useState(0);

  // Load product on edit (and whenever refreshTick changes)
  useEffect(() => {
    if (!isEdit || !productId) return;
    let cancelled = false;
    (async () => {
      try {
        setNotFound(false);
        setLoadingProduct(true);
        const res = await getProductApiRequest({ productId });
        if (!cancelled && res.success) {
          const p = res.data.product;
          setName(p.productName);
          setSku(p.productSku);
          setPrice(p.productPricePence);
          setBarcode(p.barcode || "");
          setBarcodeType(p.barcodeType || "");
          setEntityVersion(p.entityVersion);
        }
      } catch (e: any) {
        // Gracefully show a not found view for 404s
        if (!cancelled && (e?.httpStatusCode === 404 || e?.status === 404)) {
          setNotFound(true);
        } else {
          handlePageError(e, { title: "Failed to load product" });
        }
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, productId, refreshTick]);

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
      notifications.show({ color: "red", message: "Price (pence) required" });
      return;
    }

    setSaving(true);
    try {
      const key = (crypto as any)?.randomUUID?.() ?? String(Date.now());

      if (!isEdit) {
        const res = await createProductApiRequest({
          productName: name.trim(),
          productSku: sku.trim(),
          productPricePence: Number(price),
          barcode: barcode.trim() || undefined,
          barcodeType: (barcodeType && barcodeType !== "" ? barcodeType : undefined) as "EAN13" | "UPCA" | "CODE128" | "QR" | undefined,
          idempotencyKeyOptional: key,
        });
        if (res.success) {
          notifications.show({ color: "green", message: "Product created." });

          // Navigate directly to the new product page, open FIFO tab, show welcome banner.
          const newId = res.data.product.id;
          navigate(`/${tenantSlug}/products/${newId}?tab=fifo&welcome=fifo`, { replace: true });
          return; // do not fall through to list navigation
        }
      } else {
        if (!productId || entityVersion == null) return;
        const res = await updateProductApiRequest({
          productId,
          ...(name.trim() ? { productName: name.trim() } : {}),
          ...(typeof price === "number" ? { productPricePence: Number(price) } : {}),
          barcode: barcode.trim() || null,
          barcodeType: (barcodeType && barcodeType !== "" ? barcodeType : null) as "EAN13" | "UPCA" | "CODE128" | "QR" | null,
          currentEntityVersion: entityVersion,
          idempotencyKeyOptional: key,
        });
        if (res.success) {
          notifications.show({ color: "green", message: "Product updated." });

          // Stay on the page and refresh product data to get latest fields/version.
          setRefreshTick((t) => t + 1);
          return;
        }
      }
    } catch (e) {
      handlePageError(e, { title: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || loadingProduct;

  // --- Product not found view (edit mode only) ---
  if (isEdit && notFound) {
    return (
      <Stack gap="lg">
        <Group justify="space-between" align="start">
          <Title order={2}>Edit product</Title>
          <Group>
            <Button variant="default" onClick={() => navigate(-1)}>
              Back
            </Button>
          </Group>
        </Group>

        <Paper withBorder radius="md" p="md" className="bg-white">
          <Title order={4} mb="xs">
            Product not found
          </Title>
          <Text c="dimmed" mb="md">
            We couldn’t find a product with ID <code>{productId}</code>. It may have been
            deleted or you don’t have access.
          </Text>
          <Group>
            <Button variant="light" onClick={() => navigate(`/${tenantSlug}/products`)}>
              Go to products
            </Button>
            <Button onClick={() => navigate(`/${tenantSlug}/products/new`)}>
              Create a new product
            </Button>
          </Group>
        </Paper>
      </Stack>
    );
  }

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

      {busy && isEdit ? (
        <Group gap="sm">
          <Loader size="sm" />
          <Text>Loading…</Text>
        </Group>
      ) : (
        <>
          {/* FIFO welcome banner when redirected after creation */}
          {showFifoWelcome && (
            <Alert
              color="blue"
              title="Set initial FIFO stock?"
              withCloseButton
              onClose={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("welcome");
                setSearchParams(next, { replace: true });
              }}
              mb="md"
            >
              You’ve just created this product. If you already have units on hand,
              use the <b>Adjust stock</b> button in this tab to record your opening balance.
            </Alert>
          )}

          <Tabs
            value={activeTab}
            onChange={(v) => {
              const next = (v as TabKey) ?? "overview";
              setActiveTab(next);
              setTabInUrl(next);
            }}
            keepMounted={false}
          >
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              {isEdit && <Tabs.Tab value="levels">Stock levels</Tabs.Tab>}
              {isEdit && <Tabs.Tab value="fifo">FIFO</Tabs.Tab>}
              {isEdit && <Tabs.Tab value="activity">Activity</Tabs.Tab>}
            </Tabs.List>

            <Tabs.Panel value="overview" pt="md">
              <ProductOverviewTab
                isEdit={isEdit}
                name={name}
                sku={sku}
                price={price}
                barcode={barcode}
                barcodeType={barcodeType}
                entityVersion={entityVersion}
                onChangeName={setName}
                onChangeSku={setSku}
                onChangePrice={setPrice}
                onChangeBarcode={setBarcode}
                onChangeBarcodeType={setBarcodeType}
              />
              {isEdit && entityVersion != null && (
                <Group gap="xs" mt="sm">
                  <Text size="sm" c="dimmed">
                    Current version:
                  </Text>
                  <Badge>{entityVersion}</Badge>
                </Group>
              )}
            </Tabs.Panel>

            {isEdit && productId && (
              <Tabs.Panel value="levels" pt="md">
                <ProductStockLevelsTab productId={productId} />
              </Tabs.Panel>
            )}

            {isEdit && productId && (
              <Tabs.Panel value="fifo" pt="md">
                <ProductFifoTab productId={productId} canWriteProducts={canWriteProducts} />
              </Tabs.Panel>
            )}

            {isEdit && productId && (
              <Tabs.Panel value="activity" pt="md">
                <ProductActivityTab productId={productId} />
              </Tabs.Panel>
            )}
          </Tabs>
        </>
      )}
    </Stack>
  );
}
