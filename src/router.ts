export type Destination = "home" | "browse" | "search" | "library";
export type LibraryView = "favorites" | "recent" | "albums" | "songs" | "videos" | "downloaded";

export type Route =
  | { page: Exclude<Destination, "library"> }
  | { page: "library"; view: LibraryView }
  | { page: "library-album"; collectionId: string }
  | { page: "playlists" }
  | { page: "playlist"; playlistId: string }
  | { page: "collection"; collectionId: string };

const destinations = new Set<Destination>(["home", "browse", "search", "library"]);
const libraryViews = new Set<LibraryView>(["favorites", "recent", "albums", "songs", "videos", "downloaded"]);

function decoded(value: string): string | undefined {
  try { return decodeURIComponent(value); } catch { return undefined; }
}

export function routeFromHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const candidate = parts[0];

  if (candidate === "collection" && parts[1]) {
    const collectionId = decoded(parts.slice(1).join("/"));
    return collectionId ? { page: "collection", collectionId } : { page: "browse" };
  }

  if (candidate === "library" && parts[1] === "album" && parts[2]) {
    const collectionId = decoded(parts.slice(2).join("/"));
    return collectionId ? { page: "library-album", collectionId } : { page: "library", view: "recent" };
  }

  if (candidate === "library") {
    const view = parts[1] as LibraryView;
    return { page: "library", view: libraryViews.has(view) ? view : "recent" };
  }

  if (candidate === "playlists") return { page: "playlists" };

  if (candidate === "playlist" && parts[1]) {
    const playlistId = decoded(parts.slice(1).join("/"));
    return playlistId ? { page: "playlist", playlistId } : { page: "playlists" };
  }

  return { page: destinations.has(candidate as Destination) ? candidate as Exclude<Destination, "library"> : "browse" };
}

export function hrefFor(destination: Destination): string {
  return destination === "library" ? hrefForLibrary("recent") : `#/${destination}`;
}

export function hrefForLibrary(view: LibraryView): string { return `#/library/${view}`; }
export function hrefForLibraryAlbum(collectionId: string): string { return `#/library/album/${encodeURIComponent(collectionId)}`; }
export function hrefForPlaylist(playlistId: string): string { return `#/playlist/${encodeURIComponent(playlistId)}`; }
export function hrefForCollection(collectionId: string): string { return `#/collection/${encodeURIComponent(collectionId)}`; }

export function navigationDestination(route: Route): Destination {
  if (route.page === "collection") return "browse";
  if (route.page === "library-album" || route.page === "playlist" || route.page === "playlists") return "library";
  return route.page;
}
