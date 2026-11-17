import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";

test("real backend: register, login, create, upload with retry, reload and logout", async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const username = `reader_${suffix}`;
  const name = `接口联调 ${suffix}`;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "登录 / 注册" }).click();
  const dialog = page.getByRole("dialog", { name: "账号" });
  await dialog.getByRole("tab", { name: "注册" }).click();
  await dialog.getByRole("textbox", { name: "用户名", exact: true }).fill(username);
  await dialog.getByLabel(/设置密码/).fill("pass");
  await dialog.getByRole("button", { name: /注册账号/ }).click();
  await expect(dialog.getByRole("status")).toContainText("注册成功");
  await dialog.getByRole("button", { name: /登录账号/ }).click();
  await expect(page.getByRole("button", { name: "账号菜单" })).toBeVisible();
  await page.goto("/series/new");
  await page.getByLabel("系列名称 *", { exact: true }).fill(name);
  await page.getByRole("textbox", { name: /系列介绍/ }).fill("真实后端接口联调记录。");
  await page.getByRole("combobox", { name: "软件分类" }).click();
  await page.getByRole("option", { name: "网络浏览", exact: true }).click();
  await page.getByRole("button", { name: "适用平台", exact: true }).click();
  await page.getByRole("checkbox", { name: "macOS" }).check();
  await page.getByRole("button", { name: "完成选择" }).click();
  const png = {
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  };
  await page.getByLabel("系列图标", { exact: true }).setInputFiles(png);
  await page.getByRole("button", { name: "创建系列 →" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const seriesUrl = page.url();
  await expect(page.getByRole("button", { name: /收藏/ })).toHaveCount(0);
  await page.getByRole("link", { name: "＋ 添加版本" }).click();
  await page.getByLabel("版本号 *", { exact: true }).fill("1.0");
  await expect(page.getByRole("combobox", { name: "适用平台" })).toHaveText(/macOS/);
  await page
    .getByRole("textbox", { name: "正文", exact: true })
    .fill("## 联调正文\n\n发布日期未知，验证空日期。");
  await page
    .getByLabel("截图", { exact: true })
    .setInputFiles([png, { ...png, name: "second.png" }]);
  await page.getByLabel("截图说明（可选）", { exact: true }).fill("测试截图");
  let creates = 0;
  let uploads = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/series\/[^/]+\/versions$/.test(request.url())) creates++;
  });
  await page.route("**/api/versions/*/screenshots", async (route) => {
    if (route.request().method() === "POST" && ++uploads === 2) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "测试上传中断" }),
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "发布版本 →" }).click();
  await expect(page.getByRole("alert")).toContainText("已上传 1/2 张截图");
  await page.getByRole("button", { name: "重试剩余截图 →" }).click();
  await expect(page.getByRole("heading", { name: `${name} 1.0`, exact: true })).toBeVisible();
  expect(creates).toBe(1);
  expect(uploads).toBe(3);
  const versionUrl = page.url();
  await page.reload();
  await expect(page.getByRole("button", { name: /放大截图/ })).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "联调正文" })).toBeVisible();
  expect(
    await page
      .locator("figure img")
      .evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
  ).toBe(true);
  await page.getByText("补充版本截图", { exact: true }).click();
  await page.getByLabel("补充截图", { exact: true }).setInputFiles(png);
  await page.getByRole("button", { name: "上传截图", exact: true }).click();
  await expect(page.getByRole("button", { name: /放大截图/ })).toHaveCount(3);
  await page.goto(seriesUrl);
  await expect(page.getByRole("link", { name: /1.0.*发布时间：待考证/ })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "账号菜单" }).click();
  await page.getByRole("menuitem", { name: "退出登录" }).click();
  await expect(page.getByRole("button", { name: "登录 / 注册" })).toBeVisible();
  await page.goto(versionUrl);
  await expect(page.getByRole("button", { name: /放大截图/ })).toHaveCount(3);
  expect(errors).toEqual([]);
});
