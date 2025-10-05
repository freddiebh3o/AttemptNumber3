import { useEffect, useState } from "react";
import { Tabs } from "@mantine/core";
import { useSearchParams } from "react-router-dom";
import ThemeSettingsPage from "../components/theme/ThemeSettingsTab";
import ThemeActivityTab from "../components/theme/ThemeActivityTab";

type TabKey = "settings" | "activity";

export default function ThemePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qpTab = (searchParams.get("tab") as TabKey | null) ?? "settings";
  const [activeTab, setActiveTab] = useState<TabKey>(qpTab);

  // keep local state in sync with URL
  useEffect(() => {
    setActiveTab(qpTab);
  }, [qpTab]);

  function setTabInUrl(tab: TabKey) {
    const next = new URLSearchParams();
    next.set("tab", tab);
    setSearchParams(next, { replace: false });
  }

  return (
    <Tabs
      value={activeTab}
      onChange={(v) => {
        const next = (v as TabKey) ?? "settings";
        setActiveTab(next);
        setTabInUrl(next);
      }}
      keepMounted={false}
    >
      <Tabs.List>
        <Tabs.Tab value="settings">Settings</Tabs.Tab>
        <Tabs.Tab value="activity">Activity</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="settings" pt="md">
        <ThemeSettingsPage />
      </Tabs.Panel>

      <Tabs.Panel value="activity" pt="md">
        <ThemeActivityTab />
      </Tabs.Panel>
    </Tabs>
  );
}
