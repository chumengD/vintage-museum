import { setupWorker } from "msw/browser";
import { authHandlers, contentHandlers } from "./handlers";
export const worker = setupWorker(
  ...contentHandlers,
  ...(import.meta.env.VITE_MOCK_AUTH === "true" ? authHandlers : []),
);
