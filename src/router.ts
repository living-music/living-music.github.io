export type Destination = "home" | "browse" | "search" | "library";

const destinations = new Set<Destination>(["home", "browse", "search", "library"]);

export function routeFromHash(hash: string): Destination {
  const candidate = hash.replace(/^#\/?/, "").split("/")[0] as Destination;
  return destinations.has(candidate) ? candidate : "home";
}

export function hrefFor(destination: Destination): string {
  return `#/${destination}`;
}
