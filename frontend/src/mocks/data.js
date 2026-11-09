const entries = [
  [
    "firefox",
    "Mozilla Firefox",
    "Ff",
    "网络浏览",
    "从 Phoenix 到 Firefox，记录开放网络的界面与变迁。",
    128,
    "2002—2025",
  ],
  [
    "winamp",
    "Winamp",
    "W",
    "影音播放",
    "皮肤、播放列表与跳动的频谱，一代人的桌面音乐播放器。",
    64,
    "1997—2013",
  ],
  [
    "ie",
    "Internet Explorer",
    "IE",
    "网络浏览",
    "蓝色字母背后的网络时代，整理历代浏览器与使用记忆。",
    96,
    "1995—2022",
  ],
  [
    "msn",
    "MSN Messenger",
    "M",
    "即时通讯",
    "提示音、状态栏与联系人列表，那些曾经在线的日子。",
    87,
    "1999—2013",
  ],
  [
    "photoshop",
    "Adobe Photoshop",
    "Ps",
    "图形设计",
    "从像素到图层，回看数字图像工具的演进。",
    76,
    "1990—2025",
  ],
  [
    "vlc",
    "VLC media player",
    "V",
    "影音播放",
    "一枚橙色路锥，打开无数种声音与画面。",
    43,
    "2001—2025",
  ],
  [
    "7zip",
    "7-Zip",
    "7z",
    "系统工具",
    "小巧的压缩工具，封存文件，也封存桌面记忆。",
    35,
    "1999—2025",
  ],
  [
    "notepad",
    "Notepad++",
    "N+",
    "开发工具",
    "在文本与代码之间，寻找熟悉的编辑器窗口。",
    51,
    "2003—2025",
  ],
  [
    "qq",
    "QQ",
    "Q",
    "即时通讯",
    "从 OICQ 到 NT 架构，二十余年里最熟悉的那声敲门。",
    142,
    "1999—2024",
  ],
  [
    "ttplayer",
    "千千静听",
    "千",
    "影音播放",
    "本地播放器的黄金年代，歌词窗与均衡器。",
    33,
    "2002—2013",
  ],
];
export const initialSeries = entries.map(
  ([id, name, icon, category, description, count, years], i) => ({
    id,
    name,
    icon,
    category,
    description,
    count,
    years,
    platforms: ["Windows", "macOS", "Linux"],
    updatedAt: `2025-02-${String(18 - i).padStart(2, "0")}`,
    tags: ["软件记忆", category],
    source: "",
    owner: "community",
  }),
);
export const initialVersions = initialSeries.flatMap((s) =>
  (s.id === "firefox"
    ? ["1.0", "2.0", "3.0", "3.6", "4.0", "5.0"]
    : s.id === "winamp"
      ? ["1.0", "2.95", "5.0"]
      : ["1.0", "2.0", "3.0"]
  ).map((number, i) => ({
    id: `${s.id}-${number}`,
    seriesId: s.id,
    number,
    platform: "Windows",
    date:
      s.id === "firefox"
        ? ["2004-11-09", "2006-10-24", "2008-06-17", "2010-01-21", "2011-03-22", "2011-06-21"][i]
        : `200${i + 1}-06-12`,
    body:
      s.id === "firefox" && number === "3.6"
        ? "## 一个更轻快的日常入口\n\n### 版本变化\n\nFirefox 3.6 基于 Gecko 1.9.2，引入轻量主题 Personas，改进 JavaScript 性能与启动速度，并增加对部分 HTML5 能力的支持。熟悉的菜单栏和地址栏仍然保留，界面的变化更多发生在细节里。\n\n### 当时的使用体验\n\n轻量主题让浏览器第一次像桌面壁纸一样容易更换。这份档案同时记录发布资料与贡献者的个人回忆；个人看法不等同于官方结论。\n\n> 待确认 / 需要更多证据\n>\n> 简体中文首发包的精确编译时间仍待核对。如保存有安装包、原始截图或媒体报道，欢迎补充资料。\n\n### 资料出处\n\n[Mozilla · Firefox 3.6 Release Notes](https://www.mozilla.org/en-US/firefox/3.6/releasenotes/)"
        : `## ${s.name} ${number}\n\n记录这个版本的界面、功能与使用记忆。\n\n> 这是一份演示档案，欢迎补充可核实的历史资料。`,
    caption: "Windows 下的默认工具栏与起始页（界面示意）",
    source: "https://www.mozilla.org/en-US/firefox/3.6/releasenotes/",
    screenshots: [],
    owner: "community",
    updatedAt: "2025-02-18",
  })),
);
export const demoUser = {
  id: "usr_demo",
  email: "museum@example.com",
  displayName: "林行舟",
  handle: "lin_1998",
  bio: "在做软件考古。收集安装包、旧截图与论坛帖子，偶尔写一点版本史。相信界面也是史料。",
  location: "上海",
  website: "https://lin1998.net",
  joinedAt: "2021.03",
};
export function freshDatabase() {
  const personalSeries = [
    ["old-ime", "旧时输入法", "旧", "系统工具", 12],
    ["macos9", "Mac OS 9 界面档案", "M9", "系统工具", 28],
    ["netcafe", "网吧软件合集", "网", "影音播放", 46],
  ].map(([id, name, icon, category, count]) => ({
    id,
    name,
    icon,
    category,
    count,
    description: "收集那些熟悉的界面与使用记忆。",
    platforms: ["Windows", "macOS"],
    years: "1998—2010",
    updatedAt: "2025-01-12",
    owner: demoUser.id,
  }));
  const ownedVersions = ["winamp-2.95", "msn-2.0", "ttplayer-2.0", "ie-3.0", "qq-3.0"];
  return {
    series: [...structuredClone(initialSeries), ...personalSeries],
    versions: structuredClone(initialVersions).map((v) => ({
      ...v,
      owner: ownedVersions.includes(v.id) ? demoUser.id : v.owner,
    })),
    profile: { ...demoUser },
    favorites: [
      "series:firefox",
      "series:winamp",
      "series:ie",
      "series:msn",
      "version:firefox-3.6",
    ],
    drafts: [
      {
        id: "draft-notes",
        type: "series",
        title: "旧时博物馆 · 平台筛选交互说明",
        updatedAt: "2025-06-12",
        data: {
          name: "旧时博物馆 · 平台筛选交互说明",
          tags: "软件记忆",
          description: "记录不同平台中的软件界面。",
          category: "系统工具",
          platforms: ["Windows"],
          sources: [""],
          images: [],
        },
      },
      {
        id: "draft-player",
        type: "version",
        title: "千千静听 5.0 版本资料（未完成）",
        updatedAt: "2025-06-09",
        data: {
          seriesId: "ttplayer",
          number: "5.0",
          date: "2006-01-01",
          platform: "Windows",
          body: "## 版本变化\n\n待补充：歌词窗口与播放列表的变化。",
          screenshots: [],
          images: [],
        },
      },
    ],
    comments: [
      {
        id: "c1",
        versionId: "firefox-3.6",
        author: "旧电脑收藏家",
        body: "当年的 Personas 主题很有辨识度。我还留着一张安装后的截图，整理好后补充上来。",
        date: "2025.02.17",
      },
      {
        id: "c2",
        versionId: "firefox-3.6",
        author: "陈默",
        body: "发布日期已按官方 Release Notes 核对，中文版编译时间仍需要更多资料。",
        date: "2025.02.16",
      },
    ],
    revisions: [],
    session: null,
  };
}
