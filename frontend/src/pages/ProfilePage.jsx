import { useState } from "react";
import { Link } from "react-router-dom";
import { useResource } from "../lib/useResource";
import { ResourceState, Empty } from "../components/Feedback";
import Modal from "../components/Modal";
import ProfileEditor from "../components/ProfileEditor";
export default function ProfilePage() {
  const resource = useResource("/profile");
  const [editing, setEditing] = useState(false);
  const [share, setShare] = useState("");
  const p = resource.data;
  async function copy() {
    const url = `${window.location.origin}/contributors/${p.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShare("档案链接已复制。");
    } catch {
      setShare(`请复制地址：${url}`);
    }
  }
  return (
    <div className="page">
      <ResourceState resource={resource}>
        {p && (
          <>
            <div className="flex flex-wrap gap-8">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-sm border border-ink bg-[#ddd4bf] font-serif text-5xl">
                {p.displayName?.slice(0, 1)}
              </div>
              <div className="flex-1">
                <p className="eyebrow text-muted">
                  贡献者档案 / CONTRIBUTOR FILE　
                  <span className="text-vermilion">NO. 0412</span>
                </p>
                <div className="my-4 flex flex-wrap items-end gap-5">
                  <h1 className="text-5xl font-black md:text-6xl">{p.displayName}</h1>
                  <span className="font-mono text-muted">@{p.handle}</span>
                </div>
                <p className="text-base">{p.bio}</p>
                <p className="my-4 font-mono text-xs text-muted">
                  加入于 {p.joinedAt}　 ·　 {p.location}　 ·　
                  {p.website && (
                    <a
                      href={/^https?:\/\//.test(p.website) ? p.website : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-vermilion"
                    >
                      {p.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </p>
                <div className="mt-5 flex gap-6">
                  <button className="button border-ink" onClick={() => setEditing(true)}>
                    编辑资料 ✎
                  </button>
                  <button className="text-link" onClick={copy}>
                    分享档案 ↗
                  </button>
                </div>
                {share && (
                  <p role="status" className="mt-3 text-vermilion">
                    {share}
                  </p>
                )}
              </div>
            </div>
            <div className="my-9 grid grid-cols-2 gap-y-5 border-y border-ink py-6 sm:grid-cols-5">
              {[
                [p.entries.length, "贡献条目 / CONTRIBUTIONS"],
                [p.entries.length, "新增版本 / VERSIONS"],
                [p.series.length, "创建系列 / SERIES"],
                [p.savedCount, "收藏条目 / SAVED"],
                [p.drafts.length, "草稿 / DRAFTS"],
              ].map(([n, label]) => (
                <div className="border-r border-line px-5 last:border-0" key={label}>
                  <p className="font-serif text-4xl font-bold">{String(n).padStart(2, "0")}</p>
                  <p className="mt-1 font-mono text-[10px] tracking-wider text-muted">{label}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-10 lg:grid-cols-[3fr_1fr]">
              <section>
                <div className="mb-4 flex items-end justify-between">
                  <h2 className="text-2xl font-bold">
                    我的发布{" "}
                    <span className="ml-3 font-mono text-[10px] font-normal tracking-widest text-muted">
                      MY ENTRIES
                    </span>
                  </h2>
                  <Link className="text-link text-xs" to="/publish">
                    发布版本 ↗
                  </Link>
                </div>
                <div className="border-t border-ink">
                  {p.entries.length ? (
                    p.entries.map((v) => (
                      <Link
                        key={v.id}
                        to={`/versions/${v.id}`}
                        className="flex items-center gap-4 border-b border-line py-4 hover:text-vermilion"
                      >
                        <span className="border border-ink px-2 text-xs">版本</span>
                        <span className="flex-1">
                          {v.seriesName || v.seriesId} {v.number} 版本档案
                        </span>
                        <span className="text-xs text-muted">{v.date} · 已发布　↗</span>
                      </Link>
                    ))
                  ) : (
                    <Empty>你还没有发布档案，从第一段软件记忆开始。</Empty>
                  )}
                </div>
                <div className="mb-4 mt-8 flex justify-between">
                  <h2 className="text-2xl font-bold">
                    草稿{" "}
                    <span className="ml-3 font-mono text-[10px] font-normal tracking-widest text-muted">
                      DRAFTS
                    </span>
                  </h2>
                  <Link className="text-xs text-muted" to="/drafts">
                    管理草稿 →
                  </Link>
                </div>
                <div className="border-t border-ink">
                  {p.drafts.length ? (
                    p.drafts.map((d) => (
                      <Link
                        key={d.id}
                        to={`${d.type === "series" ? "/series/new" : "/publish"}?draft=${d.id}`}
                        className="flex items-center gap-4 border-b border-line py-4"
                      >
                        <span className="border border-vermilion px-2 text-xs text-vermilion">
                          草稿
                        </span>
                        <span className="flex-1">{d.title}</span>
                        <span className="text-xs text-vermilion">继续编辑 →</span>
                      </Link>
                    ))
                  ) : (
                    <Empty>暂无草稿。</Empty>
                  )}
                </div>
              </section>
              <aside className="lg:border-l lg:border-line lg:pl-7">
                <h2 className="mb-4 text-2xl font-bold">创建的系列</h2>
                {p.series.length ? (
                  p.series.map((s, i) => (
                    <Link
                      key={s.id}
                      to={`/series/${s.id}`}
                      className="mb-3 block border border-line bg-card p-4"
                    >
                      <p className="eyebrow">{String(i + 1).padStart(2, "0")}</p>
                      <h3 className="my-3 text-xl font-bold">{s.name}</h3>
                      <p className="text-xs text-muted">
                        {s.category} · {s.count} 个版本{" "}
                        <span className="float-right text-vermilion">↗</span>
                      </p>
                    </Link>
                  ))
                ) : (
                  <>
                    <p className="muted mb-4">为你珍藏的软件建立一份档案。</p>
                    <Link className="button" to="/series/new">
                      创建系列 →
                    </Link>
                  </>
                )}
              </aside>
            </div>
            <Modal open={editing} onOpenChange={setEditing} title="编辑贡献者档案">
              <ProfileEditor
                profile={p}
                onSaved={() => {
                  setEditing(false);
                  resource.reload();
                }}
              />
            </Modal>
          </>
        )}
      </ResourceState>
    </div>
  );
}
