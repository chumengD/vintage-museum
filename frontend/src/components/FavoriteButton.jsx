import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../lib/api";
export default function FavoriteButton({ itemKey, label = "系列", initialSaved, onChange }) {
  const { user, requireAuth } = useAuth();
  const [saved, setSaved] = useState(initialSaved || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (user && initialSaved === undefined)
      api("/favorites")
        .then((items) => {
          if (active) setSaved(items.some((i) => i.key === itemKey));
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, itemKey, initialSaved]);
  async function toggle() {
    if (!requireAuth()) return;
    setBusy(true);
    setError("");
    try {
      const data = await api("/favorites", {
        method: "POST",
        body: { key: itemKey },
      });
      setSaved(data.saved);
      onChange?.(data.saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        className="button whitespace-nowrap"
        disabled={busy}
        onClick={toggle}
        aria-pressed={!!user && saved}
      >
        {user && saved ? "★ 已收藏" : `☆ 收藏${label}`}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-vermilion">
          {error}
        </p>
      )}
    </div>
  );
}
