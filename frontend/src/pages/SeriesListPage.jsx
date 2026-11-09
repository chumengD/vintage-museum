import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import SeriesIcon from "../components/SeriesIcon";
import Pagination from "../components/Pagination";
import { ResourceState, Empty } from "../components/Feedback";
import { useResource } from "../lib/useResource";
import { categories } from "../lib/catalog";
export default function SeriesListPage() {
  const resource = useResource("/series");
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [category, setCategory] = useState("全部系列");
  const [letter, setLetter] = useState("全部");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("recent");
  const items = (resource.data || [])
    .filter(
      (s) =>
        (category === "全部系列" || s.category === category) &&
        (letter === "全部" ||
          (letter === "#" ? !/^[a-z]/i.test(s.name) : s.name.toUpperCase().startsWith(letter))) &&
        q
          .toLowerCase()
          .split(/\s+/)
          .every((term) =>
            `${s.name} ${s.description} ${s.platforms.join(" ")} ${s.searchText || ""}`
              .toLowerCase()
              .includes(term),
          ),
    )
    .sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <div className="page">
      <p className="eyebrow">COLLECTION INDEX / 软件系列总目</p>
      <div className="my-8 flex flex-wrap items-end justify-between gap-6">
        <h1 className="text-4xl md:text-5xl">浏览全部系列</h1>
        <p className="muted">
          循着软件的名字，重访一段数字往事。
          <br />
          每个系列，都是持续生长的版本档案。
        </p>
      </div>
      <SearchBar
        key={q}
        initialValue={q}
        onSearch={(value) => {
          setParams(value ? { q: value } : {});
          setPage(1);
        }}
      />
      <div
        className="my-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-muted"
        aria-label="按首字母筛选"
      >
        {["全部", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"].map((l) => (
          <button
            key={l}
            aria-pressed={l === letter}
            className={`min-h-8 ${l === letter ? "text-vermilion" : "hover:text-ink"}`}
            onClick={() => {
              setLetter(l);
              setPage(1);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="grid gap-8 md:grid-cols-[190px_1fr]">
        <aside>
          <h2 className="text-lg">按用途浏览</h2>
          <p className="eyebrow mb-3 text-muted">CATEGORIES</p>
          <div className="flex flex-wrap gap-1 md:block">
            {["全部系列", ...categories].map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c);
                  setPage(1);
                }}
                className={`flex w-auto items-center justify-between gap-4 px-3 py-3 text-left text-xs md:w-full ${category === c ? "bg-ink text-card" : "text-muted hover:bg-wash"}`}
              >
                {c}
                <span>
                  {(resource.data || []).filter((s) => c === "全部系列" || s.category === c).length}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-8 hidden leading-7 text-muted md:block">
            <span className="text-ink">关于系列</span>
            <br />
            同一款软件的版本、截图与使用记忆，收录于同一个系列。
          </p>
          <Link className="text-link mt-5 inline-block" to="/series/new">
            创建系列 ↗
          </Link>
        </aside>
        <section>
          <div className="flex items-center justify-between border-b border-ink pb-4">
            <h2 className="text-lg">
              {category} / {items.length}
            </h2>
            <select
              aria-label="系列排序"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs text-muted"
            >
              <option value="recent">最近更新</option>
              <option value="name">名称排序</option>
            </select>
          </div>
          <ResourceState resource={resource}>
            {!items.length && <Empty>没有找到匹配的系列，试试其他关键词或分类。</Empty>}
            {items.slice((page - 1) * 8, page * 8).map((s) => (
              <article key={s.id} className="flex items-center gap-5 border-b border-line py-6">
                <SeriesIcon series={s} />
                <div className="min-w-0 flex-1">
                  <Link to={`/series/${s.id}`} className="font-serif text-2xl hover:text-vermilion">
                    {s.name}
                  </Link>
                  <p className="mt-2 text-sm text-muted">{s.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    {s.category} / {s.count} 份内容
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <Link className="text-xs hover:text-vermilion" to={`/series/${s.id}`}>
                    查看系列 ↗
                  </Link>
                  <p className="mt-3 font-mono text-[10px] text-muted">
                    {s.updatedAt.replaceAll("-", ".")}
                  </p>
                </div>
              </article>
            ))}
            <Pagination page={page} total={items.length} pageSize={8} onChange={setPage} />
          </ResourceState>
        </section>
      </div>
    </div>
  );
}
