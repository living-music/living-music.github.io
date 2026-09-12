import { Icon } from "../Icon";
import type { DownloadRecord } from "../downloads";

const circumference = 2 * Math.PI * 8;

function statusFor(download?: DownloadRecord): string {
  if (!download) return "Not downloaded";
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

function actionFor(title: string, download?: DownloadRecord): string {
  if (!download) return `Download ${title}`;
  if (download.status === "queued") return `Cancel queued download for ${title}`;
  if (download.status === "downloading") return `Cancel download for ${title}`;
  if (download.status === "downloaded") return `Delete download for ${title}`;
  if (download.status === "stale") return `Update download for ${title}`;
  return `Retry download for ${title}`;
}

export function DownloadStatus({
  title,
  download,
  disabled = false,
  onDownload,
  onRemoveDownload,
}: {
  title: string;
  download?: DownloadRecord;
  disabled?: boolean;
  onDownload?: () => void;
  onRemoveDownload?: () => void;
}) {
  const remove = download?.status === "queued" || download?.status === "downloading" || download?.status === "downloaded";
  const active = download?.status === "downloading";
  const percent = download?.totalBytes
    ? Math.max(0, Math.min(100, ((download.bytesReceived || 0) / download.totalBytes) * 100))
    : 0;
  const status = statusFor(download);
  const action = disabled ? `${title}, no download available` : actionFor(title, download);
  const unavailable = disabled || (remove ? !onRemoveDownload : !onDownload);

  return (
    <button
      type="button"
      class={`download-status is-${download?.status || "available"}`}
      onClick={remove ? onRemoveDownload : onDownload}
      disabled={unavailable}
      aria-label={`${action}. ${status}`}
      title={`${action} | ${status}`}
    >
      <span class="download-status-glyph">
        {active && (
          <svg class={`download-progress-ring ${download?.totalBytes ? "" : "is-indeterminate"}`} viewBox="0 0 20 20" aria-hidden="true">
            <circle class="download-progress-track" cx="10" cy="10" r="8" />
            <circle
              class="download-progress-value"
              cx="10"
              cy="10"
              r="8"
              stroke-dasharray={circumference}
              stroke-dashoffset={download?.totalBytes ? circumference * (1 - percent / 100) : undefined}
            />
          </svg>
        )}
        <Icon
          name={download?.status === "downloaded" ? "check" : download?.status === "failed" ? "close" : "download"}
          size={14}
        />
      </span>
    </button>
  );
}
