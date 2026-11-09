import MultiSelectField from "./MultiSelectField";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import { categories, platforms } from "../lib/catalog";
import { api } from "../lib/api";
import { useDraft } from "../lib/useDraft";
import MarkdownEditor from "./MarkdownEditor";
import SelectField from "./SelectField";
import ImageUpload from "./ImageUpload";
import Modal from "./Modal";
import { ErrorMessage } from "./Feedback";
export default function CreateForm({ initial = {}, draftId }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    tags: "",
    description: "",
    category: "",
    platforms: [],
    sources: [""],
    images: [],
    ...initial,
  });
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const draft = useDraft("series", draftId);
  const field = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.category || !form.platforms.length) {
      setError("请填写系列名称、软件分类，并选择至少一个适用平台。");
      return;
    }
    setBusy(true);
    try {
      const item = await api("/series", {
        method: "POST",
        body: {
          ...form,
          tags: form.tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
          iconImage: form.images[0]?.url,
          source: form.sources.filter(Boolean).join("\n"),
        },
      });
      await draft.remove();
      navigate(`/series/${item.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">VINTAGE MUSEUM　 /　 NEW COLLECTION</p>
      <div className="my-6 flex flex-wrap items-end justify-between gap-8 border-b-2 border-ink pb-7">
        <div>
          <h1 className="text-4xl leading-snug md:text-5xl">
            创建一个系列，
            <br />
            留住一个时代。
          </h1>
          <p className="muted mt-3">从第一枚图标，到最后一次更新。</p>
        </div>
        <div className="md:pr-12">
          <p className="eyebrow">SCREEN MEMORIES / 01</p>
          <p className="my-3 font-serif text-xl">「欢迎使用安装向导。」</p>
          <p className="muted">曾经是故事的开始，现在是记忆的入口。</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="my-7 grid gap-8 bg-wash p-6 md:grid-cols-[160px_1fr] md:p-8">
          <ImageUpload label="系列图标" value={form.images} onChange={(v) => field("images", v)} />
          <div>
            <label className="block">
              系列名称 *
              <input
                required
                maxLength={100}
                className="input my-2 font-serif text-2xl"
                placeholder="为这个系列命名"
                value={form.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </label>
            <p className="muted mb-5">使用软件的正式名称，不包含版本号。</p>
            <label className="block">
              标签
              <input
                className="input mt-2"
                placeholder="＋ 添加标签，例如：开源，网页浏览，互联网记忆"
                value={form.tags}
                onChange={(e) => field("tags", e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <section>
            <h2 className="mb-6 flex gap-4 text-2xl">
              <span className="eyebrow">01</span>写下它的故事
            </h2>
            <MarkdownEditor
              label="系列介绍"
              value={form.description}
              onChange={(v) => field("description", v)}
            />
            <div className="mt-5 border-t border-line pt-5">
              <p className="font-serif text-xl">「正在拨号，请稍候……」</p>
              <p className="muted mt-3">那些等待连接的日子，也值得被好好保存。</p>
            </div>
          </section>
          <section className="space-y-5 md:border-l md:border-line md:pl-8">
            <h2 className="mb-6 flex gap-4 text-2xl">
              <span className="eyebrow">02</span>建立索引
            </h2>
            <SelectField
              label="软件分类"
              required
              value={form.category}
              onChange={(v) => field("category", v)}
              options={categories}
              placeholder="选择软件分类"
            />
            <MultiSelectField
              label="适用平台"
              value={form.platforms}
              onChange={(value) => field("platforms", value)}
              options={platforms}
            />
            {form.sources.map((source, i) => (
              <label key={i} className="block">
                {i ? `资料来源 ${i + 1}` : "官网或资料来源"}
                <input
                  className="input mt-2"
                  type="url"
                  placeholder="https://"
                  value={source}
                  onChange={(e) =>
                    field(
                      "sources",
                      form.sources.map((v, n) => (n === i ? e.target.value : v)),
                    )
                  }
                />
              </label>
            ))}
            <p className="muted">提供官网、历史存档或其他可核实的资料链接。</p>
            <button
              type="button"
              className="text-link"
              onClick={() => field("sources", [...form.sources, ""])}
            >
              ＋ 添加另一条链接
            </button>
          </section>
        </div>
        <ErrorMessage>{error || draft.error}</ErrorMessage>
        {draft.message && (
          <p role="status" className="my-5 text-vermilion">
            {draft.message}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-5 border-t border-ink pt-6">
          <p className="muted">先保存一个名字，再慢慢找回它的故事。</p>
          <div className="flex flex-wrap gap-3">
            <button
              className="button"
              type="button"
              disabled={busy || draft.busy}
              onClick={() => draft.save(form)}
            >
              保存草稿
            </button>
            <button className="button" type="button" onClick={() => setPreview(true)}>
              预览
            </button>
            <button disabled={busy || draft.busy} className="button button-red">
              {busy ? "正在创建…" : "创建系列 →"}
            </button>
          </div>
        </div>
      </form>
      <Modal open={preview} onOpenChange={setPreview} title={form.name || "未命名系列"}>
        <div className="p-6">
          <p className="muted">
            {form.category} · {form.platforms.join(" / ")}
          </p>
          <div className="prose">
            <Markdown>{form.description || "还没有填写系列故事。"}</Markdown>
          </div>
        </div>
      </Modal>
    </>
  );
}
