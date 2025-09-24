import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { login } from "../api";

export default function LoginPage() {
  const { tenantSlug = "" } = useParams();
  const nav = useNavigate();
  const [email, setEmail] = useState("alice@blue.test");
  const [password, setPassword] = useState("password123");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(tenantSlug, email, password);
      nav(`/t/${tenantSlug}/admin`);
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 360 }}>
      <h1>Login — {tenantSlug}</h1>
      <form onSubmit={onSubmit}>
        <label>Email<br/>
          <input value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <br/><br/>
        <label>Password<br/>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <br/><br/>
        <button disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
      </form>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <p style={{ marginTop: 16 }}>
        Try <code>alice@blue.test</code> / <code>password123</code> or <code>bob@green.test</code> / <code>password123</code>
      </p>
    </div>
  );
}
