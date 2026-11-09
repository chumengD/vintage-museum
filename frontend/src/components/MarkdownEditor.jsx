import { useRef, useState } from "react";
import Markdown from "react-markdown";
export default function MarkdownEditor({
  value,
  onChange,
  label = "正文",
  placeholder = "它曾经帮我们打开怎样的世界？\n\n介绍软件的用途、值得被记住的特点，以及这个系列想要收集的版本与历史资料。\n\n不必一次写完，故事可以慢慢补全。",
}) {
  const [preview, setPreview] = useState(false);
  const ref = useRef(null);
  function handleFormat(event) {
    const { before, after = "" } = event.currentTarget.dataset;
    const field = ref.current;
    const start = field.selectionStart,
      end = field.selectionEnd;
    onChange(value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end));
    field.focus();
  }
  return (
    <div className="border border-line bg-card">
      <div className="flex flex-wrap items-center gap-1 border-b border-line p-2">
        <button
          className="px-2 py-1 text-sm"
          type="button"
          onClick={() => setPreview(!preview)}
          aria-pressed={preview}
        >
          {preview ? "返回编辑" : "预览"}
        </button>
        {!preview &&
          [
            ["B", "**", "**", "加粗"],
            ["I", "*", "*", "斜体"],
            ["H", "\n## ", "", "标题"],
            ["≡", "\n- ", "", "列表"],
            ["链接", "[", "](https://)", "插入链接"],
            ["图片", "![图片说明](", ")", "插入图片"],
          ].map(([text, before, after, title]) => (
            <button
              type="button"
              key={title}
              aria-label={title}
              className="px-2 py-1 hover:bg-wash"
              data-before={before}
              data-after={after}
              onClick={handleFormat}
            >
              {text}
            </button>
          ))}
        <span className="ml-auto px-2 text-xs text-vermilion">
          Markdown / {preview ? "预览" : "编辑"}
        </span>
      </div>
      {preview ? (
        <div className="prose min-h-72 p-6">
          <Markdown>{value || "还没有正文。"}</Markdown>
        </div>
      ) : (
        <textarea
          ref={ref}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-72 w-full resize-y bg-transparent p-6 leading-8 placeholder:text-muted"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
