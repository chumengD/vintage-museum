import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { ErrorMessage } from "./Feedback";
export default function ProfileEditor({ profile, onSaved }) {
  const { setUser } = useAuth();
  const [form, setForm] = useState(profile);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("/profile", { method: "PATCH", body: form });
      setUser(data);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="space-y-5 p-6" onSubmit={submit}>
      {[
        ["displayName", "姓名", "text"],
        ["location", "所在地", "text"],
        ["website", "个人网站", "url"],
      ].map(([key, label, type]) => (
        <label key={key} className="block">
          {label}
          <input
            className="input mt-2"
            required={key === "displayName"}
            type={type}
            maxLength={100}
            value={form[key] || ""}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        </label>
      ))}
      <label className="block">
        个人介绍
        <textarea
          className="input mt-2 min-h-24"
          maxLength={500}
          value={form.bio || ""}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
      </label>
      <ErrorMessage>{error}</ErrorMessage>
      <button className="button button-dark" disabled={busy}>
        {busy ? "保存中…" : "保存资料"}
      </button>
    </form>
  );
}
