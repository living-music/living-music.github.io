import { useEffect, useState } from "preact/hooks";
import { Icon } from "../Icon";

export function Artwork({
  url,
  alt,
  className = "",
  eager = false,
}: {
  url: string | null | undefined;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [url]);

  return (
    <div class={`artwork ${className}`}>
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          class="artwork-fallback"
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
          aria-hidden={alt ? undefined : true}
        >
          <Icon name="music" size={32} />
        </span>
      )}
    </div>
  );
}
