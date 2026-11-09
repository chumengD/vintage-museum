import { Link, useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { useResource } from "../lib/useResource";
import { ResourceState } from "../components/Feedback";
export default function HomePage() {
  const navigate = useNavigate();
  const resource = useResource("/series");
  const order = ["qq", "msn", "ie", "winamp", "firefox", "ttplayer"];
  const cards = order.map((id) => resource.data?.find((s) => s.id === id)).filter(Boolean);
  return (
    <div className="page pt-4 md:pt-5">
      <section className="mb-14 grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-16">
        <div>
          <h1 className="font-serif text-[clamp(64px,8.5vw,132px)] font-black leading-[1.08] tracking-tight">
            旧时
            <br />
            <span className="ml-[14%] inline-flex items-center gap-5 md:gap-8">
              博物馆
              <span className="inline-flex h-[1.55em] w-[1.55em] items-center justify-center bg-vermilion text-[.48em] font-normal text-card">
                藏
              </span>
            </span>
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-5">
            <span className="font-serif text-2xl italic md:text-3xl">Vintage Museum</span>
            <span className="h-px w-16 bg-ink" />
            <span className="font-mono text-[10px] tracking-[.25em] text-muted">
              COMMUNITY SOFTWARE ARCHIVE
            </span>
          </div>
        </div>
        <aside className="self-start border-l border-line pl-6 lg:mt-5">
          <p className="eyebrow mb-4">发 刊 词</p>
          <p className="font-serif text-base leading-8 text-[#615e54]">
            这里收藏的不是软件本身，而是它们曾经被打开的样子：安装界面、默认壁纸、更新日志，以及围绕它们的争论。
          </p>
          <Link className="mt-3 inline-block text-xs hover:text-vermilion" to="/about">
            阅读本馆说明 →
          </Link>
        </aside>
      </section>
      <SearchBar
        placeholder="输入软件名称、版本号或平台…"
        onSearch={(q) => navigate(`/series?q=${encodeURIComponent(q)}`)}
      />
      <Link to="/series" className="button my-5 border-ink">
        浏览全部系列 <span className="ml-4">→</span>
      </Link>
      <section className="mt-5">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-4">
            <h2 className="text-3xl font-bold">馆藏索引</h2>
            <span className="mb-1 font-mono text-[10px] tracking-[.25em] text-muted">
              CLIPPINGS / INDEX OF COLLECTION
            </span>
          </div>
          <p className="text-xs text-muted">{cards.length} 份剪报 · 按最近更新排序</p>
        </div>
        <ResourceState resource={resource}>
          <div className="grid gap-7 md:grid-cols-3">
            {[0, 1, 2].map((col) => (
              <div key={col} className={`space-y-7 ${col === 1 ? "md:pt-6" : ""}`}>
                {cards.slice(col * 2, col * 2 + 2).map((s, i) => (
                  <Link
                    key={s.id}
                    to={`/series/${s.id}`}
                    className={`group block border border-ink bg-card p-5 shadow-[4px_5px_0_#1e1d1829] transition-transform hover:-translate-y-1 ${i % 2 ? "md:-rotate-1" : "md:rotate-1"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-lg tracking-widest text-vermilion">
                        {String(col * 2 + i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-mono text-[10px] text-muted">{s.years}</span>
                    </div>
                    <h3 className="mt-2 font-serif text-3xl font-bold group-hover:text-vermilion">
                      {s.name === "Mozilla Firefox" ? "Firefox" : s.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {s.category} · {s.count} 个版本
                    </p>
                    <p className="my-3 text-sm text-[#6c685d]">{s.description}</p>
                    <span className="text-xs tracking-wider text-vermilion">进入系列 →</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </ResourceState>
      </section>
    </div>
  );
}
