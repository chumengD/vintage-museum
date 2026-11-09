import { test, expect } from "@playwright/test";
test("all designed pages fit the viewport and account workflows are usable", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "登录 / 注册" }).click();
  await page.screenshot({ path: `test-results/login-${info.project.name}.png`, fullPage: true });
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: /邮箱地址/ }).fill("museum@example.com");
  await dialog.getByLabel(/登录密码/).fill("museum-passphrase-2026");
  await dialog.getByRole("button", { name: /登录，进入博物馆/ }).click();
  await expect(page.getByRole("button", { name: "账户菜单" })).toBeVisible();
  for (const [route, name, title] of [
    ["/series", "series", "浏览全部系列"],
    ["/series/firefox", "chain", "Mozilla Firefox"],
    ["/versions/firefox-3.6", "version", "Firefox 3.6"],
    ["/favorites", "favorites", "我的收藏"],
    ["/profile", "profile", "林行舟"],
    ["/series/new", "create", /创建一个系列/],
    ["/publish?series=firefox", "publish", "发布版本"],
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: title, exact: true }).first()).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      route,
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${name}-${info.project.name}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "打开日期选择框" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: `test-results/calendar-${info.project.name}.png` });
  await page.getByRole("button", { name: "今天", exact: true }).click();
  await page.getByRole("button", { name: "确定", exact: true }).click();
  await expect(page.getByLabel("发布日期 *")).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  await page.goto("/profile");
  await page.getByRole("button", { name: /编辑资料/ }).click();
  await page.getByRole("textbox", { name: "姓名", exact: true }).fill("数字记忆收藏者");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByRole("heading", { name: "数字记忆收藏者", exact: true })).toBeVisible();
  await page.goto("/contributors/usr_demo");
  await expect(page.getByRole("heading", { name: "数字记忆收藏者", exact: true })).toBeVisible();
  await expect(page.getByText("草稿 / DRAFTS", { exact: true })).toHaveCount(0);
  await page.goto("/drafts");
  const draft = page.locator("article").filter({ hasText: "千千静听 5.0" });
  await draft.getByRole("button", { name: "删除草稿" }).click();
  await page.getByRole("button", { name: "保留草稿" }).click();
  await expect(draft).toBeVisible();
  await draft.getByRole("button", { name: "删除草稿" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(draft).toHaveCount(0);
});
