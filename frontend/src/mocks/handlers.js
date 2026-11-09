import { http, HttpResponse, delay } from "msw";
import { freshDatabase, demoUser } from "./data";
import { readArchive, writeArchive } from "./storage";
let db = (await readArchive().catch(() => null)) || freshDatabase();
const accounts = new Map([["museum@example.com", "museum-passphrase-2026"]]);
async function passwordDigest(password) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}
async function persist() {
  await writeArchive(db);
}
export async function resetDatabase() {
  db = freshDatabase();
  accounts.clear();
  accounts.set("museum@example.com", "museum-passphrase-2026");
  await persist();
}
const fail = (message, status = 400) => HttpResponse.json({ message }, { status });
const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const guard = () =>
  !db.session || db.session.expiresAt < Date.now() ? fail("请先登录后再操作。", 401) : null;
export const authHandlers = [
  http.get("/api/auth/me", () => guard() || HttpResponse.json({ user: db.profile })),
  http.post("/api/auth/login", async ({ request }) => {
    await delay(100);
    const { email, password } = await request.json();
    if (
      accounts.get(email) !== password &&
      db.accounts?.[email] !== (await passwordDigest(password || ""))
    )
      return fail("邮箱或密码错误。", 401);
    db.profile = { ...db.profile, email };
    db.session = { expiresAt: Date.now() + 7200000 };
    await persist();
    return HttpResponse.json({ user: db.profile, expiresIn: 7200 });
  }),
  http.post("/api/auth/register", async ({ request }) => {
    const { email, password } = await request.json();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password?.length < 8)
      return fail("请输入有效邮箱及至少 8 位密码。");
    if (accounts.has(email) || db.accounts?.[email]) return fail("邮箱已注册。", 409);
    accounts.set(email, password);
    db.accounts = { ...db.accounts, [email]: await passwordDigest(password) };
    await persist();
    return HttpResponse.json({ id: uid(), email }, { status: 201 });
  }),
  http.post("/api/auth/logout", async () => {
    db.session = null;
    await persist();
    return new HttpResponse(null, { status: 204 });
  }),
];
export const contentHandlers = [
  http.get("/api/contributors/:id", ({ params }) => {
    if (params.id !== db.profile.id) return fail("未找到这份贡献者档案。", 404);
    const { id, displayName, handle, bio, location, website, joinedAt } = db.profile;
    return HttpResponse.json({
      id,
      displayName,
      handle,
      bio,
      location,
      website,
      joinedAt,
      series: db.series.filter((s) => s.owner === demoUser.id),
      entries: db.versions
        .filter((v) => v.owner === demoUser.id)
        .map((v) => ({ ...v, seriesName: db.series.find((s) => s.id === v.seriesId)?.name })),
    });
  }),
  http.post("/api/auth/password-reset", async ({ request }) => {
    const { email } = await request.json();
    return /.+@.+\..+/.test(email)
      ? HttpResponse.json({
          message: "演示模式：找回申请已接收，不会发送真实邮件。",
        })
      : fail("请输入有效邮箱。");
  }),
  http.get("/api/series", () =>
    HttpResponse.json(
      db.series.map((s) => ({
        ...s,
        searchText: db.versions
          .filter((v) => v.seriesId === s.id)
          .map((v) => v.number + " " + v.platform)
          .join(" "),
      })),
    ),
  ),
  http.get("/api/series/:id", ({ params }) => {
    const s = db.series.find((x) => x.id === params.id);
    return s
      ? HttpResponse.json({
          ...s,
          versions: db.versions.filter((v) => v.seriesId === s.id),
        })
      : fail("未找到该系列。", 404);
  }),
  http.post("/api/series", async ({ request }) => {
    const denied = guard();
    if (denied) return denied;
    const body = await request.json();
    if (!body.name?.trim() || !body.category || !body.platforms?.length)
      return fail("请填写名称、分类和适用平台。");
    if (db.series.some((s) => s.name.toLowerCase() === body.name.trim().toLowerCase()))
      return fail("该系列已存在，请搜索后添加版本。", 409);
    const item = {
      ...body,
      id: uid(),
      name: body.name.trim(),
      count: 0,
      years: "新入藏",
      icon: body.name.slice(0, 2),
      owner: demoUser.id,
      updatedAt: today(),
    };
    db.series.unshift(item);
    await persist();
    return HttpResponse.json(item, { status: 201 });
  }),
  http.get("/api/versions/:id", ({ params }) => {
    const item = db.versions.find((x) => x.id === params.id);
    return item
      ? HttpResponse.json({
          ...item,
          series: db.series.find((s) => s.id === item.seriesId),
          siblings: db.versions.filter(
            (v) => v.seriesId === item.seriesId && v.platform === item.platform,
          ),
        })
      : fail("未找到该版本。", 404);
  }),
  http.post("/api/versions", async ({ request }) => {
    const denied = guard();
    if (denied) return denied;
    const body = await request.json();
    const series = db.series.find((s) => s.id === body.seriesId);
    if (!series || !body.number?.trim() || !body.date || !body.platform)
      return fail("请完整填写版本资料。");
    if (
      db.versions.some(
        (v) =>
          v.seriesId === body.seriesId &&
          v.number === body.number.trim() &&
          v.platform === body.platform,
      )
    )
      return fail("该平台下的版本已存在。", 409);
    const item = {
      ...body,
      number: body.number.trim(),
      id: uid(),
      owner: demoUser.id,
      updatedAt: today(),
    };
    db.versions.push(item);
    series.count++;
    series.updatedAt = today();
    await persist();
    return HttpResponse.json(item, { status: 201 });
  }),
  http.put("/api/versions/:id", async ({ params, request }) => {
    const denied = guard();
    if (denied) return denied;
    const index = db.versions.findIndex((v) => v.id === params.id);
    if (index < 0) return fail("版本不存在。", 404);
    const body = await request.json();
    if (!body.number?.trim() || !body.date || !body.platform) return fail("请完整填写版本资料。");
    db.revisions.unshift({
      id: uid(),
      versionId: params.id,
      author: db.profile.displayName,
      date: today(),
      body: db.versions[index].body,
    });
    db.versions[index] = {
      ...db.versions[index],
      ...body,
      id: params.id,
      updatedAt: today(),
    };
    await persist();
    return HttpResponse.json(db.versions[index]);
  }),
  http.get("/api/versions/:id/revisions", ({ params }) =>
    HttpResponse.json(db.revisions.filter((r) => r.versionId === params.id)),
  ),
  http.get("/api/versions/:id/contributors", ({ params }) =>
    HttpResponse.json([
      ...new Set([
        "林间",
        "陈默",
        "旧电脑收藏家",
        ...db.revisions.filter((r) => r.versionId === params.id).map((r) => r.author),
      ]),
    ]),
  ),
  http.get(
    "/api/favorites",
    () =>
      guard() ||
      HttpResponse.json(
        db.favorites
          .map((key) => {
            const [type, id] = key.split(":");
            const item = (type === "series" ? db.series : db.versions).find((s) => s.id === id);
            return item
              ? {
                  ...item,
                  key,
                  type,
                  ...(type === "version"
                    ? {
                        name: `${db.series.find((s) => s.id === item.seriesId)?.name} ${item.number}`,
                      }
                    : {}),
                }
              : null;
          })
          .filter(Boolean),
      ),
  ),
  http.post("/api/favorites", async ({ request }) => {
    const denied = guard();
    if (denied) return denied;
    const { key } = await request.json();
    if (db.favorites.includes(key)) db.favorites = db.favorites.filter((k) => k !== key);
    else db.favorites.unshift(key);
    await persist();
    return HttpResponse.json({ saved: db.favorites.includes(key) });
  }),
  http.get(
    "/api/profile",
    () =>
      guard() ||
      HttpResponse.json({
        ...db.profile,
        entries: db.versions
          .filter((v) => v.owner === demoUser.id)
          .map((v) => ({ ...v, seriesName: db.series.find((s) => s.id === v.seriesId)?.name })),
        series: db.series.filter((s) => s.owner === demoUser.id),
        drafts: db.drafts,
        savedCount: db.favorites.length,
      }),
  ),
  http.patch("/api/profile", async ({ request }) => {
    const denied = guard();
    if (denied) return denied;
    const { displayName, bio, location, website } = await request.json();
    if (!displayName?.trim()) return fail("请填写姓名。");
    db.profile = { ...db.profile, displayName, bio, location, website };
    await persist();
    return HttpResponse.json(db.profile);
  }),
  http.get("/api/drafts", () => guard() || HttpResponse.json(db.drafts)),
  http.get(
    "/api/drafts/:id",
    ({ params }) =>
      guard() ||
      (db.drafts.find((d) => d.id === params.id)
        ? HttpResponse.json(db.drafts.find((d) => d.id === params.id))
        : fail("草稿不存在。", 404)),
  ),
  http.post("/api/drafts", async ({ request }) => {
    const denied = guard();
    if (denied) return denied;
    const body = await request.json();
    const item = { ...body, id: body.id || uid(), updatedAt: today() };
    db.drafts = [item, ...db.drafts.filter((d) => d.id !== item.id)];
    await persist();
    return HttpResponse.json(item, { status: 201 });
  }),
  http.delete("/api/drafts/:id", async ({ params }) => {
    const denied = guard();
    if (denied) return denied;
    db.drafts = db.drafts.filter((d) => d.id !== params.id);
    await persist();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/api/versions/:id/comments", ({ params }) =>
    HttpResponse.json(db.comments.filter((c) => c.versionId === params.id)),
  ),
  http.post("/api/versions/:id/comments", async ({ params, request }) => {
    const denied = guard();
    if (denied) return denied;
    const { body, parentId } = await request.json();
    if (!body?.trim()) return fail("请输入评论内容。");
    const item = {
      id: uid(),
      versionId: params.id,
      author: db.profile.displayName,
      body: body.trim(),
      parentId,
      date: today(),
    };
    db.comments.push(item);
    await persist();
    return HttpResponse.json(item, { status: 201 });
  }),
];

if (
  typeof window !== "undefined" &&
  import.meta.env.VITE_MOCK_AUTH !== "true" &&
  import.meta.env.MODE !== "test"
) {
  window.addEventListener("museum:session", (event) => {
    if (event.detail) {
      db.profile = { ...db.profile, ...event.detail.user };
      db.session = { expiresAt: Date.now() + (event.detail.expiresIn || 7200) * 1000 };
    } else db.session = null;
  });
}
