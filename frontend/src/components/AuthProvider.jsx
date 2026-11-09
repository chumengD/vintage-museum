import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { AuthContext } from "./AuthContext";
import AuthDialog from "./AuthDialog";
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    api("/auth/me")
      .then((data) => {
        if (alive) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    const expired = () => {
      setUser(null);
      setOpen(true);
    };
    window.addEventListener("museum:unauthorized", expired);
    return () => {
      alive = false;
      window.removeEventListener("museum:unauthorized", expired);
    };
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (e) {
      if (e.status !== 401) throw e;
    }
    setUser(null);
  }
  const requireAuth = () => {
    if (user) return true;
    setOpen(true);
    return false;
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        openLogin: () => setOpen(true),
        requireAuth,
        logout,
      }}
    >
      <>
        {children}
        <AuthDialog open={open} onOpenChange={setOpen} />
      </>
    </AuthContext.Provider>
  );
}
