import { useState } from "react";
import { Link } from "react-router-dom";
import Markdown from "react-markdown";
import { api } from "../lib/api";
import SeriesIcon from "./SeriesIcon";
import FavoriteButton from "./FavoriteButton";
import Modal from "./Modal";
import BrowserExhibit from "./BrowserExhibit";
import Comments from "./Comments";
export default function VersionContent({ version: v }) {
  const [panel, setPanel] = useState(null);
  const [content, setContent] = useState(null);
  const [error, setError] = useState("");
  const s = v.series;
  const siblings = [...v.siblings].sort((a, b) => a.date.localeCompare(b.date));
  const position = siblings.findIndex((s) => s.id === v.id);
  async function show(type) {
    setPanel(type);
    setContent(null);
    setError("");
    try {
      setContent(await api(`/versions/${v.id}/${type}`));
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <p className="muted mb-7">
        <Link to="/series">馆藏目录</Link> / <Link to={`/series/${s.id}`}>{s.name}</Link> /{" "}
        {v.platform} / {v.number}
      </p>
      <div className="flex flex-wrap items-center gap-6">
        <SeriesIcon series={v.iconImage ? { ...s, iconImage: v.iconImage } : s} large />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">VERSION RECORD / NO. {v.id.slice(0, 12)}</p>
          <h1 className="my-2 text-4xl md:text-5xl">
            {s.name === "Mozilla Firefox" ? "Firefox" : s.name} {v.number}
          </h1>
          <p className="muted">
            {v.date} 发布　 /　 {v.platform}
          </p>
        </div>
        <FavoriteButton itemKey={`version:${v.id}`} label="条目" />
        <Link className="button button-dark" to={`/versions/${v.id}/edit`}>
          编辑版本资料
        </Link>
      </div>
      <div className="my-6 flex flex-wrap gap-3">
        <Link className="button" to={`/series/${s.id}`}>
          ← 所属系列：{s.name}
        </Link>
        <Link className="button" to={`/series/${s.id}`}>
          ← {v.platform} 版本链
        </Link>
      </div>
      <div className="grid gap-8 lg:grid-cols-[2.2fr_1fr]">
        <article>
          <h2 className="section-title">
            <span className="eyebrow">01</span>留存的界面
          </h2>
          <div className="my-8">
            {v.screenshots?.length ? (
              v.screenshots.map((img, i) => (
                <figure key={i} className="mb-6">
                  <button
                    className="block w-full"
                    onClick={() => {
                      setPanel("image");
                      setContent(img);
                    }}
                    aria-label={`放大截图 ${i + 1}`}
                  >
                    <img
                      className="max-h-[550px] w-full border border-line object-contain"
                      src={img.url}
                      alt={img.name || v.caption}
                    />
                  </button>
                </figure>
              ))
            ) : s.id === "firefox" ? (
              <BrowserExhibit />
            ) : (
              <div className="flex min-h-60 flex-col items-center justify-center gap-5 border border-line bg-card">
                <SeriesIcon series={s} large />
                <p className="text-muted">尚无原始截图，欢迎补充这一版本的界面。</p>
              </div>
            )}
            <p className="mt-4 text-xs">图 01 · {v.caption || "版本界面资料"}</p>
            <p className="mt-4 text-xs text-muted">
              时间范围：{v.date} · {v.screenshots?.length ? "用户上传资料" : "原始截图待补充。"}
            </p>
          </div>
          <div className="prose border-t border-ink">
            <Markdown>{v.body}</Markdown>
          </div>
          {v.source && (
            <p className="my-5 break-all text-xs text-muted">
              资料链接：
              <a
                className="text-link"
                href={/^https?:\/\//.test(v.source) ? v.source : undefined}
                target="_blank"
                rel="noreferrer"
              >
                {v.source} ↗
              </a>
            </p>
          )}
          <Link to={`/versions/${v.id}/edit`} className="button mt-4">
            ＋ 补充或纠正资料
          </Link>
          <p className="muted mt-4">每一次修改均保留历史版本与贡献署名，资料可追溯。</p>
        </article>
        <aside>
          <h2 className="section-title">
            <span className="eyebrow">档</span>编目记录
          </h2>
          <div className="border-b border-line py-5">
            <p className="text-xs">最近更新</p>
            <p>{v.updatedAt}</p>
          </div>
          <div className="border-b border-line py-5">
            <h3 className="mb-4 text-lg">共同贡献者</h3>
            <p className="muted mb-5">
              林间　陈默　旧电脑收藏家
              <br />
              补充截图、校对时间与发布资料
            </p>
            <button className="button" onClick={() => show("contributors")}>
              查看全部贡献者 →
            </button>
          </div>
          <div className="border-b border-line py-5">
            <p className="muted mb-4">每次修订均留存历史记录</p>
            <button className="button" onClick={() => show("revisions")}>
              查看修改历史 ↗
            </button>
          </div>
          <div className="py-5">
            <p className="eyebrow mb-4">相邻版本 / {v.platform.toUpperCase()}</p>
            {position > 0 && (
              <Link
                className="block font-serif text-lg hover:text-vermilion"
                to={`/versions/${siblings[position - 1].id}`}
              >
                ← {s.name} {siblings[position - 1].number}
              </Link>
            )}
            {position < siblings.length - 1 && (
              <Link
                className="block font-serif text-lg hover:text-vermilion"
                to={`/versions/${siblings[position + 1].id}`}
              >
                {s.name} {siblings[position + 1].number} →
              </Link>
            )}
          </div>
        </aside>
      </div>
      <Comments versionId={v.id} />
      <Modal
        open={!!panel}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
        title={
          panel === "image" ? "留存的界面" : panel === "contributors" ? "共同贡献者" : "修改历史"
        }
        wide={panel === "image"}
      >
        <div className="p-6">
          {error ? (
            <p role="alert" className="text-vermilion">
              {error}
            </p>
          ) : !content ? (
            <p role="status">正在读取档案…</p>
          ) : panel === "image" ? (
            <img src={content.url} alt={content.name} className="w-full" />
          ) : panel === "contributors" ? (
            content.map((name) => (
              <p key={name} className="border-b border-line py-3">
                {name}
              </p>
            ))
          ) : content.length ? (
            content.map((r) => (
              <details key={r.id} className="border-b border-line py-3">
                <summary className="cursor-pointer">
                  {r.date} · {r.author} · 查看修订前正文
                </summary>
                <div className="prose">
                  <Markdown>{r.body}</Markdown>
                </div>
              </details>
            ))
          ) : (
            <p className="text-muted">尚无修改记录。保存编辑后，上一版正文会保留在这里。</p>
          )}
        </div>
      </Modal>
    </>
  );
}
