export default function Pagination({ page, total, pageSize, onChange }) {
  const count = Math.ceil(total / pageSize);
  if (count < 2) return null;
  return (
    <nav aria-label="分页" className="my-8 flex flex-wrap justify-end gap-2">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          aria-current={page === i + 1 ? "page" : undefined}
          className={`button px-4 ${page === i + 1 ? "button-dark" : ""}`}
          onClick={() => onChange(i + 1)}
        >
          {i + 1}
        </button>
      ))}
      <button className="button" disabled={page >= count} onClick={() => onChange(page + 1)}>
        下一页 →
      </button>
    </nav>
  );
}
