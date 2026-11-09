import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertDialog } from "radix-ui";
import { useResource } from "../lib/useResource";
import { api } from "../lib/api";
import { ResourceState, Empty, ErrorMessage } from "../components/Feedback";
export default function DraftsPage() {
  const resource = useResource("/drafts");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function remove(id) {
    setBusy(true);
    setError("");
    try {
      await api(`/drafts/${id}`, { method: "DELETE" });
      resource.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <p className="eyebrow">PRIVATE ARCHIVE / 未完的故事</p>
      <h1 className="my-7 text-5xl">我的草稿</h1>
      <p className="muted mb-8">尚未公开的记录，只对自己可见。故事可以慢慢补全。</p>
      <div className="mb-8 flex gap-3">
        <Link className="button button-dark" to="/publish">
          新建版本档案
        </Link>
        <Link className="button" to="/series/new">
          创建系列
        </Link>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <ResourceState resource={resource}>
        {!resource.data?.length && (
          <Empty>暂无草稿。在编辑页面点击「保存草稿」，下次从这里继续。</Empty>
        )}
        {resource.data?.map((d) => (
          <article
            key={d.id}
            className="flex flex-wrap items-center gap-4 border-t border-line py-6"
          >
            <span className="eyebrow">{d.type === "series" ? "系列" : "版本"}</span>
            <div className="flex-1">
              <h2 className="text-2xl">{d.title}</h2>
              <p className="muted">最后编辑 {d.updatedAt}</p>
            </div>
            <Link
              className="text-link"
              to={`${d.type === "series" ? "/series/new" : "/publish"}?draft=${d.id}`}
            >
              继续编辑 →
            </Link>
            <AlertDialog.Root>
              <AlertDialog.Trigger className="button" disabled={busy}>
                删除草稿
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
                <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-ink bg-card p-7">
                  <AlertDialog.Title className="font-serif text-2xl">
                    删除这份草稿？
                  </AlertDialog.Title>
                  <AlertDialog.Description className="my-5 text-muted">
                    「{d.title}」删除后无法恢复。
                  </AlertDialog.Description>
                  <div className="flex justify-end gap-3">
                    <AlertDialog.Cancel className="button">保留草稿</AlertDialog.Cancel>
                    <AlertDialog.Action className="button button-red" onClick={() => remove(d.id)}>
                      确认删除
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </article>
        ))}
      </ResourceState>
    </div>
  );
}
