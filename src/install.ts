export type InstallMode = "installed" | "prompt" | "ios" | "instructions";
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
export interface InstallSnapshot { mode: InstallMode; prompting: boolean; }
let deferredPrompt: BeforeInstallPromptEvent | undefined;
let started = false;
let snapshot: InstallSnapshot = { mode: detectMode(), prompting: false };
const listeners = new Set<(value: InstallSnapshot) => void>();
function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}
function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function detectMode(): InstallMode { return isStandalone() ? "installed" : isIos() ? "ios" : "instructions"; }
function publish(next: InstallSnapshot): void { snapshot = next; listeners.forEach((listener) => listener(snapshot)); }
export function startInstallTracking(): void {
  if (started) return;
  started = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); deferredPrompt = event as BeforeInstallPromptEvent; publish({ mode: "prompt", prompting: false });
  });
  window.addEventListener("appinstalled", () => { deferredPrompt = undefined; publish({ mode: "installed", prompting: false }); });
}
export function currentInstallSnapshot(): InstallSnapshot { return snapshot; }
export function subscribeToInstall(listener: (value: InstallSnapshot) => void): () => void {
  listeners.add(listener); listener(snapshot); return () => listeners.delete(listener);
}
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  publish({ ...snapshot, prompting: true });
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") deferredPrompt = undefined;
    publish({ mode: deferredPrompt ? "prompt" : detectMode(), prompting: false });
    return choice.outcome;
  } catch { publish({ ...snapshot, prompting: false }); return "unavailable"; }
}
