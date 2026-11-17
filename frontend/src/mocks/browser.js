import { setupWorker } from "msw/browser";
import { authHandlers, contentHandlers } from "./handlers";
export const worker = setupWorker(...contentHandlers, ...authHandlers);
