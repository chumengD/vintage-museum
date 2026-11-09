import { useId, useState } from "react";
import { ImagePlus } from "lucide-react";
export default function ImageUpload({ label, value = [], onChange, multiple = false }) {
  const id = useId();
  const [error, setError] = useState("");
  async function read(files) {
    setError("");
    const list = Array.from(files);
    if (
      list.some(
        (f) =>
          !["image/png", "image/jpeg", "image/webp"].includes(f.type) || f.size > 10 * 1024 * 1024,
      )
    ) {
      setError("仅支持 PNG / JPG / WEBP，每张不超过 10 MB。");
      return;
    }
    try {
      const images = await Promise.all(
        list.map(
          (file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ name: file.name, url: reader.result });
              reader.onerror = reject;
              reader.readAsDataURL(file);
            }),
        ),
      );
      onChange(multiple ? [...value, ...images] : images.slice(0, 1));
    } catch {
      setError("图片读取失败，请重新选择。");
    }
  }
  return (
    <div>
      <label htmlFor={id} className="mb-3 block">
        {label}
      </label>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          read(e.dataTransfer.files);
        }}
        className="border border-line bg-card"
      >
        <label
          htmlFor={id}
          className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 p-5 text-center hover:bg-wash"
        >
          <ImagePlus size={26} className="text-muted" />
          <span>{multiple ? "拖放截图至此，或点击上传" : "上传图标"}</span>
          <span className="text-xs text-muted">PNG / JPG / WEBP · 每张不超过 10 MB</span>
        </label>
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            read(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {value.map((img, i) => (
            <div key={`${img.name}-${i}`} className="relative">
              <img
                src={img.url}
                alt={img.name}
                className="h-24 w-32 border border-line object-contain"
              />
              <button
                type="button"
                className="absolute right-0 top-0 bg-ink px-2 text-card"
                aria-label={`移除 ${img.name}`}
                onClick={() => onChange(value.filter((_, n) => n !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-vermilion">
          {error}
        </p>
      )}
    </div>
  );
}
