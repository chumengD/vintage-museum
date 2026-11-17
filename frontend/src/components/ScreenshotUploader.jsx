import { useState } from "react";
import { useAuth } from "./AuthContext";
import { uploadScreenshot } from "../lib/backend-api";
import ImageUpload from "./ImageUpload";
import { ErrorMessage } from "./Feedback";

export default function ScreenshotUploader({ versionId, onUploaded }) {
  const { requireAuth } = useAuth();
  const [images, setImages] = useState([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (!requireAuth() || !images.length) return;
    setBusy(true);
    setError("");
    try {
      // Remove only confirmed uploads; failed and remaining files stay available for retry.
      for (const image of images) {
        const { screenshot } = await uploadScreenshot(versionId, image, caption);
        onUploaded({
          ...screenshot,
          url: screenshot.imageUrl,
          name: screenshot.caption || "版本截图",
        });
        setImages((remaining) => remaining.filter((item) => item !== image));
      }
      setCaption("");
    } catch (error) {
      setError(`已上传的截图已保留。${error.message} 可重试剩余图片。`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="my-6 border border-line p-4">
      <summary className="cursor-pointer">补充版本截图</summary>
      <form className="mt-4" onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-4">
          <ImageUpload label="补充截图" multiple value={images} onChange={setImages} />
          <label className="block">
            截图说明（可选）
            <input
              className="input mt-2"
              maxLength={500}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </label>
          <ErrorMessage>{error}</ErrorMessage>
          <button className="button" disabled={!images.length}>
            {busy ? "正在上传…" : "上传截图"}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
