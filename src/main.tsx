import { render } from "preact";
import { App } from "./App";
import "./styles.css";
render(<App />,document.getElementById("app")!);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch((error) => console.error("Living Music service worker registration failed.", error));
  }, { once: true });
}
