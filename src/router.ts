export type Destination = "home" | "browse" | "search" | "library";
export type LibraryView = "recent" | "albums" | "songs" | "videos";

export type Route =
  | { page: Exclude<Destination, "library"> }
  | { page: "library"; view: LibraryView }
  | { page: "collection"; collectionId: string };

const destinations = new Set<Destination>(["home", "browse", "search", "library"]);
const libraryViews = new Set<LibraryView>(["recent", "albums", "songs", "videos"]);

export function routeFromHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const candidate = parts[0];

  if (candidate === "collection" && parts[1]) {
    try {
      return { page: "collection", collectionId: decodeURIComponent(parts.slice(1).join("/")) };
    } catch {
      return { page: "home" };
    }
  }

  if (candidate === "library") {
    const view = parts[1] as LibraryView;
    return { page: "library", view: libraryViews.has(view) ? view : "recent" };
  }

  return { page: destinations.has(candidate as Destination) ? candidate as Exclude<Destination, "library"> : "home" };
}

export function hrefFor(destination: Destination): string {
  return destination === "library" ? hrefForLibrary("recent") : `#/${destination}`;
}

export function hrefForLibrary(view: LibraryView): string {
  return `#/library/${view}`;
}

export function hrefForCollection(collectionId: string): string {
  return `#/collection/${encodeURIComponent(collectionId)}`;
}

export function navigationDestination(route: Route): Destination {
  return route.page === "collection" ? "browse" : route.page;
}
