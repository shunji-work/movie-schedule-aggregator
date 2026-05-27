import { useEffect, useMemo, useState } from 'react';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getImageSources(src: string | string[]) {
  const values = Array.isArray(src) ? src : [src];
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function buildFallbackPoster(title: string) {
  const safeTitle = title.trim() || 'Movie';
  const displayTitle = safeTitle.length > 34 ? `${safeTitle.slice(0, 34)}…` : safeTitle;
  const escapedTitle = escapeHtml(safeTitle);
  const escapedDisplayTitle = escapeHtml(displayTitle);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="${escapedTitle}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#dbeafe" />
          <stop offset="100%" stop-color="#e2e8f0" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#bg)" />
      <text x="320" y="132" text-anchor="middle" font-size="32" font-family="sans-serif" fill="#0f172a">Now Showing</text>
      <foreignObject x="96" y="160" width="448" height="118">
        <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;height:100%;align-items:center;justify-content:center;text-align:center;font-family:sans-serif;font-size:30px;font-weight:700;line-height:1.35;color:#0f172a;padding:0 12px;word-break:break-word;">
          ${escapedDisplayTitle}
        </div>
      </foreignObject>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

type PosterImageProps = {
  src: string | string[];
  alt: string;
  className?: string;
};

export function PosterImage({ src, alt, className }: PosterImageProps) {
  const sources = useMemo(() => getImageSources(src), [src]);
  const sourceKey = sources.join('\n');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(sources[0] || buildFallbackPoster(alt));

  useEffect(() => {
    setCurrentIndex(0);
    setCurrentSrc(sources[0] || buildFallbackPoster(alt));
  }, [alt, sourceKey, sources]);

  const handleError = () => {
    const nextIndex = currentIndex + 1;
    const nextSrc = sources[nextIndex];

    if (nextSrc) {
      setCurrentIndex(nextIndex);
      setCurrentSrc(nextSrc);
      return;
    }

    setCurrentSrc(buildFallbackPoster(alt));
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={handleError}
    />
  );
}
