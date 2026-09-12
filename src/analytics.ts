import { routeFromHash, type Route } from "./router";

const ANALYTICS_STORAGE_KEY = "livingMusic:analyticsEnabled:v1";
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

type GtagCommand = [command: string, ...arguments_: unknown[]];

declare global {
  interface Window {
    dataLayer?: GtagCommand[];
    gtag?: (...arguments_: GtagCommand) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

let initialized = false;

export function readAnalyticsConsent(): boolean | undefined {
  try {
    const saved = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    return saved === null ? undefined : saved === "true";
  } catch {
    return undefined;
  }
}

export function readAnalyticsEnabled(): boolean {
  return readAnalyticsConsent() === true;
}

function analyticsAvailable(): boolean {
  return import.meta.env.PROD && Boolean(MEASUREMENT_ID);
}

export function isAnalyticsConfigured(): boolean {
  return analyticsAvailable();
}

function command(...arguments_: GtagCommand): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments_);
}

function initializeAnalytics(): void {
  const measurementId = MEASUREMENT_ID;
  if (initialized || !import.meta.env.PROD || !measurementId || !readAnalyticsEnabled()) return;
  initialized = true;
  window[`ga-disable-${measurementId}`] = false;
  window.gtag = command;
  command("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });
  command("js", new Date());
  command("config", measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}

function routeLabel(route: Route): string {
  switch (route.page) {
    case "home": return "Home";
    case "browse": return "Browse";
    case "search": return "Search";
    case "settings": return "Settings";
    case "library": return `Library: ${route.view}`;
    case "library-album": return "Library album";
    case "playlists": return "Playlists";
    case "playlist": return "Playlist";
    case "collection": return "Collection";
  }
}

export function sanitizedAnalyticsPage(hash: string): { title: string; hash: string } {
  const route = routeFromHash(hash);
  const suffix = route.page === "library" ? `/library/${route.view}` : `/${route.page}`;
  return { title: `${routeLabel(route)} · Living Music`, hash: `#${suffix}` };
}

export function startAnalytics(): void {
  initializeAnalytics();
}

export function trackPageView(hash = window.location.hash): void {
  if (!analyticsAvailable() || !readAnalyticsEnabled()) return;
  initializeAnalytics();
  const page = sanitizedAnalyticsPage(hash);
  const pagePath = `${window.location.pathname}${page.hash}`;
  command("event", "page_view", {
    page_title: page.title,
    page_location: `${window.location.origin}${pagePath}`,
    page_path: pagePath,
  });
}

export function setAnalyticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ANALYTICS_STORAGE_KEY, String(enabled));
  } catch {
    return;
  }
  const measurementId = MEASUREMENT_ID;
  if (!import.meta.env.PROD || !measurementId) return;
  window[`ga-disable-${measurementId}`] = !enabled;
  if (!enabled) {
    if (initialized) command("consent", "update", { analytics_storage: "denied" });
    return;
  }
  if (initialized) command("consent", "update", { analytics_storage: "granted" });
  initializeAnalytics();
  trackPageView();
}
