import "./lib/faro";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered: ", registration);
      })
      .catch((registrationError) => {
        console.log("SW registration failed: ", registrationError);
      });

    // Detect standalone via matchMedia or navigator.standalone and notify SW
    const sendStandaloneStatus = () => {
      if (navigator.serviceWorker.controller) {
        const isStandalone =
          globalThis.matchMedia("(display-mode: standalone)").matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true;

        navigator.serviceWorker.controller.postMessage({
          type: "SET_STANDALONE",
          value: isStandalone,
        });
      }
    };

    // Send initially if controlled
    sendStandaloneStatus();

    // Also send when a new service worker takes over
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      sendStandaloneStatus,
    );
  });
}

createRoot(document.getElementById("root")).render(<App />);
