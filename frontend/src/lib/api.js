import { demoMode } from "./features";
import { request } from "./request";
import { backendApi } from "./backend-api";

export async function api(path, options = {}) {
  const data = await (demoMode ? request(path, options) : backendApi(path, options));
  if (["/auth/login", "/auth/me", "/auth/logout"].includes(path)) {
    window.dispatchEvent(new CustomEvent("museum:session", { detail: data }));
  }
  return data;
}
