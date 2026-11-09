import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import MarkdownEditor from "./MarkdownEditor";
import ImageUpload from "./ImageUpload";
import DatePicker from "./DatePicker";
import { useState } from "react";
describe("accessible museum interactions", () => {
  it("opens the reader pass, reports login failure, logs in and supports keyboard menu navigation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "登录 / 注册" }));
    expect(screen.getByRole("dialog", { name: "馆藏通行证" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("邮箱地址", { exact: false }), "museum@example.com");
    await user.type(screen.getByLabelText("登录密码", { exact: false }), "wrong");
    await user.click(screen.getByRole("button", { name: /登录，进入博物馆/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("邮箱或密码错误");
    await user.clear(screen.getByLabelText("登录密码", { exact: false }));
    await user.type(screen.getByLabelText("登录密码", { exact: false }), "museum-passphrase-2026");
    await user.click(screen.getByRole("button", { name: /登录，进入博物馆/ }));
    const account = await screen.findByRole("button", { name: "账户菜单" });
    account.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: "我的主页" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(account).toHaveFocus();
  });
  it("filters series and shows an empty state", async () => {
    window.history.pushState({}, "", "/series");
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Mozilla Firefox");
    await user.click(screen.getByRole("button", { name: /图形设计/ }));
    expect(screen.getByText("Adobe Photoshop")).toBeInTheDocument();
    expect(screen.queryByText("Mozilla Firefox")).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "检索馆藏" }), "does-not-exist");
    await user.click(screen.getByRole("button", { name: "搜索", exact: true }));
    expect(screen.getByText(/没有找到匹配的系列/)).toBeInTheDocument();
  });
  it("renders markdown without executing HTML", async () => {
    const user = userEvent.setup();
    render(
      <MarkdownEditor value={"## 版本变化\n\n<script>alert(1)</script>"} onChange={() => {}} />,
    );
    await user.click(screen.getByRole("button", { name: "预览", exact: true }));
    expect(screen.getByRole("heading", { name: "版本变化" })).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });
  it("rejects oversized screenshots", async () => {
    const user = userEvent.setup();
    render(
      <ImageUpload
        label="截图"
        value={[]}
        onChange={() => {
          throw new Error("Should reject");
        }}
      />,
    );
    const file = new File(["a"], "large.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 });
    await user.upload(screen.getByLabelText("截图"), file);
    expect(screen.getByRole("alert")).toHaveTextContent("每张不超过 10 MB");
  });
  it("selects a date with an accessible calendar", async () => {
    function Fixture() {
      const [value, setValue] = useState("2010-01-21");
      return <DatePicker value={value} onChange={setValue} />;
    }
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole("button", { name: "打开日期选择框" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "清空" }));
    await user.click(screen.getByRole("button", { name: "确定" }));
    await waitFor(() => expect(screen.getByLabelText("发布日期 *")).toHaveValue(""));
  });
});
