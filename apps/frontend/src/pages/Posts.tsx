import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api";

type Post = {
  id: string;
  title: string;
  content?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

export default function PostsPage() {
  const { tenantSlug = "" } = useParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await apiFetch<{ posts: Post[] }>(tenantSlug, "/posts");
    setPosts(data.posts);
  }

  useEffect(() => { load().catch(err => setError(err.message)); }, [tenantSlug]);

  async function createPost() {
    setError(null);
    try {
      await apiFetch<{ post: Post }>(tenantSlug, "/posts", {
        method: "POST",
        body: JSON.stringify({ title, content })
      });
      setTitle("");
      setContent("");
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function updateStatus(id: string, status: Post["status"]) {
    try {
      await apiFetch<{ post: Post }>(tenantSlug, `/posts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function destroy(id: string) {
    try {
      await apiFetch<void>(tenantSlug, `/posts/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) { setError(e.message); }
  }

  const ordered = useMemo(
    () => [...posts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [posts]
  );

  return (
    <div>
      <h3>Posts</h3>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 16 }}>
        <h4>Create Post</h4>
        <input
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ width: 300 }}
        />
        <br/><br/>
        <textarea
          placeholder="Content"
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{ width: 300, height: 100 }}
        />
        <br/><br/>
        <button disabled={!title} onClick={createPost}>Create</button>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {ordered.map(p => (
          <li key={p.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <strong>{p.title}</strong>
              <em style={{ opacity: 0.7 }}>({p.status})</em>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={() => updateStatus(p.id, "DRAFT")}>Draft</button>
                <button onClick={() => updateStatus(p.id, "PUBLISHED")}>Publish</button>
                <button onClick={() => updateStatus(p.id, "ARCHIVED")}>Archive</button>
                <button onClick={() => destroy(p.id)}>Delete</button>
              </div>
            </div>
            {p.content && <p style={{ marginTop: 8 }}>{p.content}</p>}
            <small style={{ opacity: 0.7 }}>Updated: {new Date(p.updatedAt).toLocaleString()}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
