import { demoMode } from "./features";
export const categories = demoMode
  ? ["网络浏览", "影音播放", "即时通讯", "图形设计", "系统工具", "开发工具"]
  : ["网络浏览", "影音播放", "即时通讯", "其他"];
export const platforms = [
  "Windows",
  "macOS",
  "Linux",
  "Android",
  "iOS",
  ...(demoMode ? [] : ["其他"]),
];
