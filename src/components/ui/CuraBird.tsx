// CuraBird — the Cura mascot: a plump songbird in the Organic palette
// (moss body, clay wing & tail, fired-clay beak, sand eye). Inline SVG so it
// stays crisp at any size and inherits no page styles.
export function CuraBird({
  className = "",
  title,
}: {
  className?: string;
  /** When provided, the bird is announced to AT as an image; otherwise decorative. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      focusable="false"
    >
      {/* tail — swept back, clay */}
      <path d="M14 31 Q 3 23 0 28 Q 7 30 6 38 Q 11 37 15 40 Z" fill="#694737" />
      {/* body + neck/head silhouette (moss) */}
      <circle cx="40" cy="22" r="10.5" fill="#35422d" />
      <ellipse cx="28" cy="35" rx="17.5" ry="14.5" fill="#35422d" />
      {/* wing — folded, clay */}
      <ellipse
        cx="26"
        cy="36"
        rx="10.5"
        ry="7"
        fill="#694737"
        transform="rotate(-18 26 36)"
      />
      {/* beak — fired-clay */}
      <path d="M48.5 17.5 L60 22.5 L48.5 26.5 Z" fill="#ad7d62" />
      {/* eye — sand dot */}
      <circle cx="43.5" cy="19.5" r="1.9" fill="#eee6d6" />
      {/* legs — tiny porcelain wires */}
      <path
        d="M27 49 L26 56 M33 49 L34 56"
        stroke="#694737"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default CuraBird;
