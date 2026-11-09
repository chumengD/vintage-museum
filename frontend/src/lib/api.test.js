import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/setup";
import { api } from "./api";
describe("API client and contracts", () => {
  it("preserves error messages and status", async () => {
    server.use(
      http.get("/api/failure", () =>
        HttpResponse.json({ message: "资料暂不可用" }, { status: 503 }),
      ),
    );
    await expect(api("/failure")).rejects.toMatchObject({
      message: "资料暂不可用",
      status: 503,
    });
  });
  it("handles no-content logout and protected API responses", async () => {
    await expect(api("/favorites")).rejects.toMatchObject({ status: 401 });
    await api("/auth/login", {
      method: "POST",
      body: { email: "museum@example.com", password: "museum-passphrase-2026" },
    });
    expect((await api("/auth/me")).user.displayName).toBe("林行舟");
    expect(await api("/auth/logout", { method: "POST" })).toBeNull();
    await expect(api("/auth/me")).rejects.toMatchObject({ status: 401 });
  });
  it("rejects duplicate registration and supports register then login", async () => {
    await expect(
      api("/auth/register", {
        method: "POST",
        body: { email: "museum@example.com", password: "some-password" },
      }),
    ).rejects.toMatchObject({ status: 409 });
    await api("/auth/register", {
      method: "POST",
      body: { email: "reader@example.com", password: "some-password" },
    });
    expect(
      (
        await api("/auth/login", {
          method: "POST",
          body: { email: "reader@example.com", password: "some-password" },
        })
      ).expiresIn,
    ).toBe(7200);
  });
  it("keeps previous body when editing a version", async () => {
    await api("/auth/login", {
      method: "POST",
      body: { email: "museum@example.com", password: "museum-passphrase-2026" },
    });
    const original = await api("/versions/firefox-3.6");
    await api("/versions/firefox-3.6", {
      method: "PUT",
      body: { ...original, body: "新的档案正文" },
    });
    expect((await api("/versions/firefox-3.6/revisions"))[0].body).toBe(original.body);
    expect((await api("/versions/firefox-3.6")).body).toBe("新的档案正文");
  });
});
