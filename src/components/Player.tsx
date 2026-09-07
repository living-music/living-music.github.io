import { formatTime } from "../audio";
import { Icon } from "../Icon";
import type { PlayerSnapshot } from "../player";
import { Artwork } from "./Artwork";

export function MiniPlayer({
  player,
  onToggle,
  onPrevious,
  onNext,
  onSeek,
}: {
  player: PlayerSnapshot;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
}) {
  if (!player.track) return null;

  const isActive = player.status === "playing" || player.status === "loading";
  const duration = player.duration || 0;
  const progress = Math.min(player.currentTime, duration || player.currentTime);

  return (
    <section class="mini-player" aria-label="Player">
      <div class="mini-progress">
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
      </div>

      <div class="mini-track">
        <Artwork url={player.track.artworkUrl} alt="" className="mini-artwork" />
        <span class="mini-copy">
          <strong>{player.track.song.title}</strong>
          <small>{player.track.recording.label} · {player.track.collectionTitle}</small>
        </span>
      </div>

      <span class="player-time elapsed">{formatTime(progress)}</span>
      <div class="mini-controls">
        <button type="button" onClick={onPrevious} aria-label="Previous song" disabled={!player.hasPrevious && progress === 0}>
          <Icon name="previous" size={21} />
        </button>
        <button
          type="button"
          class="play-toggle"
          onClick={onToggle}
          aria-label={isActive ? "Pause" : "Play"}
        >
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
