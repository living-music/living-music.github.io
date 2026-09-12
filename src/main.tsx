import { render } from "preact";
import { App } from "./App";
import { startInstallTracking } from "./install";
import { loadUserState } from "./persistence";
import { registerPwa } from "./pwa";
import "./styles.css";

startInstallTracking();
const pwaRegistration = import.meta.env.PROD ? registerPwa() : Promise.resolve();
const initialPersistence = await loadUserState();
render(<App initialPersistence={initialPersistence} />, document.getElementById("app")!);
void pwaRegistration.catch((error) => console.error("Living Music service worker registration failed.", error));
