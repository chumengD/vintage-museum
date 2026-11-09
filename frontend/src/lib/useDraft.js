import { useState } from "react";
import { api } from "./api";
export function useDraft(type, initialId) {
  const [draftId, setDraftId] = useState(initialId);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(data) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const draft = await api("/drafts", {
        method: "POST",
        body: {
          id: draftId,
          type,
          data,
          title: data.name || data.number || "未命名草稿",
        },
      });
      setDraftId(draft.id);
      setMessage("草稿已保存，可在「我的草稿」继续编辑。");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (draftId) await api(`/drafts/${draftId}`, { method: "DELETE" });
  }
  return { save, remove, message, error, busy };
}
