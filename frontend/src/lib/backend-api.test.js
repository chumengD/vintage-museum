import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/setup";
import { backendApi, uploadScreenshot } from "./backend-api";

const series = {
  id: "s1",
  name: "测试浏览器",
  category: "BROWSER",
  platforms: ["WINDOWS", "MACOS"],
  description: "历史介绍",
  iconUrl: "/api/series/s1/icon",
  updatedAt: "2026-11-17T01:00:00Z",
};
const version = {
  id: "v1",
  seriesId: "s1",
  versionNumber: "1.0",
  platform: "WINDOWS",
  releaseDate: null,
  description: "正文",
  updatedAt: "2026-11-17T01:00:00Z",
};
const listing = (items, totalPages = 1) => HttpResponse.json({ items, totalPages });
const image = { name: "pixel.png", url: "data:image/png;base64,aGVsbG8=" };
const readBlob = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });

describe("Spring Boot API contract", () => {
  it("sends username credentials and the required header and normalizes current user", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    server.use(
      http.post("/api/auth/login", async ({ request }) => {
        expect(request.headers.get("X-App-Request")).toBe("museum-web");
        expect(await request.json()).toEqual({ username: "reader", password: "pass" });
        return HttpResponse.json({
          user: { id: "u1", username: "reader", email: null },
          expiresAt: "2026-11-17T01:30:00Z",
        });
      }),
    );
    expect(
      (
        await backendApi("/auth/login", {
          method: "POST",
          body: { username: "reader", password: "pass" },
        })
      ).user.displayName,
    ).toBe("reader");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("collects every series and version page and maps backend enums", async () => {
    server.use(
      http.get("/api/series", ({ request }) =>
        listing(
          [{ ...series, id: new URL(request.url).searchParams.get("page") === "0" ? "s1" : "s2" }],
          2,
        ),
      ),
      http.get("/api/series/:id/versions", ({ params, request }) =>
        listing(
          [
            {
              ...version,
              seriesId: params.id,
              id: `v${new URL(request.url).searchParams.get("page")}`,
            },
          ],
          2,
        ),
      ),
    );
    const items = await backendApi("/series");
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({
      category: "网络浏览",
      platforms: ["Windows", "macOS"],
      iconImage: series.iconUrl,
      count: 2,
    });
    expect(items[0].versions[0]).toMatchObject({ date: "", number: "1.0", body: "正文" });
  });

  it("creates multipart metadata and icon without sending unsupported fields", async () => {
    // Inspect browser FormData directly: jsdom's Blob is not a Node fetch stream.
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (url, options) => {
      expect(url).toBe("/api/series");
      expect(options.headers["Content-Type"]).toBeUndefined();
      expect(options.headers["X-App-Request"]).toBe("museum-web");
      const data = options.body;
      expect(data).toBeInstanceOf(FormData);
      expect(JSON.parse(await readBlob(data.get("metadata")))).toEqual({
        name: series.name,
        description: "历史介绍",
        category: "BROWSER",
        platforms: ["MACOS"],
      });
      expect(data.get("icon").name).toBe("pixel.png");
      return HttpResponse.json({ series }, { status: 201 });
    });
    expect(
      (
        await backendApi("/series", {
          method: "POST",
          body: {
            name: series.name,
            description: "历史介绍",
            category: "网络浏览",
            platforms: ["macOS"],
            tags: ["not sent"],
            images: [image],
          },
        })
      ).id,
    ).toBe("s1");
  });

  it("creates a version under its series with an optional release date", async () => {
    server.use(
      http.post("/api/series/s1/versions", async ({ request }) => {
        expect(await request.json()).toEqual({
          versionNumber: "1.0",
          platform: "WINDOWS",
          releaseDate: null,
          description: "正文",
        });
        return HttpResponse.json({ version }, { status: 201 });
      }),
    );
    expect(
      (
        await backendApi("/versions", {
          method: "POST",
          body: {
            seriesId: "s1",
            number: "1.0",
            platform: "Windows",
            date: "",
            body: "正文",
            screenshots: [],
          },
        })
      ).id,
    ).toBe("v1");
  });

  it("uploads screenshots as files and loads paginated images and same-platform siblings", async () => {
    server.use(
      http.get("/api/versions/v1", () => HttpResponse.json({ version, series })),
      http.get("/api/series/s1/versions", ({ request }) => {
        expect(new URL(request.url).searchParams.get("platform")).toBe("WINDOWS");
        return listing([version]);
      }),
      http.get("/api/versions/v1/screenshots", ({ request }) =>
        listing(
          [
            {
              imageUrl: `/api/screenshots/${new URL(request.url).searchParams.get("page")}/image`,
              caption: "主界面",
            },
          ],
          2,
        ),
      ),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (url, options) => {
      expect(url).toBe("/api/versions/v1/screenshots");
      expect(options.body.get("image").name).toBe("pixel.png");
      expect(options.body.get("caption")).toBe("主界面");
      expect(options.headers["Content-Type"]).toBeUndefined();
      return HttpResponse.json({ screenshot: { id: "p1" } }, { status: 201 });
    });
    await uploadScreenshot("v1", image, "主界面");
    fetchSpy.mockRestore();
    const detail = await backendApi("/versions/v1");
    expect(detail.screenshots).toHaveLength(2);
    expect(detail.screenshots[0]).toMatchObject({
      url: "/api/screenshots/0/image",
      name: "主界面",
    });
    expect(detail.siblings[0].platform).toBe("Windows");
  });

  it("surfaces field validation and never sends unsupported features to mock or backend", async () => {
    server.use(
      http.post("/api/auth/register", () =>
        HttpResponse.json(
          { message: "请检查输入字段", fieldErrors: { password: "密码须为 4～64 字符" } },
          { status: 400 },
        ),
      ),
    );
    await expect(backendApi("/auth/register", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 400,
      message: "密码须为 4～64 字符",
    });
    const spy = vi.spyOn(globalThis, "fetch");
    await expect(backendApi("/favorites")).rejects.toMatchObject({ status: 501 });
    expect(spy).not.toHaveBeenCalled();
  });
});
