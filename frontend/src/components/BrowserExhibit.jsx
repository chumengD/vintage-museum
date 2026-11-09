export default function BrowserExhibit() {
  return (
    <div
      aria-label="Firefox 历史界面排版示意，非原始截图"
      className="overflow-hidden border border-[#bcb8a7] bg-[#fafaf6]"
    >
      <div className="flex items-center gap-20 bg-[#d6d3bf] px-2 text-[10px]">
        Mozilla Firefox — 起始页 <span>— □ ×</span>
      </div>
      <div className="bg-[#e8e6d8] px-3 py-2 text-[10px] text-ink">
        <p>文件(F)　编辑(E)　查看(V)　历史(S)　书签(B)　工具(T)　帮助(H)</p>
        <p className="mt-2 flex gap-4 text-xs">
          <span>← → ↻ ⌂</span>
          <span>https://www.mozilla.org/</span>
          <span>☆</span>
        </p>
      </div>
      <div className="px-8 py-12 md:px-12">
        <p className="font-serif text-5xl text-vermilion">Firefox</p>
        <p className="mb-5 mt-6 font-serif text-2xl">让网络，保持开放。</p>
        <p className="text-xs text-muted">
          搜索网页或输入地址 <span className="ml-16">→</span>
        </p>
        <p className="mt-5 text-[10px] text-muted">历史界面排版示意 · 非原始截图</p>
      </div>
    </div>
  );
}
