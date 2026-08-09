/**
 * Story Co-Create — SVG Icon Library
 * Hand-crafted cute icons for children's story experience.
 */

interface IconProps {
  size?: number;
  className?: string;
}

/* ── Star / Sparkle ── */
export function StarIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2l3.5 7.5 8 1-5.5 5.5 1.5 8.5-7.5-4-7.5 4 1.5-8.5L5 10.5l8-1L16 2z"
        fill="url(#starGrad)" />
      <path d="M16 2l3.5 7.5 8 1-5.5 5.5 1.5 8.5-7.5-4-7.5 4 1.5-8.5L5 10.5l8-1L16 2z"
        fill="url(#starShine)" opacity=".4" />
      <defs>
        <linearGradient id="starGrad" x1="5" y1="2" x2="27" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD66D" /><stop offset="1" stopColor="#FFB347" />
        </linearGradient>
        <radialGradient id="starShine" cx="12" cy="8" r="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF8DC" /><stop offset="1" stopColor="#FFD66D" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* ── Sparkle (small decorative) ── */
export function SparkleIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 0l1.2 3.5 3.7.3-2.7 2.6.8 3.6-3-2-3 2 .8-3.6L5 3.8l3.7-.3L10 0z"
        fill="url(#sparkGrad)" opacity=".8" />
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="20" y2="20">
          <stop stopColor="#FFEAA7" /><stop offset="1" stopColor="#FFB88C" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Open Book ── */
export function BookIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 28" fill="none" aria-hidden="true">
      <path d="M3 4c0-1.1.9-2 2-2h5l2 3 2-3h9a2 2 0 012 2v16a2 2 0 01-2 2h-9l-4-2.5L6 22H5a2 2 0 01-2-2V4z"
        fill="url(#bookLeft)" />
      <path d="M16 5l2 3h5V4h-5l-2 3V5z" fill="url(#bookRight)" />
      <path d="M16 5v14.5L12 22V7.5L16 5z" fill="url(#bookSpine)" />
      <line x1="16" y1="9" x2="16" y2="22" stroke="rgba(0,0,0,.08)" strokeWidth=".5" />
      <defs>
        <linearGradient id="bookLeft" x1="0" y1="0" x2="16" y2="28">
          <stop stopColor="#FFE8D6" /><stop offset="1" stopColor="#FFCFA8" />
        </linearGradient>
        <linearGradient id="bookRight" x1="16" y1="5" x2="32" y2="5">
          <stop stopColor="#FFF0E0" /><stop offset="1" stopColor="#FFE8D0" />
        </linearGradient>
        <linearGradient id="bookSpine" x1="16" y1="5" x2="16" y2="20">
          <stop stopColor="rgba(0,0,0,.06)" /><stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Feather Quill ── */
export function QuillIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 32" fill="none" aria-hidden="true">
      <path d="M4 28c4-6 8-10 12-8 3 1.5 5-2 8-7 3-5 2-10-1-11-3-1-6 2-8 6s-2 9-4 10c-2 1-5 2-7 6v4z"
        fill="url(#quillGrad)" />
      <path d="M18 12c1-2 3-4 5-3" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="quillGrad" x1="4" y1="4" x2="26" y2="30">
          <stop stopColor="#CBC4E8" /><stop offset=".5" stopColor="#9B8FD4" /><stop offset="1" stopColor="#7B6EC0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Castle (fairy tale) ── */
export function CastleIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 28" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="24" height="16" rx="1" fill="url(#castleBody)" />
      <rect x="7" y="6" width="4" height="8" rx="1" fill="url(#castleTower)" />
      <rect x="21" y="6" width="4" height="8" rx="1" fill="url(#castleTower)" />
      <rect x="14" y="2" width="4" height="12" rx="1" fill="url(#castleMain)" />
      <rect x="7" y="18" width="6" height="8" rx="1" fill="#5A3E28" />
      <rect x="10" y="20" width="3" height="6" rx=".5" fill="#FFE8C0" />
      <circle cx="27" cy="8" r="1.5" fill="#FFD66D" />
      <circle cx="5" cy="9" r="1" fill="#FFD66D" />
      <defs>
        <linearGradient id="castleBody" x1="4" y1="10" x2="28" y2="26">
          <stop stopColor="#FFD4BA" /><stop offset="1" stopColor="#FFB88C" />
        </linearGradient>
        <linearGradient id="castleTower" x1="7" y1="6" x2="11" y2="14">
          <stop stopColor="#FFE0CC" /><stop offset="1" stopColor="#FFC9A5" />
        </linearGradient>
        <linearGradient id="castleMain" x1="14" y1="2" x2="18" y2="14">
          <stop stopColor="#FFECD8" /><stop offset="1" stopColor="#FFD4BA" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Magic Wand ── */
export function MagicWandIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="6" y="14" width="20" height="4" rx="2" transform="rotate(-45 6 14)"
        fill="url(#wandBody)" />
      <rect x="2" y="10" width="6" height="12" rx="3" transform="rotate(-45 2 10)"
        fill="url(#wandTip)" />
      <circle cx="24" cy="6" r="2" fill="#FFD66D" opacity=".8" />
      <circle cx="20" cy="3" r="1" fill="#FFEAA7" opacity=".6" />
      <circle cx="28" cy="3" r="1.5" fill="#FFD66D" opacity=".7" />
      <circle cx="26" cy="9" r="1" fill="#FFEAA7" opacity=".5" />
      <defs>
        <linearGradient id="wandBody" x1="6" y1="16" x2="24" y2="16">
          <stop stopColor="#9B8FD4" /><stop offset="1" stopColor="#7B6EC0" />
        </linearGradient>
        <linearGradient id="wandTip" x1="0" y1="10" x2="10" y2="12">
          <stop stopColor="#FF8FAB" /><stop offset="1" stopColor="#FF6090" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Rocket ── */
export function RocketIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 32" fill="none" aria-hidden="true">
      <path d="M12 0c-3 4-6 10-7 16s1 12 5 15l2 1 2-1c4-3 6-9 5-15S15 4 12 0z"
        fill="url(#rocketBody)" />
      <ellipse cx="12" cy="14" rx="3" ry="4" fill="rgba(255,255,255,.5)" />
      <path d="M8 26c1-2 3-3 4-3s3 1 4 3" stroke="#D04040" strokeWidth="1.5" strokeLinecap="round"
        fill="none" />
      <circle cx="8" cy="30" r="1.5" fill="#FF8FAB" />
      <circle cx="16" cy="30" r="1.5" fill="#FF8FAB" />
      <defs>
        <linearGradient id="rocketBody" x1="5" y1="0" x2="19" y2="32">
          <stop stopColor="#FFE8E8" /><stop offset=".4" stopColor="#FFD0D0" /><stop offset="1" stopColor="#E88080" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Palette (art/creativity) ── */
export function PaletteIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 28" fill="none" aria-hidden="true">
      <ellipse cx="16" cy="15" rx="14" ry="12" fill="url(#paletteBg)" />
      <circle cx="10" cy="10" r="2" fill="#FF8FAB" />
      <circle cx="18" cy="8" r="2.5" fill="#8ECAE6" />
      <circle cx="24" cy="14" r="2" fill="#7ECFC0" />
      <circle cx="8" cy="18" r="1.8" fill="#FFE066" />
      <circle cx="20" cy="20" r="2" fill="#FFB88C" />
      <circle cx="14" cy="22" r="2.5" fill="#9B8FD4" />
      <path d="M16 3c-6 0-10 5-10 10s3 8 8 9c1 0 2-.5 2-1.5s-.5-2-1-2.5c-.5-.5-1-1.5-1-2.5s1-2 2-2 2 .5 3 .5c2 0 5-2 5-5 0-3-3-6-8-6z"
        fill="url(#paletteHole)" />
      <defs>
        <linearGradient id="paletteBg" x1="2" y1="3" x2="30" y2="27">
          <stop stopColor="#FFECD8" /><stop offset="1" stopColor="#FFD4BA" />
        </linearGradient>
        <radialGradient id="paletteHole" cx="18" cy="10" r="8">
          <stop stopColor="rgba(0,0,0,.06)" /><stop offset="1" stopColor="transparent" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* ── Magnifying Glass (discovery/word lookup) ── */
export function MagnifyIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="url(#magStroke)" strokeWidth="3" fill="none" />
      <line x1="19" y1="19" x2="26" y2="26" stroke="url(#magStroke)" strokeWidth="3.5"
        strokeLinecap="round" />
      <circle cx="10" cy="10" r="2" fill="rgba(155,143,212,.3)" />
      <defs>
        <linearGradient id="magStroke" x1="3" y1="3" x2="26" y2="26">
          <stop stopColor="#9B8FD4" /><stop offset="1" stopColor="#7B6EC0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Shield (safety/protection) ── */
export function ShieldIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 26 32" fill="none" aria-hidden="true">
      <path d="M13 2L2 7v10c0 7 5 11 11 13 6-2 11-6 11-13V7L13 2z"
        fill="url(#shieldGrad)" />
      <path d="M13 8l-5 5 4 4 6-6-5-3z" fill="rgba(255,255,255,.6)" />
      <defs>
        <linearGradient id="shieldGrad" x1="2" y1="2" x2="24" y2="32">
          <stop stopColor="#7ECFC0" /><stop offset="1" stopColor="#5BA89A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Music Note ── */
export function MusicNoteIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 28" fill="none" aria-hidden="true">
      <circle cx="6" cy="22" r="5" fill="url(#noteHead)" />
      <rect x="10" y="2" width="3" height="14" rx="1.5" fill="url(#noteStem)" />
      <path d="M13 2c2 1 4 .5 5-.5" stroke="url(#noteStem)" strokeWidth="2.5" strokeLinecap="round"
        fill="none" />
      <defs>
        <linearGradient id="noteHead" x1="1" y1="17" x2="11" y2="27">
          <stop stopColor="#FFB88C" /><stop offset="1" stopColor="#FF8FAB" />
        </linearGradient>
        <linearGradient id="noteStem" x1="10" y1="2" x2="18" y2="2">
          <stop stopColor="#9B8FD4" /><stop offset="1" stopColor="#CBC4E8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Heart ── */
export function HeartIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 26" fill="none" aria-hidden="true">
      <path d="M14 24C3 17 0 10 0 6s3-6 7-6c2.5 0 5 1.5 7 4 2-2.5 4.5-4 7-4 4 0 7 2 7 6s-3 11-14 18z"
        fill="url(#heartGrad)" />
      <defs>
        <linearGradient id="heartGrad" x1="0" y1="0" x2="28" y2="26">
          <stop stopColor="#FF8FAB" /><stop offset="1" stopColor="#FF6090" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Crown (achievement) ── */
export function CrownIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 24" fill="none" aria-hidden="true">
      <path d="M2 18h28l-3-12-9 6-8-6L4 18z" fill="url(#crownGrad)" />
      <circle cx="5" cy="8" r="2.5" fill="#FFD66D" />
      <circle cx="16" cy="5" r="2.5" fill="#FFD66D" />
      <circle cx="27" cy="8" r="2.5" fill="#FFD66D" />
      <rect x="2" y="18" width="28" height="3" rx="1" fill="#D4A030" />
      <defs>
        <linearGradient id="crownGrad" x1="2" y1="6" x2="30" y2="18">
          <stop stopColor="#FFE066" /><stop offset="1" stopColor="#F0C030" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Telescope (exploration) ── */
export function TelescopeIcon({ size = 24, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 24" fill="none" aria-hidden="true">
      <rect x="6" y="8" width="20" height="8" rx="4" fill="url(#teleBody)" />
      <rect x="2" y="5" width="8" height="14" rx="5" fill="url(#teleLens)" />
      <rect x="22" y="7" width="3" height="10" rx="1.5" fill="#8ECAE6" />
      <line x1="26" y1="2" x2="24" y2="8" stroke="#BFB0E0" strokeWidth="3" strokeLinecap="round" />
      <circle cx="26" cy="2" r="2" fill="#FF8FAB" />
      <defs>
        <linearGradient id="teleBody" x1="6" y1="8" x2="26" y2="8">
          <stop stopColor="#BFB0E0" /><stop offset="1" stopColor="#9B8FD4" />
        </linearGradient>
        <linearGradient id="teleLens" x1="2" y1="5" x2="10" y2="19">
          <stop stopColor="#8ECAE6" /><stop offset="1" stopColor="#6DB0D0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
