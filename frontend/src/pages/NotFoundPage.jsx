import { Link } from "react-router-dom";
export default function NotFoundPage() {
  return (
    <div className="page py-24 text-center">
      <p className="eyebrow">404 / MISSING RECORD</p>
      <h1 className="my-6 text-4xl">这一页，尚未入藏。</h1>
      <Link className="button button-dark" to="/">
        返回首页 →
      </Link>
    </div>
  );
}
