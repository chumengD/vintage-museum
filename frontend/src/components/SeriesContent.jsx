import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty } from "./Feedback";
import SeriesIcon from "./SeriesIcon";
import FavoriteButton from "./FavoriteButton";
import SelectField from "./SelectField";
export default function SeriesContent({ series: s }) {
  const [platform, setPlatform] = useState(s.platforms[0] || "Windows");
  const [q, setQ] = useState("");
  const [full, setFull] = useState(false);
  const versions = s.versions
    .filter((v) => v.platform === platform && `${v.number} ${v.date}`.includes(q))
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <p className="muted mb-7">
        <Link to="/series">馆藏目录</Link> / {s.category} / {s.name}
      </p>
      <div className="flex flex-wrap items-center gap-6">
        <SeriesIcon series={s} large />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">
            SERIES NO. {s.id === "firefox" ? "003" : s.id.slice(0, 6)} / 共同编目的软件记忆
          </p>
          <h1 className="my-2 text-4xl md:text-5xl">{s.name}</h1>
          <p className="muted">
            {s.category}　 ·　 {s.count} 个版本节点　 ·　社区共同维护
          </p>
        </div>
        <FavoriteButton itemKey={`series:${s.id}`} />
        <Link className="button button-dark" to={`/publish?series=${s.id}`}>
          ＋ 添加版本
        </Link>
      </div>
      <div className="my-7 grid gap-6 border-y border-line py-6 md:grid-cols-[1.6fr_1fr]">
        <div>
          <h2 className="mb-3 text-2xl">
            {s.id === "firefox" ? "一只火狐，与开放的网络。" : "一个软件，一段共同的记忆。"}
          </h2>
          <p className="leading-7">{s.description}</p>
        </div>
        <aside>
          <p className="mb-2 text-vermilion">共同维护 · 不止一份个人记录</p>
          <p className="muted">
            任何人都可以补充或纠正资料；每一次修改都会保留贡献者署名与可追溯的历史。
          </p>
        </aside>
      </div>
      <h2 className="section-title">
        <span className="eyebrow">01</span>沿着版本，回到当时
      </h2>
      <div className="my-8 grid gap-5 sm:grid-cols-2">
        <label>
          <span className="mb-2 block">查找版本</span>
          <input
            className="input bg-transparent"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="输入版本号或时间，如 3.6、2010"
          />
        </label>
        <SelectField
          label="平台筛选"
          value={platform}
          onChange={(v) => {
            setPlatform(v);
            setFull(false);
          }}
          options={s.platforms}
        />
      </div>
      <p className="muted mb-5">
        当前仅展示 {platform} 版本链。切换平台可查看对应的独立版本链，点击节点进入版本详情。
      </p>
      <section className="border border-line p-6 md:p-7">
        <div className="flex justify-between gap-4">
          <h3 className="text-2xl">{platform}</h3>
          <p className="text-xs text-muted">
            {versions.length} 个已收录节点 · 当前展示{" "}
            {Math.min(versions.length, full ? versions.length : 4)} 个节点
          </p>
        </div>
        {!versions.length ? (
          <Empty>暂未收录匹配的版本。你可以添加这一平台的第一份记录。</Empty>
        ) : (
          <div className="mx-auto my-6 max-w-[450px]">
            {versions.slice(0, full ? undefined : 4).map((v, i, arr) => (
              <div key={v.id}>
                <Link
                  className="block border border-ink bg-card p-5 transition-colors hover:bg-wash"
                  to={`/versions/${v.id}`}
                >
                  <p className="eyebrow text-[10px]">
                    {platform.toUpperCase()} / {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="my-2 text-3xl">
                    {v.number} <span className="ml-3 text-xl">↗</span>
                  </h3>
                  <p className="muted">发布时间：{v.date.replaceAll("-", ".")}</p>
                </Link>
                {i < arr.length - 1 && <p className="py-3 text-center text-2xl text-muted">↓</p>}
              </div>
            ))}
          </div>
        )}
        {versions.length > 4 && (
          <button className="button" onClick={() => setFull(!full)}>
            {full ? "收起版本链 ↑" : `查看 ${platform} 完整版本链 →`}
          </button>
        )}
      </section>
    </>
  );
}
