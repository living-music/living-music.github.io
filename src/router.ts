export type Destination = "home" | "browse" | "search" | "library";

export type Route =
  | { page: Destination }
  | { page: "collection"; collectionId: string };

const destinations = new Set<Destination>(["home", "browse", "search", "library"]);

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

  return { page: destinations.has(candidate as Destination) ? candidate as Destination : "home" };
}

export function hrefFor(destination: Destination): string {
  return `#/${destination}`;
}

export function hrefForCollection(collectionId: string): string {
  return `#/collection/${encodeURIComponent(collectionId)}`;
}

export function navigationDestination(route: Route): Destination {
  return route.page === "collection" ? "browse" : route.page;
}
