import { render } from "preact";
import { App } from "./App";
import { registerPwa } from "./pwa";
import "./styles.css";

render(<App />, document.getElementById("app")!);

if (import.meta.env.PROD) {
  void registerPwa().catch((error) => {
    console.error("Living Music service worker registration failed.", error);
  });
}
