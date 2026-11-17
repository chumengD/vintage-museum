import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import TodayDate from "./TodayDate";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("shows today's day and advances across a month boundary", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 30, 23, 59, 59));
  render(<TodayDate />);
  expect(screen.getByLabelText("今日日期：2026-11-30")).toHaveTextContent("30");
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByLabelText("今日日期：2026-12-01")).toHaveTextContent("01");
});

it("refreshes the date after returning to a suspended page", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 17, 12));
  render(<TodayDate />);
  expect(screen.getByLabelText("今日日期：2026-11-17")).toHaveTextContent("17");
  vi.setSystemTime(new Date(2026, 10, 18, 9));
  act(() => window.dispatchEvent(new Event("focus")));
  expect(screen.getByLabelText("今日日期：2026-11-18")).toHaveTextContent("18");
});
