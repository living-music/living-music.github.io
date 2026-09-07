import { useEffect, useRef } from "preact/hooks";
import { formatTime } from "../audio";
import { Icon } from "../Icon";
import type { PlayerSnapshot, RepeatMode } from "../player";
import { Artwork } from "./Artwork";

function SeekBar({
  player,
  onSeek,
  expanded = false,
}: {
  player: PlayerSnapshot;
  onSeek: (seconds: number) => void;
  expanded?: boolean;
}) {
  const duration = player.duration || 0;
  const progress = Math.min(player.currentTime, duration || player.currentTime);
  return (
    <div class={expanded ? "expanded-progress" : "mini-progress"}>
      <input
        type="range"
        min="0"
        max={duration || 0}
        step="1"
        value={progress}
        disabled={!duration}
        aria-label="Playback position"
        aria-valuetext={`${formatTime(progress)} of ${formatTime(duration)}`}
        onInput={(event) => onSeek(Number(event.currentTarget.value))}
        style={{ "--progress": duration ? `${(progress / duration) * 100}%` : "0%" }}
      />
      {expanded && (
        <div class="expanded-times" aria-hidden="true">
          <span>{formatTime(progress)}</span>
          <span>−{formatTime(Math.max(0, duration - progress))}</span>
        </div>
      )}
    </div>
  );
}

export function MiniPlayer({
  player,
  onToggle,
  onPrevious,
  onNext,
  onSeek,
  onOpen,
}: {
  player: PlayerSnapshot;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onOpen: () => void;
}) {
  if (!player.track) return null;

  const isActive = player.status === "playing" || player.status === "loading";
  const duration = player.duration || 0;
  const progress = Math.min(player.currentTime, duration || player.currentTime);

  return (
    <section class="mini-player" aria-label="Player">
      <SeekBar player={player} onSeek={onSeek} />

      <button id="now-playing-trigger" type="button" class="mini-track" onClick={onOpen} aria-label="Open Now Playing">
        <Artwork url={player.track.artworkUrl} alt="" className="mini-artwork" />
        <span class="mini-copy">
          <strong>{player.track.song.title}</strong>
          <small>{player.track.recording.label} · {player.track.collectionTitle}</small>
        </span>
      </button>

      <span class="player-time elapsed">{formatTime(progress)}</span>
      <div class="mini-controls">
        <button type="button" onClick={onPrevious} aria-label="Previous song" disabled={!player.hasPrevious && progress === 0}>
          <Icon name="previous" size={21} />
        </button>
        <button type="button" class="play-toggle" onClick={onToggle} aria-label={isActive ? "Pause" : "Play"}>
          <Icon name={isActive ? "pause" : "play"} filled={!isActive} size={22} />
        </button>
        <button type="button" onClick={onNext} aria-label="Next song" disabled={!player.hasNext}>
          <Icon name="next" size={21} />
        </button>
      </div>
      <span class="player-time remaining">−{formatTime(Math.max(0, duration - progress))}</span>

      <span class="player-announcement" aria-live="polite">
        {player.error || (player.status === "loading" ? `Loading ${player.track.song.title}` : "")}
      </span>
      {player.error && <p class="player-error" role="alert">{player.error}</p>}
    </section>
  );
}

function repeatLabel(mode: RepeatMode): string {
  return mode === "one" ? "Repeat one" : mode === "all" ? "Repeat all" : "Repeat off";
}

export function NowPlaying({
  open,
  player,
  onClose,
  onToggle,
  onPrevious,
  onNext,
  onSeek,
  onRecordingChange,
  onCycleRepeat,
  onPlayQueueItem,
  onMoveQueueItem,
  onRemoveQueueItem,
  onClearUpNext,
  favorite,
  onToggleFavorite,
}: {
  open: boolean;
  player: PlayerSnapshot;
  onClose: () => void;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onRecordingChange: (recordingId: string) => void;
  onCycleRepeat: () => void;
  onPlayQueueItem: (index: number) => void;
  onMoveQueueItem: (index: number, direction: -1 | 1) => void;
  onRemoveQueueItem: (index: number) => void;
  onClearUpNext: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const controls = sheetRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled)");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !player.track) return null;

  const isActive = player.status === "playing" || player.status === "loading";
  const recordings = player.track.song.recordings;
  const upNext = player.queue.slice(player.currentIndex + 1);

  return (
    <div class="now-playing-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={sheetRef} class="now-playing-sheet" role="dialog" aria-modal="true" aria-labelledby="now-playing-title">
        <header class="now-playing-header">
          <button ref={closeRef} type="button" class="round-button" onClick={onClose} aria-label="Close Now Playing">
            <Icon name="close" size={20} />
          </button>
          <strong id="now-playing-title">Now Playing</strong>
          <div class="now-playing-header-actions">
            <button
              type="button"
              class={`round-button ${favorite ? "is-favorite" : ""}`}
              onClick={onToggleFavorite}
              aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={favorite}
            >
              <Icon name="heart" filled={favorite} size={18} />
            </button>
            <button
              type="button"
              class={`round-button repeat-button ${player.repeatMode !== "off" ? "is-active" : ""}`}
              onClick={onCycleRepeat}
              aria-label={repeatLabel(player.repeatMode)}
              aria-pressed={player.repeatMode !== "off"}
            >
              <Icon name="repeat" size={19} />
              {player.repeatMode === "one" && <span>1</span>}
            </button>
          </div>
        </header>

        <div class="now-playing-body">
          <div class="now-playing-main">
            <Artwork url={player.track.artworkUrl} alt="" className="now-playing-artwork" eager />
            <div class="now-playing-copy">
              <h2>{player.track.song.title}</h2>
              <p>{player.track.collectionTitle}</p>
            </div>

            <label class="recording-picker">
              <span>Recording</span>
              <select
                value={player.track.recording.id}
                onChange={(event) => onRecordingChange(event.currentTarget.value)}
                disabled={recordings.length < 2}
              >
                {recordings.map((recording) => (
                  <option value={recording.id} key={recording.id}>{recording.label}</option>
                ))}
              </select>
            </label>

            <SeekBar player={player} onSeek={onSeek} expanded />

            <div class="expanded-controls">
              <button type="button" onClick={onPrevious} aria-label="Previous song" disabled={!player.hasPrevious && player.currentTime === 0}>
                <Icon name="previous" size={27} />
              </button>
              <button type="button" class="expanded-play" onClick={onToggle} aria-label={isActive ? "Pause" : "Play"}>
                <Icon name={isActive ? "pause" : "play"} filled={!isActive} size={31} />
              </button>
              <button type="button" onClick={onNext} aria-label="Next song" disabled={!player.hasNext}>
                <Icon name="next" size={27} />
              </button>
            </div>
          </div>

          <section class="up-next" aria-labelledby="up-next-title">
            <div class="up-next-heading">
              <div>
                <p class="section-kicker">Queue</p>
                <h2 id="up-next-title">Up Next</h2>
              </div>
              {upNext.length > 0 && <button type="button" onClick={onClearUpNext}>Clear</button>}
            </div>

            {upNext.length ? (
              <ol class="queue-list">
                {upNext.map((track, offset) => {
                  const queueIndex = player.currentIndex + 1 + offset;
                  return (
                    <li class="queue-row" key={`${track.song.id}:${queueIndex}`}>
                      <button
                        type="button"
                        class="queue-track"
                        onClick={() => onPlayQueueItem(queueIndex)}
                        aria-label={`Play ${track.song.title} now`}
                      >
                        <Artwork url={track.artworkUrl} alt="" className="queue-artwork" />
                        <span>
                          <strong>{track.song.title}</strong>
                          <small>{track.recording.label}</small>
                        </span>
                      </button>
                      <div class="queue-actions">
                        <button
                          type="button"
                          onClick={() => onMoveQueueItem(queueIndex, -1)}
                          disabled={offset === 0}
                          aria-label={`Move ${track.song.title} up`}
                        >
                          <Icon name="up" size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveQueueItem(queueIndex, 1)}
                          disabled={offset === upNext.length - 1}
                          aria-label={`Move ${track.song.title} down`}
                        >
                          <Icon name="down" size={17} />
                        </button>
                        <button type="button" onClick={() => onRemoveQueueItem(queueIndex)} aria-label={`Remove ${track.song.title} from queue`}>
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div class="queue-empty">
                <Icon name="queue" size={25} />
                <p>Your queue is empty. Add songs from any collection.</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
