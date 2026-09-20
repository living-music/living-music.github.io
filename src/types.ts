export interface CatalogManifest {
  schemaVersion:number; currentVersion:string; revision:string; href:string;
  multilingual:{schemaVersion:number;revision:string;href:string;languageCount:number};
}
export interface CatalogLanguage { code:string; locale:string; name:string; autonym:string }
export interface CatalogLanguageSummary extends CatalogLanguage {
  revision:string; href:string;
  stats:{collectionCount:number;songCount:number;playableSongCount:number};
}
export interface MultilingualCatalogIndex {
  schemaVersion:number; defaultLanguage:string; languages:CatalogLanguageSummary[]; revision:string;
}
export interface CollectionSummary {
  id:string; slug:string; title:string; artworkUrl?:string|null; sourceUrl:string;
  songCount:number; playableSongCount:number; revision:string; href:string;
  language?:string; languageName?:string; availableLanguages?:string[];
}
export interface CatalogIndex {
  schemaVersion:number; language:CatalogLanguage; collections:CollectionSummary[];
  stats:{collectionCount:number;songCount:number;playableSongCount:number};
  search:{revision:string;href:string;songCount:number}; revision:string;
}
export interface Recording {
  id:string; type:string; label:string; url:string; language:string; durationMs?:number; artworkUrl?:string;
}
export interface Song {
  id:string; slug:string; title:string; number?:string; section?:string; date?:string; artworkUrl?:string|null;
  artists:string[]; authors:string[]; composers:string[]; arrangers:string[]; tags:string[]; sourceUrl?:string;
  recordings:Recording[];
  language?:string; languageName?:string; availableLanguages?:string[];
}
export interface CollectionPayload {
  schemaVersion:number; language?:string; collection:CollectionSummary; songs:Song[]; revision:string;
}
export interface SearchSong {
  id:string; title:string; number?:string; collectionId:string; artists:string[]; recordingTypes:string[];
  language?:string; languageName?:string; availableLanguages?:string[];
}
export interface SearchIndex { schemaVersion:number; language?:string; songs:SearchSong[]; revision:string }
export interface QueueItem { song:Song; recording:Recording; collectionId:string; collectionTitle:string }
