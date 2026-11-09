import { useState } from "react";
import { Tabs, Checkbox } from "radix-ui";
import { Check, Eye, EyeOff, ArrowRight } from "lucide-react";
import Modal from "./Modal";
import { ErrorMessage } from "./Feedback";
import { useAuth } from "./AuthContext";
import { api } from "../lib/api";
export default function AuthDialog({ open, onOpenChange }) {
  const { setUser } = useAuth();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function switchTab(value) {
    setTab(value);
    setError("");
    setMessage("");
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (tab === "reset") {
        const data = await api("/auth/password-reset", {
          method: "POST",
          body: { email },
        });
        setMessage(data.message);
      } else if (tab === "register") {
        await api("/auth/register", {
          method: "POST",
          body: { email, password },
        });
        setTab("login");
        setMessage("注册成功，请使用邮箱和密码登录。");
      } else {
        const data = await api("/auth/login", {
          method: "POST",
          body: { email, password },
        });
        setUser(data.user);
        setPassword("");
        onOpenChange(false);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="馆藏通行证" wide>
      <div className="grid md:grid-cols-[27%_1fr]">
        <aside className="hidden flex-col justify-between border-r border-line bg-wash p-8 md:flex">
          <div>
            <p className="eyebrow text-muted">读者联 / READER COPY</p>
            <p className="font-serif text-[110px] leading-tight">09</p>
            <p className="mt-4 leading-8 text-muted">
              这里保存的不只是软件，
              <br />
              也是曾经使用它们的我们。
            </p>
          </div>
          <div className="my-12">
            <h3 className="mb-4 text-xl">入馆之后</h3>
            {["收藏你的数字记忆", "补充版本与使用记录", "与同好共同维护馆藏"].map((s) => (
              <p key={s} className="my-3 flex items-center gap-2 text-muted">
                <Check size={16} />
                {s}
              </p>
            ))}
          </div>
          <p className="muted">长期有效 · 记忆不设期限</p>
        </aside>
        <div className="p-6 md:p-10">
          <Tabs.Root value={tab} onValueChange={switchTab}>
            <Tabs.List className="mb-7 flex gap-6 border-b border-line" aria-label="登录方式">
              {[
                ["login", "已有账户 · 登录"],
                ["register", "初次到访 · 注册"],
              ].map(([value, label]) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className="border-b-2 border-transparent pb-4 text-lg text-muted data-[state=active]:border-vermilion data-[state=active]:text-ink"
                >
                  {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content value={tab}>
              <form onSubmit={submit}>
                <label className="mb-6 block">
                  <span className="mb-2 block">
                    <span className="mr-3 font-mono text-vermilion">01</span>
                    邮箱地址
                  </span>
                  <input
                    className="input"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </label>
                {tab !== "reset" && (
                  <label className="mb-5 block">
                    <span className="mb-2 block">
                      <span className="mr-3 font-mono text-vermilion">02</span>
                      {tab === "register" ? "设置密码" : "登录密码"}
                    </span>
                    <span className="relative block">
                      <input
                        className="input pr-14"
                        type={visible ? "text" : "password"}
                        autoComplete={tab === "register" ? "new-password" : "current-password"}
                        minLength={tab === "register" ? 8 : undefined}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={tab === "register" ? "至少 8 位密码" : "请输入你的密码"}
                      />
                      <button
                        className="absolute right-3 top-3 p-1 text-muted"
                        type="button"
                        aria-label={visible ? "隐藏密码" : "显示密码"}
                        onClick={() => setVisible(!visible)}
                      >
                        {visible ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                    </span>
                  </label>
                )}
                {tab === "login" && (
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-muted">
                      <Checkbox.Root
                        checked={remember}
                        onCheckedChange={setRemember}
                        className="h-5 w-5 border border-muted"
                        aria-label="记住登录状态"
                      >
                        <Checkbox.Indicator>
                          <Check size={18} />
                        </Checkbox.Indicator>
                      </Checkbox.Root>
                      记住登录状态
                    </label>
                    <button type="button" className="text-link" onClick={() => switchTab("reset")}>
                      忘记密码？
                    </button>
                  </div>
                )}
                {remember && (
                  <p className="muted mb-3">登录状态由服务器 Cookie 管理，目前有效期为 2 小时。</p>
                )}
                <ErrorMessage>{error}</ErrorMessage>
                {message && (
                  <p role="status" className="mb-4 text-vermilion">
                    {message}
                  </p>
                )}
                <button
                  disabled={busy}
                  className="button button-dark w-full justify-between py-4"
                  type="submit"
                >
                  {busy
                    ? "请稍候…"
                    : tab === "login"
                      ? "登录，进入博物馆"
                      : tab === "register"
                        ? "注册，领取通行证"
                        : "申请找回密码"}
                  <ArrowRight size={20} />
                </button>
                <p className="mt-5 text-center text-muted">
                  {tab === "login" ? "还没有通行证？" : "已有通行证？"}{" "}
                  <button
                    type="button"
                    className="text-link ml-2"
                    onClick={() => switchTab(tab === "login" ? "register" : "login")}
                  >
                    {tab === "login" ? "免费注册 ↗" : "返回登录 ↗"}
                  </button>
                </p>
                {import.meta.env.VITE_MOCK_AUTH === "true" && (
                  <p className="mt-6 break-all border-t border-line pt-4 font-mono text-xs text-muted">
                    演示账户：museum@example.com
                    <br />
                    密码：museum-passphrase-2026
                  </p>
                )}
              </form>
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>
      <footer className="border-t border-ink px-8 py-4 text-xs text-muted">
        你的邮箱仅用于账户登录与必要通知。
      </footer>
    </Modal>
  );
}
