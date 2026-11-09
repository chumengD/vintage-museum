import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { DropdownMenu } from "radix-ui";
import { ArrowLeft, UserRound, FolderPlus, Star, LogOut, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
export default function Layout() {
  const { user, openLogin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const home = location.pathname === "/";
  const label =
    location.pathname === "/series"
      ? "全部系列"
      : location.pathname === "/series/new"
        ? "创建系列"
        : location.pathname.startsWith("/series/")
          ? "系列详情"
          : location.pathname.includes("/edit")
            ? "编辑版本"
            : location.pathname === "/publish"
              ? "发布版本"
              : location.pathname.startsWith("/versions/")
                ? "版本详情"
                : location.pathname === "/favorites"
                  ? "我的收藏"
                  : location.pathname === "/profile"
                    ? "我的主页"
                    : location.pathname === "/drafts"
                      ? "我的草稿"
                      : "本馆说明";
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${home ? "旧时博物馆" : label + " · 旧时博物馆"}`;
  }, [location.pathname, home, label]);
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-3"
      >
        跳到主要内容
      </a>
      <header
        className={
          home
            ? "flex h-20 w-full items-center justify-end px-4 md:px-6"
            : "border-b border-line"
        }
      >
        <div
          className={
            home
              ? ""
              : "flex h-[72px] w-full items-center justify-between gap-4 px-4 md:px-6"
          }
        >
          {!home && (
            <>
              <div className="flex items-center gap-3">
                <button
                  aria-label="返回上一页"
                  onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"))}
                  className="p-1"
                >
                  <ArrowLeft size={19} />
                </button>
                <Link to="/" className="flex items-center gap-2 font-bold">
                  <span className="bg-ink px-1.5 py-0.5 font-serif text-card">旧</span>
                  旧时博物馆
                  <span className="ml-2 hidden font-mono text-[8px] tracking-[.3em] text-muted sm:inline">
                    VINTAGE MUSEUM
                  </span>
                </Link>
              </div>
            </>
          )}
          {user ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                className="h-9 w-9 rounded-[2px] border border-ink bg-[#ddd4bf] font-serif text-lg data-[state=open]:bg-ink data-[state=open]:text-card"
                aria-label="账户菜单"
              >
                {user.displayName?.slice(0, 1) || "藏"}
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={10}
                  className="z-30 w-72 border border-ink bg-card shadow-[5px_5px_0_#1e1d1825]"
                >
                  <div className="flex justify-between border-b border-line px-5 py-3 text-xs text-muted">
                    <span className="tracking-widest">账户 / ACCOUNT</span>● 已登录
                  </div>
                  <div className="flex items-center gap-3 border-b border-line p-5">
                    <span className="bg-ink px-3 py-2 font-serif text-2xl text-card">
                      {user.displayName?.slice(0, 1)}
                    </span>
                    <div>
                      <strong className="font-serif text-xl">{user.displayName}</strong>
                      <p className="muted">@{user.handle || "reader"}</p>
                    </div>
                  </div>
                  {[
                    ["/profile", "我的主页", UserRound],
                    ["/favorites", "我的收藏", Star],
                    ["/series/new", "发布系列", FolderPlus],
                    ["/drafts", "我的草稿", FileText],
                  ].map(([path, title, Icon]) => (
                    <DropdownMenu.Item key={path} asChild>
                      <Link to={path} className="menu-item">
                        <Icon size={17} />
                        {title}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Separator className="border-t border-line" />
                  <DropdownMenu.Item
                    className="menu-item text-muted"
                    onSelect={async () => {
                      try {
                        await logout();
                        navigate("/");
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    <LogOut size={17} />
                    退出登录
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            <button className="button min-h-9 px-3 py-1" onClick={openLogin}>
              登录 / 注册
            </button>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="px-6 text-vermilion">
          {error}
        </p>
      )}
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-8 text-xs text-muted md:px-14">
        <span>旧时博物馆 · 由社区共同维护</span>
        <div className="flex gap-5">
          <Link to="/about" className="hover:text-vermilion">
            本馆说明 / 关于
          </Link>
          <Link to="/publish" className="hover:text-vermilion">
            投稿 ↗
          </Link>
        </div>
      </footer>
    </div>
  );
}
