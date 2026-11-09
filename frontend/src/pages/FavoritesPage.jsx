import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs } from "radix-ui";
import { useResource } from "../lib/useResource";
import { ResourceState, Empty } from "../components/Feedback";
import SeriesIcon from "../components/SeriesIcon";
import FavoriteButton from "../components/FavoriteButton";
import Pagination from "../components/Pagination";
export default function FavoritesPage() {
  const resource = useResource("/favorites");
  const [tab, setTab] = useState("series");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("saved");
  const items = (resource.data || []).filter(
    (i) =>
      i.type === tab &&
      `${i.name} ${i.description || ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (sort === "name") items.sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="page">
      <p className="eyebrow">PERSONAL COLLECTION / 私人的记忆索引</p>
      <div className="my-8 flex flex-wrap items-end gap-6">
        <h1 className="flex-1 text-5xl">我的收藏</h1>
        <p className="muted md:mr-[20%]">
          收藏是为了下一次重逢。
          <br />
          这里保留你关心的软件系列与内容。
        </p>
      </div>
      <Tabs.Root
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setPage(1);
        }}
      >
        <Tabs.List className="mb-6 flex border-b border-ink" aria-label="收藏类型">
          {[
            ["series", "系列收藏"],
            ["version", "内容收藏"],
          ].map(([value, text]) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="border border-line px-5 py-3 data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-card"
            >
              {text}　{resource.data?.filter((i) => i.type === value).length || 0}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>
      <form
        className="mb-7 flex gap-4"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q);
          setPage(1);
        }}
      >
        <input
          aria-label="搜索收藏"
          className="input"
          placeholder="⌕ 搜索收藏的软件名称、内容标题或关键词"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="button button-dark shrink-0">搜索</button>
      </form>
      <div className="mb-7 flex justify-between">
        <p>
          已收藏 {items.length} 个{tab === "series" ? "系列" : "条目"}
        </p>
        <select
          aria-label="收藏排序"
          className="bg-transparent text-muted"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="saved">按收藏时间排序</option>
          <option value="name">按名称排序</option>
        </select>
      </div>
      <ResourceState resource={resource}>
        {!items.length && (
          <Empty>
            没有匹配的收藏。
            <Link className="text-link ml-2" to="/series">
              去馆藏逛逛 →
            </Link>
          </Empty>
        )}
        {items.slice((page - 1) * 4, page * 4).map((s) => (
          <article
            key={s.key}
            className="flex flex-wrap items-center gap-6 border-t border-line py-8 md:py-10"
          >
            <SeriesIcon series={s} />
            <div className="min-w-0 flex-1">
              <Link
                to={`/${s.type === "series" ? "series" : "versions"}/${s.id}`}
                className="font-serif text-2xl hover:text-vermilion md:text-3xl"
              >
                {s.name} ↗
              </Link>
              <p className="my-3 text-muted">
                {s.description || `${s.platform} · 发布于 ${s.date}`}
              </p>
              <p className="text-xs text-muted">
                {s.category || "版本档案"}　 /　最近更新 {s.updatedAt}
              </p>
            </div>
            <div className="text-center">
              <FavoriteButton
                itemKey={s.key}
                initialSaved
                onChange={() => {
                  setPage(1);
                  resource.reload();
                }}
              />
              <p className="mt-2 text-xs text-vermilion">再次点击取消收藏</p>
            </div>
          </article>
        ))}
        <Pagination page={page} total={items.length} pageSize={4} onChange={setPage} />
      </ResourceState>
    </div>
  );
}
