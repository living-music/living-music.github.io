export interface PwaSnapshot {
  updateAvailable: boolean;
  applyingUpdate: boolean;
  catalogFallback: boolean;
}

type Listener = (snapshot: PwaSnapshot) => void;

const listeners = new Set<Listener>();
let registration: ServiceWorkerRegistration | undefined;
let waitingWorker: ServiceWorker | undefined;
let reloadForUpdate = false;
let listening = false;
let snapshot: PwaSnapshot = {
  updateAvailable: false,
  applyingUpdate: false,
  catalogFallback: false,
};

function emit(update: Partial<PwaSnapshot>): void {
  snapshot = { ...snapshot, ...update };
  for (const listener of listeners) listener(snapshot);
}

function markUpdateReady(worker: ServiceWorker): void {
  waitingWorker = worker;
  emit({ updateAvailable: true, applyingUpdate: false });
}

function watchInstallingWorker(worker: ServiceWorker): void {
  worker.addEventListener("statechange", () => {
    if (worker.state === "installed" && navigator.serviceWorker.controller) {
      markUpdateReady(worker);
    }
  });
}

function listenForWorkerEvents(): void {
  if (listening) return;
  listening = true;
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type === "LIVING_MUSIC_CATALOG_FALLBACK") {
      emit({ catalogFallback: true });
    } else if (event.data?.type === "LIVING_MUSIC_CATALOG_NETWORK") {
      emit({ catalogFallback: false });
    }
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadForUpdate) window.location.reload();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForPwaUpdate();
  });
}

export function currentPwaSnapshot(): PwaSnapshot {
  return snapshot;
}

export function subscribeToPwa(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

export async function registerPwa(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  listenForWorkerEvents();

  registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });

  if (registration.waiting && navigator.serviceWorker.controller) {
    markUpdateReady(registration.waiting);
  }
  if (registration.installing) watchInstallingWorker(registration.installing);
  registration.addEventListener("updatefound", () => {
    if (registration?.installing) watchInstallingWorker(registration.installing);
  });
}

export async function checkForPwaUpdate(): Promise<void> {
  try {
    await registration?.update();
  } catch {
    // Connectivity UI reports network state; an update check must not disrupt playback.
  }
}

export function applyPwaUpdate(): void {
  const worker = waitingWorker || registration?.waiting;
  if (!worker) return;
  reloadForUpdate = true;
  emit({ applyingUpdate: true });
  worker.postMessage({ type: "LIVING_MUSIC_SKIP_WAITING" });
}
