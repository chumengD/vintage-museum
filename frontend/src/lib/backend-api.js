import { request } from "./request";

export const categoryCodes = {
  网络浏览: "BROWSER",
  影音播放: "MEDIA",
  即时通讯: "INSTANT_MESSAGING",
  其他: "OTHER",
};
export const platformCodes = {
  Windows: "WINDOWS",
  macOS: "MACOS",
  Linux: "LINUX",
  Android: "ANDROID",
  iOS: "IOS",
  其他: "OTHER",
};
const label = (codes, code) => Object.keys(codes).find((key) => codes[key] === code) || code;
const day = (value) => value?.slice(0, 10) || "";

function versionView(v) {
  return {
    ...v,
    number: v.versionNumber,
    date: v.releaseDate || "",
    platform: label(platformCodes, v.platform),
    body: v.description || "",
    updatedAt: day(v.updatedAt),
  };
}
function seriesView(s, versions = []) {
  const years = versions
    .map((v) => v.date.slice(0, 4))
    .filter(Boolean)
    .sort();
  return {
    ...s,
    category: label(categoryCodes, s.category),
    platforms: s.platforms.map((p) => label(platformCodes, p)),
    iconImage: s.iconUrl,
    icon: s.name.slice(0, 2),
    tags: [],
    versions,
    count: versions.length,
    searchText: versions.map((v) => `${v.number} ${v.platform}`).join(" "),
    years: years.length ? [...new Set([years[0], years.at(-1)])].join("–") : "年代待补充",
    updatedAt: day(s.updatedAt),
  };
}

// Consume all pages for the existing client-side filters; never silently cap at 20/100.
export async function allPages(path, options = {}) {
  const items = [];
  for (let page = 0; ; page++) {
    const data = await request(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}&size=100`,
      options,
    );
    items.push(...data.items);
    if (page + 1 >= data.totalPages) return items;
  }
}
async function versionsFor(id, platform, options) {
  return (
    await allPages(
      `/series/${id}/versions${platform ? `?platform=${encodeURIComponent(platform)}` : ""}`,
      options,
    )
  ).map(versionView);
}
async function listSeries(options) {
  const records = await allPages("/series", options);
  const result = [];
  // Bound fan-out until the backend supplies version counts and search in the listing.
  for (let i = 0; i < records.length; i += 4) {
    result.push(
      ...(await Promise.all(
        records
          .slice(i, i + 4)
          .map(async (s) => seriesView(s, await versionsFor(s.id, null, options))),
      )),
    );
  }
  return result;
}
export async function imageBlob(image) {
  if (!/^data:image\/(png|jpeg);base64,/.test(image.url))
    throw new Error("请选择 PNG 或 JPG 图片。");
  const [header, encoded] = image.url.split(",");
  return new Blob([Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))], {
    type: header.slice(5, header.indexOf(";")),
  });
}
export async function uploadScreenshot(versionId, image, caption) {
  const body = new FormData();
  body.append("image", await imageBlob(image), image.name || "screenshot.png");
  if (caption) body.append("caption", caption);
  return request(`/versions/${versionId}/screenshots`, { method: "POST", body });
}

export async function backendApi(path, options = {}) {
  const method = options.method || "GET";
  if (/^\/auth\/(register|login|me|logout)$/.test(path)) {
    const data = await request(path, options);
    return data?.user
      ? {
          ...data,
          user: { ...data.user, displayName: data.user.username, handle: data.user.username },
        }
      : data;
  }
  if (path === "/series" && method === "GET") return listSeries(options);
  if (path === "/series" && method === "POST") {
    const form = options.body;
    const body = new FormData();
    body.append(
      "metadata",
      new Blob(
        [
          JSON.stringify({
            name: form.name,
            description: form.description,
            category: categoryCodes[form.category],
            platforms: form.platforms.map((p) => platformCodes[p]),
          }),
        ],
        { type: "application/json" },
      ),
    );
    if (form.images?.[0])
      body.append("icon", await imageBlob(form.images[0]), form.images[0].name || "icon.png");
    const data = await request(path, { method, body });
    return seriesView(data.series);
  }
  const seriesMatch = path.match(/^\/series\/([^/]+)$/);
  if (seriesMatch && method === "GET") {
    const [{ series }, versions] = await Promise.all([
      request(path, options),
      versionsFor(seriesMatch[1], null, options),
    ]);
    return seriesView(series, versions);
  }
  if (path === "/versions" && method === "POST") {
    const form = options.body;
    const data = await request(`/series/${form.seriesId}/versions`, {
      method,
      body: {
        versionNumber: form.number,
        platform: platformCodes[form.platform],
        releaseDate: form.date || null,
        description: form.body || null,
      },
    });
    return versionView(data.version);
  }
  const versionMatch = path.match(/^\/versions\/([^/]+)$/);
  if (versionMatch && method === "GET") {
    const data = await request(path, options);
    const [siblings, screenshots] = await Promise.all([
      versionsFor(data.version.seriesId, data.version.platform, options),
      allPages(`${path}/screenshots`, options),
    ]);
    return {
      ...versionView(data.version),
      series: {
        ...data.series,
        iconImage: data.series.iconUrl,
        icon: data.series.name.slice(0, 2),
      },
      siblings,
      screenshots: screenshots.map((s) => ({
        ...s,
        url: s.imageUrl,
        name: s.caption || "版本截图",
      })),
    };
  }
  // Missing endpoints are documented in docs/backend-integration.md and have no UI entry.
  throw Object.assign(new Error("当前操作不可用。"), { status: 501 });
}
