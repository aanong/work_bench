import { Search, X } from "lucide-react";
import type { RefObject } from "react";
export function SearchBar({
  query,
  onChange,
  onHide,
  inputRef,
}: {
  query: string;
  onChange: (q: string) => void;
  onHide: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="search-bar">
      <Search size={20} aria-hidden />
      <input
        ref={inputRef}
        aria-label="搜索应用"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索应用、拼音或首字母"
        autoComplete="off"
        spellCheck={false}
      />
      {query && (
        <button
          className="clear"
          aria-label="清空搜索"
          onClick={() => onChange("")}
        >
          <X size={16} />
        </button>
      )}
      <button className="key" onClick={onHide} aria-label="隐藏工作台">
        Esc
      </button>
    </div>
  );
}
