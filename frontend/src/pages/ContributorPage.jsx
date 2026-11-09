import { Link, useParams } from "react-router-dom";
import { useResource } from "../lib/useResource";
import { ResourceState, Empty } from "../components/Feedback";
export default function ContributorPage() {
  const { id } = useParams();
  const resource = useResource(`/contributors/${id}`);
  const p = resource.data;
  return (
    <div className="page">
      <ResourceState resource={resource}>
        {p && (
          <>
            <p className="eyebrow">CONTRIBUTOR FILE / 贡献者公开档案</p>
            <div className="my-8 flex flex-wrap items-center gap-7">
              <span className="flex h-28 w-28 items-center justify-center border border-ink bg-wash font-serif text-5xl">
                {p.displayName.slice(0, 1)}
              </span>
              <div>
                <h1 className="text-5xl font-bold">{p.displayName}</h1>
                <p className="muted mt-4">
                  @{p.handle} · {p.location} · 加入于 {p.joinedAt}
                </p>
              </div>
            </div>
            <p className="mb-10 text-lg">{p.bio}</p>
            <h2 className="section-title">留下的版本记录 · {p.entries.length}</h2>
            {p.entries.length ? (
              p.entries.map((v) => (
                <Link
                  className="flex justify-between border-b border-line py-5 hover:text-vermilion"
                  key={v.id}
                  to={`/versions/${v.id}`}
                >
                  <span>
                    {v.seriesName} {v.number}
                  </span>
                  <span className="muted">{v.date} ↗</span>
                </Link>
              ))
            ) : (
              <Empty>还没有公开的版本记录。</Empty>
            )}
            <h2 className="section-title mt-10">创建的系列 · {p.series.length}</h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {p.series.map((s) => (
                <Link key={s.id} to={`/series/${s.id}`} className="border border-line bg-card p-6">
                  <h3 className="text-2xl">{s.name}</h3>
                  <p className="muted mt-3">
                    {s.category} · {s.count} 个版本 ↗
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </ResourceState>
    </div>
  );
}
