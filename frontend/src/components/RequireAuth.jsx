import { useAuth } from "./AuthContext";
export default function RequireAuth({ children }) {
  const { user, loading, openLogin } = useAuth();
  if (loading)
    return (
      <p role="status" className="page">
        正在读取通行证…
      </p>
    );
  if (!user)
    return (
      <div className="page py-24 text-center">
        <p className="eyebrow">MUSEUM READER PASS</p>
        <h1 className="my-5 text-4xl">带上通行证，留住你的记忆。</h1>
        <p className="mb-6 text-muted">登录后即可收藏、投稿与管理个人档案。</p>
        <button className="button button-dark" onClick={openLogin}>
          登录 / 注册
        </button>
      </div>
    );
  return children;
}
