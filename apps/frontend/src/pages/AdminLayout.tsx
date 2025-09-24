import { Outlet, Link, useNavigate, useParams } from "react-router-dom";
import { getAuth, setAuth } from "../api";

export default function AdminLayout() {
  const { tenantSlug = "" } = useParams();
  const nav = useNavigate();
  const auth = getAuth(tenantSlug);

  if (!auth) {
    nav(`/t/${tenantSlug}/login`);
    return null;
  }

  const { user } = auth;
  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <header style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Admin — {tenantSlug}</h2>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link to={`/t/${tenantSlug}/admin/posts`}>Posts</Link>
        </nav>
        <div style={{ marginLeft: "auto" }}>
          {user.email} ({user.role})
          <button
            style={{ marginLeft: 12 }}
            onClick={() => {
              setAuth(tenantSlug, null);
              nav(`/t/${tenantSlug}/login`);
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <main style={{ marginTop: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
