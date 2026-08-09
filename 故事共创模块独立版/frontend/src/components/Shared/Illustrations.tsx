/**
 * Story Co-Create — Decorative Page Illustrations
 * Larger SVG scenes for empty states, page decoration, and key visuals.
 */

interface IlloProps {
  width?: number;
  height?: number;
  className?: string;
}

/* ═══════════════════════════════════════════
   Portal Scene — Storybook gateway
   Used on HomePage as the hero visual
   ═══════════════════════════════════════════ */
export function PortalScene({ width = 360, height = 400, className }: IlloProps) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 360 400" fill="none"
      aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      {/* Sky gradient */}
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="360" y2="400">
          <stop stopColor="#A79AFB" /><stop offset=".4" stopColor="#8DCBFF" /><stop offset="1" stopColor="#FFD1E2" />
        </linearGradient>
        <linearGradient id="moonGlow" x1="230" y1="60" x2="310" y2="140">
          <stop stopColor="#FFF5BA" /><stop offset="1" stopColor="#FFE8A0" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
          <stop stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Bg circle */}
      <circle cx="180" cy="200" r="170" fill="url(#sky)" />
      {/* Clouds */}
      <ellipse cx="120" cy="150" rx="45" ry="16" fill="white" opacity=".35" />
      <ellipse cx="260" cy="120" rx="35" ry="12" fill="white" opacity=".25" />
      {/* Moon */}
      <circle cx="250" cy="90" r="38" fill="url(#moonGlow)" />
      <circle cx="250" cy="90" r="28" fill="#FFF5BA" />
      <circle cx="240" cy="82" r="6" fill="#FFE8A0" opacity=".6" />
      <circle cx="258" cy="95" r="4" fill="#FFE8A0" opacity=".4" />
      <circle cx="245" cy="100" r="3" fill="#FFE8A0" opacity=".5" />
      {/* Stars */}
      <path d="M80 80l4 1-4 1-1 4-1-4-4-1 4-1 1-4 1 4z" fill="white" opacity=".8" />
      <path d="M130 60l3 1-3 1-1 3-1-3-3-1 3-1 1-3 1 3z" fill="white" opacity=".6" />
      <path d="M160 130l3 1-3 1-1 3-1-3-3-1 3-1 1-3 1 3z" fill="white" opacity=".5" />
      <path d="M300 170l3 1-3 1-1 3-1-3-3-1 3-1 1-3 1 3z" fill="white" opacity=".4" />
      <path d="M60 200l2 1-2 1-1 2-1-2-2-1 2-1 1-2 1 2z" fill="white" opacity=".5" />
      {/* Hills */}
      <ellipse cx="180" cy="380" rx="220" ry="80" fill="#8DE1C5" />
      <ellipse cx="100" cy="390" rx="150" ry="70" fill="#72D2B1" />
      <ellipse cx="280" cy="385" rx="130" ry="65" fill="#7ED8BB" />
      {/* Trees */}
      <path d="M60 340l10-30 10 30z" fill="#5AAD8A" opacity=".6" />
      <path d="M300 330l8-25 8 25z" fill="#5AAD8A" opacity=".5" />
      <path d="M320 335l7-20 7 20z" fill="#6AB898" opacity=".5" />
      {/* Open book */}
      <g transform="translate(130, 290)">
        <path d="M0 10c0-5 4-10 10-10h10l-5 5v20l5 5H10c-5 0-10-5-10-20z" fill="#FFF8F0" />
        <path d="M20 0h10c5 0 10 5 10 10s-5 10-10 10H20l5-5V5l-5-5z" fill="#FFECD8" />
        <path d="M15 5v30" stroke="rgba(0,0,0,.06)" strokeWidth="2" />
      </g>
      {/* Sparkles around book */}
      <path d="M105 295l2 1-2 1-1 2-1-2-2-1 2-1 1-2 1 2z" fill="#FFEAA7" />
      <path d="M215 285l2 1-2 1-1 2-1-2-2-1 2-1 1-2 1 2z" fill="#FFD66D" />
      <path d="M160 355l2 1-2 1-1 2-1-2-2-1 2-1 1-2 1 2z" fill="#FFEAA7" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Empty Gallery — No stories yet
   ═══════════════════════════════════════════ */
export function EmptyGalleryIllo({ width = 200, height = 160, className }: IlloProps) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 200 160" fill="none" aria-hidden="true">
      {/* Bookshelf */}
      <rect x="20" y="80" width="160" height="12" rx="3" fill="#D4C8A0" />
      <rect x="20" y="130" width="160" height="12" rx="3" fill="#D4C8A0" />
      {/* Books on top shelf */}
      <rect x="30" y="40" width="16" height="42" rx="3" fill="#FF8FAB" />
      <rect x="48" y="50" width="12" height="32" rx="3" fill="#8ECAE6" />
      <rect x="62" y="35" width="18" height="47" rx="3" fill="#9B8FD4" />
      <rect x="82" y="48" width="14" height="34" rx="3" fill="#7ECFC0" />
      {/* Leaning book */}
      <rect x="100" y="30" width="14" height="52" rx="3" fill="#FFB88C"
        transform="rotate(12 107 56)" />
      <rect x="120" y="42" width="16" height="40" rx="3" fill="#FFE066" />
      {/* Empty space where books are missing */}
      <rect x="148" y="50" width="22" height="32" rx="3" stroke="#D5C8E8"
        strokeWidth="2" strokeDasharray="4 3" fill="none" />
      {/* Books on bottom shelf */}
      <rect x="30" y="90" width="20" height="42" rx="3" fill="#CBC4E8" />
      <rect x="55" y="95" width="14" height="37" rx="3" fill="#FFD4BA" />
      {/* Question mark above empty spot */}
      <text x="155" y="42" fontSize="24" fontWeight="900" fill="#D5C8E8"
        fontFamily="serif">?</text>
      {/* Small star */}
      <path d="M175 20l3 1-3 1-1 3-1-3-3-1 3-1 1-3 1 3z" fill="#FFD66D" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Empty Characters — No characters created
   ═══════════════════════════════════════════ */
export function EmptyCharactersIllo({ width = 200, height = 160, className }: IlloProps) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 200 160" fill="none" aria-hidden="true">
      {/* Shadow/ground */}
      <ellipse cx="100" cy="145" rx="60" ry="8" fill="rgba(155,143,212,.1)" />
      {/* Three silhouettes */}
      {/* Left — tall */}
      <circle cx="55" cy="90" r="22" fill="#D5C8E8" />
      <rect x="43" y="112" width="24" height="30" rx="10" fill="#D5C8E8" />
      {/* Center — medium */}
      <circle cx="100" cy="80" r="25" fill="#E0D8F5" />
      <rect x="86" y="100" width="28" height="40" rx="12" fill="#E0D8F5" />
      {/* Right — small */}
      <circle cx="145" cy="95" r="20" fill="#CBC0E5" />
      <rect x="133" y="115" width="24" height="28" rx="10" fill="#CBC0E5" />
      {/* Question marks */}
      <text x="75" y="70" fontSize="18" fontWeight="900" fill="#BFB8DF"
        fontFamily="serif">?</text>
      <text x="155" y="72" fontSize="16" fontWeight="900" fill="#BFB8DF"
        fontFamily="serif">?</text>
      {/* Plus symbol — "create new" hint */}
      <circle cx="165" cy="120" r="18" fill="#F0EDFF" stroke="#9B8FD4" strokeWidth="2.5" />
      <line x1="165" y1="112" x2="165" y2="128" stroke="#9B8FD4" strokeWidth="2.5"
        strokeLinecap="round" />
      <line x1="157" y1="120" x2="173" y2="120" stroke="#9B8FD4" strokeWidth="2.5"
        strokeLinecap="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Stars Background — for login/channel pages
   ═══════════════════════════════════════════ */
export function StarsBackground({ width = 400, height = 300, className }: IlloProps) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 400 300" fill="none" aria-hidden="true">
      {/* Large star */}
      <path d="M200 40l8 18 20 2-15 14 4 20-17-10-17 10 4-20-15-14 20-2 8-18z"
        fill="#FFD66D" opacity=".25" />
      {/* Medium stars */}
      <path d="M60 80l5 12 14 1-10 10 2 13-11-6-11 6 2-13-10-10 14-1 5-12z"
        fill="#FFEAA7" opacity=".2" />
      <path d="M340 60l4 10 11 1-8 8 2 11-9-5-9 5 2-11-8-8 11-1 4-10z"
        fill="#FFD66D" opacity=".18" />
      {/* Small stars */}
      <path d="M120 120l3 6 7 1-5 5 1 7-5-2-5 2 1-7-5-5 7-1 3-6z"
        fill="#CBC4E8" opacity=".2" />
      <path d="M320 140l3 5 5 1-4 4 1 5-4-2-4 2 1-5-4-4 5-1 3-5z"
        fill="#CBC4E8" opacity=".18" />
      <path d="M80 200l2 5 5 1-3 3 1 5-4-2-4 2 1-5-3-3 5-1 2-5z"
        fill="#FFEAA7" opacity=".15" />
      <path d="M350 200l3 5 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1 3-5z"
        fill="#FFD66D" opacity=".12" />
      <path d="M160 220l2 4 4 1-3 3 1 4-3-2-3 2 1-4-3-3 4-1 2-4z"
        fill="#CBC4E8" opacity=".15" />
      {/* Tiny dots */}
      <circle cx="40" cy="160" r="2" fill="#FFD66D" opacity=".15" />
      <circle cx="280" cy="30" r="1.5" fill="#FFEAA7" opacity=".15" />
      <circle cx="370" cy="120" r="2" fill="#CBC4E8" opacity=".12" />
      <circle cx="30" cy="260" r="1.5" fill="#FFEAA7" opacity=".1" />
      <circle cx="220" cy="250" r="2" fill="#FFD66D" opacity=".12" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Magic Storybook — Open glowing book
   ═══════════════════════════════════════════ */
export function MagicStorybookIllo({ width = 180, height = 140, className }: IlloProps) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 180 140" fill="none" aria-hidden="true">
      {/* Glow behind */}
      <ellipse cx="90" cy="80" rx="70" ry="50" fill="url(#bookGlowBg)" opacity=".4" />
      {/* Left page */}
      <path d="M20 30c0-8 4-15 10-15l55 10v85l-55 10c-6 0-10-7-10-15V30z"
        fill="url(#leftPage)" />
      {/* Right page */}
      <path d="M90 25l55-10c6 0 10 7 10 15v75c0 8-4 15-10 15l-55-10V25z"
        fill="url(#rightPage)" />
      {/* Spine */}
      <line x1="90" y1="25" x2="90" y2="115" stroke="rgba(0,0,0,.06)" strokeWidth="1.5" />
      {/* Page lines (text) */}
      <rect x="30" y="45" width="50" height="3" rx="1.5" fill="rgba(155,143,212,.15)" />
      <rect x="30" y="55" width="50" height="3" rx="1.5" fill="rgba(155,143,212,.1)" />
      <rect x="30" y="65" width="40" height="3" rx="1.5" fill="rgba(155,143,212,.08)" />
      <rect x="30" y="75" width="35" height="3" rx="1.5" fill="rgba(155,143,212,.06)" />
      <rect x="100" y="45" width="50" height="3" rx="1.5" fill="rgba(155,143,212,.15)" />
      <rect x="100" y="55" width="45" height="3" rx="1.5" fill="rgba(155,143,212,.1)" />
      <rect x="100" y="65" width="50" height="3" rx="1.5" fill="rgba(155,143,212,.08)" />
      {/* Sparkles from book */}
      <path d="M60 18l2 1-2 1-1 2-1-2-2-1 2-1 1-2 1 2z" fill="#FFD66D" opacity=".7" />
      <path d="M120 15l2 1-2 1-1 2-1-2-2-1 2-1 1-2 1 2z" fill="#FFEAA7" opacity=".6" />
      <path d="M90 8l2 1-2 1-1 2-1-2-2-1 2-1 1-2 1 2z" fill="#FFD66D" opacity=".5" />
      {/* Star on cover */}
      <path d="M45 105l3 1-3 1-1 3-1-3-3-1 3-1 1-3 1 3z" fill="#FFD66D" opacity=".5" />
      <defs>
        <radialGradient id="bookGlowBg" cx="50%" cy="50%" r="50%">
          <stop stopColor="#FFEAA7" /><stop offset="1" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="leftPage" x1="20" y1="30" x2="90" y2="120">
          <stop stopColor="#FFFDF8" /><stop offset="1" stopColor="#FFF5E8" />
        </linearGradient>
        <linearGradient id="rightPage" x1="90" y1="25" x2="160" y2="120">
          <stop stopColor="#FFF5E8" /><stop offset="1" stopColor="#FFEFD8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Floating Elements — decorative page accents
   ═══════════════════════════════════════════ */
export function FloatingElements({ width = 300, height = 100, className }: IlloProps) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 300 100" fill="none" aria-hidden="true">
      {/* Cloud */}
      <g transform="translate(20, 30)" opacity=".3">
        <ellipse cx="20" cy="12" rx="18" ry="10" fill="white" />
        <ellipse cx="35" cy="8" rx="15" ry="11" fill="white" />
        <ellipse cx="14" cy="8" rx="12" ry="8" fill="white" />
      </g>
      {/* Star */}
      <path d="M120 20l4 8 9 1-6 6 2 9-7-4-7 4 2-9-6-6 9-1 4-8z" fill="#FFD66D" opacity=".25" />
      {/* Circle */}
      <circle cx="230" cy="40" r="12" fill="none" stroke="#CBC4E8" strokeWidth="2" opacity=".3" />
      {/* Dot cluster */}
      <circle cx="260" cy="70" r="3" fill="#FF8FAB" opacity=".2" />
      <circle cx="270" cy="65" r="2" fill="#8ECAE6" opacity=".2" />
      <circle cx="265" cy="78" r="2.5" fill="#7ECFC0" opacity=".15" />
      {/* Plus */}
      <path d="M50 70v8M46 74h8" stroke="#CBC4E8" strokeWidth="2" strokeLinecap="round" opacity=".25" />
      {/* Tiny sparkles */}
      <path d="M180 80l1 1-1 1-1-1-1-1 1-1 1-1 1 1z" fill="#FFEAA7" opacity=".3" />
      <path d="M150 50l1 1-1 1-1-1-1-1 1-1 1-1 1 1z" fill="#CBC4E8" opacity=".25" />
    </svg>
  );
}
