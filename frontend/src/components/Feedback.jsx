export function ResourceState({ resource, children }) {
  if (resource.loading)
    return (
      <div role="status" className="py-20 text-center text-muted">
        正在翻阅馆藏…
      </div>
    );
  if (resource.error)
    return (
      <div role="alert" className="border border-line p-8 text-center">
        <p className="mb-4 text-vermilion">{resource.error}</p>
        <button className="button" onClick={resource.reload}>
          重新加载
        </button>
      </div>
    );
  return children;
}
export function Empty({ children = "还没有记录，留下一份新的记忆吧。" }) {
  return <p className="border-y border-line py-14 text-center text-muted">{children}</p>;
}
export function ErrorMessage({ children }) {
  return children ? (
    <p role="alert" className="my-4 border-l-2 border-vermilion bg-wash px-4 py-2 text-vermilion">
      {children}
    </p>
  ) : null;
}
