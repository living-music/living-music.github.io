import { useEffect, useMemo, useRef } from "preact/hooks";
import { createPortal } from "preact/compat";
import { Icon } from "../Icon";
import type { Playlist } from "../storage";
import type { DownloadRecord } from "../downloads";

export interface ContextMenuPosition { x: number; y: number }

export function SongContextMenu({
  songId,
  title,
  position,
  favorite,
  inLibrary,
  libraryActionDisabled = false,
  playlists,
  onFavorite,
  onToggleLibrary,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  download,
  onDownload,
  onRemoveDownload,
  onClose,
}: {
  songId: string;
  title: string;
  position: ContextMenuPosition;
  favorite: boolean;
  inLibrary: boolean;
  libraryActionDisabled?: boolean;
  playlists: Playlist[];
  onFavorite: () => void;
  onToggleLibrary: () => void;
  onPlayNext?: () => void;
  onAddToQueue?: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  download?: DownloadRecord;
  onDownload?: () => void;
  onRemoveDownload?: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPosition = useMemo(() => ({
    left: `${Math.max(8, Math.min(position.x, window.innerWidth - 236))}px`,
    top: `${Math.max(8, Math.min(position.y, window.innerHeight - Math.min(430, 190 + playlists.length * 38)))}px`,
  }), [position.x, position.y, playlists.length]);

  useEffect(() => {
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());
    const close = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      onClose();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const controls = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || [])];
      if (!controls.length) return;
      event.preventDefault();
      const current = controls.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home"
        ? 0
        : event.key === "End"
          ? controls.length - 1
          : (Math.max(0, current) + (event.key === "ArrowDown" ? 1 : -1) + controls.length) % controls.length;
      controls[next].focus();
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("contextmenu", close, true);
    window.addEventListener("keydown", keydown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("contextmenu", close, true);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const run = (action: () => void) => { action(); onClose(); };

  return createPortal(
    <div
      ref={menuRef}
      class="song-context-menu"
      style={menuPosition}
      role="menu"
      aria-label={`Options for ${title}`}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p>{title}</p>
      {onDownload && !download && <button type="button" role="menuitem" onClick={() => run(onDownload)}><Icon name="download" size={17} /> Download</button>}
      {onDownload && download?.status === "failed" && <button type="button" role="menuitem" onClick={() => run(onDownload)}><Icon name="download" size={17} /> Retry Download</button>}
      {onDownload && download?.status === "stale" && <button type="button" role="menuitem" onClick={() => run(onDownload)}><Icon name="download" size={17} /> Update Download</button>}
      {download && (download.status === "queued" || download.status === "downloading") && <button type="button" role="menuitem" disabled><Icon name="download" size={17} /> {download.totalBytes ? `${Math.round(((download.bytesReceived || 0) / download.totalBytes) * 100)}% Downloaded` : download.status === "queued" ? "Queued" : "Downloading…"}</button>}
      {download && onRemoveDownload && <button type="button" role="menuitem" onClick={() => run(onRemoveDownload)}><Icon name="close" size={17} /> {download.status === "queued" || download.status === "downloading" ? "Cancel Download" : download.status === "failed" ? "Remove Failed Download" : "Remove Download"}</button>}
      {onPlayNext && <button type="button" role="menuitem" onClick={() => run(onPlayNext)}><Icon name="next" size={17} /> Play Next</button>}
      {onAddToQueue && <button type="button" role="menuitem" onClick={() => run(onAddToQueue)}><Icon name="queue" size={17} /> Add to End</button>}
      <button type="button" role="menuitem" onClick={() => run(onFavorite)}>
        <Icon name="heart" filled={favorite} size={17} /> {favorite ? "Remove from Favorites" : "Favorite"}
      </button>
      <button type="button" role="menuitem" disabled={libraryActionDisabled} onClick={() => run(onToggleLibrary)}>
        <Icon name={inLibrary ? "check" : "add"} size={17} /> {libraryActionDisabled ? "Included with Album" : inLibrary ? "Remove from Library" : "Add to Library"}
      </button>
      <div class="song-context-playlists">
        <span>Add to Playlist</span>
        {playlists.length ? playlists.map((playlist) => {
          const added = playlist.songIds.includes(songId);
          return (
            <button type="button" role="menuitem" disabled={added} onClick={() => run(() => onAddToPlaylist(playlist.id))} key={playlist.id}>
              <Icon name={added ? "check" : "music"} size={16} /> {playlist.name}
            </button>
          );
        }) : <small>No playlists yet</small>}
      </div>
    </div>,
    document.body,
  );
}
