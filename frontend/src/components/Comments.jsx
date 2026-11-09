import { useState } from "react";
import { useResource } from "../lib/useResource";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { ErrorMessage, ResourceState, Empty } from "./Feedback";
export default function Comments({ versionId }) {
  const resource = useResource(`/versions/${versionId}/comments`);
  const { requireAuth } = useAuth();
  const [body, setBody] = useState("");
  const [reply, setReply] = useState(null);
  const [expanded, setExpanded] = useState([]);
  const [limit, setLimit] = useState(3);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!requireAuth()) return;
    if (!body.trim()) {
      setError("请输入评论内容。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/versions/${versionId}/comments`, {
        method: "POST",
        body: { body, parentId: reply?.id },
      });
      if (reply) setExpanded([...expanded, reply.id]);
      setReply(null);
      setBody("");
      resource.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const items = resource.data || [];
  const roots = items.filter((c) => !c.parentId);
  return (
    <section className="mt-10">
      <h2 className="section-title">
        <span className="eyebrow">03</span>围绕这个版本的讨论 · {items.length}
      </h2>
      <form onSubmit={submit} className="mb-6 border border-line p-4">
        {reply && (
          <p className="mb-2 text-vermilion">
            回复 {reply.author}
            <button type="button" className="ml-4 underline" onClick={() => setReply(null)}>
              取消回复
            </button>
          </p>
        )}
        <textarea
          aria-label="评论内容"
          className="min-h-20 w-full resize-y bg-transparent p-1 placeholder:text-muted"
          maxLength={3000}
          placeholder="留下你的使用记忆，或提供可核实的资料…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <ErrorMessage>{error}</ErrorMessage>
        <div className="text-right">
          <button className="button button-dark" disabled={busy}>
            {busy ? "正在发表…" : "发表评论"}
          </button>
        </div>
      </form>
      <ResourceState resource={resource}>
        {roots.length === 0 && <Empty>这里还很安静，来分享第一段使用记忆。</Empty>}
        {roots.slice(0, limit).map((c) => {
          const replies = items.filter((r) => r.parentId === c.id);
          return (
            <article key={c.id} className="border-b border-line py-6">
              <p className="mb-3 text-xs text-muted">
                {c.author}　 ·　 {c.date}
              </p>
              <p className="whitespace-pre-wrap break-words">{c.body}</p>
              <div className="mt-3 flex gap-4 text-xs text-vermilion">
                <button
                  onClick={() => {
                    if (requireAuth()) {
                      setReply(c);
                      document.querySelector('textarea[aria-label="评论内容"]')?.focus();
                    }
                  }}
                >
                  回复
                </button>
                <button
                  onClick={() =>
                    setExpanded(
                      expanded.includes(c.id)
                        ? expanded.filter((x) => x !== c.id)
                        : [...expanded, c.id],
                    )
                  }
                >
                  {expanded.includes(c.id) ? "收起回复" : "查看回复"} · {replies.length}
                </button>
              </div>
              {expanded.includes(c.id) && (
                <div className="mt-4 border-l border-line pl-5">
                  {replies.length ? (
                    replies.map((r) => (
                      <div key={r.id} className="my-3">
                        <p className="text-xs text-muted">
                          {r.author} · {r.date}
                        </p>
                        <p className="whitespace-pre-wrap break-words">{r.body}</p>
                      </div>
                    ))
                  ) : (
                    <p className="muted">暂无回复。</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {roots.length > limit && (
          <button className="button mt-5" onClick={() => setLimit(limit + 3)}>
            加载更多讨论 ↓
          </button>
        )}
      </ResourceState>
    </section>
  );
}
