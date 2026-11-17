import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const root = new URL("../../docs/collections/", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("catalog.json", root), "utf8"));
const assetPath = (asset) => fileURLToPath(new URL(asset.localPath, root));
const raster = (asset) => ["image/png", "image/jpeg"].includes(asset.mimeType);
const category = {
  instant_messaging: ["即时通讯", "INSTANT_MESSAGING"],
  web_browser: ["网络浏览", "BROWSER"],
  media_player: ["影音播放", "MEDIA"],
};
// These are test mappings, not a production importer: the catalog's PC platform
// and missing desktop platforms use Windows; unavailable categories use OTHER.
const platform = (version) =>
  version.platform === "iOS" || version.productId === "ios"
    ? ["iOS", "IOS"]
    : version.productId === "android"
      ? ["Android", "ANDROID"]
      : ["Windows", "WINDOWS"];
const screenshotAssets = (version) =>
  catalog.assets.filter(
    (asset) =>
      version.assetIds.includes(asset.id) &&
      asset.versionId === version.id &&
      asset.role === "version_screenshot" &&
      raster(asset),
  );
function description(version) {
  const sources = version.sourceIds.map((id) => catalog.sources.find((s) => s.id === id));
  return [
    "## 版本记录",
    version.summary,
    `资料编号：${version.id}`,
    `原始日期精度：${version.datePrecision}；时间线年份：${version.timelineYear}`,
    version.dateNote,
    "## 资料来源",
    ...sources.map((source) => `- [${source.title || source.id}](${source.url})`),
  ]
    .filter(Boolean)
    .join("\n\n");
}
const suffix = Date.now().toString(36);
let cookies;

test.beforeAll(async ({ browser, baseURL }) => {
  const page = await browser.newPage({ baseURL });
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "登录 / 注册" }).click();
    const dialog = page.getByRole("dialog", { name: "账号" });
    await dialog.getByRole("tab", { name: "注册" }).click();
    await dialog.getByRole("textbox", { name: "用户名", exact: true }).fill(`collection_${suffix}`);
    await dialog.getByLabel(/设置密码/).fill("collection-test-pass");
    await dialog.getByRole("button", { name: /注册账号/ }).click();
    await expect(dialog.getByRole("status")).toContainText("注册成功");
    await dialog.getByRole("button", { name: /登录账号/ }).click();
    await expect(page.getByRole("button", { name: "账号菜单" })).toBeVisible();
    cookies = await page.context().cookies();
  } finally {
    await page.close();
  }
});

for (const product of catalog.products) {
  test(`collection: ${product.id} — submit every catalog version and matched screenshot`, async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(180000);
    await context.addCookies(cookies);
    const versions = catalog.versions.filter((v) => v.productId === product.id);
    const [categoryLabel, categoryCode] = category[product.category] || ["其他", "OTHER"];
    const platforms = [...new Set(versions.map((v) => platform(v)[0]))];
    const icon = catalog.assets.find((a) => product.logoAssetIds?.includes(a.id) && raster(a));
    const name = `${product.name} [${suffix}]`;
    const errors = [];
    const writes = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.request().method() === "POST" && response.url().includes("/api/")) {
        writes.push({ path: new URL(response.url()).pathname, status: response.status() });
      }
    });
    const report = { product: product.id, versions: [], writes };
    try {
      await page.goto("/series/new");
      await page.getByLabel("系列名称 *", { exact: true }).fill(name);
      await page.getByRole("textbox", { name: /系列介绍/ }).fill(product.summary);
      await page.getByRole("combobox", { name: "软件分类" }).click();
      await page.getByRole("option", { name: categoryLabel, exact: true }).click();
      await page.getByRole("button", { name: "适用平台", exact: true }).click();
      for (const value of platforms)
        await page.getByRole("checkbox", { name: value, exact: true }).check();
      await page.getByRole("button", { name: "完成选择" }).click();
      if (icon) await page.getByLabel("系列图标", { exact: true }).setInputFiles(assetPath(icon));
      const seriesResponse = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/series" && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "创建系列 →" }).click();
      const created = await seriesResponse;
      expect(created.status()).toBe(201);
      const { series } = await created.json();
      report.seriesId = series.id;
      expect(series).toMatchObject({ name, description: product.summary, category: categoryCode });
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
      if (icon) {
        const response = await page.request.get(series.iconUrl);
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain("image/png");
      } else expect(series.iconUrl).toBeNull();

      for (const version of versions) {
        await test.step(version.id, async () => {
          await page.goto(`/series/${series.id}`);
          await page.getByRole("link", { name: "＋ 添加版本" }).click();
          await page.getByLabel("版本号 *", { exact: true }).fill(version.version);
          const releaseDate = version.datePrecision === "day" ? version.releasedAt : null;
          if (releaseDate) await page.getByLabel("发布日期（未知可留空）").fill(releaseDate);
          const [platformLabel, platformCode] = platform(version);
          const select = page.getByRole("combobox", { name: "适用平台" });
          if (!(await select.textContent()).includes(platformLabel)) {
            await select.click();
            await page.getByRole("option", { name: platformLabel, exact: true }).click();
          }
          const body = description(version);
          expect(body.length).toBeLessThanOrEqual(5000);
          await page.getByRole("textbox", { name: "正文", exact: true }).fill(body);
          const screenshots = screenshotAssets(version);
          for (const asset of screenshots) {
            expect(
              createHash("sha256")
                .update(readFileSync(assetPath(asset)))
                .digest("hex"),
            ).toBe(asset.sha256);
          }
          if (screenshots.length) {
            await page
              .getByLabel("截图", { exact: true })
              .setInputFiles(screenshots.map(assetPath));
            await expect(page.getByRole("button", { name: /^移除 / })).toHaveCount(
              screenshots.length,
            );
            await page
              .getByLabel("截图说明（可选）", { exact: true })
              .fill(`${version.version} · 资料库版本截图`);
          }
          const versionResponse = page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === `/api/series/${series.id}/versions` &&
              r.request().method() === "POST",
          );
          await page.getByRole("button", { name: "发布版本 →" }).click();
          const submitted = await versionResponse;
          expect(submitted.status()).toBe(201);
          const { version: saved } = await submitted.json();
          const expected = {
            seriesId: series.id,
            versionNumber: version.version,
            platform: platformCode,
            releaseDate,
            description: body,
          };
          expect(saved).toMatchObject(expected);
          await expect(
            page.getByRole("heading", { name: `${name} ${version.version}`, exact: true }),
          ).toBeVisible();
          await page.reload();
          await expect(page.getByRole("heading", { name: "版本记录", exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: /放大截图/ })).toHaveCount(
            screenshots.length,
          );
          const detail = await page.request.get(`/api/versions/${saved.id}`);
          expect(detail.status()).toBe(200);
          expect((await detail.json()).version).toMatchObject(expected);
          const imagesResponse = await page.request.get(`/api/versions/${saved.id}/screenshots`);
          expect(imagesResponse.status()).toBe(200);
          const images = await imagesResponse.json();
          expect(images.totalElements).toBe(screenshots.length);
          for (let i = 0; i < screenshots.length; i++) {
            const img = page.locator("figure img").nth(i);
            await expect
              .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
              .toBe(true);
            const dimensions = await img.evaluate((el) => [el.naturalWidth, el.naturalHeight]);
            expect(dimensions).toEqual([screenshots[i].width, screenshots[i].height]);
          }
          report.versions.push({
            id: version.id,
            apiId: saved.id,
            releaseDate,
            screenshots: screenshots.length,
          });
        });
      }
      const listing = await page.request.get(`/api/series/${series.id}/versions?size=100`);
      expect(listing.status()).toBe(200);
      expect((await listing.json()).totalElements).toBe(versions.length);
      const expectedWrites =
        1 + versions.length + versions.reduce((n, v) => n + screenshotAssets(v).length, 0);
      expect(writes).toHaveLength(expectedWrites);
      expect(writes.every((w) => w.status === 201)).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${product.id}.png`), fullPage: true });
    } finally {
      await testInfo.attach("collection-api-results", {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
    }
  });
}

test("collection: SVG icons are rejected by both the form and API", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies(cookies);
  const svg = catalog.assets.find((a) => a.mimeType === "image/svg+xml");
  await page.goto("/series/new");
  await page.getByLabel("系列图标", { exact: true }).setInputFiles(assetPath(svg));
  await expect(page.getByRole("alert")).toContainText("仅支持 PNG / JPG");
  const response = await page.request.post("/api/series", {
    headers: { "X-App-Request": "museum-web", Origin: baseURL },
    multipart: {
      metadata: {
        name: "metadata.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            name: "SVG rejection",
            description: "SVG validation",
            category: "OTHER",
            platforms: ["WINDOWS"],
          }),
        ),
      },
      icon: { name: "icon.svg", mimeType: svg.mimeType, buffer: readFileSync(assetPath(svg)) },
    },
  });
  expect(response.status()).toBe(400);
});
