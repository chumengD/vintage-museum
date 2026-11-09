import { useState } from "react";
import { ArrowRight } from "lucide-react";
export default function SearchBar({
  onSearch,
  initialValue = "",
  placeholder = "搜索软件系列名称或关键词…",
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value.trim());
      }}
      className="flex items-center gap-4 border-y border-ink py-3 md:gap-6"
    >
      <span className="eyebrow hidden sm:block">检 索</span>
      <input
        aria-label="检索馆藏"
        className="min-w-0 flex-1 bg-transparent py-3 font-serif text-lg outline-offset-0 placeholder:text-muted md:text-2xl"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
      <span className="hidden font-mono text-xs text-muted lg:block">例：Firefox / Winamp</span>
      <button aria-label="搜索" className="button button-dark h-12 w-12 shrink-0 p-0">
        <ArrowRight size={22} />
      </button>
    </form>
  );
}
