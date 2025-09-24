// apps/frontend/src/App.tsx
import { useEffect, useState } from "react";
import type { TenantSlug } from "@acme/types";

export default function App() {
  const [msg, setMsg] = useState("Loading…");
  const tenant: TenantSlug = "blue";

  useEffect(() => {
    fetch(`http://localhost:3001/demo/${tenant}`)
      .then(r => r.json())
      .then(d => setMsg(d.message))
      .catch(() => setMsg("Server not running yet; just the frontend here!"));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Multi-tenant Template — Frontend</h1>
      <p>{msg}</p>
    </div>
  );
}
