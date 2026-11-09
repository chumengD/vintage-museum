import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { authHandlers, contentHandlers, resetDatabase } from "../mocks/handlers";
export const server = setupServer(...authHandlers, ...contentHandlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(async () => {
  cleanup();
  server.resetHandlers();
  await resetDatabase();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});
afterAll(() => server.close());
window.scrollTo = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.setPointerCapture = () => {};
window.HTMLElement.prototype.releasePointerCapture = () => {};
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
