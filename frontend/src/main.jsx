import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { demoMode } from "./lib/features";

async function bootstrap() {
  if (demoMode) {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledFrame: "bypass", quiet: true });
  } else if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) =>
          [registration.active, registration.waiting, registration.installing].some((worker) =>
            worker?.scriptURL.endsWith("/mockServiceWorker.js"),
          ),
        )
        .map((registration) => registration.unregister()),
    );
  }
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
bootstrap();
