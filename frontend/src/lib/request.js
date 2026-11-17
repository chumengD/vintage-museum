export async function request(path, options = {}) {
  const multipart = options.body instanceof FormData;
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "include",
      ...options,
      headers: {
        "X-App-Request": "museum-web",
        ...(options.body && !multipart ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: multipart ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("无法连接服务，请确认后端已启动后重试。", { cause: error });
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const fields = Object.values(data.fieldErrors || {});
    const error = new Error(
      fields.length
        ? fields.join("；")
        : data.message ||
            {
              401: "请先登录后再操作。",
              403: "请求未被允许，请检查后端允许的站点地址。",
              409: "该记录已存在。",
              429: "请求过于频繁，请稍后重试。",
              500: "服务暂时不可用，请确认后端已启动后重试。",
              502: "无法连接后端服务，请确认后端已启动。",
            }[response.status] ||
            "请求失败，请稍后重试。",
    );
    error.status = response.status;
    error.code = data.code;
    error.fieldErrors = data.fieldErrors;
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("museum:unauthorized"));
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
