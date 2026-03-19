import { useEffect, useState } from 'react';

function buildFallbackPoster(title: string) {
  const safeTitle = title.trim() || 'Movie';
  const displayTitle = safeTitle.length > 28 ? `${safeTitle.slice(0, 28)}…` : safeTitle;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480" role="img" aria-label="${safeTitle}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e0f2fe" />
          <stop offset="100%" stop-color="#e2e8f0" />
        </linearGradient>
      </defs>
      <rect width="320" height="480" rx="28" fill="url(#bg)" />
      <rect x="24" y="24" width="272" height="432" rx="22" fill="#ffffff" opacity="0.94" />
      <text x="160" y="170" text-anchor="middle" font-size="26" font-family="sans-serif" fill="#0f172a">Now Showing</text>
      <foreignObject x="42" y="210" width="236" height="170">
        <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;height:100%;align-items:center;justify-content:center;text-align:center;font-family:sans-serif;font-size:24px;line-height:1.45;color:#1e293b;padding:0 8px;word-break:break-word;">
          ${displayTitle}
        </div>
      </foreignObject>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

type PosterImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export function PosterImage({ src, alt, className }: PosterImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src || buildFallbackPoster(alt));

  useEffect(() => {
    setCurrentSrc(src || buildFallbackPoster(alt));
  }, [alt, src]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setCurrentSrc(buildFallbackPoster(alt))}
    />
  );
}
