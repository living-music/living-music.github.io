import { Icon } from "../Icon";
import type { DownloadRecord } from "../downloads";

const circumference = 2 * Math.PI * 8;

function labelFor(download: DownloadRecord): string {
  if (download.status === "queued") return "Download queued";
  if (download.status === "downloading") {
    if (download.totalBytes) {
      const percent = Math.round(((download.bytesReceived || 0) / download.totalBytes) * 100);
      return `Downloading, ${percent}%`;
    }
    return "Downloading";
  }
  if (download.status === "downloaded") return "Downloaded";
  if (download.status === "stale") return "Download update available";
  return download.error ? `Download failed: ${download.error}` : "Download failed";
}

export function DownloadStatus({ download }: { download?: DownloadRecord }) {
  if (!download) return <span class="download-status is-empty" aria-hidden="true" />;

  const active = download.status === "queued" || download.status === "downloading";
  const percent = download.totalBytes
    ? Math.max(0, Math.min(100, ((download.bytesReceived || 0) / download.totalBytes) * 100))
    : 0;
  const label = labelFor(download);

  return (
    <span class={`download-status is-${download.status}`} role="img" aria-label={label} title={label}>
      <span class="download-status-glyph">
        {active && (
          <svg class={`download-progress-ring ${download.totalBytes ? "" : "is-indeterminate"}`} viewBox="0 0 20 20" aria-hidden="true">
            <circle class="download-progress-track" cx="10" cy="10" r="8" />
            <circle
              class="download-progress-value"
              cx="10"
              cy="10"
              r="8"
              stroke-dasharray={circumference}
              stroke-dashoffset={download.totalBytes ? circumference * (1 - percent / 100) : undefined}
            />
          </svg>
        )}
        <Icon
          name={download.status === "downloaded" ? "check" : download.status === "failed" ? "close" : "download"}
          size={14}
        />
      </span>
    </span>
  );
}
