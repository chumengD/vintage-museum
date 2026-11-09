import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";
async function login(page) {
  await page.getByRole("button", { name: "登录 / 注册" }).first().click();
  const dialog = page.getByRole("dialog", { name: "馆藏通行证" });
  await dialog.getByRole("textbox", { name: /邮箱地址/ }).fill("museum@example.com");
  await dialog.getByLabel(/登录密码/).fill("museum-passphrase-2026");
  await dialog.getByRole("button", { name: /登录，进入博物馆/ }).click();
  await expect(page.getByRole("button", { name: "账户菜单" })).toBeVisible();
}
test("browse, search, version chain, details and mobile layout", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /旧时/ })).toBeVisible();
  await page.screenshot({
    path: `test-results/home-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: /浏览全部系列/ }).click();
  await page.getByRole("textbox", { name: "检索馆藏" }).fill("Firefox");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page.getByRole("link", { name: "Mozilla Firefox", exact: true }).click();
  await page.getByRole("link", { name: /3.6.*发布时间/ }).click();
  await expect(page.getByRole("heading", { name: "Firefox 3.6", exact: true })).toBeVisible();
  await expect(page.getByText("版本变化", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
test("login dialog escape restores focus and account menu supports keyboard", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "登录 / 注册" });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await login(page);
  await page.getByRole("button", { name: "账户菜单" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "我的主页" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "账户菜单" })).toBeFocused();
});
test("favorite, comment, reply, edit and history survive navigation", async ({ page }) => {
  await page.goto("/versions/firefox-3.6");
  await login(page);
  await page.getByRole("button", { name: "★ 已收藏" }).click();
  await expect(page.getByRole("button", { name: "☆ 收藏条目" })).toBeVisible();
  await page.getByRole("button", { name: "☆ 收藏条目" }).click();
  await page.getByRole("textbox", { name: "评论内容" }).fill("记得这个版本的轻量主题。");
  await page.getByRole("button", { name: "发表评论", exact: true }).click();
  await expect(page.getByText("记得这个版本的轻量主题。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "回复", exact: true }).first().click();
  await page.getByRole("textbox", { name: "评论内容" }).fill("期待你的截图！");
  await page.getByRole("button", { name: "发表评论", exact: true }).click();
  await expect(page.getByText("期待你的截图！", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "编辑版本资料" }).click();
  await page
    .getByRole("textbox", { name: "正文", exact: true })
    .fill("## 新补充的资料\n\n新增可核实的版本说明。");
  await page.getByRole("button", { name: "保存修改 →" }).click();
  await expect(page.getByRole("heading", { name: "新补充的资料" })).toBeVisible();
  await page.getByRole("button", { name: /查看修改历史/ }).click();
  await expect(page.getByText(/林行舟 · 查看修订前正文/)).toBeVisible();
});
test("create series, save and resume version draft, publish with screenshot", async ({ page }) => {
  await page.goto("/series/new");
  await login(page);
  await page.getByRole("textbox", { name: "系列名称 *", exact: true }).fill("记忆播放器");
  await page.getByRole("combobox", { name: "软件分类" }).click();
  await page.getByRole("option", { name: "影音播放", exact: true }).click();
  await page.getByRole("button", { name: "适用平台", exact: true }).click();
  await page.getByRole("checkbox", { name: "Windows" }).check();
  await page.getByRole("button", { name: "完成选择" }).click();
  await page.getByRole("button", { name: "创建系列 →" }).click();
  await expect(page.getByRole("heading", { name: "记忆播放器", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "＋ 添加版本" }).click();
  await page.getByRole("textbox", { name: "版本号 *", exact: true }).fill("1.1");
  await page.getByLabel("发布日期 *").fill("2010-01-21");
  await page
    .getByRole("textbox", { name: "正文", exact: true })
    .fill("## 初次见面\n\n一份新的版本档案。");
  await page.getByRole("button", { name: "保存草稿" }).click();
  await expect(page.getByRole("status")).toContainText("草稿已保存");
  await page.getByRole("link", { name: "我的草稿", exact: true }).click();
  await page
    .locator("article")
    .filter({ hasText: "1.1" })
    .getByRole("link", { name: "继续编辑 →" })
    .click();
  await expect(page.getByRole("textbox", { name: "版本号 *", exact: true })).toHaveValue("1.1");
  await page.getByLabel("截图", { exact: true }).setInputFiles({
    name: "screen.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByRole("button", { name: "移除 screen.png" })).toBeVisible();
  await page.getByRole("button", { name: "发布版本 →" }).click();
  await expect(page.getByRole("heading", { name: "记忆播放器 1.1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "初次见面" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "记忆播放器 1.1" })).toBeVisible();
});
