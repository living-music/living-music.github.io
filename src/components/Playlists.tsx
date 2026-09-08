import { useEffect, useRef, useState } from "preact/hooks";
import { Icon } from "../Icon";
import { hrefForLibrary, hrefForPlaylist } from "../router";
import type { Playlist } from "../storage";

export type PlaylistDialogState =
  | { mode: "create" }
  | { mode: "rename"; playlist: Playlist }
  | { mode: "delete"; playlist: Playlist };

export function PlaylistDialog({
  state,
  onCancel,
  onCreate,
  onRename,
  onDelete,
}: {
  state: PlaylistDialogState;
  onCancel: () => void;
  onCreate: (name: string) => void;
  onRename: (playlistId: string, name: string) => void;
  onDelete: (playlistId: string) => void;
}) {
  const [name, setName] = useState(state.mode === "rename" ? state.playlist.name : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => state.mode === "delete" ? cancelRef.current?.focus() : inputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [state.mode, onCancel]);

  const submit = (event: Event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (state.mode === "create") onCreate(trimmed);
    if (state.mode === "rename") onRename(state.playlist.id, trimmed);
  };

  const title = state.mode === "create" ? "New Playlist" : state.mode === "rename" ? "Rename Playlist" : "Delete Playlist?";

  return (
    <div class="playlist-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section ref={dialogRef} class="playlist-dialog" role="dialog" aria-modal="true" aria-labelledby="playlist-dialog-title">
        <h2 id="playlist-dialog-title">{title}</h2>
        {state.mode === "delete" ? (
          <>
            <p>“{state.playlist.name}” will be removed from this device.</p>
            <div class="playlist-dialog-actions">
              <button ref={cancelRef} type="button" class="playlist-dialog-cancel" onClick={onCancel}>Cancel</button>
              <button type="button" class="playlist-dialog-delete" onClick={() => onDelete(state.playlist.id)}>Delete</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <label for="playlist-name">Name</label>
            <input
              ref={inputRef}
              id="playlist-name"
              value={name}
              maxLength={80}
              onInput={(event) => setName(event.currentTarget.value)}
              autocomplete="off"
            />
            <div class="playlist-dialog-actions">
              <button type="button" class="playlist-dialog-cancel" onClick={onCancel}>Cancel</button>
              <button type="submit" class="playlist-dialog-save" disabled={!name.trim()}>{state.mode === "create" ? "Create" : "Save"}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export function PlaylistsPage({
  playlists,
  favoriteCount,
  onCreate,
}: {
  playlists: Playlist[];
  favoriteCount: number;
  onCreate: () => void;
}) {
  return (
    <div class="page">
      <header class="page-header">
        <p class="eyebrow">Your music</p>
        <h1>Playlists</h1>
        <p class="page-description">Collections you create for the way you listen.</p>
      </header>
      <button type="button" class="primary-action playlist-create-action" onClick={onCreate}>
        <Icon name="add" size={18} /> New Playlist
      </button>
      <div class="playlist-page-list">
        <a href={hrefForLibrary("favorites")}>
          <span class="playlist-artwork playlist-favorites-artwork"><Icon name="heart" filled size={25} /></span>
          <span><strong>Favorites</strong><small>{favoriteCount} {favoriteCount === 1 ? "song" : "songs"} · Smart Playlist</small></span>
          <Icon name="chevron" size={17} />
        </a>
        {playlists.map((playlist) => (
          <a href={hrefForPlaylist(playlist.id)} key={playlist.id}>
            <span class="playlist-artwork"><Icon name="music" size={25} /></span>
            <span><strong>{playlist.name}</strong><small>{playlist.songIds.length} {playlist.songIds.length === 1 ? "song" : "songs"}</small></span>
            <Icon name="chevron" size={17} />
          </a>
        ))}
      </div>
      {!playlists.length && (
        <p class="playlist-list-hint">Create a playlist and it will appear below Favorites in the sidebar.</p>
      )}
    </div>
  );
}

export function PlaylistPage({
  playlist,
  onRename,
  onDelete,
}: {
  playlist: Playlist;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div class="page playlist-page">
      <a class="back-link playlist-mobile-back" href="#/playlists"><Icon name="back" size={18} /> Playlists</a>
      <header class="page-header">
        <p class="eyebrow">Playlist</p>
        <h1>{playlist.name}</h1>
        <p class="page-description">{playlist.songIds.length} {playlist.songIds.length === 1 ? "song" : "songs"}</p>
        <div class="playlist-page-actions">
          <button type="button" onClick={onRename}>Rename</button>
          <button type="button" class="is-destructive" onClick={onDelete}>Delete</button>
        </div>
      </header>
      <section class="empty-state compact playlist-empty">
        <div class="empty-icon"><Icon name="music" size={28} /></div>
        <h2>This playlist is empty.</h2>
        <p>Use this playlist as a home for songs you want to hear together.</p>
        <a class="primary-action" href="#/search">Find music</a>
      </section>
    </div>
  );
}
