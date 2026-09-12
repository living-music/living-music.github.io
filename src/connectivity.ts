export type CatalogFailureKind = "offline" | "upstream" | "unsupported" | "invalid";

export interface CatalogFailure {
  kind: CatalogFailureKind;
  message: string;
}

export class CatalogClientError extends Error {
  readonly kind: CatalogFailureKind;

  constructor(kind: CatalogFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CatalogClientError";
    this.kind = kind;
  }
}

export function deviceIsOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function catalogFailure(error: unknown, fallback: string): CatalogFailure {
  if (error instanceof CatalogClientError) return { kind: error.kind, message: error.message };
  return {
    kind: deviceIsOffline() ? "offline" : "upstream",
    message: error instanceof Error ? error.message : fallback,
  };
}
