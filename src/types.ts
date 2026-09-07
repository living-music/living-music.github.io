export interface CatalogManifest { schemaVersion:number; currentVersion:string; revision:string; href:string }
export interface CollectionSummary {
  id:string; slug:string; title:string; artworkUrl:string|null; sourceUrl:string;
  songCount:number; playableSongCount:number; revision:string; href:string;
}
export interface CatalogIndex {
  schemaVersion:number; language:string; collections:CollectionSummary[];
  stats:{collectionCount:number;songCount:number;recordingCount:number};
  search:{revision:string;href:string;songCount:number}; revision:string;
}
export interface Recording {
  id:string; type:string; label:string; url:string; language:string; durationMs?:number; artworkUrl?:string;
}
export interface Song {
  id:string; slug:string; title:string; number?:string; section?:string; date?:string; artworkUrl:string|null;
  artists:string[]; authors:string[]; composers:string[]; arrangers:string[]; tags:string[]; sourceUrl?:string;
  recordings:Recording[];
}
export interface CollectionPayload {
  schemaVersion:number; collection:Omit<CollectionSummary,"href"|"revision">; songs:Song[]; revision:string;
}
export interface SearchSong {
  id:string; title:string; number?:string; collectionId:string; artists:string[]; recordingTypes:string[];
}
export interface SearchIndex { schemaVersion:number; songs:SearchSong[]; revision:string }
export interface QueueItem { song:Song; recording:Recording; collectionId:string; collectionTitle:string }
