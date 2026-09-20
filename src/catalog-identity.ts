export const DEFAULT_CATALOG_LANGUAGE = "eng";

const LANGUAGE_SEPARATOR = "::";
const QUALIFIED_ID = /^([a-z]{3})::(.+)$/;

export function catalogItemId(language: string, sourceId: string): string {
  if (QUALIFIED_ID.test(sourceId)) return sourceId;
  return `${language}${LANGUAGE_SEPARATOR}${sourceId}`;
}

export function catalogLanguageFromId(id: string): string | undefined {
  return QUALIFIED_ID.exec(id)?.[1];
}

export function catalogSourceId(id: string): string {
  return QUALIFIED_ID.exec(id)?.[2] ?? id;
}

export function migrateCatalogItemId(id: string): string {
  return catalogItemId(DEFAULT_CATALOG_LANGUAGE, id);
}
