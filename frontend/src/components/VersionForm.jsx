import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import { api } from "../lib/api";
import { demoMode } from "../lib/features";
import { uploadScreenshot } from "../lib/backend-api";
import { useResource } from "../lib/useResource";
import { useDraft } from "../lib/useDraft";
import SelectField from "./SelectField";
import SeriesIcon from "./SeriesIcon";
import DatePicker from "./DatePicker";
import ImageUpload from "./ImageUpload";
import MarkdownEditor from "./MarkdownEditor";
import Modal from "./Modal";
import { ResourceState, ErrorMessage } from "./Feedback";
function FormSection({ number, title, description, children }) {
  return (
    <section className="grid gap-6 border-t border-line py-7 md:grid-cols-[200px_1fr]">
      <div>
        <p className="eyebrow mb-3">{number}</p>
        <h2 className="text-2xl">{title}</h2>
        {description && <p className="muted mt-3 max-w-40">{description}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}
export default function VersionForm({ initial, draftId, editId }) {
  const series = useResource("/series");
  const navigate = useNavigate();
  const draft = useDraft("version", draftId);
  const [form, setForm] = useState({
    seriesId: "",
    number: "",
    date: "",
    platform: "",
    screenshots: [],
    images: [],
    caption: "",
    source: "",
    body: "",
    ...initial,
    editId,
  });
  const [choose, setChoose] = useState(!initial.seriesId);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState(null);
  const publication = useRef({ id: null, uploaded: 0 });
  const field = (name, value) => {
    if (!publication.current.id) setForm((f) => ({ ...f, [name]: value }));
  };
  const selected = series.data?.find((s) => s.id === form.seriesId);
  const selectedPlatform = form.platform || selected?.platforms[0] || "";
  async function submit(e) {
    e.preventDefault();
    setError("");
    const parsedDate = new Date(`${form.date}T00:00:00Z`);
    if (
      !form.seriesId ||
      !form.number.trim() ||
      !selectedPlatform ||
      ((demoMode || form.date) &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) ||
          isNaN(parsedDate) ||
          parsedDate.toISOString().slice(0, 10) !== form.date))
    ) {
      setError("请选择系列，并填写版本号、有效的发布日期和平台。");
      return;
    }
    if (!demoMode && (form.body.length > 5000 || form.caption.length > 500)) {
      setError("正文最多 5000 字，截图说明最多 500 字。");
      return;
    }
    setBusy(true);
    try {
      const data = publication.current.id
        ? { id: publication.current.id }
        : await api(editId ? `/versions/${editId}` : "/versions", {
            method: editId ? "PUT" : "POST",
            body: {
              ...form,
              platform: selectedPlatform,
              iconImage: form.images[0]?.url || initial.iconImage,
            },
          });
      if (!demoMode) {
        publication.current.id = data.id;
        setCreatedId(data.id);
        while (publication.current.uploaded < form.screenshots.length) {
          await uploadScreenshot(
            data.id,
            form.screenshots[publication.current.uploaded],
            form.caption,
          );
          publication.current.uploaded++;
        }
      }
      await draft.remove();
      navigate(`/versions/${data.id}`);
    } catch (e) {
      setError(
        publication.current.id
          ? `版本已创建，已上传 ${publication.current.uploaded}/${form.screenshots.length} 张截图。${e.message} 请重试剩余截图，无需再次创建版本。`
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <p className="muted">发布内容 / {editId ? "编辑版本" : "新建版本"}</p>
        <div className="flex gap-3">
          <Link className="button" to="/series/new">
            切换至创建系列 ↗
          </Link>
          {demoMode && (
            <Link className="button" to="/drafts">
              我的草稿
            </Link>
          )}
        </div>
      </div>
      <p className="eyebrow">ACCESSION FORM　 /　 VERSION RECORD</p>
      <div className="mb-7 mt-4 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-bold">{editId ? "编辑版本" : "发布版本"}</h1>
          <p className="muted mt-4">为一段软件历史，留下一个可查证的记录。</p>
        </div>
        <div className="max-w-sm border-l-2 border-vermilion pl-5">
          <p className="font-serif text-lg">由你开始，由大家完善。</p>
          <p className="muted mt-2">
            {demoMode
              ? "发布后支持多人补充与纠正，贡献署名和每次修改都会被保留。"
              : "记录版本变化，补充界面截图，让软件历史有迹可循。"}
          </p>
        </div>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={busy || !!createdId}>
          <FormSection
            number="01"
            title="选择系列"
            description="先找到所属系列，让新版本有迹可循。"
          >
            <ResourceState resource={series}>
              {selected && !choose ? (
                <div className="flex flex-wrap items-center gap-5 border border-ink p-4">
                  <SeriesIcon series={selected} />
                  <div className="flex-1">
                    <p className="text-xs text-vermilion">所属软件系列 *</p>
                    <h3 className="text-2xl">{selected.name}</h3>
                  </div>
                  <p className="muted">
                    {selected.category} · {selected.count} 个版本
                  </p>
                  {!editId && (
                    <button className="button" type="button" onClick={() => setChoose(true)}>
                      更换系列 ▾
                    </button>
                  )}
                </div>
              ) : (
                <SelectField
                  required
                  label="所属软件系列"
                  value={form.seriesId}
                  options={(series.data || []).map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  onChange={(v) => {
                    field("seriesId", v);
                    field(
                      "platform",
                      series.data.find((s) => s.id === v)?.platforms[0] || "Windows",
                    );
                    setChoose(false);
                  }}
                />
              )}
            </ResourceState>
          </FormSection>
          <FormSection number="02" title="版本资料">
            <div className="grid gap-5 sm:grid-cols-3">
              <label>
                版本号 *
                <input
                  required
                  maxLength={100}
                  className="input mt-2"
                  value={form.number}
                  onChange={(e) => field("number", e.target.value)}
                  placeholder="例如 3.6"
                />
              </label>
              <DatePicker
                value={form.date}
                required={demoMode}
                onChange={(v) => field("date", v)}
              />
              <SelectField
                required
                label="适用平台"
                value={selectedPlatform}
                options={selected?.platforms || ["Windows", "macOS", "Linux"]}
                onChange={(v) => field("platform", v)}
              />
            </div>
          </FormSection>
          <FormSection
            number="03"
            title="图像资料"
            description="让界面留下来。请为截图附上说明与出处。"
          >
            <div className="grid gap-6 md:grid-cols-[180px_1fr]">
              <div className="md:border-r md:border-line md:pr-6">
                <p className="mb-3">版本图标</p>
                {selected && !form.images.length && (
                  <div className="mb-4">
                    <SeriesIcon series={selected} />
                    <p className="muted mt-2">沿用系列图标</p>
                  </div>
                )}
                {demoMode && (
                  <ImageUpload
                    label="上传版本图标"
                    value={form.images}
                    onChange={(v) => field("images", v)}
                  />
                )}
              </div>
              <div className="space-y-4">
                <ImageUpload
                  multiple
                  label="截图"
                  value={form.screenshots}
                  onChange={(v) => field("screenshots", v)}
                />
                <label className="block">
                  截图说明（可选）
                  <input
                    className="input mt-2"
                    value={form.caption}
                    maxLength={demoMode ? undefined : 500}
                    onChange={(e) => field("caption", e.target.value)}
                    placeholder="例如：Windows 下的默认工具栏与起始页"
                  />
                </label>
                {demoMode && (
                  <label className="block">
                    资料来源（可选）
                    <input
                      className="input mt-2"
                      type="url"
                      value={form.source}
                      onChange={(e) => field("source", e.target.value)}
                      placeholder="https://www.mozilla.org/…"
                    />
                  </label>
                )}
                {!demoMode && <p className="muted">资料来源请写入正文，版本图标沿用系列图标。</p>}
              </div>
            </div>
          </FormSection>
          <FormSection number="04" title="正文">
            <MarkdownEditor
              value={form.body}
              onChange={(v) => field("body", v)}
              placeholder={
                "## 版本变化\n\n记录新功能与界面的变化。\n\n## 资料来源\n\n保留可核实的资料链接。\n\n## 个人看法与待确认信息\n\n记录你的使用感受，并将个人回忆与已核实的事实区分开来。"
              }
            />
            <div className="mt-3 flex justify-between gap-3 text-xs text-muted">
              <p>支持 Markdown · 请保留可核实的资料链接，个人看法请明确标注。</p>
              <span>{demoMode ? "草稿仅自己可见" : "正文最多 5000 字"}</span>
            </div>
          </FormSection>
        </fieldset>
        <ErrorMessage>{error || draft.error}</ErrorMessage>
        {createdId && !busy && (
          <Link className="text-link block mb-4" to={`/versions/${createdId}`}>
            查看已发布版本 →
          </Link>
        )}
        {draft.message && (
          <p role="status" className="mb-5 text-vermilion">
            {draft.message}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-5 border-t border-ink pt-7">
          <div>
            <p className="font-serif text-lg">一份记录，加入共同的记忆。</p>
            <p className="muted mt-2">
              {demoMode
                ? "发布后支持社区共同维护，并保留贡献与修改记录。"
                : "发布前请核对版本资料与截图。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {demoMode && (
              <button
                className="button"
                type="button"
                disabled={busy || draft.busy}
                onClick={() => draft.save(form)}
              >
                保存草稿
              </button>
            )}
            <button className="button" type="button" onClick={() => setPreview(true)}>
              预览
            </button>
            <button disabled={busy || draft.busy} className="button button-dark">
              {busy
                ? "正在保存…"
                : createdId
                  ? "重试剩余截图 →"
                  : editId
                    ? "保存修改 →"
                    : "发布版本 →"}
            </button>
          </div>
        </div>
      </form>
      <Modal
        open={preview}
        onOpenChange={setPreview}
        title={`${selected?.name || "版本预览"} ${form.number}`}
        wide
      >
        <div className="p-7">
          <p className="muted">
            {form.date} / {selectedPlatform}
          </p>
          {form.screenshots.map((img, i) => (
            <img key={i} src={img.url} alt={img.name} className="my-5 max-h-96 object-contain" />
          ))}
          <div className="prose">
            <Markdown>{form.body || "正文尚未填写。"}</Markdown>
          </div>
        </div>
      </Modal>
    </>
  );
}
