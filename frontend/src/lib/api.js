export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(
      data.message ||
        {
          401: "请先登录后再操作。",
          403: "请求未被允许，请重试。",
          409: "该记录已存在。",
        }[response.status] ||
        "请求失败，请稍后重试。",
    );
    error.status = response.status;
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("museum:unauthorized"));
    throw error;
  }
  const data = response.status === 204 ? null : await response.json();
  if (path === "/auth/login" || path === "/auth/me" || path === "/auth/logout") {
    window.dispatchEvent(new CustomEvent("museum:session", { detail: data }));
  }
  return data;
}
