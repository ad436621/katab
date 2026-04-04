import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Capture PWA install prompt before it disappears
let installPromptEvent: Event | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPromptEvent = e;
  window.dispatchEvent(new CustomEvent("pwa-install-available"));
});

window.addEventListener("appinstalled", () => {
  installPromptEvent = null;
  window.dispatchEvent(new CustomEvent("pwa-installed"));
});

export function getPWAInstallPrompt() { return installPromptEvent; }
export function clearPWAInstallPrompt() { installPromptEvent = null; }

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        });
      })
      .catch((err) => console.warn("[SW] Registration failed:", err));
  });
}
